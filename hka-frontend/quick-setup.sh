#!/bin/bash

# 🚀 DEX Platform Quick Setup Script
# Run this after extracting ZIP and copying files

echo "🎯 DEX Platform Quick Setup"
echo "=========================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "📦 Creating new React project..."
    # Uncomment one of these based on your preference:
    
    # Option 1: Vite (Recommended - Faster)
    # npm create vite@latest . -- --template react-ts --force
    
    # Option 2: Create React App
    # npx create-react-app . --template typescript
    
    echo "⚠️  Please create your React project first:"
    echo "   npm create vite@latest my-dex-platform -- --template react-ts"
    echo "   cd my-dex-platform"
    echo "   Then run this script again"
    exit 1
fi

echo "📦 Installing all dependencies..."

# Core React & TypeScript
npm install react@18 react-dom@18 typescript @types/react @types/react-dom @types/node

# Tailwind CSS & Styling
npm install tailwindcss postcss autoprefixer tailwindcss-animate
npm install class-variance-authority clsx tailwind-merge

# UI & Icons
npm install lucide-react

# Charts
npm install recharts

# Forms & Validation
npm install react-hook-form@7.55.0 @hookform/resolvers zod

# Animation & Notifications
npm install motion sonner@2.0.3

# Dev Dependencies
npm install --save-dev @vitejs/plugin-react

echo "⚙️  Creating configuration files..."

# Create Tailwind config
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dex-blue': '#3b82f6',
        'dex-success': '#22c55e',
        'dex-danger': '#ef4444',
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
EOF

# Create PostCSS config
cat > postcss.config.js << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# Update main.tsx to import globals.css
if [ -f "src/main.tsx" ]; then
    if ! grep -q "globals.css" src/main.tsx; then
        sed -i "3i import './styles/globals.css'" src/main.tsx
        echo "✅ Added globals.css import to main.tsx"
    fi
fi

# Create vite.config.ts with path aliases
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/components": path.resolve(__dirname, "./src/components"),
      "@/ui": path.resolve(__dirname, "./src/components/ui"),
    },
  },
})
EOF

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "  1. Make sure your DEX files are in src/ folder:"
echo "     src/components/, src/contexts/, src/services/, etc."
echo "  2. Update src/main.tsx to import './styles/globals.css'"
echo "  3. npm run dev"
echo ""
echo "🔍 Your project structure should look like:"
echo "  your-project/"
echo "  ├── src/"
echo "  │   ├── App.tsx"
echo "  │   ├── main.tsx"
echo "  │   ├── components/"
echo "  │   ├── contexts/"
echo "  │   ├── services/"
echo "  │   ├── styles/"
echo "  │   └── utils/"
echo "  ├── package.json"
echo "  ├── tailwind.config.js"
echo "  └── vite.config.ts"
echo ""
echo "🚀 Ready to run: npm run dev"
EOF