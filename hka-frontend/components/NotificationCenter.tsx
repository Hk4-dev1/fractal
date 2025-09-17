import { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import {
  Bell, CheckCircle2, 
  Info, TrendingUp, X, Trash2
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'trade' | 'alert' | 'system' | 'order';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif_1',
    type: 'trade',
    title: 'Trade Executed',
    message: 'Your BUY order for 0.5 BTC at $43,500 has been filled',
    timestamp: Date.now() - 300000,
    read: false,
    priority: 'high'
  },
  {
    id: 'notif_2',
    type: 'alert',
    title: 'Price Alert Triggered',
    message: 'ETH/USDT has reached your target price of $2,600',
    timestamp: Date.now() - 900000,
    read: false,
    priority: 'medium'
  },
  {
    id: 'notif_3',
    type: 'system',
    title: 'Network Status',
    message: 'Ethereum network congestion detected. Expect delays.',
    timestamp: Date.now() - 1800000,
    read: true,
    priority: 'medium'
  }
];

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState({
    tradeNotifications: true,
    priceAlerts: true,
    systemUpdates: true,
    orderUpdates: true,
    sound: false
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'trade': return <TrendingUp className="w-4 h-4" />;
      case 'alert': return <Bell className="w-4 h-4" />;
      case 'system': return <Info className="w-4 h-4" />;
      case 'order': return <CheckCircle2 className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-dex-danger';
      case 'medium': return 'border-l-yellow-500';
      case 'low': return 'border-l-dex-blue';
      default: return 'border-l-gray-400';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs bg-dex-danger">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark All Read
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={clearAll}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>
            View and manage your trading notifications and alerts.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-96">
          <div className="space-y-2">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div key={notification.id} className={`p-3 border-l-4 ${getPriorityColor(notification.priority)} ${!notification.read ? 'bg-accent/50' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">{getIcon(notification.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{notification.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">{notification.message}</div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {new Date(notification.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!notification.read && (
                        <Button variant="ghost" size="sm" onClick={() => markAsRead(notification.id)}>
                          <CheckCircle2 className="w-3 h-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => deleteNotification(notification.id)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="border-t pt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Trade Notifications</span>
              <Switch checked={settings.tradeNotifications} onCheckedChange={(checked) => setSettings(prev => ({ ...prev, tradeNotifications: checked }))} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Price Alerts</span>
              <Switch checked={settings.priceAlerts} onCheckedChange={(checked) => setSettings(prev => ({ ...prev, priceAlerts: checked }))} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">System Updates</span>
              <Switch checked={settings.systemUpdates} onCheckedChange={(checked) => setSettings(prev => ({ ...prev, systemUpdates: checked }))} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}