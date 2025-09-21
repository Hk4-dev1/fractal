#!/bin/bash

echo "🚀 HKA DEX Frontend - Local Setup"
echo "================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if installation was successful
if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "🔧 Creating .env file..."
    cat > .env << EOF
# HKA DEX Environment Variables
VITE_APP_NAME=HKA DEX
VITE_APP_VERSION=1.0.0

# Backend API URLs
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_BASE_URL=ws://localhost:3000

# Blockchain Configuration
VITE_CHAIN_ID=11155111
VITE_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
VITE_EXPLORER_URL=https://sepolia.etherscan.io

# LayerZero Configuration
VITE_LZ_ENDPOINT=0x6EDCE65403992e310A62460808c4b910D972f10f

# Contract Addresses (will be updated after deployment)
VITE_ORDERBOOK_ENGINE_ADDRESS=
VITE_CROSSCHAIN_RELAY_ADDRESS=

# Feature Flags
VITE_ENABLE_CROSS_CHAIN=true
VITE_ENABLE_PERPETUAL=true
VITE_ENABLE_SPOT_TRADING=true

# Development
VITE_DEBUG_MODE=true
VITE_MOCK_DATA=true
EOF
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

# Fix import issues in existing files
echo "🔧 Fixing import issues..."

# Fix sonner import
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/from '\''sonner@2.0.3'\''/from '\''sonner'\''/g'

# Fix framer-motion import
find . -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's/from '\''motion\/react'\''/from '\''framer-motion'\''/g'

echo "✅ Import issues fixed"

# Start development server
echo "🚀 Starting development server..."
echo "📱 Frontend will be available at: http://localhost:5173"
echo "🔗 Backend should be running at: http://localhost:3000"
echo ""
echo "💡 Tips:"
echo "   - Make sure backend is running before testing full features"
echo "   - Check .env file for configuration"
echo "   - Use Ctrl+C to stop the server"
echo ""

npm run dev 