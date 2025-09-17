# 📋 Manual Migration Guide - Step by Step

> **Copy each file individually from Figma Make to your workspace**

## 🎯 **Setup Your Project Structure First**

In your workspace, create this exact folder structure:

```
your-project/
├── src/
│   ├── App.tsx
│   ├── components/
│   │   ├── figma/
│   │   └── ui/
│   ├── contexts/
│   ├── services/
│   ├── styles/
│   └── utils/
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
└── vite.config.ts
```

---

## 📁 **Step 1: Copy Main Files**

### **1.1 App.tsx**
```bash
# Copy content from Figma Make /App.tsx
# Paste to: your-project/src/App.tsx
```

### **1.2 Package.json** 
Create `package.json` in root:
```json
{
  "name": "dex-trading-platform",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.2.2",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.32",
    "autoprefixer": "^10.4.16",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.300.0",
    "recharts": "^2.8.0",
    "sonner": "2.0.3",
    "react-hook-form": "7.55.0",
    "motion": "^10.16.0",
    "@hookform/resolvers": "^3.3.0",
    "zod": "^3.22.0",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@types/node": "^20.10.0",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5"
  }
}
```

---

## 📂 **Step 2: Copy Components (19 files)**

Create folder: `src/components/`

### **Main Components:**
1. **Analytics.tsx** - Copy from `/components/Analytics.tsx`
2. **CrossChain.tsx** - Copy from `/components/CrossChain.tsx`
3. **EnhancedChart.tsx** - Copy from `/components/EnhancedChart.tsx`
4. **ErrorBoundary.tsx** - Copy from `/components/ErrorBoundary.tsx`
5. **Footer.tsx** - Copy from `/components/Footer.tsx`
6. **Header.tsx** - Copy from `/components/Header.tsx`
7. **Homepage.tsx** - Copy from `/components/Homepage.tsx`
8. **Market.tsx** - Copy from `/components/Market.tsx`
9. **MobileBottomNav.tsx** - Copy from `/components/MobileBottomNav.tsx`
10. **MobileNavigation.tsx** - Copy from `/components/MobileNavigation.tsx`
11. **NotificationCenter.tsx** - Copy from `/components/NotificationCenter.tsx`
12. **OrderManagement.tsx** - Copy from `/components/OrderManagement.tsx`
13. **PerpetualFutures.tsx** - Copy from `/components/PerpetualFutures.tsx`
14. **Portfolio.tsx** - Copy from `/components/Portfolio.tsx`
15. **Settings.tsx** - Copy from `/components/Settings.tsx`
16. **Sidebar.tsx** - Copy from `/components/Sidebar.tsx`
17. **SpotTrading.tsx** - Copy from `/components/SpotTrading.tsx`
18. **TradingHistory.tsx** - Copy from `/components/TradingHistory.tsx`
19. **Watchlist.tsx** - Copy from `/components/Watchlist.tsx`

---

## 🎨 **Step 3: Copy UI Components (37 files)**

Create folder: `src/components/ui/`

