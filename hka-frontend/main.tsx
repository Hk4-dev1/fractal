import React from 'react'
import ReactDOM from 'react-dom/client'
import { Suspense, lazy, useState, useEffect } from 'react'
import App from './App.tsx'
import './styles/globals.css'
import { validateContracts } from './services/contracts.validate'

// Lazy wrapper to mount wagmi only when user interacts (e.g., presses Connect Wallet event)
const LazyWagmi = lazy(async () => {
  const wagmi = await import('wagmi')
  const cfg = await import('./src/config/wagmi')
  return { default: ({ children }: { children: React.ReactNode }) => <wagmi.WagmiConfig config={cfg.wagmiConfig}>{children}</wagmi.WagmiConfig> }
})

function Root() {
  const [useWalletLayer, setUseWalletLayer] = useState(false)
  useEffect(() => {
    // Dev-time contract config validation
    if (import.meta.env?.MODE === 'development') {
      try {
        const issues = validateContracts()
        if (issues.length) {
          console.warn('[contracts.validate] Potential config issues:', issues)
        }
      } catch (e) {
        console.warn('[contracts.validate] validation failed:', e)
      }
    }
    // Heuristic: if user has injected provider OR previously connected (localStorage flag), enable immediately
    const hasEth = typeof window !== 'undefined' && (window as unknown as { ethereum?: object }).ethereum;
    if (hasEth || localStorage.getItem('hka_last_wallet_connect') === '1') {
      setUseWalletLayer(true)
    }
    const onIntent = () => setUseWalletLayer(true)
    window.addEventListener('hka:wallet-intent', onIntent)
    return () => window.removeEventListener('hka:wallet-intent', onIntent)
  }, [])
  if (!useWalletLayer) {
    return <App />
  }
  return (
    <Suspense fallback={<App />}> {/* fallback keeps UI responsive */}
      <LazyWagmi><App /></LazyWagmi>
    </Suspense>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)