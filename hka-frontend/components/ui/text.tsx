import React from 'react';
import { TEXT_STYLES, TEXT_COLORS } from '../../constants/typography';

interface TextProps {
  variant?: keyof typeof TEXT_STYLES;
  color?: keyof typeof TEXT_COLORS;
  className?: string;
  children: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div';
}

export function Text({ 
  variant = 'body', 
  color = 'primary',
  className = '',
  children,
  as: Component = 'div'
}: TextProps) {
  const baseClasses = TEXT_STYLES[variant];
  const colorClasses = TEXT_COLORS[color];
  
  return (
    <Component className={`${baseClasses} ${colorClasses} ${className}`}>
      {children}
    </Component>
  );
}

// Specific text components for common use cases
interface PriceProps {
  value: string | number;
  change?: string | number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSign?: boolean;
  className?: string;
}

export function Price({ 
  value, 
  change, 
  size = 'md',
  showSign = false, 
  className = '' 
}: PriceProps) {
  const sizeVariants: Record<string, keyof typeof TEXT_STYLES> = {
    sm: 'price',
    md: 'price', 
    lg: 'priceXl',
    xl: 'priceXl'
  };

  const formatValue = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 6 
    });
  };

  const formatChange = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Text variant={sizeVariants[size]} color="primary">
        {showSign && typeof value === 'number' && value >= 0 ? '+' : ''}
        ${formatValue(value)}
      </Text>
      
      {change !== undefined && (
        <Text 
          variant="percentage" 
          color={parseFloat(change.toString()) >= 0 ? 'success' : 'danger'}
        >
          {formatChange(change)}
        </Text>
      )}
    </div>
  );
}

interface AddressProps {
  address: string;
  length?: number;
  className?: string;
  showCopy?: boolean;
}

export function Address({ 
  address, 
  length = 6, 
  className = '',
  showCopy = false 
}: AddressProps) {
  const truncated = `${address.slice(0, length)}...${address.slice(-length)}`;
  
  const handleCopy = () => {
    navigator.clipboard.writeText(address);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Text variant="address" color="secondary">
        {truncated}
      </Text>
      {showCopy && (
        <button 
          onClick={handleCopy}
          className="p-1 hover:bg-accent rounded transition-colors"
        >
          📋
        </button>
      )}
    </div>
  );
}
