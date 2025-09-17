# 🚀 HKA-DEX: Cross-Chain Trading Platform

> **Next-generation cross-chain DEX with AMM swaps and LayerZero-powered futures trading**

![DEX Platform](https://img.shields.io/badge/Platform-Cross%20Chain%20DEX-blue?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss)

## ✨ **Features**

### 🔄 **Cross-Chain Swaps (AMM + Escrow)**
- **Efficient swaps** with custom AMM technology
- **Cross-chain escrow** for secure multi-chain transfers
- **Multi-network support** with real-time quotes

### � **Cross-Chain Futures Trading**
- **LayerZero V2 messaging** for cross-chain execution
- **Leverage trading** up to 100x across multiple chains
- **Unified margin** and cross-chain position management
- **Real-time settlement** with institutional-grade infrastructure

### 🔗 **Cross-Chain Technology**
- **LayerZero integration** for seamless cross-chain messaging
- **Custom AMM** for efficient swap execution
- **Multi-network support** (Ethereum, Arbitrum, Polygon, BSC, etc.)
- **Gas optimization** and transaction tracking

### 💼 **Portfolio Management**
- **Multi-chain portfolio** tracking
- **Real-time PnL** calculation
- **Transaction history** and analytics
- **Asset allocation** visualization

### 📈 **Advanced Features**
- **Dark/Light theme** toggle
- **Responsive design** (mobile-first)
- **Real-time notifications** with Sonner
- **Professional charts** with Recharts
- **Comprehensive analytics** dashboard

---

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+ 
- npm or yarn
- Git

### **Installation**
```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/dex-trading-platform.git
cd dex-trading-platform

# Install dependencies
npm install

# Start development server
npm run dev
```

### **Open Application**
```
http://localhost:5173
```

---

## 📱 **Screenshots**

### Desktop Interface
- Clean, professional trading interface
- Real-time charts and data
- Advanced order management

### Mobile Interface  
- Optimized bottom navigation
- Collapsible sections for space efficiency
- Touch-friendly controls

---

## 🛠️ **Tech Stack**

| Category | Technology |
|----------|------------|
| **Frontend** | React 18, TypeScript 5.0 |
| **Styling** | TailwindCSS 3.4, ShadCN/UI |
| **Charts** | Recharts, Enhanced Charts |
| **Animation** | Motion (Framer Motion) |
| **Forms** | React Hook Form, Zod |
| **Icons** | Lucide React |
| **Notifications** | Sonner |
| **Build Tool** | Vite 5.0 |

---

## 📂 **Project Structure**

```
src/
├── components/           # React components
│   ├── ui/              # ShadCN UI components
│   ├── SpotTrading.tsx  # AMM trading interface
│   ├── PerpetualFutures.tsx # Futures trading
│   ├── CrossChain.tsx   # Bridge interface
│   ├── Portfolio.tsx    # Portfolio management
│   └── ...
├── contexts/            # React contexts
│   └── DEXContext.tsx   # Global state management
├── services/            # API and WebSocket services
│   ├── api.ts          # REST API calls
│   └── websocket.ts    # Real-time data
├── styles/             # Global styles
│   └── globals.css     # TailwindCSS + custom styles
└── utils/              # Utility functions
    └── storage.ts      # Local storage helpers
```

---

## 🎨 **Design System**

### **Colors**
```css
--dex-success: #22C55E  /* Buy/Long actions */
--dex-danger: #EF4444   /*
--dex-blue: #3B82F6     /* Primary brand color */
```

### **Components**
- **40+ ShadCN components** included
- **Consistent spacing** with Tailwind
- **Responsive breakpoints** for all devices
- **Accessibility** built-in

---

## 📋 **Available Scripts**

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

---

## 🔧 **Configuration**

### **Environment Variables**
```bash
# Create .env file
VITE_API_URL=https://your-api-endpoint
VITE_WS_URL=wss://your-websocket-endpoint
VITE_CHAIN_ID=1
```

### 🔒 Security & Environment Hygiene
- Never commit real secrets. Use `.env.local` (git-ignored) for local values.
- We removed accidental secrets and added `SECURITY_ENV.md` with guidance.
- Public runtime vars must be prefixed with `VITE_`.
- For contract admin keys or private RPCs, keep them in backend-only envs.

### **Customization**
- **Logo**: Update in `components/Header.tsx`
- **Colors**: Modify `styles/globals.css`
- **Networks**: Configure in trading components
- **API**: Update endpoints in `services/api.ts`

---

## 📱 **Mobile Features**

### **Responsive Navigation**
- Bottom navigation for mobile
- Collapsible sections
- Touch-optimized controls

### **Performance**
- **Lazy loading** for components
- **Optimized bundle** size
- **Fast refresh** during development

---

## 🛣️ **Roadmap**

### **Phase 1: Core Features** ✅
- [x] Spot Trading (AMM)
- [x] Perpetual Futures  
- [x] Cross-chain Bridge
- [x] Portfolio Management
- [x] Mobile Optimization

### **Phase 2: Advanced Features** 🚧
- [ ] Options Trading
- [ ] Staking/Farming
- [ ] NFT Marketplace
- [ ] Social Trading

### **Phase 3: Backend Integration** 📋
- [ ] Real API integration
- [ ] User authentication
- [ ] Database integration  
- [ ] WebSocket real-time data

---

## 🤝 **Contributing**

1. **Fork** the repository
2. **Create** feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** changes (`git commit -m 'Add amazing feature'`)
4. **Push** to branch (`git push origin feature/amazing-feature`)
5. **Open** Pull Request

---

## 📄 **License**

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- **ShadCN/UI** for beautiful components
- **TailwindCSS** for styling system
- **Recharts** for charting library
- **Lucide** for icon system
- **Motion** for animations

---

## 📞 **Support**

- **Documentation**: See `/guidelines` folder
- **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/dex-trading-platform/issues)
- **Discussions**: [GitHub Discussions](https://github.com/YOUR_USERNAME/dex-trading-platform/discussions)

---

**Built with ❤️ for the DeFi community**

![Made with React](https://img.shields.io/badge/Made%20with-React-61DAFB?style=flat&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6?style=flat&logo=typescript)
![Mobile Friendly](https://img.shields.io/badge/Mobile-Friendly-4CAF50?style=flat&logo=mobile)