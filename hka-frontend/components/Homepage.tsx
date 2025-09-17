import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Text } from './ui/text';
import { ArrowLeftRight, Shield, Zap, Globe, Twitter, MessageCircle, Send, Github } from 'lucide-react';
// BalanceDebug removed
import HkaLogo from '../logo/HKA-LOGO.svg';

export function Homepage() {
  const socialLinks = [
    {
      name: 'X (Twitter)',
      icon: Twitter,
      url: 'https://x.com/hka_dex',
      color: 'hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
    },
    {
      name: 'Discord',
      icon: MessageCircle,
      url: 'https://discord.gg/hkadex',
      color: 'hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950'
    },
    {
      name: 'Telegram',
      icon: Send,
      url: 'https://t.me/hkadex',
      color: 'hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950'
    },
    {
      name: 'Github',
      icon: Github,
      url: 'https://github.com/hkadex',
      color: 'hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
    }
  ];

  return (
    <div className="space-y-8 md:space-y-12">
      {/* Hero Section */}
      <div className="relative text-center space-y-4 md:space-y-6 py-8 md:py-16 overflow-hidden px-4">
        {/* Fractal Background Pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 800 600" preserveAspectRatio="none">
            <defs>
              <linearGradient id="fractal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0EA5E9" />
                <stop offset="50%" stopColor="#06B6D4" />
                <stop offset="100%" stopColor="#0EA5E9" />
              </linearGradient>
            </defs>
            {/* Main fractal lines */}
            <path d="M100,300 Q200,200 300,300 T500,300 T700,300" stroke="url(#fractal-grad)" strokeWidth="2" fill="none" opacity="0.6" />
            <path d="M50,250 Q150,150 250,250 T450,250 T650,250" stroke="url(#fractal-grad)" strokeWidth="1.5" fill="none" opacity="0.4" />
            <path d="M150,350 Q250,250 350,350 T550,350 T750,350" stroke="url(#fractal-grad)" strokeWidth="1.5" fill="none" opacity="0.4" />
            {/* Branch fractals */}
            <path d="M200,200 L250,150 L300,200 L350,120 L400,180" stroke="url(#fractal-grad)" strokeWidth="1" fill="none" opacity="0.3" />
            <path d="M400,380 L450,330 L500,380 L550,300 L600,360" stroke="url(#fractal-grad)" strokeWidth="1" fill="none" opacity="0.3" />
            {/* Connecting nodes */}
            <circle cx="300" cy="300" r="3" fill="url(#fractal-grad)" opacity="0.5" />
            <circle cx="500" cy="300" r="3" fill="url(#fractal-grad)" opacity="0.5" />
            <circle cx="250" cy="250" r="2" fill="url(#fractal-grad)" opacity="0.4" />
            <circle cx="450" cy="250" r="2" fill="url(#fractal-grad)" opacity="0.4" />
          </svg>
        </div>
        <div className="w-16 h-16 md:w-24 md:h-24 rounded-full overflow-hidden mx-auto mb-4 md:mb-6 shadow-lg">
          <img 
            src={HkaLogo} 
            alt="HKA-DEX Logo" 
            className="w-full h-full object-cover rounded-full"
          />
        </div>
        <Text variant="h1" className="font-bold text-2xl md:text-4xl lg:text-5xl">
          Welcome to HKA-DEX
        </Text>
        <Text variant="bodyLg" className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base px-4">
          Next-generation cross-chain DEX with AMM swaps and LayerZero-powered futures trading.
          Experience seamless omnichain trading with institutional-grade technology.
        </Text>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 px-4 md:px-0">
        <Card className="hover:shadow-xl hover:shadow-blue-500/20 transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="text-center p-4 md:p-6">
            <ArrowLeftRight className="h-6 w-6 md:h-8 md:w-8 mx-auto text-blue-500" />
            <CardTitle className="text-base md:text-lg">Cross-Chain Swaps</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <Text variant="bodySm" className="text-muted-foreground text-center text-xs md:text-sm">
              Powered by custom AMM with efficient swaps and cross-chain escrow.
            </Text>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl hover:shadow-dex-success/20 transition-all duration-300 transform hover:-translate-y-1 hover:scale-105">
          <CardHeader className="text-center p-4 md:p-6">
            <Shield className="h-6 w-6 md:h-8 md:w-8 mx-auto text-dex-success" />
            <CardTitle className="text-base md:text-lg">Secure & Decentralized</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <p className="text-xs md:text-sm text-muted-foreground text-center">
              Non-custodial trading with smart contract security and transparency.
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl hover:shadow-purple-500/20 transition-all duration-300 transform hover:-translate-y-1">
          <CardHeader className="text-center">
            <Zap className="h-8 w-8 mx-auto text-purple-500" />
            <CardTitle className="text-lg">Futures Trading</CardTitle>
          </CardHeader>
          <CardContent>
            <Text variant="bodySm" className="text-muted-foreground text-center">
              Cross-chain futures with LayerZero messaging and unified margin.
            </Text>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 transform hover:-translate-y-1 hover:scale-105">
          <CardHeader className="text-center">
            <Globe className="h-8 w-8 mx-auto text-primary" />
            <CardTitle className="text-lg">Cross-Chain</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
              Trade across multiple blockchains with seamless cross-chain execution.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="text-center hover:shadow-xl hover:shadow-dex-blue/10 transition-all duration-300 transform hover:-translate-y-1 hover:scale-105">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-dex-gradient">$2.4B+</div>
            <p className="text-sm text-muted-foreground">24h Trading Volume</p>
          </CardContent>
        </Card>
        
        <Card className="text-center hover:shadow-xl hover:shadow-dex-cyan/10 transition-all duration-300 transform hover:-translate-y-1 hover:scale-105">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-dex-gradient">150+</div>
            <p className="text-sm text-muted-foreground">Trading Pairs</p>
          </CardContent>
        </Card>
        
        <Card className="text-center hover:shadow-xl hover:shadow-dex-blue/10 transition-all duration-300 transform hover:-translate-y-1 hover:scale-105">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-dex-gradient">500K+</div>
            <p className="text-sm text-muted-foreground">Active Traders</p>
          </CardContent>
        </Card>
      </div>

      {/* Social Links - Positioned below stats */}
      <div className="text-center pt-6 md:pt-8 pb-4 px-4">
        <h3 className="text-base md:text-lg font-medium mb-4 md:mb-6 text-muted-foreground">Join Our Community</h3>
        <div className="flex gap-3 md:gap-4 justify-center items-center mb-4">
          {socialLinks.map((social) => {
            const IconComponent = social.icon;
            return (
              <a
                key={social.name}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`p-2 md:p-3 rounded-lg border border-border transition-all duration-200 ${social.color} group shadow-sm hover:shadow-md touch-target active:scale-95`}
                title={social.name}
              >
                <IconComponent className="h-5 w-5 md:h-6 md:w-6 transition-transform group-hover:scale-110" />
              </a>
            );
          })}
        </div>
        <p className="text-xs md:text-sm text-muted-foreground max-w-md mx-auto">
          Follow us for the latest updates, announcements, and community discussions
        </p>
      </div>

  {/* Balance Debug Component removed */}
    </div>
  );
}