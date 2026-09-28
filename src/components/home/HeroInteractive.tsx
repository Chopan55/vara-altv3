'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Home, TrendingUp, Link2, Loader2, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Intent = 'BUY' | 'SELL' | 'FOUND'

const intents = [
  {
    id: 'BUY' as Intent,
    icon: Home,
    label: 'Quiero comprar',
    sub: 'Busco propiedades y quiero entender costos y riesgos',
    showUrl: true,
  },
  {
    id: 'SELL' as Intent,
    icon: TrendingUp,
    label: 'Quiero vender',
    sub: 'Tengo una propiedad y quiero publicarla o gestionar la venta',
    showUrl: false,
  },
  {
    id: 'FOUND' as Intent,
    icon: Link2,
    label: 'Ya encontré una propiedad',
    sub: 'Tengo el link del aviso y quiero que VARA la analice',
    showUrl: true,
  },
]

export function HeroInteractive() {
  const router = useRouter()
  const [selected, setSelected] = useState<Intent | null>(null)
  const [url, setUrl] = useState('')
  const [going, setGoing] = useState(false)

  const active = intents.find(i => i.id === selected)
  const showUrlInput = active?.showUrl

  function handleStart() {
    if (!selected) return
    setGoing(true)
    try {
      const typeMap: Record<Intent, string> = {
        BUY: 'BUY_PROPERTY',
        SELL: 'SELL_PROPERTY',
        FOUND: 'BUY_PROPERTY',
      }
      localStorage.setItem('vara_hero_intent', typeMap[selected])
      if (url.trim()) localStorage.setItem('vara_hero_url', url.trim())
      else localStorage.removeItem('vara_hero_url')
    } catch {}

    const params = new URLSearchParams({ intent: selected })
    router.push(`/onboarding?${params}`)
  }

  return (
    <div className="space-y-4">
      {/* Intent selector */}
      <div className="space-y-2.5">
        {intents.map(({ id, icon: Icon, label, sub }) => (
          <button
            key={id}
            onClick={() => setSelected(id)}
            className={cn(
              'w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 text-left transition-all duration-150',
              selected === id
                ? 'border-brand-500 bg-brand-50 shadow-sm'
                : 'border-slate-200 hover:border-brand-300 bg-white'
            )}
          >
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
              selected === id ? 'bg-brand-100' : 'bg-slate-50'
            )}>
              <Icon size={18} className={selected === id ? 'text-brand-600' : 'text-slate-400'} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('font-bold text-sm', selected === id ? 'text-brand-800' : 'text-slate-800')}>
                {label}
              </p>
              <p className="text-xs text-slate-400 leading-snug mt-0.5 hidden sm:block">{sub}</p>
            </div>
            {selected === id && (
              <CheckCircle2 size={16} className="text-brand-500 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* URL input */}
      {showUrlInput && (
        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
            <Link2 size={15} />
          </div>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && selected && handleStart()}
            placeholder={
              selected === 'FOUND'
                ? 'Pegá el link del aviso (Zonaprop, MeLi, Argenprop…)'
                : 'Pegá el link de una propiedad que estés mirando (opcional)'
            }
            className="w-full pl-10 pr-10 py-3.5 rounded-xl border-2 border-slate-200 focus:border-brand-400 outline-none text-slate-700 text-sm placeholder:text-slate-300 transition-colors bg-white"
          />
          {url && (
            <button
              onClick={() => setUrl('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
              aria-label="Limpiar"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={handleStart}
        disabled={!selected || going}
        className={cn(
          'w-full font-bold text-base py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm',
          selected
            ? 'bg-brand-600 hover:bg-brand-500 text-white cursor-pointer'
            : 'bg-slate-100 text-slate-300 cursor-not-allowed'
        )}
      >
        {going ? (
          <><Loader2 size={18} className="animate-spin" /> Un momento…</>
        ) : (
          <>Empezar con VARA <ArrowRight size={16} /></>
        )}
      </button>

      <p className="text-center text-xs text-slate-400">
        Sin registro · Gratis · Listo en 2 minutos
      </p>
    </div>
  )
}
