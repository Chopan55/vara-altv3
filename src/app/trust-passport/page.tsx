'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Shield, CheckCircle2, Circle,
  Award, FileText, Loader2, Info,
} from 'lucide-react'
import { tryCreateClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { getMyIdentity } from '@/lib/supabase/identity'
import type { IdentityVerificationRow } from '@/lib/supabase/types'
import { IdentityVerificationCard } from '@/components/trust/IdentityVerificationCard'
import { cn } from '@/lib/utils'

interface TrustSignal {
  id: string
  label: string
  description: string
  verified: boolean
  icon: React.ElementType
  points: number
  actionLabel?: string
  actionHref?: string
}

interface ProfileData {
  hasName: boolean
  hasPhone: boolean
}

export default function TrustPassportPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileData>({ hasName: false, hasPhone: false })
  const [operationsCount, setOperationsCount] = useState(0)
  const [identity, setIdentity] = useState<IdentityVerificationRow | null>(null)
  const [identityNotReady, setIdentityNotReady] = useState(false)
  const reloadIdentity = () => {
    void getMyIdentity().then(r => { setIdentity(r.data); setIdentityNotReady(r.error === 'NOT_READY') })
  }
  // Sin base configurada no hay nada que cargar.
  const [done, setDone] = useState(false)
  const loading = isSupabaseConfigured && !done

  useEffect(() => {
    const client = tryCreateClient()
    if (!client) return
    let alive = true
    void getMyIdentity().then(r => {
      if (!alive) return
      setIdentity(r.data); setIdentityNotReady(r.error === 'NOT_READY')
    })
    Promise.all([
      client.auth.getUser(),
      client.from('profiles').select('full_name, phone').maybeSingle(),
      client.from('operations').select('id', { count: 'exact', head: true }),
    ]).then(([{ data: authData }, { data: profileData }, { count }]) => {
      if (!alive) return
      setUserEmail(authData.user?.email_confirmed_at ? (authData.user.email ?? null) : null)
      setProfile({
        hasName: !!profileData?.full_name?.trim(),
        hasPhone: !!profileData?.phone?.trim(),
      })
      setOperationsCount(count ?? 0)
      setDone(true)
    }).catch(() => { if (alive) setDone(true) })
    return () => { alive = false }
  }, [])

  const signals: TrustSignal[] = [
    {
      id: 'email',
      label: 'Email verificado',
      description: 'Tu dirección de correo fue confirmada.',
      verified: !!userEmail,
      icon: CheckCircle2,
      points: 25,
    },
    {
      id: 'name',
      label: 'Nombre registrado',
      description: 'Tu nombre completo está cargado en tu cuenta.',
      verified: profile.hasName,
      icon: profile.hasName ? CheckCircle2 : Circle,
      points: 10,
    },
    {
      id: 'phone',
      label: 'Teléfono registrado',
      description: 'Número de celular cargado en tu cuenta.',
      verified: profile.hasPhone,
      icon: profile.hasPhone ? CheckCircle2 : Circle,
      points: 15,
    },
    {
      id: 'identity',
      label: 'Identidad verificada',
      description: identity?.status === 'VERIFIED'
        ? 'DNI y selfie revisados por VARA.'
        : identity?.status === 'SUBMITTED'
        ? 'Documentos enviados, en revisión.'
        : 'DNI y selfie revisados por una persona de VARA.',
      verified: identity?.status === 'VERIFIED',
      icon: FileText,
      points: 30,
    },
    {
      id: 'operations',
      label: 'Historial de operaciones',
      description: operationsCount > 0
        ? `${operationsCount} operación${operationsCount !== 1 ? 'es' : ''} en VARA.`
        : 'Operaciones completadas en VARA.',
      verified: operationsCount > 0,
      icon: operationsCount > 0 ? Award : Circle,
      points: 20,
    },
  ]

  const earned = signals.filter(s => s.verified).reduce((sum, s) => sum + s.points, 0)
  const total = signals.reduce((sum, s) => sum + s.points, 0)
  const score = Math.round((earned / total) * 100)

  const trustLabel =
    score >= 80
      ? { label: 'Confianza alta', color: 'text-emerald-700', bg: 'bg-emerald-50' }
      : score >= 40
      ? { label: 'Confianza media', color: 'text-amber-700', bg: 'bg-amber-50' }
      : { label: 'Confianza básica', color: 'text-slate-600', bg: 'bg-slate-100' }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" aria-label="Volver" className="-m-2 p-2 text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[var(--foreground)] leading-tight">
              Trust Passport
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Tu perfil de confianza en VARA</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={20} className="animate-spin text-slate-300" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tarjeta de perfil */}
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5">
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center">
                    <Shield size={28} className="text-brand-500" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center">
                    <span className="text-[10px] font-black text-brand-600">{score}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 truncate">{userEmail ?? 'Usuario VARA'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full',
                        trustLabel.bg,
                        trustLabel.color,
                      )}
                    >
                      {trustLabel.label}
                    </span>
                    <span className="text-xs text-slate-400">{score}/100 pts</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-500"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Señales */}
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-800">Señales de confianza</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {signals.map(signal => {
                  const Icon = signal.icon
                  return (
                    <div key={signal.id} className="flex items-center gap-3 px-5 py-4">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0',
                          signal.verified ? 'bg-emerald-50' : 'bg-slate-50',
                        )}
                      >
                        <Icon
                          size={15}
                          className={signal.verified ? 'text-emerald-500' : 'text-slate-300'}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{signal.label}</p>
                        <p className="text-xs text-slate-500">{signal.description}</p>
                        {!signal.verified && signal.actionHref && (
                          <Link
                            href={signal.actionHref}
                            className="text-[10px] font-semibold text-brand-600 hover:underline"
                          >
                            {signal.actionLabel} →
                          </Link>
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0',
                          signal.verified
                            ? 'text-emerald-600 bg-emerald-50'
                            : 'text-slate-400 bg-slate-100',
                        )}
                      >
                        {signal.verified ? `+${signal.points}` : `${signal.points} pts`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            <IdentityVerificationCard row={identity} notReady={identityNotReady} onSubmitted={reloadIdentity} />

            {/* Info */}
            <div className="bg-brand-50 rounded-2xl border border-brand-100 p-4">
              <div className="flex items-start gap-2">
                <Info size={14} className="text-brand-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-brand-700 mb-1">¿Para qué sirve?</p>
                  <p className="text-xs text-brand-600 leading-relaxed">
                    Cuando compartís una operación, vos y tus invitados ven las señales del otro
                    (email confirmado, teléfono, identidad verificada) antes de avanzar. Nunca se
                    muestran tus archivos ni tus datos de contacto.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
