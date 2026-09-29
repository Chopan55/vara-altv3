import { useState, useEffect, useCallback } from 'react'
import { tryCreateClient } from '@/lib/supabase/client'
import type { NegotiationContext, NegotiationMode, NegotiationResponse } from '@/app/api/negotiation/route'

const LS_KEY    = 'vara_neg_ctx_v1'
const LS_NEXT   = 'vara_neg_next_v1'
const LS_NEG_ID = 'vara_neg_id_v1'

export interface Negotiation {
  id: string
  title: string
  status: 'active' | 'closed' | 'paused'
  next_action: string | null
  created_at: string
  updated_at: string
  objetivo?: string | null
  target?: string | null
  walk_away?: string | null
  batna?: string | null
  deadline?: string | null
  current_offer?: string | null
  counterparty_role?: string | null
  counterparty_style?: string | null
  negotiation_history?: string | null
  other_context?: string | null
}

export interface NegotiationMessage {
  id: string
  negotiation_id: string
  mode: NegotiationMode
  channel?: string | null
  input_message?: string | null
  result: NegotiationResponse
  created_at: string
}

function ctxFromNeg(n: Negotiation): NegotiationContext {
  return {
    objetivo:           n.objetivo ?? undefined,
    target:             n.target ?? undefined,
    walkAway:           n.walk_away ?? undefined,
    batna:              n.batna ?? undefined,
    deadline:           n.deadline ?? undefined,
    currentOffer:       n.current_offer ?? undefined,
    counterpartyRole:   n.counterparty_role ?? undefined,
    counterpartyStyle:  n.counterparty_style ?? undefined,
    negotiationHistory: n.negotiation_history ?? undefined,
    otherContext:       n.other_context ?? undefined,
  }
}

function ctxToRow(ctx: NegotiationContext) {
  return {
    objetivo:            ctx.objetivo ?? null,
    target:              ctx.target ?? null,
    walk_away:           ctx.walkAway ?? null,
    batna:               ctx.batna ?? null,
    deadline:            ctx.deadline ?? null,
    current_offer:       ctx.currentOffer ?? null,
    counterparty_role:   ctx.counterpartyRole ?? null,
    counterparty_style:  ctx.counterpartyStyle ?? null,
    negotiation_history: ctx.negotiationHistory ?? null,
    other_context:       ctx.otherContext ?? null,
  }
}

export function useNegotiationStore() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = tryCreateClient() as any

  const [userId, setUserId]           = useState<string | null>(null)
  const [negotiations, setNegotiations] = useState<Negotiation[]>([])
  const [activeId, setActiveId]       = useState<string | null>(null)
  const [ctx, setCtxState]            = useState<NegotiationContext>({})
  const [nextAction, setNextActionState] = useState('')
  const [messages, setMessages]       = useState<NegotiationMessage[]>([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.auth.getUser().then(({ data }: any) => {
      setUserId(data.user?.id ?? null)
    })
  }, [])

  useEffect(() => {
    if (userId) {
      loadNegotiations()
    } else {
      try {
        setCtxState(JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'))
        setNextActionState(localStorage.getItem(LS_NEXT) ?? '')
      } catch {}
      setLoading(false)
    }
  }, [userId])

  const loadMessages = useCallback(async (negId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('negotiation_messages')
      .select('*')
      .eq('negotiation_id', negId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setMessages(data as NegotiationMessage[])
  }, [])

  const loadNegotiations = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from('negotiations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(20)

    if (data) {
      setNegotiations(data as Negotiation[])
      const lastId = localStorage.getItem(LS_NEG_ID)
      const found = (data as Negotiation[]).find(n => n.id === lastId)
        ?? (data as Negotiation[]).find(n => n.status === 'active')
      if (found) {
        setActiveId(found.id)
        setCtxState(ctxFromNeg(found))
        setNextActionState(found.next_action ?? '')
        await loadMessages(found.id)
      }
    }
    setLoading(false)
  }, [userId, loadMessages])

  const selectNegotiation = useCallback(async (neg: Negotiation) => {
    setActiveId(neg.id)
    setCtxState(ctxFromNeg(neg))
    setNextActionState(neg.next_action ?? '')
    try { localStorage.setItem(LS_NEG_ID, neg.id) } catch {}
    await loadMessages(neg.id)
  }, [loadMessages])

  const createNegotiation = useCallback(async (title: string, initialCtx?: NegotiationContext): Promise<string | null> => {
    if (!userId) return null
    const { data } = await supabase
      .from('negotiations')
      .insert({ user_id: userId, title, ...(initialCtx ? ctxToRow(initialCtx) : {}) })
      .select()
      .single()
    if (!data) return null
    const neg = data as Negotiation
    setNegotiations(prev => [neg, ...prev])
    setActiveId(neg.id)
    setCtxState(ctxFromNeg(neg))
    setNextActionState('')
    setMessages([])
    try { localStorage.setItem(LS_NEG_ID, neg.id) } catch {}
    return neg.id
  }, [userId])

  const saveContext = useCallback(async (newCtx: NegotiationContext) => {
    setCtxState(newCtx)
    if (userId && activeId) {
      await supabase.from('negotiations').update(ctxToRow(newCtx)).eq('id', activeId).eq('user_id', userId)
      setNegotiations(prev => prev.map(n => n.id === activeId ? { ...n, ...ctxToRow(newCtx) } : n))
    } else {
      try { localStorage.setItem(LS_KEY, JSON.stringify(newCtx)) } catch {}
    }
  }, [userId, activeId])

  const saveNextAction = useCallback(async (action: string) => {
    setNextActionState(action)
    if (userId && activeId) {
      await supabase.from('negotiations').update({ next_action: action }).eq('id', activeId).eq('user_id', userId)
      setNegotiations(prev => prev.map(n => n.id === activeId ? { ...n, next_action: action } : n))
    } else {
      try { localStorage.setItem(LS_NEXT, action) } catch {}
    }
  }, [userId, activeId])

  const saveMessage = useCallback(async (
    mode: NegotiationMode,
    channel: string | undefined,
    inputMessage: string | undefined,
    result: NegotiationResponse,
  ) => {
    if (!userId || !activeId) return
    const { data } = await supabase
      .from('negotiation_messages')
      .insert({ negotiation_id: activeId, user_id: userId, mode, channel: channel ?? null, input_message: inputMessage ?? null, result })
      .select()
      .single()
    if (data) setMessages(prev => [data as NegotiationMessage, ...prev])
  }, [userId, activeId])

  const updateTitle = useCallback(async (title: string) => {
    if (!userId || !activeId) return
    await supabase.from('negotiations').update({ title }).eq('id', activeId).eq('user_id', userId)
    setNegotiations(prev => prev.map(n => n.id === activeId ? { ...n, title } : n))
  }, [userId, activeId])

  return {
    userId, loading, negotiations, activeId, ctx, nextAction, messages,
    saveContext, saveNextAction, saveMessage,
    createNegotiation, selectNegotiation, updateTitle,
    reload: loadNegotiations,
  }
}
