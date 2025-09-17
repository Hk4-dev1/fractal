import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { toast } from '../utils/lazyToast';
import { 
  Plus, Star, StarOff, TrendingUp, TrendingDown, 
  Bell, BellOff, Search, BarChart3,
  Eye, ArrowUpDown
} from 'lucide-react';
import { dexStorage } from '../utils/storage';

interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  network: string;
  price: string;
  change24h: string;
  volume24h: string;
  marketCap: string;
  priceAlert?: {
    enabled: boolean;
    price: string;
    condition: 'above' | 'below';
  };
  isFavorite: boolean;
  addedAt: number;
}

interface StoredWatchlistItem {
  id: string;
  symbol: string;
  name: string;
  price: string;
  change24h: string;
  isFavorite?: boolean;
  network?: string;
  volume24h?: string;
  marketCap?: string;
  addedAt?: number;
}

const MOCK_WATCHLIST: WatchlistItem[] = [
  {
    id: 'watch_1',
    symbol: 'BTC/USDT',
    name: 'Bitcoin',
    network: 'ethereum',
    price: '43523.75',
    change24h: '+2.34',
    volume24h: '2.1B',
    marketCap: '845.2B',
    priceAlert: {
      enabled: true,
      price: '45000',
      condition: 'above'
    },
    isFavorite: true,
    addedAt: Date.now() - 86400000
  },
  {
    id: 'watch_2',
    symbol: 'ETH/USDT',
    name: 'Ethereum',
    network: 'ethereum',
    price: '2567.89',
    change24h: '-1.23',
    volume24h: '1.8B',
    marketCap: '308.5B',
    priceAlert: {
      enabled: false,
      price: '2500',
      condition: 'below'
    },
    isFavorite: true,
    addedAt: Date.now() - 172800000
  },
  {
    id: 'watch_3',
    symbol: 'BNB/USDT',
    name: 'BNB',
    network: 'bsc',
    price: '315.42',
    change24h: '+0.87',
    volume24h: '456M',
    marketCap: '47.2B',
    isFavorite: false,
    addedAt: Date.now() - 259200000
  },
  {
    id: 'watch_4',
    symbol: 'SOL/USDT',
    name: 'Solana',
    network: 'polygon',
    price: '98.76',
    change24h: '+3.21',
    volume24h: '234M',
    marketCap: '42.8B',
    priceAlert: {
      enabled: true,
      price: '100',
      condition: 'above'
    },
    isFavorite: false,
    addedAt: Date.now() - 345600000
  },
  {
    id: 'watch_5',
    symbol: 'LINK/USDT',
    name: 'Chainlink',
    network: 'arbitrum',
    price: '14.56',
    change24h: '+1.45',
    volume24h: '123M',
    marketCap: '8.1B',
    isFavorite: true,
    addedAt: Date.now() - 432000000
  }
];

const AVAILABLE_PAIRS = [
  { symbol: 'BTC/USDT', network: 'ethereum' },
  { symbol: 'ETH/USDT', network: 'ethereum' },
  { symbol: 'BNB/USDT', network: 'bsc' },
  { symbol: 'MATIC/USDT', network: 'polygon' },
  { symbol: 'SOL/USDT', network: 'polygon' },
  { symbol: 'LINK/USDT', network: 'arbitrum' },
  { symbol: 'UNI/USDT', network: 'ethereum' },
  { symbol: 'AAVE/USDT', network: 'ethereum' },
  { symbol: 'AVAX/USDT', network: 'avalanche' },
  { symbol: 'DOT/USDT', network: 'polygon' }
];

const NETWORK_LOGOS: { [key: string]: string } = {
  ethereum: '⟠',
  bsc: '⬢',
  polygon: '⬟',
  arbitrum: '🔵',
  optimism: '🔴',
  avalanche: '🔺'
};

