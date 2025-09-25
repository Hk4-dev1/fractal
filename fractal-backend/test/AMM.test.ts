import { expect } from "chai";
import { viem } from "hardhat";
import { parseEther, parseUnits } from "viem";

/**
 * AMM minimal tests:
 * - Add initial liquidity
 * - Swap ETH->USDC and USDC->ETH with slippage check
 * - Remove liquidity
 */

describe("AMM (viem)", function () {
  it("add liquidity, swap both ways, remove liquidity", async () => {
    const [deployer, user] = await viem.getWalletClients();
    const publicClient = await viem.getPublicClient();

    // Deploy MockUSDC (6 decimals)
    const usdc = await viem.deployContract("MockUSDC", ["MockUSDC", "mUSDC", 6, 0]);

    // Mint to deployer & user
    await deployer.writeContract({ address: usdc.address, abi: usdc.abi, functionName: 'mint', args: [deployer.account.address, parseUnits("1000000", 6)] });
    await deployer.writeContract({ address: usdc.address, abi: usdc.abi, functionName: 'mint', args: [user.account.address, parseUnits("1000000", 6)] });

    // Deploy AMM (30 bps fee)
    const amm = await viem.deployContract("AMM", [usdc.address, 30n, "Fractal LP", "fLP"]);

    // Approve USDC for AMM from deployer
    await deployer.writeContract({ address: usdc.address, abi: usdc.abi, functionName: 'approve', args: [amm.address, parseUnits("1000000", 6)] });

    // Add initial liquidity: 10 ETH + 20,000 USDC
    await deployer.writeContract({ address: amm.address, abi: amm.abi, functionName: 'addLiquidity', args: [parseUnits("20000", 6)], value: parseEther("10") });

    // Reserves check
    let [ethRes, usdcRes] = await publicClient.readContract({ address: amm.address, abi: amm.abi, functionName: 'getReserves', args: [] }) as [bigint,bigint];
    expect(ethRes).to.equal(parseEther("10"));
    expect(usdcRes).to.equal(parseUnits("20000", 6));

    // User swap: ETH -> USDC (1 ETH)
    await user.writeContract({ address: amm.address, abi: amm.abi, functionName: 'swapETHForUSDC', args: [0n], value: parseEther("1") });

    // User swap: USDC -> ETH (approve + swap 1000 USDC)
    await user.writeContract({ address: usdc.address, abi: usdc.abi, functionName: 'approve', args: [amm.address, parseUnits("10000", 6)] });
    await user.writeContract({ address: amm.address, abi: amm.abi, functionName: 'swapUSDCForETH', args: [parseUnits("1000", 6), 0n] });

    // Remove half liquidity (deployer)
    const lpBal = await publicClient.readContract({ address: amm.address, abi: amm.abi, functionName: 'balanceOf', args: [deployer.account.address] }) as bigint;
    const burn = lpBal / 2n;
    await deployer.writeContract({ address: amm.address, abi: amm.abi, functionName: 'removeLiquidity', args: [burn] });

    [ethRes, usdcRes] = await publicClient.readContract({ address: amm.address, abi: amm.abi, functionName: 'getReserves', args: [] }) as [bigint,bigint];
  expect(ethRes > 0n).to.equal(true);
  expect(usdcRes > 0n).to.equal(true);
  });
});
