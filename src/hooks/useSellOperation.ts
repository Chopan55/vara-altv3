'use client'
import { useOperations } from '@/hooks/useOperations'

/**
 * La venta con la que trabajan las herramientas de venta (precio, interesados,
 * papeles, ficha). Usa la misma fuente de operaciones que el resto de la app, así
 * una venta que se ve en el Dashboard nunca figura como inexistente acá.
 *
 * Si la operación activa es una venta, esa; si no, la primera venta que exista.
 */
export function useSellOperation() {
  const { activeOperation, sellOperations, getTransactionData, loaded } = useOperations()
  const op = (activeOperation?.type === 'SELL' ? activeOperation : null) ?? sellOperations[0] ?? null
  return { op, loaded, getTransactionData }
}
