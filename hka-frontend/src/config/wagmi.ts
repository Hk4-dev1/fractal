import { createConfig, configureChains } from 'wagmi'
import { arbitrumSepolia, baseSepolia, optimismSepolia, sepolia } from 'wagmi/chains'
import { publicProvider } from 'wagmi/providers/public'
import { InjectedConnector } from 'wagmi/connectors/injected'

const chains = [sepolia, arbitrumSepolia, optimismSepolia, baseSepolia]

const { publicClient, webSocketPublicClient } = configureChains(chains, [publicProvider()])

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [new InjectedConnector({ chains: [...chains] })],
  publicClient,
  webSocketPublicClient,
})
