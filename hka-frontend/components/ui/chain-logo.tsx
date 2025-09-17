import { CHAIN_LOGOS, LOGO_SIZES } from '../../constants/chains';
import { ImageWithFallback } from '../figma/ImageWithFallback';
// Prefer user-provided PNGs if available
import ethPng from '../../logo/ethereum.png';
import arbPng from '../../logo/arbitrum.png';
import opPng from '../../logo/optimism.png';
import basePng from '../../logo/base.png';

const PNG_LOGOS: Record<string, string | undefined> = {
  ethereum: ethPng,
  arbitrum: arbPng,
  optimism: opPng,
  base: basePng,
};

interface ChainLogoProps {
  chainId: string;
  size?: keyof typeof LOGO_SIZES;
  className?: string;
  showName?: boolean;
  showStatus?: boolean;
  status?: 'active' | 'inactive' | 'maintenance' | 'error';
}

export function ChainLogo({ 
  chainId, 
  size = 'md', 
  className = '',
  showName = false,
  showStatus = false,
  status = 'active'
}: ChainLogoProps) {
  const chain = CHAIN_LOGOS[chainId as keyof typeof CHAIN_LOGOS];
  
  if (!chain) {
    return (
      <div className={`${LOGO_SIZES[size]} bg-gray-200 rounded-full flex items-center justify-center ${className}`}>
        <span className="text-xs text-gray-500">?</span>
      </div>
    );
  }

  const sizePx = ((): number => {
    switch (size) {
      case 'xs': return 16
      case 'sm': return 20
      case 'md': return 24
      case 'lg': return 32
      case 'xl': return 48
      case '2xl': return 64
      default: return 24
    }
  })()

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Logo Container */}
      <div className="relative">
    { (PNG_LOGOS[chainId] || chain.logo) ? (
          <div className={`${LOGO_SIZES[size]} rounded-full overflow-hidden bg-white ring-1 ring-black/5 flex items-center justify-center`}>
      <ImageWithFallback src={PNG_LOGOS[chainId] || chain.logo} alt={`${chain.name} logo`} style={{ width: sizePx, height: sizePx }} />
          </div>
        ) : (
          <div 
            className={`${LOGO_SIZES[size]} rounded-full flex items-center justify-center`}
            style={{ backgroundColor: chain.color + '20' }}
          >
            <span 
              className="font-bold text-xs"
              style={{ color: chain.color }}
            >
              {chain.symbol.charAt(0)}
            </span>
          </div>
        )}

        {/* Status Indicator */}
        {showStatus && (
          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white`}>
            <div className={`w-full h-full rounded-full ${
              status === 'active' ? 'bg-green-500' : 
              status === 'maintenance' ? 'bg-yellow-500' :
              status === 'error' ? 'bg-red-500' : 'bg-gray-400'
            }`} />
          </div>
        )}
      </div>
      
      {/* Chain Name */}
      {showName && (
        <span className="font-medium text-sm">{chain.name}</span>
      )}
    </div>
  );
}

// Gradient Badge Version
interface ChainBadgeProps {
  chainId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ChainBadge({ chainId, size = 'md', className = '' }: ChainBadgeProps) {
  const chain = CHAIN_LOGOS[chainId as keyof typeof CHAIN_LOGOS];
  
  if (!chain) return null;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm', 
    lg: 'px-4 py-2 text-base'
  };

  return (
    <div className={`
      inline-flex items-center gap-2 rounded-full font-medium
      bg-gradient-to-r ${chain.gradient}
      text-white shadow-sm
      ${sizeClasses[size]}
      ${className}
    `}>
      <span className="font-bold">{chain.symbol.charAt(0)}</span>
      <span>{chain.name}</span>
    </div>
  );
}
