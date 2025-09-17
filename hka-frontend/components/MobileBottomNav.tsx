import { Home, TrendingUp, Zap, User } from 'lucide-react';

interface MobileBottomNavProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

export function MobileBottomNav({ activeSection, setActiveSection }: MobileBottomNavProps) {
  const navItems = [
    { id: 'homepage', label: 'Home', icon: Home },
    { id: 'spot', label: 'Spot', icon: TrendingUp },
    { id: 'futures', label: 'Futures', icon: Zap },
    { id: 'portfolio', label: 'Portfolio', icon: User },
  ];

  const prefetch = (id: string) => {
    switch (id) {
      case 'homepage':
        import('../components/Homepage');
        break;
      case 'spot':
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
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border z-50">
      <div className="flex justify-around items-center py-2 px-2 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              ref={onRefAttach(item.id)}
              onClick={() => setActiveSection(item.id)}
              onMouseEnter={() => prefetch(item.id)}
              onFocus={() => prefetch(item.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors min-w-0 flex-1 ${
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={18} />
              <span className="text-xs mt-1 truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}