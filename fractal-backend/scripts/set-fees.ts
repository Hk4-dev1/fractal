import * as dotenv from 'dotenv';
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { addr, raw } from './core/env';
import { readOwner, readFees, setFees } from './core/contract';
import { ensureBaseRpcEnv } from './core/bootstrap';
import { logStep, time } from './core/log';

dotenv.config();

async function main(){
  const escrow = addr('ESCROW_ADDRESS');
  const pk = raw('PRIVATE_KEY').replace(/^0x/,'');
  const rpc = raw('ETH_SEPOLIA_RPC_URL'); // assumes sepolia; could be generalized
  ensureBaseRpcEnv();
  const account = privateKeyToAccount(`0x${pk}`);
  const chain = { id:11155111, name:'ethereum-sepolia', network:'ethereum-sepolia', nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18}, rpcUrls:{ default:{ http:[rpc] }, public:{ http:[rpc] } } } as const;
  const wallet = createWalletClient({ account, chain, transport: http(rpc) });
  const pub = createPublicClient({ chain, transport: http(rpc) });

  const owner = await readOwner(pub, escrow);
  if(owner.toLowerCase() !== account.address.toLowerCase()) throw new Error(`Not owner. Owner=${owner} you=${account.address}`);
  const { escrowFee, protocolFee, treasuryEscrow, treasuryProtocol } = await readFees(pub, escrow);
  const newEscrow = BigInt(process.env.NEW_ESCROW_FEE_BPS || '30');
  const newProtocol = BigInt(process.env.NEW_PROTOCOL_FEE_BPS || '5');
  logStep('fees:current', { escrowFee: escrowFee.toString(), protocolFee: protocolFee.toString(), treasuryEscrow, treasuryProtocol });
  logStep('fees:update', { escrowFeeBps: newEscrow.toString(), protocolFeeBps: newProtocol.toString() });
  const hash = await time('setFees', () => setFees(wallet, escrow, newEscrow, newProtocol, treasuryEscrow, treasuryProtocol));
  await pub.waitForTransactionReceipt({ hash });
  logStep('fees:updated', { tx: hash });
}

main().catch(e=>{ console.error(e); process.exitCode=1; });
