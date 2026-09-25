/**
 * Persistencia de fotos en IndexedDB.
 * localStorage no sirve acá: tiene ~5MB y las fotos de una propiedad los superan enseguida.
 */

const DB_NAME = 'vara-photos'
const DB_VERSION = 1
const STORE = 'photos'

export interface StoredPhoto {
  id: string
  blob: Blob
  label: string
  isCover: boolean
  createdAt: number
}

export interface PhotoRecord extends StoredPhoto {
  preview: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir IndexedDB'))
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Error en IndexedDB'))
    t.oncomplete = () => db.close()
  }))
}

export async function savePhoto(photo: StoredPhoto): Promise<void> {
  try { await tx('readwrite', s => s.put(photo)) } catch { /* sin persistencia, sigue en memoria */ }
}

export async function deletePhoto(id: string): Promise<void> {
  try { await tx('readwrite', s => s.delete(id)) } catch {}
}

export async function updatePhotoMeta(
  id: string,
  patch: Partial<Pick<StoredPhoto, 'label' | 'isCover'>>
): Promise<void> {
  try {
    const existing = await tx<StoredPhoto | undefined>('readonly', s => s.get(id))
    if (existing) await tx('readwrite', s => s.put({ ...existing, ...patch }))
  } catch {}
}

/** Marca una sola foto como portada, desmarcando el resto. */
export async function setCoverPhoto(id: string): Promise<void> {
  try {
    const all = await tx<StoredPhoto[]>('readonly', s => s.getAll())
    for (const p of all) {
      const shouldBeCover = p.id === id
      if (p.isCover !== shouldBeCover) {
        await tx('readwrite', s => s.put({ ...p, isCover: shouldBeCover }))
      }
    }
  } catch {}
}

/** Devuelve las fotos con un objectURL listo para <img src>. Liberalos con releasePhotos. */
export async function loadPhotos(): Promise<PhotoRecord[]> {
  try {
    const all = await tx<StoredPhoto[]>('readonly', s => s.getAll())
    return all
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(p => ({ ...p, preview: URL.createObjectURL(p.blob) }))
  } catch {
    return []
  }
}

export function releasePhotos(photos: { preview: string }[]): void {
  for (const p of photos) {
    if (p.preview?.startsWith('blob:')) {
      try { URL.revokeObjectURL(p.preview) } catch {}
    }
  }
}

export async function clearPhotos(): Promise<void> {
  try { await tx('readwrite', s => s.clear()) } catch {}
}
