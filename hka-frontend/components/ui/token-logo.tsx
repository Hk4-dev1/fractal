// Use your provided ETH logo for all tokens for now
import ethPng from '../../logo/ethereum.png'

type TokenLogoProps = {
  symbol?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
}

export function TokenLogo({ symbol = 'ETH', size = 'sm', className = '' }: TokenLogoProps) {
  const px = SIZE_MAP[size]
  return (
    <img
      src={ethPng}
      alt={`${symbol} logo`}
      width={px}
      height={px}
      className={`rounded-full object-contain ${className}`}
      style={{ width: px, height: px }}
    />
  )
}
