/**
 * Motor del avatar de VARA: una esfera de vidrio que se deforma como gelatina (WebGL).
 *
 * Usa la imagen de VARA como textura y la deforma en el shader: respira, flota, se aplasta
 * y se estira con la voz. Párpados, boca y cejas se dibujan en la GPU con el color de la
 * propia imagen, así que se mezclan sin costuras. Sin librerías.
 *
 * Todas las coordenadas del shader están en "espacio de imagen" (0..1, y hacia abajo).
 */

/** `listening`: la persona está hablando y VARA la escucha (mira al frente, atenta). */
export type OrbState = 'idle' | 'thinking' | 'speaking' | 'listening'

export interface OrbDebug {
  level?: number
  speak?: number
  think?: number
  lid?: number
  gaze?: [number, number]
}

export interface OrbOptions {
  textureUrl: string
  /** Menos movimiento (preferencia del sistema): sin gelatina ni flotación. */
  calm: boolean
  getState: () => OrbState
  /** Volumen del audio que suena (0..1). */
  getLevel: () => number
  /** Hay audio real: la boca lo sigue. Sin audio y hablando, se usa un ritmo sintético. */
  hasAudio: () => boolean
  /** Solo para pruebas visuales. */
  debug?: () => OrbDebug | null
}

const VERT = `
attribute vec2 a;
varying vec2 v;
void main() { v = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }
`

const FRAG = `
precision highp float;
varying vec2 v;
uniform sampler2D tex;
uniform float uTime, uLevel, uSpeak, uThink, uLidL, uLidR, uTilt, uCalm, uPx;
uniform vec2 uGaze;

const vec2 C  = vec2(0.492, 0.4745);   // centro de la esfera
const float R = 0.37;                  // radio de la esfera
const float S = 1.14;                  // zoom del cuadro (margen para el estiramiento)
const float RC = 0.357;                // radio de corte (justo dentro del borde de la esfera)
const vec2 EL = vec2(0.381, 0.4067);   // ojo izquierdo
const vec2 ER = vec2(0.6746, 0.4513);  // ojo derecho
const vec2 MO = vec2(0.5247, 0.4984);  // boca
const vec2 BL = vec2(0.395, 0.307);    // ceja izquierda
const vec2 BR = vec2(0.696, 0.355);    // ceja derecha

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float win(vec2 p, vec2 c, vec2 r) { return 1.0 - smoothstep(0.55, 1.0, length((p - c) / r)); }

// Párpado: baja desde arriba con el color de la piel de alrededor y una línea de pestaña.
vec3 lid(vec3 col, vec2 p, vec2 e, float amt) {
  vec2 d = (p - e) / vec2(0.066, 0.062);
  float region = 1.0 - smoothstep(0.98, 1.34, length(d * vec2(0.9, 1.0)));
  float edge = mix(-1.25, 1.12, amt) + 0.30 * d.x * d.x * (1.0 - 0.35 * amt);
  float cover = 1.0 - smoothstep(edge - 0.07, edge + 0.07, d.y);
  // Piel de alrededor: promedio de los cuatro costados, con poco peso abajo (ahí está el rubor).
  vec3 skin = (texture2D(tex, e + vec2(0.0, -0.085)).rgb * 0.30
             + texture2D(tex, e + vec2(0.0, 0.085)).rgb * 0.10
             + texture2D(tex, e + vec2(-0.085, 0.0)).rgb * 0.30
             + texture2D(tex, e + vec2(0.085, 0.0)).rgb * 0.30) * 0.992;
  col = mix(col, skin, cover * region);
  float line = (1.0 - smoothstep(0.0, 0.075, abs(d.y - edge))) * (1.0 - smoothstep(0.62, 0.95, abs(d.x)));
  col = mix(col, vec3(0.20, 0.15, 0.50), line * region * smoothstep(0.12, 0.40, amt) * 0.85);
  return col;
}

void main() {
  vec2 q = vec2(v.x * 2.0 - 1.0, (1.0 - v.y) * 2.0 - 1.0);
  float t = uTime;
  float live = 1.0 - 0.7 * uCalm;

  // Flota, respira y se aplasta con la voz (volumen constante: ancho = 1/sqrt(alto)).
  q.y -= 0.022 * sin(t * 1.3) * live;
  float sy = 1.0 + (0.012 * sin(t * 1.9) + 0.075 * uLevel) * live;
  float sx = 1.0 / sqrt(sy);
  q = vec2(q.x / sx, q.y / sy);
  q = rot(-uTilt) * q;

  // Gelatina: ondulación suave de la superficie
  float wob = (0.008 + 0.024 * uLevel + 0.012 * uThink) * live;
  q += wob * vec2(sin(q.y * 5.0 + t * 1.7 + uLevel * 3.0), cos(q.x * 5.0 + t * 1.3));

  vec2 p = C + q * R * S;
  float rr = length(q) * R * S;
  float px = 2.0 * R * S * uPx;
  float alpha = 1.0 - smoothstep(RC - 1.6 * px, RC, rr);
  if (alpha <= 0.0) { gl_FragColor = vec4(0.0); return; }

  vec2 pg = p;                       // posición antes de mover los ojos (para dibujar encima)

  // Cejas: se levantan al hablar y al pensar
  float wbl = win(p, BL, vec2(0.075, 0.045));
  float wbr = win(p, BR, vec2(0.075, 0.045));
  p.y += 0.015 * (uLevel * 0.9 + uThink * 0.8) * (wbl + wbr) * live;

  // Mirada: los ojos siguen el punto hacia donde mira
  float we = win(p, EL, vec2(0.074, 0.074)) + win(p, ER, vec2(0.074, 0.074));
  p -= uGaze * 0.0125 * we;

  vec3 col = texture2D(tex, p).rgb;

  col = lid(col, pg, EL, uLidL);
  col = lid(col, pg, ER, uLidR);

  // Boca abierta: sigue el volumen de la voz
  float open = clamp(uLevel * 1.15, 0.0, 1.0) * uSpeak;
  vec2 mc = MO + vec2(0.0, 0.003 + 0.018 * open);
  vec2 m = (pg - mc) / vec2(0.039 + 0.014 * open, 0.003 + 0.040 * open);
  float md = length(m);
  float shape = 1.0 - smoothstep(0.80, 1.0, md);
  float on = smoothstep(0.04, 0.13, open);
  vec3 inner = mix(vec3(0.21, 0.13, 0.52), vec3(0.96, 0.47, 0.64), smoothstep(0.05, 1.0, m.y * 0.5 + 0.5) * 0.85);
  inner += 0.10 * (1.0 - smoothstep(0.0, 0.5, m.y + 0.9));
  col = mix(col, inner, shape * on);

  // Brillo con la voz y destello giratorio en el borde al pensar
  col *= 1.0 + 0.05 * uLevel;
  float ang = atan(q.y, q.x);
  float sweep = pow(max(0.0, cos(ang - t * 3.2)), 7.0);
  float rimW = smoothstep(0.80, 0.97, rr / RC);
  col += uThink * sweep * rimW * vec3(0.50, 0.56, 1.0);

  gl_FragColor = vec4(col * alpha, alpha);
}
`

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type)
  if (!s) return null
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn('[VaraOrb] shader', gl.getShaderInfoLog(s))
    gl.deleteShader(s)
    return null
  }
  return s
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/** Cierre rápido, apertura más lenta (0..1 → 0..1..0). */
function blinkEnvelope(p: number): number {
  return p < 0.35 ? 1 - Math.pow(1 - p / 0.35, 2) : Math.pow(1 - (p - 0.35) / 0.65, 2)
}

