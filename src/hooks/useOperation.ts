'use client'
import { useMemo } from 'react'
import { OPERATION_STORE } from '@/data/mock'
import type { Transaction } from '@/types'

export function useOperation(operationId: string | null): {
  operation: Transaction | null
  loading: boolean
  notFound: boolean
} {
  return useMemo(() => {
    if (!operationId) return { operation: null, loading: false, notFound: false }
    const op = OPERATION_STORE[operationId] ?? null
    return { operation: op, loading: false, notFound: op === null }
  }, [operationId])
}

export { OPERATION_STORE }