### **ShadCN UI Components:**
1. **accordion.tsx** - Copy from `/components/ui/accordion.tsx`
2. **alert-dialog.tsx** - Copy from `/components/ui/alert-dialog.tsx`
3. **alert.tsx** - Copy from `/components/ui/alert.tsx`
4. **aspect-ratio.tsx** - Copy from `/components/ui/aspect-ratio.tsx`
5. **avatar.tsx** - Copy from `/components/ui/avatar.tsx`
6. **badge.tsx** - Copy from `/components/ui/badge.tsx`
7. **breadcrumb.tsx** - Copy from `/components/ui/breadcrumb.tsx`
8. **button.tsx** - Copy from `/components/ui/button.tsx`
9. **calendar.tsx** - Copy from `/components/ui/calendar.tsx`
10. **card.tsx** - Copy from `/components/ui/card.tsx`
11. **carousel.tsx** - Copy from `/components/ui/carousel.tsx`
12. **chart.tsx** - Copy from `/components/ui/chart.tsx`
13. **checkbox.tsx** - Copy from `/components/ui/checkbox.tsx`
14. **collapsible.tsx** - Copy from `/components/ui/collapsible.tsx`
15. **command.tsx** - Copy from `/components/ui/command.tsx`
16. **context-menu.tsx** - Copy from `/components/ui/context-menu.tsx`
17. **dialog.tsx** - Copy from `/components/ui/dialog.tsx`
18. **drawer.tsx** - Copy from `/components/ui/drawer.tsx`
19. **dropdown-menu.tsx** - Copy from `/components/ui/dropdown-menu.tsx`
20. **form.tsx** - Copy from `/components/ui/form.tsx`
21. **hover-card.tsx** - Copy from `/components/ui/hover-card.tsx`
22. **input-otp.tsx** - Copy from `/components/ui/input-otp.tsx`
23. **input.tsx** - Copy from `/components/ui/input.tsx`
24. **label.tsx** - Copy from `/components/ui/label.tsx`
25. **menubar.tsx** - Copy from `/components/ui/menubar.tsx`
26. **navigation-menu.tsx** - Copy from `/components/ui/navigation-menu.tsx`
27. **pagination.tsx** - Copy from `/components/ui/pagination.tsx`
28. **popover.tsx** - Copy from `/components/ui/popover.tsx`
29. **progress.tsx** - Copy from `/components/ui/progress.tsx`
30. **radio-group.tsx** - Copy from `/components/ui/radio-group.tsx`
31. **resizable.tsx** - Copy from `/components/ui/resizable.tsx`
32. **scroll-area.tsx** - Copy from `/components/ui/scroll-area.tsx`
33. **select.tsx** - Copy from `/components/ui/select.tsx`
34. **separator.tsx** - Copy from `/components/ui/separator.tsx`
35. **sheet.tsx** - Copy from `/components/ui/sheet.tsx`
36. **sidebar.tsx** - Copy from `/components/ui/sidebar.tsx`
37. **skeleton.tsx** - Copy from `/components/ui/skeleton.tsx`
38. **slider.tsx** - Copy from `/components/ui/slider.tsx`
39. **sonner.tsx** - Copy from `/components/ui/sonner.tsx`
40. **switch.tsx** - Copy from `/components/ui/switch.tsx`
41. **table.tsx** - Copy from `/components/ui/table.tsx`
42. **tabs.tsx** - Copy from `/components/ui/tabs.tsx`
43. **textarea.tsx** - Copy from `/components/ui/textarea.tsx`
44. **toggle-group.tsx** - Copy from `/components/ui/toggle-group.tsx`
45. **toggle.tsx** - Copy from `/components/ui/toggle.tsx`
46. **tooltip.tsx** - Copy from `/components/ui/tooltip.tsx`
47. **use-mobile.ts** - Copy from `/components/ui/use-mobile.ts`
48. **utils.ts** - Copy from `/components/ui/utils.ts`

### **Figma Components:**
49. **ImageWithFallback.tsx** - Copy from `/components/figma/ImageWithFallback.tsx`
    - Save to: `src/components/figma/ImageWithFallback.tsx`

---

## 🔧 **Step 4: Copy Contexts**

Create folder: `src/contexts/`

1. **DEXContext.tsx** - Copy from `/contexts/DEXContext.tsx`

---

## 🌐 **Step 5: Copy Services**

Create folder: `src/services/`

1. **api.ts** - Copy from `/services/api.ts`
2. **websocket.ts** - Copy from `/services/websocket.ts`

---

## 🎨 **Step 6: Copy Styles**

Create folder: `src/styles/`

1. **globals.css** - Copy from `/styles/globals.css`

---

## 🛠️ **Step 7: Copy Utils**

Create folder: `src/utils/`

1. **storage.ts** - Copy from `/utils/storage.ts`

---

## ⚙️ **Step 8: Create Config Files**

### **8.1 tsconfig.json**
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

### **8.2 tailwind.config.js**
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

### **8.3 postcss.config.js**
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### **8.4 vite.config.ts**
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

### **8.5 src/main.tsx**
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

### **8.6 index.html**
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DEX Trading Platform</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## 🚀 **Step 9: Install & Run**

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

---

## ✅ **Step 10: Verification Checklist**

- [ ] All 19 main components copied
- [ ] All 48 UI components copied  
- [ ] Context and services copied
- [ ] Styles and utils copied
- [ ] Config files created
- [ ] Dependencies installed
- [ ] App runs without errors
- [ ] Dark/light mode works
- [ ] All trading sections functional

---

## 🎯 **Quick Reference - File Count**

| Folder | File Count | Status |
|--------|------------|--------|
| **Main Components** | 19 files | ⏳ Pending |
| **UI Components** | 48 files | ⏳ Pending |
| **Contexts** | 1 file | ⏳ Pending |
| **Services** | 2 files | ⏳ Pending |
| **Styles** | 1 file | ⏳ Pending |
| **Utils** | 1 file | ⏳ Pending |
| **Config Files** | 6 files | ⏳ Pending |
| **TOTAL** | **78 files** | ⏳ **0/78** |

---

## 💡 **Pro Tips**

1. **Copy in order** - Start with config files, then main components
2. **Check imports** - Update import paths if needed  
3. **Test frequently** - Run `npm run dev` after copying each section
4. **Use search/replace** - If import paths need updating
5. **Create folders first** - Make sure folder structure exists

---

**🎉 You'll have a complete, working DEX platform after copying all 78 files!**