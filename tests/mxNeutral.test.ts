import { describe, expect, it } from 'vitest'
import { ANALYST_SYSTEM_PROMPT, briefToPrompt, sanitizeBrief } from '@/lib/analysis/brief'
import { sellerQuestions } from '@/lib/analysis/sellerQuestions'
import { localRequirements } from '@/lib/analysis/localRequirements'

describe('México sin voseo', () => {
  it('el asistente responde en el español del país del aviso', () => {
    expect(ANALYST_SYSTEM_PROMPT).toMatch(/México: español de México \(tú/)
    const b = sanitizeBrief({ v: 1, property: { title: 'Depto', country: 'MX' }, conclusion: { headline: 'x', verdict: 'v', why: '', price: '', unknown: '' }, price: {}, cost: {}, next: {} })
    expect(b?.property.country).toBe('MX')
    expect(briefToPrompt(b!)).toContain('PAÍS: México')
  })
  it('las preguntas al vendedor de México van de tú', () => {
    const t = sellerQuestions({ country: 'MX', hasCommonCharges: true }).map(q => q.why).join(' ')
    expect(t).not.toMatch(/Pedilas|Pedí |Preguntá/)
  })
})

describe('partidos de GBA Norte', () => {
  it('Vicente López tiene sus requisitos', () => {
    const r = localRequirements('BUENOS_AIRES', 'AR', ['Florida', 'Vicente López'])
    expect(r?.detected?.name).toBe('Vicente López')
  })
})
