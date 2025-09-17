# 📦 Dependencies Checklist - DEX Platform

## ✅ **Core Dependencies (WAJIB)**

### **React & TypeScript**
```bash
npm install react@18 react-dom@18 typescript
npm install @types/react @types/react-dom @types/node
```

### **Tailwind CSS & Styling**
```bash
npm install tailwindcss postcss autoprefixer
npm install tailwindcss-animate
npm install class-variance-authority clsx tailwind-merge
```

### **UI & Form Libraries**
```bash
npm install lucide-react              # Icons
npm install recharts                  # Charts
npm install sonner@2.0.3             # Toast notifications
npm install react-hook-form@7.55.0   # Forms
npm install @hookform/resolvers       # Form validation
npm install zod                       # Schema validation
npm install motion/react              # Animations
```

## 🎯 **Verifikasi Package.json**

Setelah install, `package.json` Anda harus mengandung:

```json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^3.0.0",
    "tailwindcss-animate": "^1.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0",
    "lucide-react": "^0.400.0",
    "recharts": "^2.8.0",
    "sonner": "2.0.3",
    "react-hook-form": "7.55.0",
    "@hookform/resolvers": "^3.0.0",
    "zod": "^3.22.0",
    "motion": "^10.16.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "@types/node": "^20.0.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

## 🚀 **Quick Install Commands**

### **All in One (Copy-Paste Ready)**
```bash
npm install react@18 react-dom@18 typescript @types/react @types/react-dom @types/node tailwindcss postcss autoprefixer tailwindcss-animate class-variance-authority clsx tailwind-merge lucide-react recharts sonner@2.0.3 react-hook-form@7.55.0 @hookform/resolvers zod motion/react
```

### **Step by Step**
```bash
# Core React
npm install react@18 react-dom@18 typescript @types/react @types/react-dom @types/node

# Styling
npm install tailwindcss postcss autoprefixer tailwindcss-animate class-variance-authority clsx tailwind-merge

# UI Libraries  
npm install lucide-react recharts sonner@2.0.3 react-hook-form@7.55.0 @hookform/resolvers zod motion/react
```

## 🔍 **Version Check Commands**

```bash
# Check jika packages sudah terinstall dengan benar:
npm list react
npm list tailwindcss
npm list lucide-react
npm list recharts
npm list sonner
npm list react-hook-form
npm list motion
```

## ⚠️ **Important Version Notes**

1. **Sonner**: Harus versi `2.0.3` (specific version required)
2. **React Hook Form**: Harus versi `7.55.0` (specific version required)
3. **Motion**: Import dengan `motion/react` bukan `framer-motion`
4. **React**: Minimal versi 18 untuk concurrent features

## 🛠️ **Config Files Required**

Setelah install dependencies, pastikan files ini ada:

### **tailwind.config.js**
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // ... rest of config
}
```

### **postcss.config.js**
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

## 🎨 **Import Syntax Reference**

```typescript
// Correct import syntax:
import React from 'react';
import { motion } from 'motion/react';
import { Button } from './components/ui/button';
import { toast } from 'sonner@2.0.3';
import { useForm } from 'react-hook-form@7.55.0';
import { LineChart, XAxis, YAxis } from 'recharts';
import { Search, TrendingUp } from 'lucide-react';
```

## ✅ **Final Verification**

Run ini untuk memastikan semua dependency terinstall:

```bash
npm run dev
```

Jika ada error, jalankan:
```bash
npm install
npm audit fix
npm run dev
```

---

🎯 **Ready to go! Semua dependencies siap untuk DEX Platform!**