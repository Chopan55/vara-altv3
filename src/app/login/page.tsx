import { redirect } from 'next/navigation'
import { AuthScreen } from '@/components/auth/AuthScreen'
import { loginRedirect } from '@/lib/auth/entryJourney'
import { getCurrentUser } from '@/lib/supabase/server'

/**
 * Entrada de quien compra o vende. La de los Visit Partners es /partner/entrar.
 * Con sesión válida no se vuelve a mostrar el formulario: se redirige a /dashboard
 * (o al `next` seguro que traiga). Sin sesión, o con Supabase sin configurar, se muestra el login.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams
  const target = loginRedirect(Boolean(await getCurrentUser()), Array.isArray(next) ? next[0] : next)
  if (target) redirect(target)
  return <AuthScreen audience="client" />
}
