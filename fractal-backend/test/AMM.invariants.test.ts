import { expect } from "chai";
import { viem } from "hardhat";
import { parseUnits, parseEther } from 'viem';
import { deployMockUSDC, deployAMM, AMM_ABI } from './utils/viem-helpers';
import { expectSingleEvent } from './utils/assert';

describe("AMM invariants and events (viem)", function () {
  async function setup() {
    const { usdc, deployer, user } = await deployMockUSDC();
    const amm = await deployAMM(usdc.address as `0x${string}`);
    await deployer.writeContract({ address: usdc.address, abi: usdc.abi, functionName: 'approve', args: [amm.address, parseUnits('1000000',6)] });
    await deployer.writeContract({ address: amm.address, abi: amm.abi, functionName: 'addLiquidity', args: [parseUnits('20000',6)], value: parseEther('10') });
    const publicClient = await viem.getPublicClient();
    return { deployer, user, usdc, amm, publicClient };
  }

  it("product k increases after swaps due to fees", async () => {
  const { user, amm, usdc } = await setup();
  // ensure user has allowance for USDC leg swap
  await user.writeContract({ address: usdc.address, abi: usdc.abi, functionName: 'approve', args: [amm.address, parseUnits('10000',6)] });
    const publicClient = await viem.getPublicClient();
    const [e0, u0] = await publicClient.readContract({ address: amm.address, abi: amm.abi, functionName: 'getReserves', args: [] }) as [bigint,bigint];
    const k0 = e0 * u0;

    await user.writeContract({ address: amm.address, abi: amm.abi, functionName: 'swapETHForUSDC', args: [0n], value: parseEther('1') });
    let [e1, u1] = await publicClient.readContract({ address: amm.address, abi: amm.abi, functionName: 'getReserves', args: [] }) as [bigint,bigint];
    const k1 = e1 * u1;
  expect(k1 > k0).to.equal(true);

  // Determine a USDC amount after first swap that still fits reserves
  const usdcAllowanceNeeded = parseUnits('1000',6);
  // Top-up USDC allowance (some tokens may reset allowance pattern)
  await user.writeContract({ address: usdc.address, abi: usdc.abi, functionName: 'approve', args: [amm.address, usdcAllowanceNeeded] });
  await user.writeContract({ address: amm.address, abi: amm.abi, functionName: 'swapUSDCForETH', args: [usdcAllowanceNeeded, 0n] });
    const [e2, u2] = await publicClient.readContract({ address: amm.address, abi: amm.abi, functionName: 'getReserves', args: [] }) as [bigint,bigint];
    const k2 = e2 * u2;
  expect(k2 > k1).to.equal(true);
  });

  it("remove all liquidity drains pool and zeroes supply", async () => {
    const { deployer, amm } = await setup();
    const publicClient = await viem.getPublicClient();
    const total = await publicClient.readContract({ address: amm.address, abi: amm.abi, functionName: 'balanceOf', args: [deployer.account.address] }) as bigint;
    await deployer.writeContract({ address: amm.address, abi: amm.abi, functionName: 'removeLiquidity', args: [total] });
    const [e, u] = await publicClient.readContract({ address: amm.address, abi: amm.abi, functionName: 'getReserves', args: [] }) as [bigint,bigint];
  expect(e).to.equal(0n);
  expect(u).to.equal(0n);
    const ts = await publicClient.readContract({ address: amm.address, abi: amm.abi, functionName: 'totalSupply', args: [] }) as bigint;
    expect(ts).to.equal(0n);
  });

  it("emits SwapExecuted with correct token addresses", async () => {
    const { user, amm, usdc } = await setup();
    const ev1 = await expectSingleEvent(
      await user.writeContract({ address: amm.address, abi: amm.abi, functionName: 'swapETHForUSDC', args: [0n], value: parseEther('1') }),
      AMM_ABI as any,
      'SwapExecuted'
    );
    expect(ev1.tokenIn).to.equal('0x0000000000000000000000000000000000000000');
  expect(ev1.tokenOut.toLowerCase()).to.equal(usdc.address.toLowerCase());

  // Approve received USDC back to AMM for reverse swap
  const publicClient = await viem.getPublicClient();
  const userUsdcBal = await publicClient.readContract({ address: usdc.address, abi: usdc.abi, functionName: 'balanceOf', args: [user.account.address] }) as bigint;
  await user.writeContract({ address: usdc.address, abi: usdc.abi, functionName: 'approve', args: [amm.address, userUsdcBal] });

    const ev2 = await expectSingleEvent(
      await user.writeContract({ address: amm.address, abi: amm.abi, functionName: 'swapUSDCForETH', args: [parseUnits('1000',6), 0n] }),
      AMM_ABI as any,
      'SwapExecuted'
    );
  expect(ev2.tokenIn.toLowerCase()).to.equal(usdc.address.toLowerCase());
    expect(ev2.tokenOut).to.equal('0x0000000000000000000000000000000000000000');
  });

  it("getLPBalance mirrors ERC20 balanceOf", async () => {
    const { deployer, amm } = await setup();
    const publicClient = await viem.getPublicClient();
    const a = await publicClient.readContract({ address: amm.address, abi: amm.abi, functionName: 'getLPBalance', args: [deployer.account.address] }) as bigint;
    const b = await publicClient.readContract({ address: amm.address, abi: amm.abi, functionName: 'balanceOf', args: [deployer.account.address] }) as bigint;
  expect(a).to.equal(b);
  });
});
