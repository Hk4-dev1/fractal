# 🚀 React Setup Guide - After ZIP Download

## 📦 **Step 1: Download & Extract**

1. **Download ZIP** from Figma Make
2. **Extract** to your desired location
3. **Navigate** to project folder
```bash
cd path/to/extracted-dex-platform
```

---

## ⚡ **Step 2: Quick Setup Commands**

### **Option A: Create React Project + Copy Files**
```bash
# Create new React + TypeScript project
npx create-react-app my-dex-platform --template typescript
cd my-dex-platform

# Copy your DEX files to src/
cp -r ../extracted-dex-platform/components src/
cp -r ../extracted-dex-platform/contexts src/
cp -r ../extracted-dex-platform/services src/
cp -r ../extracted-dex-platform/styles src/
cp -r ../extracted-dex-platform/utils src/
cp ../extracted-dex-platform/App.tsx src/
```

### **Option B: Vite Setup (Recommended - Faster)**
```bash
# Create Vite React project
npm create vite@latest my-dex-platform -- --template react-ts
cd my-dex-platform

# Copy your DEX files to src/
cp -r ../extracted-dex-platform/components src/
cp -r ../extracted-dex-platform/contexts src/
cp -r ../extracted-dex-platform/services src/
cp -r ../extracted-dex-platform/styles src/
cp -r ../extracted-dex-platform/utils src/
cp ../extracted-dex-platform/App.tsx src/
```

---

## 📦 **Step 3: Install All Dependencies**

### **3.1 Core React Dependencies**
```bash
npm install react@18 react-dom@18 typescript @types/react @types/react-dom @types/node
```

### **3.2 Tailwind CSS + Styling**
```bash
npm install tailwindcss postcss autoprefixer tailwindcss-animate
npm install class-variance-authority clsx tailwind-merge
```

### **3.3 UI & Icons**
```bash
npm install lucide-react
```

### **3.4 Charts & Visualization**
```bash
npm install recharts
```

### **3.5 Forms & Validation**
```bash
npm install react-hook-form@7.55.0 @hookform/resolvers zod
```

### **3.6 Animations**
```bash
npm install motion
```

### **3.7 Notifications**
```bash
npm install sonner@2.0.3
```

### **3.8 Development Tools**
```bash
npm install --save-dev @vitejs/plugin-react eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react-hooks eslint-plugin-react-refresh
```

---

## 🛠️ **Step 4: Create Configuration Files**

### **4.1 package.json Scripts**
Update your `package.json` scripts section:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  }
}
```

### **4.2 Create tailwind.config.js**
```javascript
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
```

### **4.3 Create postcss.config.js**
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### **4.4 Update tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/ui/*": ["./src/components/ui/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### **4.5 Create vite.config.ts**
```typescript
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
```

### **4.6 Update src/main.tsx**
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### **4.7 Initialize Tailwind**
```bash
npx tailwindcss init -p
```

---

## 🎯 **Step 5: One-Command Install (Recommended)**

Save this as `install-all.sh` and run it:
```bash
#!/bin/bash
echo "🚀 Installing DEX Platform Dependencies..."

# Core React
npm install react@18 react-dom@18 typescript @types/react @types/react-dom @types/node

# Tailwind + Styling
npm install tailwindcss postcss autoprefixer tailwindcss-animate class-variance-authority clsx tailwind-merge

# UI Components
npm install lucide-react recharts

# Forms & Validation  
npm install react-hook-form@7.55.0 @hookform/resolvers zod

# Animation & Notifications
npm install motion sonner@2.0.3

# Dev Dependencies
npm install --save-dev @vitejs/plugin-react eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react-hooks eslint-plugin-react-refresh

echo "✅ All dependencies installed!"
echo "🎯 Next: npm run dev"
```

Make executable and run:
```bash
chmod +x install-all.sh
./install-all.sh
```

---

## 🚀 **Step 6: Start Development Server**

```bash
# Start the dev server
npm run dev

# Should open at:
# http://localhost:5173 (Vite)
# or
# http://localhost:3000 (Create React App)
```

---

## ✅ **Step 7: Test Checklist**

### **Basic Functionality:**
- [ ] App loads without errors
- [ ] Dark/Light mode toggle works
- [ ] All navigation sections accessible
- [ ] No console errors

### **Trading Features:**
- [ ] Spot Trading interface loads
- [ ] Perpetual Futures loads
- [ ] Cross-chain Bridge loads
- [ ] Portfolio section loads
- [ ] Charts display correctly

### **Mobile Features:**
- [ ] Responsive design works
- [ ] Bottom navigation appears on mobile
- [ ] Collapsible orderbook works (futures mobile)

---

## 🐛 **Step 8: Common Issues & Solutions**

### **Issue 1: Module not found**
```bash
# Install missing package
npm install [missing-package-name]
```

### **Issue 2: Tailwind not working**
```bash
# Make sure globals.css is imported in main.tsx
import './styles/globals.css'
```

### **Issue 3: TypeScript errors**
```bash
# Add to tsconfig.json compilerOptions:
"skipLibCheck": true
```

### **Issue 4: Import path errors**
```bash
# Update import paths in components from:
import { Button } from './ui/button'
# to:
import { Button } from '../ui/button'
```

---

## 📊 **Complete Dependencies List**

| Package | Version | Purpose |
|---------|---------|---------|
| **react** | 18.x | Core React |
| **react-dom** | 18.x | React DOM |
| **typescript** | 5.x | TypeScript support |
| **tailwindcss** | 3.4.x | Styling framework |
| **lucide-react** | latest | Icons |
| **recharts** | latest | Charts |
| **react-hook-form** | 7.55.0 | Forms |
| **motion** | latest | Animations |
| **sonner** | 2.0.3 | Notifications |
| **zod** | latest | Validation |
| **clsx** | latest | Conditional classes |

---

## 🎉 **Final Result**

After following this guide, you'll have:
✅ **Complete DEX Platform** running locally  
✅ **All 81 files** properly configured  
✅ **Hot reload** development environment  
✅ **Professional trading interface**  
✅ **Mobile responsive** design  
✅ **Dark/Light themes** working  

**🚀 Ready to trade! Your DEX platform is now live!**