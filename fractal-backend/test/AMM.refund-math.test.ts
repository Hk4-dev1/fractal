import { expect } from "chai";
import { viem } from "hardhat";
import { parseUnits, parseEther } from 'viem';
import { deployMockUSDC, deployAMM, AMM_ABI } from './utils/viem-helpers';
import { expectSingleEvent } from './utils/assert';

function mulDiv(a: bigint, b: bigint, d: bigint): bigint { return (a * b) / d; }

describe("AMM refunds and math (viem)", function () {
  async function setup() {
    const { usdc, deployer, user } = await deployMockUSDC();
    const amm = await deployAMM(usdc.address as `0x${string}`);
    await deployer.writeContract({ address: usdc.address, abi: usdc.abi, functionName: 'approve', args: [amm.address, parseUnits('1000000',6)] });
    await deployer.writeContract({ address: amm.address, abi: amm.abi, functionName: 'addLiquidity', args: [parseUnits('20000',6)], value: parseEther('10') });
    const publicClient = await viem.getPublicClient();
    return { deployer, user, usdc, amm, publicClient };
  }

  it("refunds extra USDC when ETH is the limiting side", async () => {
    const { user, usdc, amm } = await setup();

  const publicClient = await viem.getPublicClient();
  const userUsdcStart = await publicClient.readContract({ address: usdc.address, abi: usdc.abi, functionName: 'balanceOf', args: [user.account.address] }) as bigint;

    // Ratio is 2000 USDC per 1 ETH; provide 1 ETH + 3000 USDC -> expect ~1000 USDC refund
  await user.writeContract({ address: usdc.address, abi: usdc.abi, functionName: 'approve', args: [amm.address, parseUnits('3000',6)] });
  await user.writeContract({ address: amm.address, abi: amm.abi, functionName: 'addLiquidity', args: [parseUnits('3000',6)], value: parseEther('1') });

  const userUsdcEnd = await publicClient.readContract({ address: usdc.address, abi: usdc.abi, functionName: 'balanceOf', args: [user.account.address] }) as bigint;
    const spent = userUsdcStart - userUsdcEnd;
  expect(spent).to.equal(parseUnits("2000", 6));
  });

  it("refunds extra ETH when USDC is the limiting side", async () => {
    const { user, usdc, amm } = await setup();

  // Provide 0.6 ETH + 500 USDC; requiredETH for 500 USDC at ratio 2000/1 = 0.25 ETH
  await user.writeContract({ address: usdc.address, abi: usdc.abi, functionName: 'approve', args: [amm.address, parseUnits('500',6)] });
  const txHash = await user.writeContract({ address: amm.address, abi: amm.abi, functionName: 'addLiquidity', args: [parseUnits('500',6)], value: parseEther('0.6') });
  const ev = await expectSingleEvent(txHash, AMM_ABI as any, 'LiquidityAdded');
  // Required ETH for 500 USDC at initial ratio 2000:1 is 0.25 ETH
  expect(ev.ethAmount).to.equal(parseEther('0.25'));
  expect(ev.usdcAmount).to.equal(parseUnits('500',6));
  });

  it("fee math matches expected on ETH->USDC swap", async () => {
    const { user, usdc, amm } = await setup();

    // Read reserves
  const publicClient3 = await viem.getPublicClient();
  const [ethRes0, usdcRes0] = await publicClient3.readContract({ address: amm.address, abi: amm.abi, functionName: 'getReserves', args: [] }) as [bigint,bigint];
    const feeBps = 30n;
  const amountIn = parseEther("1");
    const amountInAfterFee = mulDiv(amountIn, 10000n - feeBps, 10000n);
    const k = ethRes0 * usdcRes0;
    const newEth = ethRes0 + amountInAfterFee;
    const newUsdc = k / newEth;
    const expectedOut = usdcRes0 - newUsdc;

  const usdcStart = await publicClient3.readContract({ address: usdc.address, abi: usdc.abi, functionName: 'balanceOf', args: [user.account.address] }) as bigint;
  await user.writeContract({ address: amm.address, abi: amm.abi, functionName: 'swapETHForUSDC', args: [0n], value: amountIn });
  const usdcEnd = await publicClient3.readContract({ address: usdc.address, abi: usdc.abi, functionName: 'balanceOf', args: [user.account.address] }) as bigint;

    expect(usdcEnd - usdcStart).to.equal(expectedOut);
  });

  it("reverts on zero amounts", async () => {
    const { amm } = await setup();
  // manual revert assertions
  let r1=false; try { await (await viem.getWalletClients())[0].writeContract({ address: amm.address, abi: amm.abi, functionName: 'swapUSDCForETH', args: [0n, 0n] }); } catch(e:any){ r1=/InvalidAmount/i.test(e.message||''); }
  let r2=false; try { await (await viem.getWalletClients())[0].writeContract({ address: amm.address, abi: amm.abi, functionName: 'removeLiquidity', args: [0n] }); } catch(e:any){ r2=/InvalidAmount/i.test(e.message||''); }
  expect(r1).to.equal(true);
  expect(r2).to.equal(true);
  });
});
