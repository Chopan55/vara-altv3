'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Info, AlertCircle, ChevronDown, ChevronRight, CreditCard, LineChart } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { formatPrice } from '@/lib/utils'
import { useVaraState } from '@/hooks/useVaraState'
import { useJurisdiction } from '@/hooks/useJurisdiction'
import { generateChecklist, formatPercent, getProvinceListGrouped } from '@/lib/regulations'
import type { ProvinceCode } from '@/data/regulations/types'

const PROVINCE_GROUPS = getProvinceListGrouped()

export function CostosPanel() {
  const vara = useVaraState()
  const isSeller = vara.loaded && vara.journeyType === 'SELL_PROPERTY'
  const j = useJurisdiction()
  const [selectedProvince, setSelectedProvince] = useState<string>(j.defaultProvinceCode)

  /*
   * Arranca en 0, no en 185.000.
   *
   * Antes había un precio escrito a mano y la cabecera decía "Propiedad:
   * USD 185.000" como si fuera la tuya. Alguien podía leer un total de
   * costos calculado sobre una casa que no existe y tomarlo por propio.
   * Si tenés una propiedad cargada usamos ESA; si no, pedimos el número.
   */
  const [propertyPrice, setPropertyPrice] = useState(0)
  const [priceFromProperty, setPriceFromProperty] = useState(false)

  useEffect(() => {
    let alive = true
    import('@/lib/candidates/store')
      .then(m => m.loadCandidates())
      .then(list => {
        if (!alive) return
        const withPrice = list.find(c => c.price > 0 && c.status !== 'DISCARDED')
        if (withPrice) {
          setPropertyPrice(withPrice.price)
          setPriceFromProperty(true)
        }
      })
      .catch(() => { /* sin propiedad cargada, el usuario pone el número */ })
    return () => { alive = false }
  }, [])

  const hasPrice = propertyPrice > 0

  const checklist = generateChecklist(selectedProvince as ProvinceCode, 'BUY_PROPERTY', propertyPrice)
  const { costs } = checklist

  const buyerCosts = [costs.stampTaxBuyer, costs.notaryFeeBuyer, costs.registryFee, costs.certificates]
  const sellerCosts = [costs.stampTaxSeller, costs.notaryFeeSeller]

  const totalMinBuyer = costs.totalBuyer.min
  const totalMaxBuyer = costs.totalBuyer.max

  return (
    <div className="">
      <header className="px-4 lg:px-6 pt-8 pb-3">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Calculadora de Costos</h1>
          <p className="text-sm text-slate-500 mt-1">
            {hasPrice
              ? `${priceFromProperty ? 'Tu propiedad' : 'Valor'}: ${formatPrice(propertyPrice)} · ${checklist.provinceName}`
              : `Poné el valor de la propiedad para calcular · ${checklist.provinceName}`}
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">

        {/* Precio de la propiedad */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Valor de la propiedad (USD)</p>
          <input
            type="number"
            min={0}
            step={1000}
            value={hasPrice ? propertyPrice : ''}
            onChange={e => setPropertyPrice(Number(e.target.value) || 0)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-brand-400"
            placeholder="Ej: 185000"
          />
          <p className="text-xs text-slate-400 mt-1.5">Ingresá el valor en dólares para calcular los costos exactos</p>
        </div>

        {/* Selector de provincia */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{j.subdivisionLabel} del inmueble</p>
          <div className="relative">
            <select
              value={selectedProvince}
              onChange={e => setSelectedProvince(e.target.value)}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-brand-400 pr-8"
            >
              {PROVINCE_GROUPS.map(group => (
                <optgroup key={group.country} label={group.label}>
                  {group.items.map(p => (
                    <option key={p.code} value={p.code}>{p.displayName}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          {checklist.dataConfidence !== 'VERIFIED' && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <AlertCircle size={11} /> Datos {checklist.dataConfidence === 'ESTIMATED' ? 'estimados' : 'parciales'} — verificar con {j.professionalLabels.CLOSING_PROFESSIONAL.toLowerCase()} local
            </p>
          )}
        </div>

        {/*
          Sin precio no hay nada que calcular. Antes esto mostraba
          "USD 0 – USD 0" con un 0% al lado, que se lee como un resultado.
        */}
        {!hasPrice && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-6 text-center">
            <p className="text-sm font-semibold text-slate-800 mb-1">Falta el valor de la propiedad</p>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              Poné el precio arriba y calculamos sellos, honorarios y gastos de
              registro con las alícuotas vigentes de la provincia que elijas.
            </p>
          </div>
        )}

        {hasPrice && (<>
        {/* Resumen */}
        <div className="bg-slate-900 rounded-2xl p-5 text-white">
          <p className="text-sm font-medium opacity-60 mb-1">Costo total estimado para el comprador</p>
          <p className="text-3xl font-extrabold mb-0.5">
            {formatPrice(totalMinBuyer)} – {formatPrice(totalMaxBuyer)}
          </p>
          <p className="text-sm opacity-60">
            {costs.totalBuyer.percentMin.toFixed(1)}% – {costs.totalBuyer.percentMax.toFixed(1)}% del valor de la propiedad
          </p>
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
            <span className="text-xs opacity-50">Sellos {checklist.provinceName}:</span>
            <span className="text-xs font-semibold text-brand-400">{formatPercent(costs.stampTaxBuyer.minAmount / propertyPrice * 2)} total</span>
          </div>
        </div>

        {/* Comprador */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Gastos del comprador</p>
          </div>
          {buyerCosts.map((cost, i) => (
            <div key={i} className={`px-5 py-4 ${i < buyerCosts.length - 1 ? 'border-b border-slate-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{cost.label}</p>
                  {cost.notes && <p className="text-xs text-slate-400 mt-0.5">{cost.notes}</p>}
                  <p className="text-xs text-slate-300 mt-0.5">Fuente: {cost.source}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {cost.minAmount === cost.maxAmount
                    ? <p className="text-sm font-bold text-slate-900">{formatPrice(cost.minAmount, cost.currency)}</p>
                    : <>
                        <p className="text-xs text-slate-400">desde</p>
                        <p className="text-sm font-bold text-slate-900">{formatPrice(cost.minAmount, cost.currency)}</p>
                        <p className="text-xs text-slate-400">hasta {formatPrice(cost.maxAmount, cost.currency)}</p>
                      </>
                  }
                </div>
              </div>
            </div>
          ))}
          <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
            <p className="text-sm font-bold text-slate-700">Total estimado</p>
            <p className="text-sm font-bold text-brand-700">{formatPrice(totalMinBuyer)} – {formatPrice(totalMaxBuyer)}</p>
          </div>
        </div>

        {/* Vendedor */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Gastos del vendedor</p>
          </div>
          {sellerCosts.map((cost, i) => (
            <div key={i} className={`px-5 py-4 ${i < sellerCosts.length - 1 ? 'border-b border-slate-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{cost.label}</p>
                  {cost.notes && <p className="text-xs text-slate-400 mt-0.5">{cost.notes}</p>}
                </div>
                <p className="text-sm font-bold text-slate-900 ml-3">
                  {cost.minAmount === cost.maxAmount
                    ? formatPrice(cost.minAmount, cost.currency)
                    : `${formatPrice(cost.minAmount, cost.currency)} – ${formatPrice(cost.maxAmount, cost.currency)}`}
                </p>
              </div>
            </div>
          ))}
          <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
            <p className="text-sm font-bold text-slate-700">Total estimado vendedor</p>
            <p className="text-sm font-bold text-brand-700">{formatPrice(costs.totalSeller.min)} – {formatPrice(costs.totalSeller.max)}</p>
          </div>
        </div>

        </>)}

        {/* Advertencias específicas de la provincia */}
        {checklist.warnings.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Particularidades de {checklist.provinceName}</p>
            {checklist.warnings.slice(0, 3).map((w, i) => (
              <div key={i} className="flex gap-2">
                <Info size={12} className="text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600">{w}</p>
              </div>
            ))}
          </div>
        )}

        {/* Disclaimer */}
        <div className="flex gap-2 bg-amber-50 rounded-2xl p-4">
          <Info size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            Valores estimativos basados en fuentes oficiales y secundarias. Confianza del dato: <strong>{checklist.dataConfidence === 'VERIFIED' ? 'VERIFICADO' : checklist.dataConfidence === 'PARTIAL' ? 'PARCIAL' : 'ESTIMADO'}</strong>. Consultá con {j.professionalLabels.CLOSING_PROFESSIONAL.toLowerCase()} matriculado/a en {checklist.provinceName} para la liquidación exacta.
          </p>
        </div>

      </div>
    </div>
  )
}
