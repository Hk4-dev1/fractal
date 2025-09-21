#!/bin/bash

echo "🚀 Testing HKA-DEX Frontend Wallet Integration"
echo "============================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in frontend directory"
    exit 1
fi

echo "✅ In correct directory"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Check if MetaMask SDK is installed
if npm list @metamask/sdk > /dev/null 2>&1; then
    echo "✅ MetaMask SDK is installed"
else
    echo "❌ MetaMask SDK not found"
fi

# Run type check
echo "🔍 Running TypeScript type check..."
npm run type-check

# If no errors, start dev server
if [ $? -eq 0 ]; then
    echo "✅ TypeScript compilation successful"
    echo "🌐 Starting development server..."
    npm run dev
else
    echo "❌ TypeScript errors found. Please fix them first."
    exit 1
fi
