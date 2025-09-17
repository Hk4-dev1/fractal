# 🚀 DEX Platform Migration Guide

## 📋 **Prerequisites**
- Node.js (version 18+)
- NPM atau Yarn
- React project yang sudah di-setup
- Code editor (VS Code recommended)

## 🗂️ **Step 1: Copy File Structure**

### **Method 1: Manual Copy**
```bash
# Di workspace Anda, buat structure seperti ini:
your-project/
├── src/
│   ├── App.tsx                    # Copy dari root
│   ├── components/                # Copy seluruh folder
│   ├── contexts/                  # Copy seluruh folder  
│   ├── services/                  # Copy seluruh folder
│   ├── styles/                    # Copy seluruh folder
│   └── utils/                     # Copy seluruh folder
```

### **Method 2: Command Line**
```bash
# Di terminal, dari directory ini:
cp -r components/ /path/to/your-project/src/
cp -r contexts/ /path/to/your-project/src/
cp -r services/ /path/to/your-project/src/
cp -r styles/ /path/to/your-project/src/
cp -r utils/ /path/to/your-project/src/
cp App.tsx /path/to/your-project/src/
```

### **Method 3: Git Clone (Recommended)**
```bash
# Clone project ini, lalu copy files yang dibutuhkan
git clone [this-project-url]
cp -r dex-platform/components your-project/src/
cp -r dex-platform/contexts your-project/src/
# ... dst
```

## 📦 **Step 2: Install Dependencies**

### **Required Dependencies**
```bash
npm install react@18 react-dom@18 typescript
npm install @types/react @types/react-dom @types/node
npm install tailwindcss postcss autoprefixer
npm install class-variance-authority clsx tailwind-merge
npm install lucide-react
npm install recharts
npm install sonner@2.0.3
npm install react-hook-form@7.55.0
npm install motion/react
npm install @hookform/resolvers
npm install zod
```

### **Optional Dependencies (jika diperlukan)**
```bash
npm install react-router-dom
npm install @types/react-router-dom
```

## ⚙️ **Step 3: Configuration Files**

### **3.1 Tailwind Config**
Buat file `tailwind.config.js`:
```javascript
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
```

### **3.2 PostCSS Config**
Buat file `postcss.config.js`:
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### **3.3 TypeScript Config**
Update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": false,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/ui/*": ["./src/components/ui/*"]
    }
  },
  "include": [
    "src/**/*",
    "src/components/**/*",
    "src/contexts/**/*",
    "src/utils/**/*",
    "src/services/**/*"
  ],
  "exclude": ["node_modules"]
}
```

### **3.4 Vite Config (jika menggunakan Vite)**
Update `vite.config.ts`:
```typescript
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
```

## 🎨 **Step 4: CSS Import**

### **4.1 Main CSS File**
Di file `src/main.tsx` atau `src/index.tsx`, tambahkan:
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'  // ← Import CSS ini

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### **4.2 Additional Dependencies untuk CSS**
```bash
npm install tailwindcss-animate
```

## 🔧 **Step 5: Fix Import Paths**

### **5.1 Update Import Paths di App.tsx**
Ganti semua import relatif menjadi absolut:
```typescript
// Dari:
import { Header } from './components/Header';

// Menjadi (jika menggunakan src folder):
import { Header } from './components/Header';
// atau dengan path alias:
import { Header } from '@/components/Header';
```

### **5.2 Update Component Imports**
Di semua files component, pastikan import path benar:
```typescript
// Contoh di SpotTrading.tsx:
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Select } from './ui/select';
```

## 📱 **Step 6: Logo & Assets**

### **6.1 Logo Setup**
Jika Anda punya logo custom:
```bash
# Copy logo ke public folder
cp your-logo.png public/
# atau ke src/assets/
mkdir src/assets
cp your-logo.png src/assets/
```

### **6.2 Update Logo Import**
Di `components/Header.tsx`, update logo path:
```typescript
// Jika logo di public folder:
<img src="/your-logo.png" alt="DEX Logo" />

// Jika logo di assets folder:
import logo from '../assets/your-logo.png';
<img src={logo} alt="DEX Logo" />
```

## 🚀 **Step 7: Testing Setup**

### **7.1 Start Development Server**
```bash
npm run dev
# atau
yarn dev
```

### **7.2 Test Checklist**
- [ ] App loads without errors
- [ ] All components render correctly
- [ ] Dark/Light mode toggle works
- [ ] Navigation between sections works
- [ ] Trading forms are functional
- [ ] Charts display properly
- [ ] No console errors

## 🐛 **Step 8: Common Issues & Fixes**

### **Issue 1: Module not found errors**
```bash
# Install missing packages:
npm install [missing-package-name]
```

### **Issue 2: CSS not loading**
```typescript
// Make sure globals.css is imported in main.tsx:
import './styles/globals.css'
```

### **Issue 3: TypeScript errors**
```bash
# Install missing type definitions:
npm install @types/[package-name]
```

### **Issue 4: Tailwind classes not working**
```bash
# Make sure Tailwind is configured:
npx tailwindcss init -p
# And content paths are correct in tailwind.config.js
```

### **Issue 5: ShadCN components not styled**
```bash
# Install required dependencies:
npm install tailwindcss-animate
npm install class-variance-authority clsx tailwind-merge
```

## 📋 **Step 9: Verification**

### **9.1 Component Test**
Test setiap major component:
```bash
# Buka di browser dan test:
- Homepage (3D effects, fractal background)
- Spot Trading (order book, trading controls)
- Portfolio (data display, filters)
- Cross-Chain (bridge interface)
- Analytics (charts, filters)
```

### **9.2 Functionality Test**
- [ ] Theme toggle (dark/light)
- [ ] Responsive design (mobile/desktop)
- [ ] Form interactions
- [ ] Data filtering
- [ ] Navigation
- [ ] Notifications

## 🎯 **Step 10: Customization**

### **10.1 Branding**
- Update logo di `components/Header.tsx`
- Ganti color scheme di `styles/globals.css`
- Update app title di `index.html`

### **10.2 Configuration**
- Modify chain list di trading components
- Update API endpoints di `services/api.ts`
- Customize notification settings

## 🔗 **Quick Commands Summary**

```bash
# Complete setup dari scratch:
npm create react-app my-dex --template typescript
cd my-dex
# Copy semua files DEX platform
npm install [all dependencies above]
# Setup config files
npm run dev
```

## 📞 **Support**

Jika ada error atau issue:
1. Check console errors
2. Verify all dependencies installed
3. Check import paths
4. Ensure CSS is imported correctly
5. Verify file structure matches exactly

---

🎉 **Selamat! DEX Platform sudah ready untuk digunakan!**