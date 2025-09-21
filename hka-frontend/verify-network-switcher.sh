#!/bin/bash

# Quick verification script for frontend network switcher
echo "🔍 Checking Frontend Network Switcher Implementation..."
echo "=================================================="

# Check if SpotTradingNew.tsx has the network switcher
echo "📁 Checking SpotTradingNew.tsx for network switcher code..."

if grep -q "Network.*from.*lucide-react" /Users/ivarhka/FRACTAL/hka-frontend/components/SpotTradingNew.tsx; then
    echo "✅ Network icon import found"
else
    echo "❌ Network icon import missing"
fi

if grep -q "switchNetwork" /Users/ivarhka/FRACTAL/hka-frontend/components/SpotTradingNew.tsx; then
    echo "✅ switchNetwork function found"
else
    echo "❌ switchNetwork function missing"
fi

if grep -q "NETWORKS.*from.*contract-config" /Users/ivarhka/FRACTAL/hka-frontend/components/SpotTradingNew.tsx; then
    echo "✅ NETWORKS import found"
else
    echo "❌ NETWORKS import missing"
fi

if grep -q "handleNetworkSwitch" /Users/ivarhka/FRACTAL/hka-frontend/components/SpotTradingNew.tsx; then
    echo "✅ handleNetworkSwitch function found"
else
    echo "❌ handleNetworkSwitch function missing"
fi

echo ""
echo "📊 Network Options Available:"
grep -o "chainId.*name.*'.*'" /Users/ivarhka/FRACTAL/hka-frontend/services/contract-config.ts | head -4

echo ""
echo "🌐 Frontend Server Status:"
if curl -s http://localhost:5173 >/dev/null; then
    echo "✅ Frontend server is running at http://localhost:5173"
else
    echo "❌ Frontend server is not accessible"
fi

echo ""
echo "📝 Next Steps:"
echo "1. Open http://localhost:5173 in browser"
echo "2. Connect MetaMask wallet"
echo "3. Look for Network dropdown in Spot Trading header"
echo "4. Test switching between networks"
echo ""
