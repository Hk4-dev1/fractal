import { Badge } from './ui/badge';
import { Text } from './ui/text';
import {
  Home,
  Zap,
  ArrowUpDown,
  User,
  Network
} from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  darkMode: boolean;
}

export function Sidebar({ activeSection, setActiveSection }: SidebarProps) {
  const menuItems = [
    { id: 'homepage', label: 'Overview', icon: Home, count: 0 },
  { id: 'spot', label: 'Swap', icon: ArrowUpDown, count: 0, description: 'Spot & Cross-Chain' },
  { id: 'crosschain', label: 'Swap (Alt)', icon: Network, count: 0, description: 'Same UI' },
    { id: 'futures', label: 'Futures', icon: Zap, count: 0, description: 'Perpetual Futures' },
    { id: 'portfolio', label: 'Portfolio', icon: User, count: 0 }
  ];

  const prefetch = (id: string) => {
    // Prefetch lazy chunks for smoother navigation
    switch (id) {
      case 'homepage':
        import('../components/Homepage');
        break;
      case 'spot':
      case 'crosschain':
        import('../components/SpotTradingNew');
        break;
      case 'futures':
        import('../components/PerpetualFutures');
        break;
      case 'portfolio':
        import('../components/Portfolio');
        break;
      default:
        break;
    }
  };

  // Prefetch when nav enters viewport
  // Using direct refs on buttons via callback to avoid ref array complexity
  const onRefAttach = (id: string) => (el: HTMLButtonElement | null) => {
    if (!el || typeof IntersectionObserver === 'undefined') return;
    let did = false;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !did) {
          did = true;
          prefetch(id);
          io.disconnect();
          break;
        }
      }
    }, { rootMargin: '200px' });
    io.observe(el);
  };

  return (
    <div className="fixed left-0 top-20 h-[calc(100vh-5rem)] w-[240px] bg-background border-r border-border overflow-y-auto z-40">
      <div className="p-4">
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const IconComponent = item.icon;

            return (
              <button
                key={item.id}
                ref={onRefAttach(item.id)}
                onClick={() => setActiveSection(item.id)}
                onMouseEnter={() => prefetch(item.id)}
                onFocus={() => prefetch(item.id)}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-lg transition-all duration-200 ${
                  activeSection === item.id
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <IconComponent className="h-5 w-5 flex-shrink-0" />
                  <div className="text-left">
                    <Text variant="button" className="font-medium text-sm">
                      {item.label}
                    </Text>
                    {item.description && (
                      <Text variant="bodySm" className="text-xs text-muted-foreground mt-0.5">
                        {item.description}
                      </Text>
                    )}
                  </div>
                </div>
                {item.count > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {item.count}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}