import { AuthScreen } from '@/components/auth/AuthScreen'

/** Entrada de quien compra o vende. La de los Visit Partners es /partner/entrar. */
export default function LoginPage() {
  return <AuthScreen audience="client" />
}
