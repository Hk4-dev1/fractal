#!/bin/bash

# 🚀 DEX Platform Migration Script
# Automaticaly copy all DEX files to your workspace

echo "🎯 DEX Platform Migration Script"
echo "=================================="

# Check if target directory is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide target directory"
    echo "Usage: ./migrate-dex.sh /path/to/your/project"
    exit 1
fi

TARGET_DIR="$1"
SOURCE_DIR="$(pwd)"

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "❌ Error: Target directory does not exist: $TARGET_DIR"
    exit 1
fi

echo "📂 Source: $SOURCE_DIR"
echo "🎯 Target: $TARGET_DIR"
echo ""

# Create src directory if it doesn't exist
if [ ! -d "$TARGET_DIR/src" ]; then
    echo "📁 Creating src directory..."
    mkdir -p "$TARGET_DIR/src"
fi

echo "📋 Copying files..."

# Copy main directories
echo "  ├── Copying components/"
cp -r "$SOURCE_DIR/components" "$TARGET_DIR/src/"

echo "  ├── Copying contexts/"
cp -r "$SOURCE_DIR/contexts" "$TARGET_DIR/src/"

echo "  ├── Copying services/"
cp -r "$SOURCE_DIR/services" "$TARGET_DIR/src/"

echo "  ├── Copying styles/"
cp -r "$SOURCE_DIR/styles" "$TARGET_DIR/src/"

echo "  ├── Copying utils/"
cp -r "$SOURCE_DIR/utils" "$TARGET_DIR/src/"

# Copy main App.tsx
echo "  ├── Copying App.tsx"
cp "$SOURCE_DIR/App.tsx" "$TARGET_DIR/src/"

# Copy guidelines (optional)
echo "  ├── Copying guidelines/"
cp -r "$SOURCE_DIR/guidelines" "$TARGET_DIR/"

echo ""
echo "✅ Files copied successfully!"
echo ""

# Create necessary config files
echo "⚙️  Creating configuration files..."

# Create tailwind.config.js
echo "  ├── Creating tailwind.config.js"
cat > "$TARGET_DIR/tailwind.config.js" << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
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

# Create postcss.config.js
echo "  ├── Creating postcss.config.js"
cat > "$TARGET_DIR/postcss.config.js" << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# Update package.json with dependencies (if it exists)
if [ -f "$TARGET_DIR/package.json" ]; then
    echo "  ├── Updating package.json with dependencies"
    
    # Create install script
    cat > "$TARGET_DIR/install-dex-deps.sh" << 'EOF'
#!/bin/bash
echo "📦 Installing DEX Platform dependencies..."
npm install react@18 react-dom@18 typescript @types/react @types/react-dom @types/node tailwindcss postcss autoprefixer tailwindcss-animate class-variance-authority clsx tailwind-merge lucide-react recharts sonner@2.0.3 react-hook-form@7.55.0 @hookform/resolvers zod motion/react
echo "✅ Dependencies installed!"
EOF
    chmod +x "$TARGET_DIR/install-dex-deps.sh"
    echo "  ├── Created install-dex-deps.sh script"
fi

# Create Vite config if it doesn't exist
if [ ! -f "$TARGET_DIR/vite.config.ts" ] && [ ! -f "$TARGET_DIR/vite.config.js" ]; then
    echo "  ├── Creating vite.config.ts"
    cat > "$TARGET_DIR/vite.config.ts" << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/ui': path.resolve(__dirname, './src/components/ui'),
    },
  },
})
EOF
fi

echo ""
echo "🎉 Migration completed successfully!"
echo ""
echo "📋 Next steps:"
echo "  1. cd $TARGET_DIR"
echo "  2. ./install-dex-deps.sh  (install dependencies)"
echo "  3. Update src/main.tsx to import './styles/globals.css'"
echo "  4. npm run dev  (start development server)"
echo ""
echo "🔍 Files structure:"
echo "  $TARGET_DIR/"
echo "  ├── src/"
echo "  │   ├── App.tsx"
echo "  │   ├── components/"
echo "  │   ├── contexts/"
echo "  │   ├── services/"
echo "  │   ├── styles/"
echo "  │   └── utils/"
echo "  ├── tailwind.config.js"
echo "  ├── postcss.config.js"
echo "  ├── vite.config.ts"
echo "  └── install-dex-deps.sh"
echo ""
echo "✨ Happy coding with DEX Platform!"
EOF