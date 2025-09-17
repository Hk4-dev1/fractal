#!/usr/bin/env node
// validate-amounts.mjs
// Quick sanity checks for amount parsing/formatting and constant product AMM math.
// Usage: node scripts/validate-amounts.mjs
// Exits non-zero if any check fails.

import { parseUnits, formatUnits } from 'ethers';

function parseAmount(amount, decimals) {
	if (!amount || amount.trim() === '') return 0n;
	const norm = normalize(amount, decimals);
	return parseUnits(norm, decimals);
}

function formatAmount(raw, decimals, maxDecimals = decimals) {
	try {
		const v = typeof raw === 'string' ? BigInt(raw) : raw;
		const out = formatUnits(v, decimals);
		if (maxDecimals < decimals) {
			const [w, d = ''] = out.split('.');
			if (!d) return w;
			return d.length <= maxDecimals ? out : `${w}.${d.slice(0, maxDecimals)}`;
		}
		return out;
	} catch {
		return '0';
	}
}

function normalize(val, decimals) {
	const trimmed = val.trim();
	if (!trimmed.includes('.')) return trimmed;
	const [w, d] = trimmed.split('.');
	if (d.length <= decimals) return trimmed;
	return `${w}.${d.slice(0, decimals)}`;
}

const failures = [];

function assertEqual(label, a, b) {
	if (a !== b) {
		failures.push(`${label}: expected ${b} got ${a}`);
	}
}

// Test 1: Truncation
const dec = 6;
const input = '1.123456789';
const parsed = parseAmount(input, dec);
const formatted = formatAmount(parsed, dec, 6);
assertEqual('truncate->format', formatted, '1.123456');

// Test 2: Empty / zero
assertEqual('empty string parse', parseAmount('', dec).toString(), '0');
assertEqual('zero format', formatAmount(0n, dec), '0.0');

// Constant product AMM math check
// x * y = k, feeBps on input (deducted). amountOut = (y * amountInWithFee) / (x + amountInWithFee)
function cpQuote(x, y, amountIn, feeBps = 30n, feeDenom = 10000n) {
	const amountInWithFee = amountIn * (feeDenom - feeBps) / feeDenom;
	const numerator = y * amountInWithFee;
	const denominator = x + amountInWithFee;
	return numerator / denominator;
}

const ONE = 10n ** 18n;
const reserveX = 1000n * ONE;
const reserveY = 5000n * ONE;
const amountIn = 10n * ONE;
const out = cpQuote(reserveX, reserveY, amountIn);

// Mid price vs execution price impact
const midPrice = Number(reserveY) / Number(reserveX); // 5
const execPrice = Number(out) / Number(amountIn);
const impactPct = ((midPrice - execPrice) / midPrice) * 100;
if (!(impactPct > 0 && impactPct < 2)) {
	failures.push(`price impact out of expected small range: ${impactPct.toFixed(4)}%`);
}

// Invariance approximate: (x+amountIn)*(y-out) ~ k
const kOrig = reserveX * reserveY;
const kNew = (reserveX + amountIn) * (reserveY - out);
const slip = Number((kNew > kOrig ? kNew - kOrig : kOrig - kNew) * 1000000n / kOrig) / 1e6;
if (slip > 0.005) { // 0.005% tolerance
	failures.push(`Constant product invariant drift > 0.005% (${slip}%)`);
}

// Large trade edge case
const bigIn = 900n * ONE; // large portion of pool
const bigOut = cpQuote(reserveX, reserveY, bigIn);
if (bigOut >= reserveY) failures.push('big trade outputs entire reserve (invalid)');

// Report
if (failures.length) {
	console.error('\n❌ Validation failures:');
	for (const f of failures) console.error(' -', f);
	process.exit(1);
} else {
	console.log('✅ Amount & AMM math validations passed');
	console.log('Parsed truncated example:', formatted, parsed.toString());
	console.log('Sample quote amountOut:', formatUnits(out, 18));
	console.log('Price impact %:', impactPct.toFixed(4));
	console.log('Invariant drift %:', slip);
}