export function Watchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [filteredWatchlist, setFilteredWatchlist] = useState<WatchlistItem[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('addedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPairSymbol, setNewPairSymbol] = useState('');
  const [newPairNetwork, setNewPairNetwork] = useState('');
  const [alertPrice, setAlertPrice] = useState('');
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');
  const [editingAlert, setEditingAlert] = useState<string | null>(null);

  // Load watchlist from storage on mount
  useEffect(() => {
    const savedWatchlist = dexStorage.get('watchlist') || [];
    const convertedWatchlist: WatchlistItem[] = savedWatchlist.map((item: StoredWatchlistItem) => ({
      ...item,
      name: item.name || item.symbol.split('/')[0],
      network: item.network || 'ethereum',
      volume24h: item.volume24h || '0',
      marketCap: item.marketCap || '0',
      isFavorite: item.isFavorite || false,
      addedAt: item.addedAt || Date.now()
    }));
    setWatchlist(convertedWatchlist.length > 0 ? convertedWatchlist : MOCK_WATCHLIST);
  }, []);

  // Save watchlist to storage whenever it changes
  useEffect(() => {
    if (watchlist.length > 0) {
      dexStorage.set('watchlist', watchlist);
    }
  }, [watchlist]);

  // Filter and sort watchlist
  useEffect(() => {
    let filtered = [...watchlist];

    // Filter by network
    if (selectedNetwork !== 'all') {
      filtered = filtered.filter(item => item.network === selectedNetwork);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.symbol.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by favorites
    if (showFavoritesOnly) {
      filtered = filtered.filter(item => item.isFavorite);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: string | number = a[sortBy as keyof WatchlistItem] as string | number;
      let bValue: string | number = b[sortBy as keyof WatchlistItem] as string | number;

      if (sortBy === 'price' || sortBy === 'change24h') {
        aValue = parseFloat(String(aValue).replace(/[+\-%$,]/g, ''));
        bValue = parseFloat(String(bValue).replace(/[+\-%$,]/g, ''));
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    setFilteredWatchlist(filtered);
  }, [watchlist, selectedNetwork, searchTerm, sortBy, sortOrder, showFavoritesOnly]);

  // Simulate real-time price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setWatchlist(prev => prev.map(item => ({
        ...item,
        price: (parseFloat(item.price) * (1 + (Math.random() - 0.5) * 0.002)).toFixed(2),
        change24h: ((Math.random() - 0.5) * 10).toFixed(2)
      })));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const addToWatchlist = () => {
    if (!newPairSymbol || !newPairNetwork) {
      toast.error('Please select both symbol and network');
      return;
    }

    const exists = watchlist.some(item => 
      item.symbol === newPairSymbol && item.network === newPairNetwork
    );

    if (exists) {
      toast.error('This pair is already in your watchlist');
      return;
    }

    const newItem: WatchlistItem = {
      id: `watch_${Date.now()}`,
      symbol: newPairSymbol,
      name: newPairSymbol, // Default name to symbol, can be updated later
      network: newPairNetwork,
      price: (Math.random() * 1000 + 10).toFixed(2),
      change24h: ((Math.random() - 0.5) * 10).toFixed(2),
      volume24h: `${(Math.random() * 500 + 50).toFixed(0)}M`,
      marketCap: `${(Math.random() * 100 + 10).toFixed(1)}B`,
      isFavorite: false,
      addedAt: Date.now()
    };

    setWatchlist(prev => [newItem, ...prev]);
    setNewPairSymbol('');
    setNewPairNetwork('');
    setIsAddDialogOpen(false);
    toast.success(`${newPairSymbol} added to watchlist`);
  };

  const removeFromWatchlist = (id: string) => {
    const item = watchlist.find(w => w.id === id);
    setWatchlist(prev => prev.filter(w => w.id !== id));
    toast.success(`${item?.symbol} removed from watchlist`);
  };

  const toggleFavorite = (id: string) => {
    setWatchlist(prev => prev.map(item => 
      item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
    ));
  };

  const updatePriceAlert = (id: string) => {
    if (!alertPrice) {
      toast.error('Please enter alert price');
      return;
    }

    setWatchlist(prev => prev.map(item => 
      item.id === id 
        ? { 
            ...item, 
            priceAlert: { 
              enabled: true, 
              price: alertPrice, 
              condition: alertCondition 
            } 
          }
        : item
    ));

    setEditingAlert(null);
    setAlertPrice('');
    toast.success('Price alert updated');
  };

  const togglePriceAlert = (id: string) => {
    setWatchlist(prev => prev.map(item => 
      item.id === id && item.priceAlert
        ? { 
            ...item, 
            priceAlert: { 
              ...item.priceAlert, 
              enabled: !item.priceAlert.enabled 
            } 
          }
        : item
    ));
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const watchlistStats = {
    total: watchlist.length,
    favorites: watchlist.filter(w => w.isFavorite).length,
    withAlerts: watchlist.filter(w => w.priceAlert?.enabled).length,
    totalValue: watchlist.reduce((sum, w) => sum + parseFloat(w.price), 0)
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Watchlist</h2>
          <p className="text-muted-foreground">Track your favorite trading pairs and set price alerts</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-dex-blue">
            <Star className="w-3 h-3 mr-1" />
            {watchlistStats.favorites} Favorites
          </Badge>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Pair
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add to Watchlist</DialogTitle>
                <DialogDescription>
                  Select a trading pair and network to add to your watchlist.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Trading Pair</label>
                  <Select value={newPairSymbol} onValueChange={setNewPairSymbol}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select trading pair" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_PAIRS.map((pair) => (
                        <SelectItem key={`${pair.symbol}-${pair.network}`} value={pair.symbol}>
                          {pair.symbol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Network</label>
                  <Select value={newPairNetwork} onValueChange={setNewPairNetwork}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ethereum">Ethereum</SelectItem>
                      <SelectItem value="bsc">BSC</SelectItem>
                      <SelectItem value="polygon">Polygon</SelectItem>
                      <SelectItem value="arbitrum">Arbitrum</SelectItem>
                      <SelectItem value="avalanche">Avalanche</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={addToWatchlist}>
                    Add to Watchlist
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{watchlistStats.total}</div>
            <div className="text-sm text-muted-foreground">Total Pairs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{watchlistStats.favorites}</div>
            <div className="text-sm text-muted-foreground">Favorites</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-dex-blue">{watchlistStats.withAlerts}</div>
            <div className="text-sm text-muted-foreground">Active Alerts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">${watchlistStats.totalValue.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Combined Price</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search pairs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Networks</SelectItem>
                  <SelectItem value="ethereum">Ethereum</SelectItem>
                  <SelectItem value="bsc">BSC</SelectItem>
                  <SelectItem value="polygon">Polygon</SelectItem>
                  <SelectItem value="arbitrum">Arbitrum</SelectItem>
                  <SelectItem value="avalanche">Avalanche</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="addedAt">Date Added</SelectItem>
                  <SelectItem value="symbol">Symbol</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                  <SelectItem value="change24h">24h Change</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={showFavoritesOnly ? "default" : "outline"}
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              >
                <Star className="h-4 w-4 mr-2" />
                Favorites Only
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Watchlist Table */}
      <Card>
        <CardHeader>
          <CardTitle>Watchlist ({filteredWatchlist.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('symbol')} className="p-0">
                      Pair <ArrowUpDown className="ml-1 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('price')} className="p-0">
                      Price <ArrowUpDown className="ml-1 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('change24h')} className="p-0">
                      24h Change <ArrowUpDown className="ml-1 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Market Cap</TableHead>
                  <TableHead>Price Alert</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWatchlist.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.symbol}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{NETWORK_LOGOS[item.network]}</span>
                        <span className="capitalize text-sm">{item.network}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">${item.price}</TableCell>
                    <TableCell>
                      <span className={`flex items-center gap-1 ${
                        parseFloat(item.change24h) >= 0 ? 'text-dex-success' : 'text-dex-danger'
                      }`}>
                        {parseFloat(item.change24h) >= 0 ? 
                          <TrendingUp className="w-3 h-3" /> : 
                          <TrendingDown className="w-3 h-3" />
                        }
                        {parseFloat(item.change24h) >= 0 ? '+' : ''}{item.change24h}%
                      </span>
                    </TableCell>
                    <TableCell>${item.volume24h}</TableCell>
                    <TableCell>${item.marketCap}</TableCell>
                    <TableCell>
                      {item.priceAlert ? (
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={item.priceAlert.enabled ? "default" : "secondary"}
                            className="text-xs"
                          >
                            ${item.priceAlert.price} {item.priceAlert.condition}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePriceAlert(item.id)}
                          >
                            {item.priceAlert.enabled ? 
                              <Bell className="h-3 w-3" /> : 
                              <BellOff className="h-3 w-3" />
                            }
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingAlert(item.id);
                            setAlertPrice(item.price);
                          }}
                        >
                          <Bell className="h-3 w-3 mr-1" />
                          Set Alert
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFavorite(item.id)}
                        >
                          {item.isFavorite ? 
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> : 
                            <StarOff className="h-4 w-4" />
                          }
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromWatchlist(item.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredWatchlist.length === 0 && (
            <div className="text-center py-8">
              <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <div className="text-muted-foreground mb-2">No pairs in your watchlist</div>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Pair
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Price Alert Dialog */}
      {editingAlert && (
        <Dialog open={true} onOpenChange={() => setEditingAlert(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Price Alert</DialogTitle>
              <DialogDescription>
                Configure price alerts to get notified when the price reaches your target.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Alert Price</label>
                <Input
                  type="number"
                  value={alertPrice}
                  onChange={(e) => setAlertPrice(e.target.value)}
                  placeholder="Enter price"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Condition</label>
                <Select value={alertCondition} onValueChange={(value: 'above' | 'below') => setAlertCondition(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">Price goes above</SelectItem>
                    <SelectItem value="below">Price goes below</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingAlert(null)}>
                  Cancel
                </Button>
                <Button onClick={() => updatePriceAlert(editingAlert)}>
                  Set Alert
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export {};