import { useState } from 'react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Text } from './ui/text';
import { Sun, Moon, Wallet, Menu } from 'lucide-react';
import { useIsMobile } from './ui/use-mobile';
import HkaLogo from '../logo/HKA-LOGO.svg';
import { useWallet } from '../hooks/useWallet';
import { WalletModal } from './WalletModal';

interface HeaderProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  onMenuClick?: () => void;
}

export function Header({ darkMode, toggleDarkMode, onMenuClick }: HeaderProps) {
  const { 
    isConnected, 
    getShortAddress
  } = useWallet();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const isMobile = useIsMobile();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 md:h-20 bg-card border-b border-border px-4 md:px-6 py-2 md:py-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center gap-2 md:gap-3">
          {isMobile && onMenuClick && (
            <Button variant="ghost" size="icon" onClick={onMenuClick} className="mr-2">
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div 
            className="w-8 h-8 md:w-12 md:h-12 rounded-full overflow-hidden shadow-md hover:shadow-lg transition-shadow"
          >
            <img 
              src={HkaLogo} 
              alt="HKA-DEX Logo" 
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          {!isMobile && (
            <div>
              <Text variant="h4" className="font-bold">
                HKA-DEX
              </Text>
              <Text variant="caption" className="text-muted-foreground">
                Decentralized Exchange Platform
              </Text>
            </div>
          )}
          {isMobile && (
            <Text variant="h5" className="font-bold">
              HKA-DEX
            </Text>
          )}
        </div>

        {/* Right Side Controls */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Connect Wallet */}
          <Button 
            onClick={() => setShowWalletModal(true)}
            className={`transition-all duration-200 shadow-lg hover:shadow-xl ${
              darkMode 
                ? 'bg-black hover:bg-gray-900 text-white' 
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            }`}
            size={isMobile ? "sm" : "default"}
          >
            <Wallet className="h-4 w-4 mr-1 md:mr-2" />
            {isMobile ? (
              isConnected ? getShortAddress() : 'Connect'
            ) : (
              isConnected ? getShortAddress() : 'Connect Wallet'
            )}
          </Button>

          {/* Theme Toggle */}
          {!isMobile && (
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-foreground" />
              <Switch checked={darkMode} onCheckedChange={toggleDarkMode} />
              <Moon className="h-4 w-4 text-foreground" />
            </div>
          )}
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
              {darkMode ? <Sun className="h-4 w-4 text-foreground" /> : <Moon className="h-4 w-4 text-foreground" />}
            </Button>
          )}
        </div>
      </div>
      
      {/* Wallet Modal */}
      <WalletModal 
        isOpen={showWalletModal} 
        onClose={() => setShowWalletModal(false)} 
      />
    </header>
  );
}