import * as dotenv from "dotenv";
import { createWalletClient, http, createPublicClient, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { logStep } from './core/log';

dotenv.config();

function ensure(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing env ${name}`);
  return v.trim();
}

function toRouterEnv(chainKey: string): string {
  switch (chainKey) {
    case "ethereum-sepolia": return "ROUTERV2_ETH_SEPOLIA";
    case "arbitrum-sepolia": return "ROUTERV2_ARB_SEPOLIA";
    case "optimism-sepolia": return "ROUTERV2_OP_SEPOLIA";
    case "base-sepolia": return "ROUTERV2_BASE_SEPOLIA";
    default: throw new Error(`Unknown CHAIN_KEY: ${chainKey}`);
  }
}

function toRpcEnv(chainKey: string): string {
  switch (chainKey) {
    case "ethereum-sepolia": return "ETH_SEPOLIA_RPC_URL";
    case "arbitrum-sepolia": return "ARB_SEPOLIA_RPC_URL";
    case "optimism-sepolia": return "OP_SEPOLIA_RPC_URL";
    case "base-sepolia": return "BASE_SEPOLIA_RPC_URL";
    default: throw new Error(`Unknown CHAIN_KEY: ${chainKey}`);
  }
}

// Minimal chain metadata objects (only what viem needs for typing)
function buildChain(id: number, name: string, rpc: string) {
  return {
    id,
    name,
    network: name.replace(/\s+/g, "-"),
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpc] }, public: { http: [rpc] } },
  } as const;
}

function resolveChain(chainKey: string, rpc: string) {
  switch (chainKey) {
    case "ethereum-sepolia": return buildChain(11155111, "ethereum-sepolia", rpc);
    case "arbitrum-sepolia": return buildChain(421614, "arbitrum-sepolia", rpc);
    case "optimism-sepolia": return buildChain(11155420, "optimism-sepolia", rpc);
    case "base-sepolia": return buildChain(84532, "base-sepolia", rpc);
    default: throw new Error(`Unsupported CHAIN_KEY ${chainKey}`);
  }
}

async function main() {
  const chainKey = ensure("CHAIN_KEY");
  const pk = ensure("PRIVATE_KEY").replace(/^0x/, "");
  const routerAddr = ensure(toRouterEnv(chainKey));
  const rpc = ensure(toRpcEnv(chainKey));

  const chain = resolveChain(chainKey, rpc);
  const account = privateKeyToAccount(`0x${pk}`);

  const walletClient = createWalletClient({ account, chain, transport: http(rpc) });
  const publicClient = createPublicClient({ chain, transport: http(rpc) });

  logStep('delegate:set:start', { chainKey, router: routerAddr, delegate: account.address });

  // whitelist: minimal single-function ABI (guard test allows <=2 functions but still flags parseAbi; retained for clarity)
  const delegateAbi = parseAbi(['function setDelegate(address _delegate)']);
  const hash = await walletClient.writeContract({
    address: routerAddr as `0x${string}`,
  abi: delegateAbi,
  functionName: "setDelegate",
    args: [account.address],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  logStep('delegate:set:confirmed', { tx: hash });
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
