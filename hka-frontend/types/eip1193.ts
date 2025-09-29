// Shared EIP-1193 types used across services
export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on?: {
    (event: 'accountsChanged', listener: (accounts: string[]) => void): void
    (event: 'chainChanged', listener: (chainId: string) => void): void
    (event: 'connect', listener: (info: { chainId: string }) => void): void
    (event: 'disconnect', listener: (error: unknown) => void): void
  }
  removeListener?: {
    (event: 'accountsChanged', listener: (accounts: string[]) => void): void
    (event: 'chainChanged', listener: (chainId: string) => void): void
    (event: 'connect', listener: (info: { chainId: string }) => void): void
    (event: 'disconnect', listener: (error: unknown) => void): void
  }
  isMetaMask?: boolean
  providers?: Eip1193Provider[]
}

export function isEip1193Provider(val: unknown): val is Eip1193Provider {
  return !!val && typeof val === 'object' && 'request' in (val as object) && typeof (val as { request?: unknown }).request === 'function'
}
