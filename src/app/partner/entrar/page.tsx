import { AuthScreen } from '@/components/auth/AuthScreen'

/**
 * Entrada propia de los Visit Partners: su logo, sus textos y su destino
 * (/partner) después de entrar. No pasa por el login de quien compra o vende.
 */
export default function PartnerEntryPage() {
  return <AuthScreen audience="partner" />
}
