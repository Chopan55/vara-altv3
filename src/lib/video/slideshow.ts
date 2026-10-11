import { FADE_SECONDS, SECONDS_PER_PHOTO, frameAt, motionAt, planTimeline } from '@/lib/video/timeline'

/**
 * Arma el recorrido en video en el navegador con canvas + MediaRecorder: movimiento
 * de cámara en cada foto, nombre del ambiente y título de la propiedad.
 * No usa IA ni servidor: no cuesta nada y las fotos no salen del dispositivo.
 * Es un recorrido de imágenes, no una filmación.
 */
export interface TourItem { url: string; label?: string }

export interface SlideshowOptions {
  items: TourItem[]
  title?: string
  subtitle?: string
  secondsPerPhoto?: number
  width?: number
  height?: number
  fps?: number
  onProgress?: (fraction: number) => void
}

export function canRecordVideo(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar una de las fotos.'))
    img.src = url
  })
}

/** Dibuja la foto cubriendo todo el cuadro, con zoom y paneo. panX: -1 borde derecho, 1 borde izquierdo. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, zoom: number, panX: number, alpha: number) {
  const scale = Math.max(w / img.width, h / img.height) * zoom
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.globalAlpha = alpha
  ctx.drawImage(img, (w - dw) / 2 + panX * (dw - w) / 2, (h - dh) / 2, dw, dh)
  ctx.globalAlpha = 1
}

function roundedPill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export async function buildSlideshow(opts: SlideshowOptions): Promise<Blob> {
  if (!canRecordVideo()) throw new Error('Tu navegador no puede armar videos. Probá con Chrome o Edge en una computadora.')
  const sec = opts.secondsPerPhoto ?? SECONDS_PER_PHOTO
  const { segments, total } = planTimeline(opts.items.length, sec)
  if (segments.length === 0) throw new Error('Subí al menos una foto para armar el video.')

  const items = opts.items.slice(0, segments.length)
  const images = await Promise.all(items.map(i => loadImage(i.url)))
  const w = opts.width ?? 1280
  const h = opts.height ?? 720
  const fps = opts.fps ?? 30
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar el video.')

  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'
  const recorder = new MediaRecorder(canvas.captureStream(fps), { mimeType: mime, videoBitsPerSecond: 4_000_000 })
  const chunks: Blob[] = []
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
    recorder.onerror = () => reject(new Error('Falló la grabación del video.'))
  })

  const draw = (t: number) => {
    const f = frameAt(t, images.length, sec, FADE_SECONDS)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, w, h)
    const local = (t - f.current * sec) / sec
    const m = motionAt(f.current, local)
    drawCover(ctx, images[f.current], w, h, m.zoom, m.panX, 1)
    if (f.next !== null) {
      const n = motionAt(f.next, 0)
      drawCover(ctx, images[f.next], w, h, n.zoom, n.panX, f.mix)
    }

    // Franja inferior para que se lean los textos.
    const grad = ctx.createLinearGradient(0, h * 0.62, 0, h)
    grad.addColorStop(0, 'rgba(15,23,42,0)')
    grad.addColorStop(1, 'rgba(15,23,42,0.78)')
    ctx.fillStyle = grad
    ctx.fillRect(0, h * 0.62, w, h * 0.38)

    ctx.textBaseline = 'alphabetic'
    if (opts.title && f.current === 0) {
      ctx.fillStyle = '#ffffff'
      ctx.font = `700 ${Math.round(h * 0.07)}px system-ui, sans-serif`
      ctx.fillText(opts.title.slice(0, 60), w * 0.05, h * 0.86)
      if (opts.subtitle) {
        ctx.font = `500 ${Math.round(h * 0.04)}px system-ui, sans-serif`
        ctx.fillText(opts.subtitle.slice(0, 80), w * 0.05, h * 0.93)
      }
    }

    // Nombre del ambiente: aparece y se va con cada foto.
    const label = items[f.current].label
    if (label && local > 0.08 && local < 0.92) {
      const fs = Math.round(h * 0.045)
      ctx.font = `600 ${fs}px system-ui, sans-serif`
      const tw = ctx.measureText(label).width
      const padX = fs * 0.8
      const ph = fs * 1.9
      const x = w * 0.05
      const y = h * 0.05
      ctx.fillStyle = 'rgba(15,23,42,0.72)'
      roundedPill(ctx, x, y, tw + padX * 2, ph)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, x + padX, y + ph * 0.66)
    }

    // Barra de avance del recorrido.
    const bar = Math.max(4, h * 0.008)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillRect(0, h - bar, w * Math.min(t / total, 1), bar)
  }

  recorder.start()
  const startedAt = performance.now()
  await new Promise<void>(resolve => {
    const tick = () => {
      const t = (performance.now() - startedAt) / 1000
      if (t >= total) { resolve(); return }
      draw(t)
      opts.onProgress?.(t / total)
      requestAnimationFrame(tick)
    }
    tick()
  })
  recorder.stop()
  opts.onProgress?.(1)
  return done
}