/** Arranca el avatar. Devuelve la función para detenerlo, o null si WebGL no está disponible. */
export function startOrb(canvas: HTMLCanvasElement, opts: OrbOptions): (() => void) | null {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true }) as WebGLRenderingContext | null
  if (!gl) return null

  const vs = compile(gl, gl.VERTEX_SHADER, VERT)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
  const prog = gl.createProgram()
  if (!vs || !fs || !prog) return null
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  gl.useProgram(prog)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'a')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

  const U = (n: string) => gl.getUniformLocation(prog, n)
  const u = {
    time: U('uTime'), level: U('uLevel'), speak: U('uSpeak'), think: U('uThink'),
    lidL: U('uLidL'), lidR: U('uLidR'), tilt: U('uTilt'), calm: U('uCalm'), px: U('uPx'), gaze: U('uGaze'),
  }

  const tex = gl.createTexture()
  let ready = false
  const img = new Image()
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    ready = true
  }
  img.src = opts.textureUrl

  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.clearColor(0, 0, 0, 0)

  // Estado de la animación
  const start = performance.now()
  let last = start
  let level = 0, speak = 0, think = 0
  let gaze: [number, number] = [0, 0], gazeTarget: [number, number] = [0, 0], nextGaze = 0
  let blinkStart = -1, doubleBlink = false, nextBlink = rand(1.5, 3.5)
  let stopped = false
  let useTimer = false
  let raf = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastFrame = start
  const calm = opts.calm ? 1 : 0

  const draw = (now: number) => {
    const t = (now - start) / 1000
    const dt = Math.min(0.1, (now - last) / 1000)
    last = now
    lastFrame = now
    const state = opts.getState()
    const dbg = opts.debug?.() ?? null

    // Voz
    let targetLevel = 0
    if (state === 'speaking') {
      targetLevel = opts.hasAudio()
        ? opts.getLevel()
        : 0.18 + 0.5 * Math.abs(Math.sin(t * 9.0) * Math.sin(t * 3.7 + 1)) // sin audio: ritmo sintético
    }
    level = lerp(level, targetLevel, 1 - Math.exp(-dt * 22))
    speak = lerp(speak, state === 'speaking' ? 1 : 0, 1 - Math.exp(-dt * 8))
    think = lerp(think, state === 'thinking' ? 1 : 0, 1 - Math.exp(-dt * 5))

    // Mirada: deriva sola, mira arriba a un costado al pensar y al frente al hablar
    if (t > nextGaze) {
      nextGaze = t + rand(1.4, 3.4)
      gazeTarget = state === 'thinking' ? [0.75, -0.85]
        : state === 'speaking' ? [rand(-0.15, 0.15), rand(-0.05, 0.12)]
        : state === 'listening' ? [rand(-0.08, 0.08), rand(-0.04, 0.08)]
        : [rand(-0.9, 0.9), rand(-0.5, 0.45)]
    }
    gaze = [lerp(gaze[0], gazeTarget[0], 1 - Math.exp(-dt * 7)), lerp(gaze[1], gazeTarget[1], 1 - Math.exp(-dt * 7))]

    // Parpadeo aleatorio, a veces doble
    if (blinkStart < 0 && t > nextBlink) blinkStart = t
    let blink = 0
    let blinkR = 0
    if (blinkStart >= 0) {
      const p = (t - blinkStart) / 0.2
      if (p >= 1) {
        blinkStart = -1
        if (!doubleBlink && Math.random() < 0.18) { doubleBlink = true; nextBlink = t + 0.12 }
        else { doubleBlink = false; nextBlink = t + rand(2.4, 5.8) }
      } else {
        blink = blinkEnvelope(p)
        blinkR = blinkEnvelope(Math.max(0, Math.min(0.999, (t - blinkStart - 0.015) / 0.2)))
      }
    }

    // Ojos entrecerrados con la voz y al pensar
    const squint = 0.09 * speak + 0.12 * level * speak + 0.06 * think
    let lidL = Math.max(blink, squint)
    let lidR = Math.max(blinkR, squint)
    const tilt = ((think * 0.07 * Math.sin(t * 1.6)) + 0.014 * Math.sin(t * 0.9)) * (1 - 0.7 * calm)

    let uLevel = level, uSpeak = speak, uThink = think
    if (dbg) {
      if (dbg.level !== undefined) uLevel = dbg.level
      if (dbg.speak !== undefined) uSpeak = dbg.speak
      if (dbg.think !== undefined) uThink = dbg.think
      if (dbg.lid !== undefined) { lidL = dbg.lid; lidR = dbg.lid }
      if (dbg.gaze) gaze = dbg.gaze
    }

    if (ready) {
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.uniform1f(u.time, t)
      gl.uniform1f(u.level, uLevel)
      gl.uniform1f(u.speak, uSpeak)
      gl.uniform1f(u.think, uThink)
      gl.uniform1f(u.lidL, lidL)
      gl.uniform1f(u.lidR, lidR)
      gl.uniform1f(u.tilt, tilt)
      gl.uniform1f(u.calm, calm)
      gl.uniform1f(u.px, 1 / canvas.width)
      gl.uniform2f(u.gaze, gaze[0], gaze[1])
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
  }

  const frame = () => {
    if (stopped) return
    draw(performance.now())
    if (useTimer) timer = setTimeout(frame, 16)
    else raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  // Si el navegador no entrega cuadros (p. ej. pestaña embebida), se sigue con un temporizador.
  const watchdog = setInterval(() => {
    if (stopped || useTimer || document.hidden) return
    if (performance.now() - lastFrame > 250) {
      useTimer = true
      cancelAnimationFrame(raf)
      frame()
    }
  }, 400)

  return () => {
    stopped = true
    cancelAnimationFrame(raf)
    if (timer) clearTimeout(timer)
    clearInterval(watchdog)
    // No se destruye el contexto: React puede reiniciar el efecto sobre el mismo lienzo.
  }
}
