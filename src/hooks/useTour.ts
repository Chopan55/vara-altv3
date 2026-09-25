'use client'
import { useState, useCallback, useEffect } from 'react'
import { TOURS, type Tour } from '@/data/tours'

const LS_KEY = 'vara_tour_completed'

function loadCompleted(): Set<string> {
  try {
    const saved = localStorage.getItem(LS_KEY)
    if (saved) return new Set(JSON.parse(saved) as string[])
  } catch {}
  return new Set()
}

function saveCompleted(ids: Set<string>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]))
  } catch {}
}

interface TourState {
  activeTour: Tour | null
  stepIndex: number
  isActive: boolean
}

export function useTour() {
  const [state, setState] = useState<TourState>({ activeTour: null, stepIndex: 0, isActive: false })
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  useEffect(() => {
    setCompleted(loadCompleted())
  }, [])

  const startTour = useCallback((tourId: string) => {
    const tour = TOURS[tourId]
    if (!tour) return
    setState({ activeTour: tour, stepIndex: 0, isActive: true })
  }, [])

  const next = useCallback(() => {
    setState(prev => {
      if (!prev.activeTour) return prev
      const nextStep = prev.stepIndex + 1
      if (nextStep >= prev.activeTour.pasos.length) {
        setCompleted(c => {
          const next = new Set([...c, prev.activeTour!.id])
          saveCompleted(next)
          return next
        })
        return { activeTour: null, stepIndex: 0, isActive: false }
      }
      return { ...prev, stepIndex: nextStep }
    })
  }, [])

  const prev = useCallback(() => {
    setState(p => p.stepIndex > 0 ? { ...p, stepIndex: p.stepIndex - 1 } : p)
  }, [])

  const close = useCallback(() => {
    setState({ activeTour: null, stepIndex: 0, isActive: false })
  }, [])

  const isCompleted = useCallback((tourId: string) => completed.has(tourId), [completed])

  const resetAll = useCallback(() => {
    const empty = new Set<string>()
    setCompleted(empty)
    saveCompleted(empty)
  }, [])

  return { ...state, startTour, next, prev, close, isCompleted, resetAll }
}
