import { FADE_SECONDS, SECONDS_PER_PHOTO, frameAt, planTimeline } from '@/lib/video/timeline'

/**
 * Arma el video de presentación en el navegador con canvas + MediaRecorder.
 * No usa IA ni servidor: no cuesta nada y las fotos no salen del dispositivo.
 */
export interface SlideshowOptions {
  urls: string[]
  title?: string
  subtitle?: string
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

/** Dibuja la foto cubriendo todo el cuadro, con zoom centrado. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, zoom: number, alpha: number) {
  const scale = Math.max(w / img.width, h / img.height) * zoom
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.globalAlpha = alpha
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
  ctx.globalAlpha = 1
}

export async function buildSlideshow(opts: SlideshowOptions): Promise<Blob> {
  if (!canRecordVideo()) throw new Error('Tu navegador no puede armar videos. Probá con Chrome o Edge en una computadora.')
  const { segments, total } = planTimeline(opts.urls.length)
  if (segments.length === 0) throw new Error('Subí al menos una foto para armar el video.')

  const images = await Promise.all(opts.urls.slice(0, segments.length).map(loadImage))
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
    const f = frameAt(t, images.length, SECONDS_PER_PHOTO, FADE_SECONDS)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, w, h)
    drawCover(ctx, images[f.current], w, h, f.zoom, 1)
    if (f.next !== null) drawCover(ctx, images[f.next], w, h, 1, f.mix)
    if (opts.title && t < SECONDS_PER_PHOTO) {
      const grad = ctx.createLinearGradient(0, h * 0.55, 0, h)
      grad.addColorStop(0, 'rgba(15,23,42,0)')
      grad.addColorStop(1, 'rgba(15,23,42,0.75)')
      ctx.fillStyle = grad
      ctx.fillRect(0, h * 0.55, w, h * 0.45)
      ctx.fillStyle = '#ffffff'
      ctx.font = `700 ${Math.round(h * 0.07)}px system-ui, sans-serif`
      ctx.fillText(opts.title.slice(0, 60), w * 0.05, h * 0.86)
      if (opts.subtitle) {
        ctx.font = `500 ${Math.round(h * 0.04)}px system-ui, sans-serif`
        ctx.fillText(opts.subtitle.slice(0, 80), w * 0.05, h * 0.93)
      }
    }
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
