import { describe, it, expect } from 'vitest'
import {
  stripCertaintyLabels, agentContext, buildExplainPrompt, buildDraftPrompt,
} from '@/lib/nba/agentPrompts'

const action = {
  title: 'Conseguí escritura anterior',
  why: 'Sin este documento no se puede verificar la titularidad.',
}

describe('stripCertaintyLabels', () => {
  it('saca las etiquetas de certeza que agrega el asistente', () => {
    expect(stripCertaintyLabels('[RECOMENDACIÓN] Hola Juan, te pido la escritura.')).toBe('Hola Juan, te pido la escritura.')
    expect(stripCertaintyLabels('[HECHO] A [ESTIMADO] B')).toBe('A B')
    expect(stripCertaintyLabels('[consultar profesional] Hola')).toBe('Hola')
  })

  it('deja intactos los corchetes que son datos a completar', () => {
    const msg = 'Hola [nombre del escribano], necesito [fecha].'
    expect(stripCertaintyLabels(msg)).toBe(msg)
  })

  it('recorta espacios', () => {
    expect(stripCertaintyLabels('  Hola  ')).toBe('Hola')
  })
})

describe('agentContext', () => {
  it('le dice al endpoint con quién habla: "compr" o "vend"', () => {
    expect(agentContext('BUY')).toMatch(/compr/i)
    expect(agentContext('SELL')).toMatch(/vend/i)
    expect(agentContext('SELL')).not.toMatch(/compr/i)
  })

  it('incluye la provincia solo si la hay', () => {
    expect(agentContext('BUY', 'Buenos Aires')).toContain('Buenos Aires')
    expect(agentContext('BUY')).not.toContain(' en undefined')
  })
})

describe('prompts', () => {
  it('mandan exactamente lo que calculó el motor', () => {
    for (const prompt of [buildExplainPrompt(action, 'BUY'), buildDraftPrompt(action, 'BUY')]) {
      expect(prompt).toContain(action.title)
      expect(prompt).toContain(action.why)
    }
  })

  it('hablan de compra o de venta según corresponde', () => {
    expect(buildDraftPrompt(action, 'BUY')).toContain('mi compra')
    expect(buildDraftPrompt(action, 'SELL')).toContain('mi venta')
    expect(buildExplainPrompt(action, 'SELL')).toContain('mi venta')
  })

  it('el borrador pide solo el mensaje y marcar con corchetes lo que falta', () => {
    const p = buildDraftPrompt(action, 'BUY')
    expect(p).toMatch(/SOLO con el mensaje/)
    expect(p).toMatch(/corchetes/)
  })
})
