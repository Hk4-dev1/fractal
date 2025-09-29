/// <reference types="vite/client" />

// Minimal EIP-1193 provider typing to avoid importing from ethers
interface Eip1193ProviderLike {
  request<T = unknown>(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<T>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193ProviderLike;
  }
}

export {};
