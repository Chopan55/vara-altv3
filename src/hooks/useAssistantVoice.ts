'use client'

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useVaraVoice } from '@/components/buy-v3/useVaraVoice'
import { IDLE_VOICE, createVoiceController, readAutoRead, writeAutoRead } from '@/lib/assistant/voice'

/**
 * Voz del Asistente VARA para la pantalla /asistente.
 *
 * Reutiliza el reproductor de `useVaraVoice` (pide el audio a /api/v3/speak y mide el volumen para la boca del
 * avatar) y le suma lo que el asistente necesita: una respuesta por vez, errores silenciosos, la preferencia
 * "Leer respuestas" (apagada por defecto) y limpieza del audio al salir.
 */

// Preferencia "Leer respuestas": vive en localStorage y, si no hay storage, en memoria durante la sesión.
let memoryPref: boolean | null = null
const prefListeners = new Set<() => void>()

const readPref = () => memoryPref ?? readAutoRead()
const writePref = (on: boolean) => {
  memoryPref = on
  writeAutoRead(on)
  prefListeners.forEach(l => l())
}
const subscribePref = (listener: () => void) => {
  prefListeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    prefListeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useAssistantVoice() {
  /** Volumen del audio que suena (0..1): lo lee el avatar para mover la boca. */
  const levelRef = useRef(0)
  const setLevel = useCallback((v: number) => { levelRef.current = v }, [])
  const { prepare, stop: stopAudio } = useVaraVoice(setLevel)

  const controller = useMemo(() => createVoiceController({ prepare, stopAudio }), [prepare, stopAudio])
  const snap = useSyncExternalStore(controller.subscribe, controller.getSnapshot, () => IDLE_VOICE)
  // Al salir de la pantalla: se corta el audio y no queda nada colgado.
  useEffect(() => () => controller.dispose(), [controller])

  // Servidor y primer render del cliente: apagada (sin diferencias de HTML).
  const autoRead = useSyncExternalStore(subscribePref, readPref, () => false)
  const setAutoRead = useCallback((on: boolean) => {
    writePref(on)
    if (!on) controller.stop()
  }, [controller])

  return {
    levelRef,
    status: snap.status,
    activeId: snap.activeId,
    failedId: snap.failedId,
    play: controller.play,
    stop: controller.stop,
    autoRead,
    setAutoRead,
  }
}
