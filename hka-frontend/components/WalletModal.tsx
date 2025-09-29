// Wallet Connection Modal Component
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Wallet, ExternalLink, AlertTriangle, Loader2 } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import type { NetworkInfo } from '../services/wallet';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { 
    isConnected, 
    isConnecting, 
    chainId, 
    networkName,
    isSupported,
    connect, 
    disconnect,
    switchNetwork,
    getSupportedNetworks,
    getShortAddress,
    getFormattedBalance
  } = useWallet();

  // Lightweight provider detection for user feedback
  type InjectedProvider = { isMetaMask?: boolean; providers?: InjectedProvider[] }
  const injected: InjectedProvider | undefined = typeof window !== 'undefined' ? (window as unknown as { ethereum?: InjectedProvider }).ethereum : undefined;
  const providers: InjectedProvider[] | undefined = injected?.providers;
  const metaMaskDetected = providers ? providers.some((p) => !!p?.isMetaMask) : !!injected?.isMetaMask;

  const handleConnect = async () => {
    try {
  try { window.dispatchEvent(new Event('hka:wallet-intent')); } catch {
        /* non-blocking: dispatch hint may fail in some browsers */
      }
      await connect();
      onClose();
    } catch (error) {
      // Error is already handled by the hook
      console.error('Connection failed:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      onClose();
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  const handleNetworkSwitch = async (targetChainId: number) => {
    try {
      await switchNetwork(targetChainId);
    } catch (error) {
      console.error('Network switch failed:', error);
    }
  };

  const supportedNetworks = getSupportedNetworks();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Wallet Connection
          </DialogTitle>
          <DialogDescription>
            Connect your wallet to start trading on HKA DEX
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isConnected ? (
            // Connection Section
            <div className="space-y-4">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                  <Wallet className="w-8 h-8 text-primary" />
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold">Connect MetaMask</h3>
                  <p className="text-sm text-muted-foreground">
                    Connect your MetaMask wallet to access trading features
                  </p>
                </div>

                <Button 
                  onClick={handleConnect} 
                  disabled={isConnecting}
                  className="w-full"
                  size="lg"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-4 h-4 mr-2" />
                      Connect MetaMask
                    </>
                  )}
                </Button>

                <div className="text-[11px] text-muted-foreground mt-2">
                  {injected
                    ? (metaMaskDetected ? 'MetaMask detected' : 'Injected wallet detected')
                    : 'No injected wallet detected'}
                </div>
              </div>

              <div className="text-xs text-muted-foreground text-center space-y-2">
                <p>Don&apos;t have MetaMask?</p>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="text-xs"
                >
                  <a 
                    href="https://metamask.io/download/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    Download MetaMask
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            // Connected Section
            <div className="space-y-4">
              {/* Account Info */}
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Account</span>
                  <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                    Connected
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Address</span>
                    <span className="text-sm font-mono">{getShortAddress()}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Balance</span>
                    <span className="text-sm font-medium">{getFormattedBalance(4)} ETH</span>
                  </div>
                </div>
              </div>

              {/* Network Info */}
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Network</span>
                  {isSupported ? (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                      Supported
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Unsupported
                    </Badge>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Current</span>
                    <span className="text-sm">{networkName}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Chain ID</span>
                    <span className="text-sm font-mono">{chainId}</span>
                  </div>
                </div>

                {!isSupported && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">
                      Switch to a supported network:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {supportedNetworks.slice(0, 4).map((network: NetworkInfo) => (
                        <Button
                          key={network.chainId}
                          variant="outline"
                          size="sm"
                          onClick={() => handleNetworkSwitch(network.chainId)}
                          className="text-xs"
                        >
                          {network.name.split(' ')[0]}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Close
                </Button>
                <Button variant="destructive" onClick={handleDisconnect} className="flex-1">
                  Disconnect
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletModal;
