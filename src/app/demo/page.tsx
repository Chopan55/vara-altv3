import { redirect } from 'next/navigation'

/**
 * La demo con datos ficticios se retiró: VARA no muestra datos inventados en ninguna pantalla.
 * Quien llegue por un enlace viejo vuelve al inicio, donde se prueba con un aviso real.
 */
export default function DemoPage() {
  redirect('/')
}
