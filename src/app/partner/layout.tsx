import { PartnerBar } from '@/components/partner/PartnerBar'

/**
 * El portal de Visit Partners tiene su propia cara: no hereda el menú de quien
 * compra o vende (AppShell lo deja pasar sin menú para /partner).
 */
export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <PartnerBar />
      {children}
    </div>
  )
}
