// Chain registry abstraction to simplify adding new chains.
// Existing code can continue using CONTRACTS; future code can use this layer
// to support runtime overrides via env vars without editing large objects.

export interface ChainAddresses {
  testETH: string
  testUSDC: string
  orderBookEngine: string
  ammEngine: string
  weth: string
  layerZeroRelay: string
  crossChainEscrow: string
  layerZeroEid: number
}

export interface ChainBaseConfig {
  chainId: number
  name: string
  defaultRpc: string
  explorer: string
  envPrefix: string // e.g. 'SEPOLIA', 'ARBITRUM_SEPOLIA'
  addresses: ChainAddresses
}

// Source of truth (duplicated minimal fields from contracts.ts; kept in sync manually for now)
// NOTE: If you add a new chain, just append an entry here with an envPrefix.
const BASE_CHAINS: ChainBaseConfig[] = [
  {
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    defaultRpc: 'https://eth-sepolia.public.blastapi.io',
    explorer: 'https://sepolia.etherscan.io',
    envPrefix: 'SEPOLIA',
    addresses: {
      testETH: '0xdc1DCA3041ec84d72cCDC3a761B080451AB350AD',
      testUSDC: '0x787a258717489a07a537d1377A0ee14767BB53c4',
      orderBookEngine: '0xBF7784eB164abc8162276D9a5E8FC6D4d81A7B5f',
      ammEngine: '0x963aED7a6A603edc51F2938af0bdFFadEf28e9bC',
      weth: '0x0eA0d0923BC5ac5d17DdEc73Af06FaC1a7816927',
      layerZeroRelay: '0x3307a91941023Cd8eb60fB6C3eBd02E041dd6CB6',
      crossChainEscrow: '0xe09570Ba8fA370467C4bae17bd57D2C8556ddB1a',
      layerZeroEid: 40161
    }
  },
  {
    chainId: 421614,
    name: 'Arbitrum Sepolia',
    defaultRpc: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorer: 'https://sepolia.arbiscan.io',
    envPrefix: 'ARBITRUM_SEPOLIA',
    addresses: {
      testETH: '0xcfa48E2daed3aC8177B752c6825aF47C8c555A79',
      testUSDC: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43',
      orderBookEngine: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13',
      ammEngine: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3',
      weth: '0x8422972b99AD56341C36480CCCA687E11A55662F',
      layerZeroRelay: '0x92cc9842c958D5c1d6c62C4C99DfFC2b7C3f2bcC',
      crossChainEscrow: '0x0b14bEd09a7B9EABe616Ac0dC566F62590c87268',
      layerZeroEid: 40243
    }
  },
  {
    chainId: 11155420,
    name: 'Optimism Sepolia',
    defaultRpc: 'https://sepolia.optimism.io',
    explorer: 'https://sepolia-optimism.etherscan.io',
    envPrefix: 'OPTIMISM_SEPOLIA',
    addresses: {
      testETH: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43',
      testUSDC: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13',
      orderBookEngine: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3',
      ammEngine: '0x5B4Ea2f5D7B676ec7BBe54B6EB9E56DFFb78572F',
      weth: '0x98f406873625ee98Ca9f89B17CE43649A3Ce9DDa',
      layerZeroRelay: '0xEf36682745DE4273D28B17eD2b55F638e0095945',
      crossChainEscrow: '0x0044650c75DC3fF50bB62cA7CBdbd59Cc9CAe91F',
      layerZeroEid: 40232
    }
  },
  {
    chainId: 84532,
    name: 'Base Sepolia',
    defaultRpc: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    envPrefix: 'BASE_SEPOLIA',
    addresses: {
      testETH: '0xcfa48E2daed3aC8177B752c6825aF47C8c555A79',
      testUSDC: '0xE6fD94A1C5200A1104019EaB7116672C70d55e43',
      orderBookEngine: '0x47C67616E56f7aBb0aE021e7F4d1E0D9058CEC13',
      ammEngine: '0xBcaC3a25fA85e5e8b9269b819dB60BC14667e9f3',
      weth: '0x63147A584a0cB4df645B9cB7605B1BD72D46E1E8',
      layerZeroRelay: '0xEf36682745DE4273D28B17eD2b55F638e0095945',
      crossChainEscrow: '0xaba4c0b9335572efF9bb1DB53Eaa556e51ab8A8d',
      layerZeroEid: 40245
    }
  }
]

const byId = new Map<number, ChainBaseConfig>(BASE_CHAINS.map(c => [c.chainId, c]))

export function getRegisteredChainIds(): number[] {
  return Array.from(byId.keys())
}

export interface ChainConfigResolved extends ChainBaseConfig {
  effectiveRpc: string
  overrides: { rpc?: string; addresses: Partial<ChainAddresses> }
}

export function getChainConfig(chainId: number): ChainConfigResolved | undefined {
  const base = byId.get(chainId)
  if (!base) return undefined
  const overrides: ChainConfigResolved['overrides'] = { addresses: {} }
  // Allow env override for RPC via VITE_RPC_<ENV_PREFIX>
  const rpcVar = `VITE_RPC_${base.envPrefix}`
  const envAny = import.meta.env as unknown as Record<string, string | undefined>
  const rpcOverride = envAny[rpcVar]
  if (rpcOverride) overrides.rpc = rpcOverride
  // Allow each address override: pattern VITE_<ENV_PREFIX>_<ADDRESS_KEY>_ADDRESS (matching existing style)
  for (const key of Object.keys(base.addresses) as (keyof ChainAddresses)[]) {
    if (key === 'layerZeroEid') continue
  const envKey = `VITE_${base.envPrefix}_${key.toUpperCase()}_ADDRESS`
  const v = envAny[envKey]
    if (v) overrides.addresses[key] = v
  }
  const effectiveRpc = overrides.rpc || base.defaultRpc
  return { ...base, effectiveRpc, overrides }
}

export function registerChain(cfg: ChainBaseConfig) {
  if (byId.has(cfg.chainId)) throw new Error(`Chain ${cfg.chainId} already registered`) 
  byId.set(cfg.chainId, cfg)
}

export function unregisterChain(chainId: number) {
  byId.delete(chainId)
}

// Convenience: snapshot all configs with applied overrides
export function listChainConfigs(): ChainConfigResolved[] {
  return getRegisteredChainIds().map(id => getChainConfig(id)!).filter(Boolean)
}
