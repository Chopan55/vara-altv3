import Link from 'next/link'

/**
 * Logo de VARA Visit.
 *
 * Es de la misma familia que VARA (la misma V con la curva a la izquierda) pero se
 * distingue a primera vista: el brazo derecho termina en un pin de ubicación en
 * lugar de la flecha, y va en verde azulado en vez de índigo. Visit es ir al lugar.
 *
 * `tone="light"` es para fondos oscuros: el pin queda calado (se ve el fondo).
 */

interface VaraVisitLogoProps {
  size?: number
  tone?: 'dark' | 'light'
  href?: string
  showText?: boolean
  className?: string
}

export function VaraVisitLogo({
  size = 32, tone = 'dark', href = '/partner', showText = true, className = '',
}: VaraVisitLogoProps) {
  const mark = tone === 'light' ? '#ffffff' : '#0f766e'
  const text = tone === 'light' ? '#ffffff' : '#134e4a'

  return (
    <Link href={href} aria-label="VARA Visit" className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width={size * 1.08} height={size} viewBox="0 0 56 52" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M5 22 C3 14 7 7 13 5 C17 3 20 6 19 12 L25 45"
          stroke={mark} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"
        />
        <path d="M25 45 L41 27" stroke={mark} strokeWidth="5.5" strokeLinecap="round" />
        {/* Pin con el centro calado. */}
        <path
          fill={mark} fillRule="evenodd"
          d="M44 2 C38.2 2 33.5 6.6 33.5 12.3 C33.5 19.5 44 30 44 30 C44 30 54.5 19.5 54.5 12.3 C54.5 6.6 49.8 2 44 2 Z M40 12.3 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 Z"
        />
      </svg>
      {showText && (
        <span className="select-none leading-none" style={{ fontSize: size * 0.62, letterSpacing: '-0.02em', color: text }}>
          <span className="font-extrabold">VARA</span>
          <span className="font-light"> Visit</span>
        </span>
      )}
    </Link>
  )
}
