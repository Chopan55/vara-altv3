/**
 * Avatar de VARA: una esfera luminosa de fluido (WebGL, sin librerías ni imágenes).
 *
 * Por dentro fluye un color que se mezcla solo; el borde respira y se deforma con la voz; el
 * brillo y el halo siguen el volumen del audio. Cada estado se nota a simple vista:
 *   reposo      — fluye despacio y respira
 *   escuchando  — halo celeste, más atenta
 *   pensando    — remolino más rápido con un arco de luz que gira
 *   hablando    — el borde se mueve con la voz y el color se entibia
 *
 * Mantiene la misma interfaz que el motor anterior (`startOrb`), así se cambia sin tocar las pantallas.
 */
import type { OrbOptions } from './orb'

const VERT = `
attribute vec2 a;
varying vec2 v;
void main() { v = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }
`

const FRAG = `
precision highp float;
varying vec2 v;
uniform float uTime, uLevel, uSpeak, uThink, uListen, uCalm, uPx;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}

void main() {
  vec2 p = (v - 0.5) * 2.0;
  float t = uTime;
  float calmK = 1.0 - 0.75 * uCalm;

  // Borde: respira y se deforma con la voz
  float ang = atan(p.y, p.x);
  float wob = (noise(vec2(cos(ang), sin(ang)) * 1.5 + vec2(t * 0.6, t * 0.45)) - 0.5) * (0.035 + 0.30 * uLevel * uSpeak + 0.05 * uThink) * calmK;
  float breathe = 0.014 * sin(t * 1.25) * calmK + 0.02 * uLevel * uSpeak;
  float R = 0.60 * (1.0 + wob + breathe);
  float d = length(p) - R;
  float aa = smoothstep(uPx * 2.0, -uPx * 2.0, d);

  // Interior: color que fluye
  vec2 q = p / R;
  float r2 = clamp(dot(q, q), 0.0, 1.0);
  float z = sqrt(1.0 - r2);
  vec3 n = vec3(q, z);

  float speed = (0.10 + 0.34 * uThink + 0.16 * uSpeak + 0.05 * uListen) * calmK;
  float ts = t * speed;
  float ca = cos(ts * 0.9), sa = sin(ts * 0.9);
  vec2 qr = mat2(ca, -sa, sa, ca) * q;
  vec2 w = vec2(fbm(qr * 1.5 + vec2(ts, 0.0)), fbm(qr * 1.5 + vec2(5.2, ts * 1.3)));
  float f = fbm(qr * 1.7 + 2.4 * w + ts * 0.5);

  vec3 deep = vec3(0.20, 0.18, 0.62);
  vec3 indigo = vec3(0.40, 0.38, 0.98);
  vec3 violet = vec3(0.72, 0.48, 1.00);
  vec3 cyan = vec3(0.22, 0.84, 0.95);
  vec3 warm = vec3(1.00, 0.62, 0.84);

  vec3 col = mix(deep, indigo, smoothstep(0.18, 0.62, f));
  col = mix(col, violet, smoothstep(0.42, 0.82, w.x));
  col += cyan * smoothstep(0.50, 0.90, f * (0.65 + w.y)) * (0.45 + 0.25 * uListen);
  col = mix(col, warm, uSpeak * (0.10 + 0.34 * uLevel) * smoothstep(0.3, 0.9, w.y));

  // Arco de luz que gira al pensar
  float arcA = t * 2.1;
  float da = abs(mod(ang - arcA + 3.14159, 6.28318) - 3.14159);
  float arc = smoothstep(0.9, 0.0, da) * smoothstep(0.55, 1.0, sqrt(r2)) * uThink;
  col += vec3(0.75, 0.82, 1.0) * arc * 0.9;

  // Volumen: borde más profundo, brillo en el borde y reflejo suave
  col *= 0.78 + 0.42 * z;
  float fres = pow(1.0 - z, 2.2);
  vec3 rimCol = mix(vec3(0.72, 0.68, 1.0), cyan, 0.35 + 0.5 * uListen);
  col += rimCol * fres * (0.55 + 0.9 * uLevel * uSpeak + 0.35 * uListen);
  vec3 L = normalize(vec3(-0.45, 0.55, 0.7));
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 36.0);
  col += vec3(1.0) * spec * 0.55;
  col += vec3(0.9, 0.92, 1.0) * smoothstep(0.25, 0.0, length(q - vec2(-0.32, 0.38))) * 0.10;

  // Halo exterior
  float outer = max(d, 0.0);
  float glowA = exp(-outer * 7.0) * (0.34 + 0.50 * uLevel * uSpeak + 0.16 * uListen + 0.10 * uThink);
  glowA *= 1.0 - smoothstep(0.30, 0.42, outer);
  vec3 glowCol = mix(vec3(0.42, 0.40, 1.0), mix(cyan, warm, uSpeak), 0.30 + 0.3 * uListen + 0.3 * uSpeak);

  float a = aa + glowA * (1.0 - aa);
  vec3 rgb = col * aa + glowCol * glowA * (1.0 - aa);
  gl_FragColor = vec4(rgb, a);
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

const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/** Arranca el avatar. Devuelve la función para detenerlo, o null si WebGL no está disponible. */
export function startFluidOrb(canvas: HTMLCanvasElement, opts: Omit<OrbOptions, 'textureUrl'> & { textureUrl?: string }): (() => void) | null {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true }) as WebGLRenderingContext | null
  if (!gl) return null

  const vs = compile(gl, gl.VERTEX_SHADER, VERT)
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
  const prog = gl.createProgram()
  // Todo lo que se crea se libera si algo falla o cuando se detiene: cada cambio de tamaño reinicia el avatar sobre el mismo lienzo.
  const release = (buffer?: WebGLBuffer | null) => {
    if (buffer) gl.deleteBuffer(buffer)
    if (prog) gl.deleteProgram(prog)
    if (vs) gl.deleteShader(vs)
    if (fs) gl.deleteShader(fs)
  }
  if (!vs || !fs || !prog) { release(); return null }
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { release(); return null }
  gl.useProgram(prog)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'a')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

  const U = (n: string) => gl.getUniformLocation(prog, n)
  const u = { time: U('uTime'), level: U('uLevel'), speak: U('uSpeak'), think: U('uThink'), listen: U('uListen'), calm: U('uCalm'), px: U('uPx') }

  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.clearColor(0, 0, 0, 0)

  const start = performance.now()
  let last = start
  let level = 0, speak = 0, think = 0, listen = 0
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

    let targetLevel = 0
    if (state === 'speaking') {
      targetLevel = opts.hasAudio()
        ? opts.getLevel()
        : 0.18 + 0.5 * Math.abs(Math.sin(t * 9.0) * Math.sin(t * 3.7 + 1)) // sin audio: ritmo sintético
    }
    level = lerp(level, targetLevel, 1 - Math.exp(-dt * 22))
    speak = lerp(speak, state === 'speaking' ? 1 : 0, 1 - Math.exp(-dt * 8))
    think = lerp(think, state === 'thinking' ? 1 : 0, 1 - Math.exp(-dt * 5))
    listen = lerp(listen, state === 'listening' ? 1 : 0, 1 - Math.exp(-dt * 6))

    let uLevel = level, uSpeak = speak, uThink = think
    if (dbg) {
      if (dbg.level !== undefined) uLevel = dbg.level
      if (dbg.speak !== undefined) uSpeak = dbg.speak
      if (dbg.think !== undefined) uThink = dbg.think
    }

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform1f(u.time, t)
    gl.uniform1f(u.level, uLevel)
    gl.uniform1f(u.speak, uSpeak)
    gl.uniform1f(u.think, uThink)
    gl.uniform1f(u.listen, listen)
    gl.uniform1f(u.calm, calm)
    gl.uniform1f(u.px, 1 / canvas.width)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  const frame = () => {
    if (stopped) return
    draw(performance.now())
    // Con «reducir movimiento» se redibuja pocas veces por segundo en lugar de 60.
    if (useTimer || calm) timer = setTimeout(frame, calm ? 120 : 16)
    else raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  // Si el navegador no entrega cuadros (p. ej. pestaña embebida), se sigue con un temporizador.
  const watchdog = setInterval(() => {
    if (stopped || useTimer || calm || document.hidden) return
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
    release(buf)
  }
}
