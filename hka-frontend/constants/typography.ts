// Typography System
export const TYPOGRAPHY = {
  // Font families
  fonts: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
    display: ['Inter', 'system-ui', 'sans-serif']
  },

  // Font sizes (using Tailwind scale)
  sizes: {
    xs: 'text-xs',     // 12px
    sm: 'text-sm',     // 14px  
    base: 'text-base', // 16px
    lg: 'text-lg',     // 18px
    xl: 'text-xl',     // 20px
    '2xl': 'text-2xl', // 24px
    '3xl': 'text-3xl', // 30px
    '4xl': 'text-4xl'  // 36px
  },

  // Font weights
  weights: {
    light: 'font-light',      // 300
    normal: 'font-normal',    // 400
    medium: 'font-medium',    // 500
    semibold: 'font-semibold', // 600
    bold: 'font-bold',        // 700
    extrabold: 'font-extrabold' // 800
  },

  // Line heights
  leading: {
    tight: 'leading-tight',   // 1.25
    normal: 'leading-normal', // 1.5
    relaxed: 'leading-relaxed' // 1.625
  },

  // Letter spacing
  tracking: {
    tight: 'tracking-tight',   // -0.025em
    normal: 'tracking-normal', // 0em
    wide: 'tracking-wide'      // 0.025em
  }
};

// Typography presets for common use cases
export const TEXT_STYLES = {
  // Headings
  h1: `${TYPOGRAPHY.sizes['3xl']} ${TYPOGRAPHY.weights.bold} ${TYPOGRAPHY.leading.tight} ${TYPOGRAPHY.tracking.tight}`,
  h2: `${TYPOGRAPHY.sizes['2xl']} ${TYPOGRAPHY.weights.bold} ${TYPOGRAPHY.leading.tight}`,
  h3: `${TYPOGRAPHY.sizes.xl} ${TYPOGRAPHY.weights.semibold} ${TYPOGRAPHY.leading.tight}`,
  h4: `${TYPOGRAPHY.sizes.lg} ${TYPOGRAPHY.weights.semibold}`,
  h5: `${TYPOGRAPHY.sizes.base} ${TYPOGRAPHY.weights.semibold}`,
  h6: `${TYPOGRAPHY.sizes.sm} ${TYPOGRAPHY.weights.semibold}`,

  // Body text
  body: `${TYPOGRAPHY.sizes.base} ${TYPOGRAPHY.weights.normal} ${TYPOGRAPHY.leading.normal}`,
  bodyLg: `${TYPOGRAPHY.sizes.lg} ${TYPOGRAPHY.weights.normal} ${TYPOGRAPHY.leading.normal}`,
  bodySm: `${TYPOGRAPHY.sizes.sm} ${TYPOGRAPHY.weights.normal} ${TYPOGRAPHY.leading.normal}`,

  // UI text
  label: `${TYPOGRAPHY.sizes.sm} ${TYPOGRAPHY.weights.medium}`,
  caption: `${TYPOGRAPHY.sizes.xs} ${TYPOGRAPHY.weights.normal}`,
  button: `${TYPOGRAPHY.sizes.sm} ${TYPOGRAPHY.weights.semibold}`,

  // Numbers/Data
  price: `${TYPOGRAPHY.sizes.lg} ${TYPOGRAPHY.weights.semibold} font-mono`,
  priceXl: `${TYPOGRAPHY.sizes['2xl']} ${TYPOGRAPHY.weights.bold} font-mono`,
  percentage: `${TYPOGRAPHY.sizes.sm} ${TYPOGRAPHY.weights.medium} font-mono`,
  address: `${TYPOGRAPHY.sizes.xs} font-mono ${TYPOGRAPHY.tracking.tight}`,

  // Status
  success: `${TYPOGRAPHY.sizes.sm} ${TYPOGRAPHY.weights.medium} text-green-600`,
  error: `${TYPOGRAPHY.sizes.sm} ${TYPOGRAPHY.weights.medium} text-red-600`,
  warning: `${TYPOGRAPHY.sizes.sm} ${TYPOGRAPHY.weights.medium} text-yellow-600`,
  info: `${TYPOGRAPHY.sizes.sm} ${TYPOGRAPHY.weights.medium} text-blue-600`
};

// Color classes for text
export const TEXT_COLORS = {
  primary: 'text-foreground',
  secondary: 'text-muted-foreground', 
  tertiary: 'text-muted-foreground/70',
  accent: 'text-dex-blue',
  success: 'text-dex-success',
  danger: 'text-dex-danger',
  warning: 'text-dex-warning',
  white: 'text-white',
  black: 'text-black'
};
