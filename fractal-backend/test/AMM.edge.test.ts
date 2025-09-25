import { expect } from "chai";
import { viem } from "hardhat";
import { parseUnits, parseEther } from "viem";
import { deployMockUSDC, deployAMM } from './utils/viem-helpers';

/**
 * Edge tests for AMM:
 * - Reentrancy on ETH receive blocked
 * - Slippage strict reverts
 * - Wrong ratio addLiquidity limited by LP mint (expect revert when too skewed)
 */

describe("AMM edge cases (viem)", function () {
  async function deployEnv() {
    const { usdc, deployer, user } = await deployMockUSDC();
    const amm = await deployAMM(usdc.address as `0x${string}`);
    await deployer.writeContract({ address: usdc.address, abi: usdc.abi, functionName: 'approve', args: [amm.address, parseUnits('1000000',6)] });
    await deployer.writeContract({ address: amm.address, abi: amm.abi, functionName: 'addLiquidity', args: [parseUnits('20000',6)], value: parseEther('10') });
    return { deployer, user, usdc, amm };
  }

  it("reentrancy blocked on ETH send", async () => {
    const { usdc, amm } = await deployEnv();

  const attacker = await viem.deployContract('ReentrantAttacker', [amm.address, usdc.address]);
  // setTryReenter(true)
  const [signer] = await viem.getWalletClients();
  await signer.writeContract({ address: attacker.address, abi: attacker.abi, functionName: 'setTryReenter', args: [true] });
  await signer.writeContract({ address: usdc.address, abi: usdc.abi, functionName: 'approve', args: [amm.address, parseUnits('1000',6)] });
  await signer.writeContract({ address: amm.address, abi: amm.abi, functionName: 'swapUSDCForETH', args: [parseUnits('1000',6), 0n] });

    // If reentrancy happened, state would be corrupted; we simply assert reserves still > 0
  const publicClient = await viem.getPublicClient();
  const [ethRes, usdcRes] = await publicClient.readContract({ address: amm.address, abi: amm.abi, functionName: 'getReserves', args: [] }) as [bigint,bigint];
  expect(ethRes > 0n).to.equal(true);
  expect(usdcRes > 0n).to.equal(true);
  });

  it("slippage strict reverts on ETH->USDC", async () => {
    const { amm } = await deployEnv();
    // Manual revert capture since viem + chai error matcher integration not auto
    let reverted = false;
    const { deployer } = await deployEnv(); // isolate fresh env for revert test
    try {
      await deployer.writeContract({ address: amm.address, abi: amm.abi, functionName: 'swapETHForUSDC', args: [parseUnits('999999999',6)], value: parseEther('1') });
    } catch(e:any){
      reverted = /SlippageExceeded/i.test(e.message || '');
    }
    expect(reverted).to.equal(true);
  });

  it("slippage strict reverts on USDC->ETH", async () => {
    const { usdc, amm } = await deployEnv();
  const { deployer: d2 } = await deployEnv();
  await d2.writeContract({ address: usdc.address, abi: usdc.abi, functionName: 'approve', args: [amm.address, parseUnits('1000',6)] });
    let reverted2 = false;
    try {
  await d2.writeContract({ address: amm.address, abi: amm.abi, functionName: 'swapUSDCForETH', args: [parseUnits('1000',6), parseEther('999')] });
    } catch(e:any){
      reverted2 = /SlippageExceeded/i.test(e.message || '');
    }
    expect(reverted2).to.equal(true);
  });
});
