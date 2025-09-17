#!/usr/bin/env node
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
const cwd = process.cwd()
const envPath = path.resolve(cwd, '.env')
const stat = fs.statSync(envPath)
const raw = fs.readFileSync(envPath, 'utf8')
const result = dotenv.config({ path: envPath })
console.log('cwd:', cwd)
console.log('envPath:', envPath)
console.log('size:', stat.size)
console.log('dotenvError:', result.error ? result.error.message : null)
console.log('parsed keys:', Object.keys(result.parsed || {}))
console.log('Has PRIVATE_KEY:', !!process.env.PRIVATE_KEY)
console.log('PRIVATE_KEY prefix:', (process.env.PRIVATE_KEY||'').slice(0,6))
const idx = raw.indexOf('PRIVATE_KEY')
if (idx >= 0) {
	const snippet = raw.slice(Math.max(0, idx - 20), idx + 60)
	console.log('raw snippet around PRIVATE_KEY:', JSON.stringify(snippet))
	const line = raw.split(/\r?\n/).find(l => l.includes('PRIVATE_KEY'))
	console.log('line:', JSON.stringify(line))
	console.log('char codes:', Array.from(line || '').map(c=>c.charCodeAt(0)))
}
