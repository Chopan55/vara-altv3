import Link from 'next/link'

interface VaraLogoProps {
  size?: number
  showText?: boolean
  className?: string
}

export function VaraLogo({ size = 32, showText = true, className = '' }: VaraLogoProps) {
  const h = size
  const w = size * 1.1

  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`}>
      {/* VARA mark: stylized V with upward arrow */}
      <svg width={w} height={h} viewBox="0 0 52 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Left arm — wave curve going into V bottom */}
        <path
          d="M5 22 C3 14 7 7 13 5 C17 3 20 6 19 12 L25 40"
          stroke="#6366d8"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Right arm — rises steeply from V bottom to arrow */}
        <path
          d="M25 40 L40 5"
          stroke="#6366d8"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Arrow head */}
        <path
          d="M40 5 L47 17"
          stroke="#6366d8"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M40 5 L30 7"
          stroke="#6366d8"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
      </svg>
      {showText && (
        <span
          className="font-extrabold tracking-tight select-none"
          style={{ color: '#333333', fontSize: size * 0.56, letterSpacing: '-0.02em' }}
        >
          +VARA
        </span>
      )}
    </Link>
  )
}
