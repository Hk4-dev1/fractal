import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Wallet, 
  Copy, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  Users,
  Gift,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import { useDEX } from '../contexts/DEXContext';

export function Portfolio() {
  const { state } = useDEX();
  const [showBalances, setShowBalances] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [referralCode, setReferralCode] = useState('HKA-ABC123XYZ');

  // Mock data - akan diganti dengan real data nanti
  const portfolioData = {
    totalUSD: 12847.32,
    change24h: 5.67,
    chains: [
      {
        name: 'Ethereum Sepolia',
        logo: '⟠',
        color: 'text-blue-500',
        balances: [
          { symbol: 'ETH', amount: '2.45', usdValue: 6297.83, isNative: true },
          { symbol: 'USDC', amount: '1,250.00', usdValue: 1250.00 },
          { symbol: 'USDT', amount: '500.00', usdValue: 500.00 }
        ]
      },
      {
        name: 'Arbitrum Sepolia', 
        logo: '🔵',
        color: 'text-blue-600',
        balances: [
          { symbol: 'ETH', amount: '1.82', usdValue: 4673.54, isNative: true },
          { symbol: 'USDC', amount: '125.68', usdValue: 125.68 }
        ]
      },
      {
        name: 'Optimism Sepolia',
        logo: '🔴', 
        color: 'text-red-500',
        balances: [
          { symbol: 'ETH', amount: '0.00', usdValue: 0, isNative: true }
        ]
      },
      {
        name: 'Base Sepolia',
        logo: '🔵',
        color: 'text-blue-400',
        balances: [
          { symbol: 'ETH', amount: '0.00', usdValue: 0, isNative: true }
        ]
      }
    ]
  };

  const referralStats = {
    totalReferrals: 12,
    activeReferrals: 8,
    totalCommissions: 234.56,
    thisMonthCommissions: 45.23
  };

  const recentTransactions = [
    {
      id: '1',
      type: 'Swap',
      from: 'ETH',
      to: 'USDC', 
      amount: '0.5',
      value: '$1,283.95',
      chain: 'Ethereum',
      time: '2 hours ago',
      status: 'success'
    },
    {
      id: '2', 
      type: 'Transfer',
      from: 'USDT',
      to: 'External',
      amount: '100',
      value: '$100.00',
      chain: 'Arbitrum',
      time: '1 day ago', 
      status: 'success'
    },
    {
      id: '3',
      type: 'Referral',
      from: 'Commission',
      to: 'Portfolio',
      amount: '15.67',
      value: '$15.67',
      chain: 'All Chains',
      time: '3 days ago',
      status: 'success'
    }
  ];

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setRefreshing(false);
    toast.success('Portfolio refreshed');
  };

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralCode);
    toast.success('Referral code copied to clipboard');
  };

  const generateNewReferral = () => {
    const newCode = `HKA-${Math.random().toString(36).substr(2, 3).toUpperCase()}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
    setReferralCode(newCode);
    toast.success('New referral code generated');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const toggleBalanceVisibility = () => {
    setShowBalances(!showBalances);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
            <Wallet className="h-5 w-5 md:h-6 md:w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Portfolio</h1>
            <p className="text-sm text-muted-foreground">Track your assets and referrals</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost" 
            size="icon"
            onClick={toggleBalanceVisibility}
            className="touch-target"
          >
            {showBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon" 
            onClick={handleRefresh}
            disabled={refreshing}
            className="touch-target"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {!state.isConnected ? (
        <Card className="text-center p-8 md:p-12">
          <CardContent>
            <Wallet className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg md:text-xl font-semibold mb-2">Connect Your Wallet</h3>
            <p className="text-muted-foreground mb-6">
              Connect your wallet to view your portfolio and manage referrals
            </p>
            <Button className="w-full sm:w-auto">
              Connect Wallet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:w-[400px]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Portfolio Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Portfolio Overview</span>
                  <Badge variant={portfolioData.change24h >= 0 ? "default" : "destructive"} className="text-xs">
                    {portfolioData.change24h >= 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {portfolioData.change24h >= 0 ? '+' : ''}{portfolioData.change24h}%
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl md:text-4xl font-bold mb-2">
                  {showBalances ? formatCurrency(portfolioData.totalUSD) : '****'}
                </div>
                <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
              </CardContent>
            </Card>

            {/* Multi-Chain Balances */}
            <div className="grid gap-4 md:gap-6">
              <h3 className="text-lg font-semibold">Balances by Chain</h3>
              <div className="grid gap-4">
                {portfolioData.chains.map((chain, index) => {
                  const totalChainValue = chain.balances.reduce((sum, balance) => sum + balance.usdValue, 0);
                  
                  return (
                    <Card key={index}>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-3 text-base md:text-lg">
                          <div className={`text-xl ${chain.color}`}>{chain.logo}</div>
                          <div className="flex-1">
                            <div>{chain.name}</div>
                            <div className="text-sm font-normal text-muted-foreground">
                              {showBalances ? formatCurrency(totalChainValue) : '****'}
                            </div>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {chain.balances.map((balance, balanceIndex) => (
                            <div key={balanceIndex} className="flex items-center justify-between py-2 border-t border-border/50 first:border-t-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{balance.symbol}</span>
                                {balance.isNative && (
                                  <Badge variant="outline" className="text-xs">Native</Badge>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="font-medium">
                                  {showBalances ? balance.amount : '****'} {balance.symbol}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {showBalances ? formatCurrency(balance.usdValue) : '****'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* Referrals Tab */}
          <TabsContent value="referrals" className="space-y-6">
            {/* Referral Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold">{referralStats.totalReferrals}</div>
                  <div className="text-xs text-muted-foreground">Total Referrals</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-500" />
                  <div className="text-2xl font-bold">{referralStats.activeReferrals}</div>
                  <div className="text-xs text-muted-foreground">Active</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <Gift className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                  <div className="text-2xl font-bold">${referralStats.totalCommissions}</div>
                  <div className="text-xs text-muted-foreground">Total Earned</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-6 w-6 mx-auto mb-2 text-orange-500" />
                  <div className="text-2xl font-bold">${referralStats.thisMonthCommissions}</div>
                  <div className="text-xs text-muted-foreground">This Month</div>
                </CardContent>
              </Card>
            </div>

            {/* Referral Code Section */}
            <Card>
              <CardHeader>
                <CardTitle>Your Referral Code</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    value={referralCode}
                    readOnly
                    className="flex-1 font-mono text-center sm:text-left"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyReferral}
                      className="touch-target"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={generateNewReferral}
                      className="touch-target"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Generate New
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Share your referral code and earn commissions from your referrals&apos; trading fees.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-b-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                          tx.type === 'Swap' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
                          tx.type === 'Transfer' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' :
                          'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                        }`}>
                          {tx.type === 'Swap' ? '↔' : tx.type === 'Transfer' ? '→' : '🎁'}
                        </div>
                        <div>
                          <div className="font-medium text-sm">
                            {tx.type} {tx.from} {tx.type !== 'Referral' ? `→ ${tx.to}` : ''}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {tx.chain} • {tx.time}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-sm">{tx.amount} {tx.from}</div>
                        <div className="text-xs text-muted-foreground">{tx.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export {};
