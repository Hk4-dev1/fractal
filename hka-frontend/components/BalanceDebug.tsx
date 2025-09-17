// Balance Debug Component - shows current wallet balances for testing
import { useDEX } from '../contexts/DEXContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { RefreshCw } from 'lucide-react';

export function BalanceDebug() {
  const { state, actions } = useDEX();

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Balance Debug
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={actions.refreshBalances}
          className="h-8 w-8"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Wallet: {state.isConnected ? state.selectedWallet || 'Connected' : 'Not Connected'}
          </div>
          {/* Network info not tracked in DEXState; show placeholder */}
          <div className="text-xs text-muted-foreground">Chain: auto</div>
          <div className="text-xs text-muted-foreground">
            Balances Count: {state.userBalances.length}
          </div>
          <div className="space-y-1">
            {state.userBalances.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                {state.isConnected ? 'No balances found' : 'Connect wallet to see balances'}
              </div>
            ) : (
              state.userBalances.map((balance, index) => (
                <div key={index} className="flex justify-between text-xs">
                  <span>{balance.asset}:</span>
                  <span>{parseFloat(balance.available).toFixed(4)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
