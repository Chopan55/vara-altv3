'use client'
import { Shield, Star, MapPin, CheckCircle2, Clock, BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TIER_CRITERIA, tierLabel,
  type PartnerPublicProfile, type PartnerTier,
} from '@/types/varaVisit'
import { formatVisitPrice } from '@/lib/varaVisit/pricing'

/**
 * Tarjeta pública de un Visit Partner.
 *
 * Recibe `PartnerPublicProfile` y nada más. Ese tipo no tiene teléfono, ni
 * email, ni domicilio, ni documento: la barrera de privacidad es el tipo, no
 * la disciplina de quien escribe la pantalla.
 *
 * Todo lo que se muestra es una métrica cruda y verificable. No hay un score
 * de 0 a 100: quien tiene que decidir si deja entrar a alguien a su casa no
 * puede hacer nada con un número inventado.
 */

export function TierBadge({ tier, className }: { tier: PartnerTier; className?: string }) {
  const criteria = TIER_CRITERIA.find(t => t.tier === tier)
  return (
    <span
      title={criteria ? criteria.requirements.join(' · ') : undefined}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
        tier === 'TRAINEE'
          ? 'bg-slate-100 text-slate-600'
          : 'bg-emerald-50 text-emerald-700',
        className,
      )}
    >
      <BadgeCheck size={10} aria-hidden="true" />
      {tierLabel(tier)}
    </span>
  )
}

/**
 * Verificaciones como afirmaciones simples.
 * Nunca se muestra el documento en sí: solo si VARA lo verificó.
 */
export function VerificationList({ partner }: { partner: PartnerPublicProfile }) {
  const items = [
    { ok: partner.verifiedIdentity, label: 'Identidad verificada' },
    { ok: partner.verifiedDocument, label: 'Documento verificado' },
    { ok: partner.verifiedPhone, label: 'Teléfono verificado' },
    { ok: partner.certified, label: 'VARA Certified' },
  ].filter(i => i.ok)

  if (items.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {items.map(i => (
        <li key={i.label} className="flex items-center gap-1 text-[11px] text-emerald-700">
          <CheckCircle2 size={11} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

/**
 * Métricas crudas, cada una con su unidad.
 * Un partner sin historial lo dice, no muestra 0% — que se leería como
 * "nunca llega a horario" en vez de "todavía no tiene visitas".
 */
export function PartnerMetricsRow({ partner }: { partner: PartnerPublicProfile }) {
  const m = partner.metrics

  if (m.completedVisits === 0 && m.reviewCount === 0) {
    return (
      <p className="text-[11px] text-slate-500">
        Todavía no hizo visitas con VARA. Está certificado y verificado.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
      {m.averageRating !== null && (
        <span className="flex items-center gap-1 font-semibold text-slate-800">
          <Star size={11} className="text-amber-500 fill-amber-500" aria-hidden="true" />
          {m.averageRating.toFixed(2)}
          <span className="font-normal text-slate-400">({m.reviewCount})</span>
        </span>
      )}
      <span>{m.completedVisits} visitas</span>
      {m.punctualityRate !== null && (
        <span className="flex items-center gap-1">
          <Clock size={10} aria-hidden="true" />
          {Math.round(m.punctualityRate * 100)}% puntualidad
        </span>
      )}
      {m.completionRate !== null && (
        <span>{Math.round(m.completionRate * 100)}% completadas</span>
      )}
      {m.incidentCount === 0 && <span className="text-emerald-700">Sin incidentes</span>}
    </div>
  )
}

export function PartnerAvatar({ partner, size = 44 }: { partner: PartnerPublicProfile; size?: number }) {
  return (
    <div
      className="rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
    >
      {partner.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={partner.photoUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-sm font-bold text-brand-700">{partner.initials}</span>
      )}
    </div>
  )
}

export function PartnerCard({
  partner,
  reasons,
  selected,
  onSelect,
  zoneLabel,
}: {
  partner: PartnerPublicProfile
  /** Por qué VARA lo propone. Hace auditable el orden de la lista. */
  reasons?: string[]
  selected?: boolean
  onSelect?: (id: string) => void
  /** Zona de la visita, para decir si trabaja habitualmente ahí. */
  zoneLabel?: string
}) {
  const worksHere = zoneLabel
    ? partner.homeZoneLabel.toLowerCase().includes(zoneLabel.toLowerCase())
    : false

  const body = (
    <div className="flex items-start gap-3">
      <PartnerAvatar partner={partner} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-slate-900 text-sm">{partner.displayName}</p>
          <TierBadge tier={partner.tier} />
        </div>

        {partner.profession && (
          <p className="text-[11px] text-slate-500 mt-0.5">
            {partner.profession}
            {partner.experienceYears ? ` · ${partner.experienceYears} años de experiencia` : ''}
          </p>
        )}

        <p className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
          <MapPin size={10} aria-hidden="true" />
          {partner.homeZoneLabel}
          {worksHere && (
            <span className="text-brand-700 font-medium">· Trabaja habitualmente acá</span>
          )}
        </p>

        <div className="mt-2"><PartnerMetricsRow partner={partner} /></div>
        <div className="mt-2"><VerificationList partner={partner} /></div>

        {reasons && reasons.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {reasons.map(r => (
              <li key={r} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                <Shield size={9} className="text-brand-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="text-right flex-shrink-0">
        <p className="font-bold text-slate-900 text-sm">
          {formatVisitPrice(partner.ratePerVisit, partner.currency)}
        </p>
        <p className="text-[10px] text-slate-400">por visita</p>
      </div>
    </div>
  )

  const className = cn(
    'w-full text-left bg-white rounded-2xl border p-4 transition-all',
    onSelect ? 'hover:border-slate-300' : '',
    selected ? 'border-brand-400 ring-2 ring-brand-100' : 'border-slate-200/70',
  )

  if (onSelect) {
    return (
      <button type="button" onClick={() => onSelect(partner.id)} className={className}>
        {body}
      </button>
    )
  }
  return <div className={className}>{body}</div>
}
