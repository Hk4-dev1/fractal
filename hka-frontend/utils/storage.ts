// Local storage utility untuk menyimpan data user
declare global {
  namespace NodeJS {
    interface Global {
      localStorage?: Storage;
    }
  }
}

interface StorageData {
  walletAddress?: string;
  selectedWallet?: string;
  userSettings?: {
    darkMode: boolean;
    language: string;
    tradingMode: string;
    notifications: boolean;
    autoSave: boolean;
  };
  favoriteCoins?: string[];
  priceAlerts?: Array<{
    symbol: string;
    price: string;
    condition: 'above' | 'below';
    enabled: boolean;
  }>;
  tradingHistory?: Array<{
    id: string;
    type: 'spot' | 'futures';
    action: 'buy' | 'sell' | 'long' | 'short';
    symbol: string;
    amount: string;
    price: string;
    timestamp: number;
    pnl?: string;
  }>;
  watchlist?: Array<{
    id: string;
    symbol: string;
    name: string;
    price: string;
    change24h: string;
    isFavorite?: boolean;
  }>;
  spot_orders?: Array<{
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit';
    amount: string;
    price?: string;
    status: 'pending' | 'filled' | 'cancelled';
    timestamp: number;
    filled?: string;
    remaining?: string;
  }>;
  futures_orders?: Array<{
    id: string;
    symbol: string;
    side: 'long' | 'short';
    type: 'market' | 'limit';
    amount: string;
    price?: string;
    status: 'pending' | 'filled' | 'cancelled';
    timestamp: number;
    filled?: string;
    remaining?: string;
  }>;
  crosschain_orders?: Array<{
    id: string;
    fromChain: number;
    toChain: number;
    fromToken: string;
    toToken: string;
    amount: string;
    status: 'pending' | 'completed' | 'failed';
    timestamp: number;
  }>;
}

class DEXStorage {
  private readonly storageKey = 'hka-dex-data';

  // Get all stored data
  getData(): StorageData {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return {};
    }
  }

  // Save all data
  setData(data: StorageData): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  }

  // Get specific data
  get<K extends keyof StorageData>(key: K): StorageData[K] {
    const data = this.getData();
    return data[key];
  }

  // Set specific data
  set<K extends keyof StorageData>(key: K, value: StorageData[K]): void {
    const data = this.getData();
    data[key] = value;
    this.setData(data);
  }

  // User settings
  getUserSettings() {
    return this.get('userSettings') || {
      darkMode: false,
      language: 'en',
      tradingMode: 'advanced',
      notifications: true,
      autoSave: true
    };
  }

  setUserSettings(settings: StorageData['userSettings']) {
    this.set('userSettings', settings);
  }

  // Wallet management
  getWalletInfo() {
    return {
      address: this.get('walletAddress'),
      selectedWallet: this.get('selectedWallet')
    };
  }

  setWalletInfo(address: string, walletType: string) {
    this.set('walletAddress', address);
    this.set('selectedWallet', walletType);
  }

  clearWalletInfo() {
    this.set('walletAddress', undefined);
    this.set('selectedWallet', undefined);
  }

  // Favorite coins
  getFavoriteCoins(): string[] {
    return this.get('favoriteCoins') || [];
  }

  addFavoriteCoin(symbol: string) {
    const favorites = this.getFavoriteCoins();
    if (!favorites.includes(symbol)) {
      favorites.push(symbol);
      this.set('favoriteCoins', favorites);
    }
  }

  removeFavoriteCoin(symbol: string) {
    const favorites = this.getFavoriteCoins();
    const updated = favorites.filter(coin => coin !== symbol);
    this.set('favoriteCoins', updated);
  }

  // Price alerts
  getPriceAlerts() {
    return this.get('priceAlerts') || [];
  }

  addPriceAlert(alert: {
    symbol: string;
    price: string;
    condition: 'above' | 'below';
    enabled: boolean;
  }) {
    const alerts = this.getPriceAlerts();
    alerts.push({ ...alert, enabled: true });
    this.set('priceAlerts', alerts);
  }

  removePriceAlert(symbol: string, price: string) {
    const alerts = this.getPriceAlerts();
    const updated = alerts.filter(alert => 
      !(alert.symbol === symbol && alert.price === price)
    );
    this.set('priceAlerts', updated);
  }

  togglePriceAlert(symbol: string, price: string) {
    const alerts = this.getPriceAlerts();
    const updated = alerts.map(alert => 
      (alert.symbol === symbol && alert.price === price)
        ? { ...alert, enabled: !alert.enabled }
        : alert
    );
    this.set('priceAlerts', updated);
  }

  // Trading history
  getTradingHistory() {
    return this.get('tradingHistory') || [];
  }

  addTradingRecord(record: {
    id: string;
    type: 'spot' | 'futures';
    action: 'buy' | 'sell' | 'long' | 'short';
    symbol: string;
    amount: string;
    price: string;
    timestamp: number;
    pnl?: string;
  }) {
    const history = this.getTradingHistory();
    history.unshift(record); // Add to beginning
    
    // Keep only last 1000 records
    if (history.length > 1000) {
      history.splice(1000);
    }
    
    this.set('tradingHistory', history);
  }

  clearTradingHistory() {
    this.set('tradingHistory', []);
  }

  // Clear all data
  clearAll() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }

  // Export data for backup
  exportData(): string {
    return JSON.stringify(this.getData(), null, 2);
  }

  // Import data from backup
  importData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      this.setData(data);
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  // Check if storage is available
  isStorageAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
}

export const dexStorage = new DEXStorage();

// Auto-save utility
export class AutoSave {
  private timeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly delay = 1000; // 1 second delay

  schedule(key: string, callback: () => void) {
    // Clear existing timeout
    const existingTimeout = this.timeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule new save
    const timeout = setTimeout(() => {
      callback();
      this.timeouts.delete(key);
    }, this.delay);

    this.timeouts.set(key, timeout);
  }

  immediate(callback: () => void) {
    callback();
  }

  cancel(key: string) {
    const timeout = this.timeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(key);
    }
  }

  cancelAll() {
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
  }
}

export const autoSave = new AutoSave();