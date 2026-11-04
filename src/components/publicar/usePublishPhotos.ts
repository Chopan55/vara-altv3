import { useCallback, useEffect, useRef, useState } from 'react'
import { loadPhotos, savePhoto, deletePhoto, updatePhotoMeta, setCoverPhoto } from '@/lib/photoStore'
import {
  hasPhotoSession, uploadPhoto, listPhotos, deletePhotoRemote,
  updatePhotoRemote, setCoverRemote,
} from '@/lib/supabase/photos'
import type { PhotoItem } from './model'

/** Fotos del aviso: en la cuenta si hay sesión, en IndexedDB si no. */
export function usePublishPhotos() {
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [inCloud, setInCloud] = useState(false)
  // Hasta saber si hay sesión no se muestra ningún texto definitivo sobre dónde se guardan las fotos.
  const [sessionChecked, setSessionChecked] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Las fotos viven en IndexedDB: sobreviven la recarga y no chocan con el límite de localStorage.
  useEffect(() => {
    let alive = true
    ;(async () => {
      // Con sesión las fotos viven en Storage y te siguen entre dispositivos.
      if (await hasPhotoSession()) {
        const remote = await listPhotos()
        if (!alive) return
        setPhotos(remote.map(p => ({ id: p.id, preview: p.url, label: p.label, isCover: p.isCover })))
        setInCloud(true)
        return
      }
      const stored = await loadPhotos()
      if (!alive) return
      setPhotos(stored.map(p => ({ id: p.id, preview: p.preview, label: p.label, isCover: p.isCover })))
    })().catch(() => {}).finally(() => { if (alive) setSessionChecked(true) })
    return () => { alive = false }
  }, [])

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const accepted = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 20 - photos.length)
    if (!accepted.length) return

    const needsCover = photos.length === 0

    void (async () => {
      if (await hasPhotoSession()) {
        setUploading(true)
        for (let i = 0; i < accepted.length; i++) {
          const up = await uploadPhoto(accepted[i], 'Sin etiquetar', needsCover && i === 0)
          if (up) {
            setPhotos(prev => [...prev, { id: up.id, preview: up.url, label: up.label, isCover: up.isCover }])
          }
        }
        setUploading(false)
        setInCloud(true)
        return
      }
      const newPhotos: PhotoItem[] = accepted.map((f, i) => {
        const id = `ph-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const isCover = needsCover && i === 0
        void savePhoto({ id, blob: f, label: 'Sin etiquetar', isCover, createdAt: Date.now() + i })
        return { id, preview: URL.createObjectURL(f), label: 'Sin etiquetar', isCover }
      })
      setPhotos(prev => [...prev, ...newPhotos])
    })()
  }, [photos.length])

  const removePhoto = (id: string) => {
    void (async () => {
      if (await hasPhotoSession()) {
        const remote = (await listPhotos()).find(p => p.id === id)
        if (remote) await deletePhotoRemote(id, remote.storagePath)
      } else { void deletePhoto(id) }
    })()
    setPhotos(prev => {
      const next = prev.filter(p => p.id !== id)
      if (next.length > 0 && !next.some(p => p.isCover)) {
        next[0] = { ...next[0], isCover: true }
        void setCoverPhoto(next[0].id)
      }
      return next
    })
  }

  const setCover = (id: string) => {
    void (async () => {
      if (await hasPhotoSession()) await setCoverRemote(id)
      else void setCoverPhoto(id)
    })()
    setPhotos(prev => prev.map(p => ({ ...p, isCover: p.id === id })))
  }

  const setLabel = (id: string, label: string) => {
    void (async () => {
      if (await hasPhotoSession()) await updatePhotoRemote(id, { label })
      else void updatePhotoMeta(id, { label })
    })()
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, label } : p))
  }

  return { photos, dragOver, setDragOver, fileInputRef, inCloud, sessionChecked, uploading, addFiles, removePhoto, setCover, setLabel }
}
