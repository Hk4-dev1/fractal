import { useState, useEffect, lazy, Suspense } from 'react';
import SidebarSkeleton from './components/skeletons/SidebarSkeleton';
import MobileNavSkeleton from './components/skeletons/MobileNavSkeleton';
import HomepageSkeleton from './components/skeletons/HomepageSkeleton';
import SpotSkeleton from './components/skeletons/SpotSkeleton';
import PortfolioSkeleton from './components/skeletons/PortfolioSkeleton';
import { DEXProvider } from './contexts/DEXContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
const Footer = lazy(() => import('./components/Footer').then(m => ({ default: m.Footer })));
const Sidebar = lazy(() => import('./components/Sidebar').then(m => ({ default: m.Sidebar })));
const MobileBottomNav = lazy(() => import('./components/MobileBottomNav').then(m => ({ default: m.MobileBottomNav })));
const Homepage = lazy(() => import('./components/Homepage').then(m => ({ default: m.Homepage })));
const SpotTradingNew = lazy(() => import('./components/SpotTradingNew').then(m => ({ default: m.SpotTradingNew })));
const PerpetualFutures = lazy(() => import('./components/PerpetualFutures').then(m => ({ default: m.PerpetualFutures })));
const Portfolio = lazy(() => import('./components/Portfolio').then(m => ({ default: m.Portfolio })));
const NotificationCenter = lazy(() => import('./components/NotificationCenter').then(m => ({ default: m.NotificationCenter })));
import { useIsMobile } from './components/ui/use-mobile';
const ToasterLazy = lazy(() => import('sonner').then(m => ({ default: m.Toaster })));

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeSection, setActiveSection] = useState('homepage');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('hka-dex-dark-mode');
    if (savedDarkMode) {
      setDarkMode(JSON.parse(savedDarkMode));
    }
  }, []);

  // Apply dark mode class and save to localStorage
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.body.classList.toggle('dark', darkMode);
    localStorage.setItem('hka-dex-dark-mode', JSON.stringify(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Idle prefetch for likely next routes
  useEffect(() => {
    const w = globalThis as unknown as { requestIdleCallback?: typeof requestIdleCallback };
    const ric: typeof requestIdleCallback | undefined = w.requestIdleCallback;
    const schedule = (fn: () => void) => {
      if (typeof ric === 'function') {
        ric(fn, { timeout: 1500 });
      } else {
        setTimeout(fn, 500);
      }
    };
  const doPrefetch = () => {
      // Naive heuristic: from homepage → spot, from spot → portfolio, otherwise homepage
      const next = activeSection === 'homepage' ? 'spot'
        : activeSection === 'spot' || activeSection === 'crosschain' ? 'portfolio'
        : 'homepage';
      switch (next) {
        case 'homepage':
          import('./components/Homepage');
          break;
        case 'spot':
          import('./components/SpotTradingNew');
          break;
        case 'portfolio':
          import('./components/Portfolio');
          break;
        default:
          break;
      }
      // Also prefetch notifications lazily
      import('./components/NotificationCenter');
      // And prefetch futures screen when likely (from homepage/spot)
      if (activeSection === 'homepage' || activeSection === 'spot') {
        import('./components/PerpetualFutures')
      }
    };
    schedule(doPrefetch);
  }, [activeSection]);

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'homepage':
        return <Homepage />;
      case 'spot':
        return <SpotTradingNew />;
      case 'crosschain':
        // Unified: reuse 1inch-style panel for both same-chain and cross-chain
        return <SpotTradingNew />;
      case 'futures':
        return <PerpetualFutures />;
      case 'portfolio':
        return <Portfolio />;
      default:
        return <Homepage />;
    }
  };

  return (
    <ErrorBoundary>
      <DEXProvider>
        <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
          <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <Header
              darkMode={darkMode}
              toggleDarkMode={toggleDarkMode}
              onMenuClick={() => setSidebarOpen(!sidebarOpen)}
            />

            {/* Layout Container */}
            <div className="flex pt-16 md:pt-20">
              {/* Desktop Sidebar */}
              {!isMobile && (
                <Suspense fallback={<SidebarSkeleton /> }>
                  <Sidebar
                    activeSection={activeSection}
                    setActiveSection={setActiveSection}
                    darkMode={darkMode}
                  />
                </Suspense>
              )}

              {/* Mobile Sidebar Overlay */}
              {isMobile && sidebarOpen && (
                <>
                  <div
                    className="fixed inset-0 bg-black/50 z-40"
                    onClick={() => setSidebarOpen(false)}
                  />
                  <div className="fixed left-0 top-16 bottom-16 z-50">
                    <Suspense fallback={<SidebarSkeleton /> }>
                      <Sidebar
                        activeSection={activeSection}
                        setActiveSection={setActiveSection}
                        darkMode={darkMode}
                      />
                    </Suspense>
                  </div>
                </>
              )}

              {/* Main Content */}
              <main className={`flex-1 ${!isMobile ? 'ml-[240px]' : ''} min-h-[calc(100vh-8rem)]`}>
                <div className="container mx-auto p-4 md:p-6 pb-20 md:pb-6">
                  <Suspense fallback={
                    activeSection === 'homepage' ? <HomepageSkeleton /> :
                    activeSection === 'spot' || activeSection === 'crosschain' ? <SpotSkeleton /> :
                    activeSection === 'portfolio' ? <PortfolioSkeleton /> :
                    <div className="h-40" />
                  }>
                    {renderActiveSection()}
                  </Suspense>
                </div>
              </main>
            </div>

            {/* Mobile Bottom Navigation */}
            {isMobile && (
              <Suspense fallback={<MobileNavSkeleton /> }>
                <MobileBottomNav
                  activeSection={activeSection}
                  setActiveSection={setActiveSection}
                />
              </Suspense>
            )}

            {/* Footer */}
            <Suspense fallback={null}>
              <Footer />
            </Suspense>

            {/* Notifications */}
            <Suspense fallback={null}>
              <NotificationCenter />
            </Suspense>

            {/* Toast Notifications */}
            <Suspense fallback={null}>
              <ToasterLazy
                theme={darkMode ? 'dark' : 'light'}
                position="top-right"
                expand={false}
                richColors
              />
            </Suspense>
          </div>
        </div>
      </DEXProvider>
    </ErrorBoundary>
  );
}

export default App;