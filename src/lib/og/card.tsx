/**
 * Tarjeta que muestran WhatsApp, Instagram y compañía cuando alguien pega un
 * link de VARA. Se genera en el build (no usa datos de nadie).
 */

import { ImageResponse } from 'next/og'

export const OG_SIZE = { width: 1200, height: 630 }

export function ogCard({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: '64px 72px', background: 'linear-gradient(135deg, #14123a 0%, #2b2a7a 60%, #4748cf 100%)', color: 'white',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: '#8a8cf0', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 800, color: '#14123a',
          }}>V</div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 2 }}>VARA</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 28, color: '#b2b4f4', fontWeight: 600 }}>{eyebrow}</div>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, maxWidth: 1000 }}>{title}</div>
          <div style={{ fontSize: 32, color: '#d3d4f9', lineHeight: 1.3, maxWidth: 1000 }}>{subtitle}</div>
        </div>
        <div style={{ fontSize: 24, color: '#b2b4f4' }}>Argentina · México</div>
      </div>
    ),
    OG_SIZE,
  )
}
