import * as dotenv from "dotenv";
import { viem } from "hardhat";
import { zeroAddress } from "viem";
import { logStep, time } from './core/log';
import { isDryRun } from './core/flags';

dotenv.config();

async function main() {
  const [deployer] = await viem.getWalletClients();
  const deployerAddr = deployer.account.address;
  logStep('deploy:init', { deployer: deployerAddr, dryRun: isDryRun });

  const escrowFeeBps = 30; // 0.30%
  const protocolFeeBps = 5; // 0.05%
  const treasuryEscrow = process.env.TREASURY_ESCROW ?? zeroAddress;
  const treasuryProtocol = process.env.TREASURY_PROTOCOL ?? zeroAddress;
  if (treasuryEscrow === zeroAddress || treasuryProtocol === zeroAddress) {
    throw new Error("Missing treasuries in env (TREASURY_ESCROW / TREASURY_PROTOCOL)");
  }

  let escrowAddr: string; let escrowAbi: any;
  if(isDryRun){
    escrowAddr = '0x000000000000000000000000000000000000E5c0';
    logStep('deploy:escrow:skip');
  } else {
    const escrow = await time('deploy:EscrowCore', () => viem.deployContract("EscrowCore", [
      deployerAddr,
      BigInt(escrowFeeBps),
      BigInt(protocolFeeBps),
      treasuryEscrow,
      treasuryProtocol
    ]));
    escrowAddr = escrow.address; escrowAbi = escrow.abi;
    logStep('deploy:escrow:ok', { address: escrowAddr });
  }

  let routerAddr: string; let routerAbi: any;
  if(isDryRun){
    routerAddr = '0x000000000000000000000000000000000000r007';
    logStep('deploy:router:skip');
  } else {
    const router = await time('deploy:SimpleRouter', () => viem.deployContract("SimpleRouter", [escrowAddr, deployerAddr]));
    routerAddr = router.address; routerAbi = router.abi;
    logStep('deploy:router:ok', { address: routerAddr });
  }

  if(!isDryRun){
    await time('escrow:setRouter', () => deployer.writeContract({ address: escrowAddr as `0x${string}`, abi: escrowAbi, functionName: "setRouter", args: [routerAddr] }));
    logStep('escrow:setRouter', { escrow: escrowAddr, router: routerAddr });
  }
  logStep('deploy:complete', { escrow: escrowAddr, router: routerAddr });
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
