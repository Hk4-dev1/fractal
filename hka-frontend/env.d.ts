/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEBUG_DEX?: string;
  readonly VITE_FEATURE_CCPAYLOAD?: string;
  readonly VITE_RPC_ETHEREUM_SEPOLIA?: string;
  readonly VITE_RPC_ARBITRUM_SEPOLIA?: string;
  readonly VITE_RPC_OPTIMISM_SEPOLIA?: string;
  readonly VITE_RPC_BASE_SEPOLIA?: string;
  readonly VITE_RPC_ETHEREUM_SEPOLIA_FALLBACKS?: string;
  readonly VITE_RPC_ARBITRUM_SEPOLIA_FALLBACKS?: string;
  readonly VITE_RPC_OPTIMISM_SEPOLIA_FALLBACKS?: string;
  readonly VITE_RPC_BASE_SEPOLIA_FALLBACKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
