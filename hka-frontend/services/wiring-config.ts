// Read-only wiring config for LayerZero v2 health checks (testnets)
export const LZV2_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f";

export type WiringEntry = {
  id: string;
  name: string;
  chainId: number;
  eid: number;
  rpcEnv: keyof ImportMetaEnv;
  router: string;
  escrow: string;
};

export const WIRING_ENTRIES: WiringEntry[] = [
  {
    id: 'ethereum',
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    eid: 40161,
    rpcEnv: 'VITE_RPC_ETHEREUM_SEPOLIA',
    router: '0xb77078E1d22F9390441C84ab0C00f656311b224e',
    escrow: '0xb04057fD0dAF231A16BE26a566F762b24D602816',
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    eid: 40243,
    rpcEnv: 'VITE_RPC_ARBITRUM_SEPOLIA',
    router: '0x3D1D6bc8D8Af01Bff8751b03636c317e3B464b0D',
    escrow: '0x02f93dcCF6F93D170c622AE391315c2e90a1e628',
  },
  {
    id: 'optimism',
    name: 'Optimism Sepolia',
    chainId: 11155420,
    eid: 40232,
    rpcEnv: 'VITE_RPC_OPTIMISM_SEPOLIA',
    router: '0x005D2E2fcDbA0740725E848cc1bCc019823f118C',
    escrow: '0x238a9a6A716B393C5B93EA52B1D99d0283212157',
  },
  {
    id: 'base',
    name: 'Base Sepolia',
    chainId: 84532,
    eid: 40245,
    rpcEnv: 'VITE_RPC_BASE_SEPOLIA',
    router: '0x68bAB827101cD4C55d9994bc738f2ED8FfAB974F',
    escrow: '0x83d705e272dDc2811CE87CD35b0Ec4bA52cF3D23',
  },
];
