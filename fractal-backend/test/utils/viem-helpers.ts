import { viem } from 'hardhat';
import { parseUnits, parseEther } from 'viem';

export async function deployMockUSDC(total?: bigint){
  const c = await viem.deployContract('MockUSDC', ['MockUSDC','mUSDC',6, 0]);
  const [w0, w1] = await viem.getWalletClients();
  await w0.writeContract({ address: c.address, abi: c.abi, functionName: 'mint', args: [w0.account.address, parseUnits('1000000',6)] });
  await w0.writeContract({ address: c.address, abi: c.abi, functionName: 'mint', args: [w1.account.address, parseUnits('1000000',6)] });
  return { usdc: c, deployer: w0, user: w1 };
}

export async function deployAMM(usdcAddr: `0x${string}`){
  return viem.deployContract('AMM', [usdcAddr, 30n, 'Fractal LP','fLP']);
}

export async function approveMax(token: { address: `0x${string}`; abi: any }, owner: any, spender: `0x${string}`){
  await owner.writeContract({ address: token.address, abi: token.abi, functionName: 'approve', args: [spender, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')] });
}

export async function deployAMMWithLiquidity(usdcAddr: `0x${string}`, usdcAmount: bigint, ethAmount: bigint) {
  const amm = await deployAMM(usdcAddr);
  const [deployer] = await viem.getWalletClients();
  await deployer.writeContract({ address: amm.address, abi: amm.abi, functionName: 'approve', args: [amm.address, usdcAmount] }).catch(()=>{}); // ignore if no approve needed
  await deployer.writeContract({ address: amm.address, abi: amm.abi, functionName: 'addLiquidity', args: [usdcAmount], value: ethAmount });
  return amm;
}

export const AMM_ABI = [
  { type: 'event', name: 'LiquidityAdded', inputs: [
      { name: 'provider', type: 'address', indexed: true },
      { name: 'ethAmount', type: 'uint256', indexed: false },
      { name: 'usdcAmount', type: 'uint256', indexed: false }
    ]
  },
  { type: 'event', name: 'SwapExecuted', inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'tokenIn', type: 'address', indexed: false },
      { name: 'tokenOut', type: 'address', indexed: false },
      { name: 'amountIn', type: 'uint256', indexed: false },
      { name: 'amountOut', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint256', indexed: false }
    ]
  }
] as const;

export { parseUnits, parseEther };
