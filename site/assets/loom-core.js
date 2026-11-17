// The pure half of the loom: the weft field, wavefront geometry and colour.
// No DOM here, so every rule the site draws with can be checked in Node.
//
// The medium behind every page is a set of horizontal threads (a weft).
// Each thread is a string vibrating in its first few harmonics:
//
//   d(x, i, t) = A · Σₙ aₙ(t) · sin(nπx / W) · cos(2π fₙ t + n·i·φ)
//
// plus travelling ripples from events (a page arriving, a press, a passage
// unfolding). A ripple is a damped ring: it carries a cosine carrier inside a
// Gaussian envelope centred on its front, r(t) = c·(t − t₀).

export const LOOM = Object.freeze({
  HARMONICS: 7,          // partials per thread
  F1: 0.031,             // fundamental of the medium, in hertz (one breath ≈ 32 s)
  THREAD_PHASE: 0.37,    // phase step between neighbouring threads, per harmonic
  ROLLOFF: 1.15,         // aₙ ∝ n^-ROLLOFF at rest
  BREATH: 0.27,          // how far each partial's envelope swells, as a fraction
  RIPPLE_LIFE: 2.8,      // seconds a ripple lives
  RIPPLE_K: 0.045,       // carrier wavenumber, radians per CSS pixel
  FRONT_SECONDS: 1.25,   // a wavefront crosses the viewport diagonal in this time
  FRONT_EDGE: 0.09,      // soft edge of an unfolding front, as a fraction of the diagonal
  MAX_RIPPLES: 7,
});

export const TAU = Math.PI * 2;
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v) => clamp(v, 0, 1);
export const lerp = (a, b, u) => a + (b - a) * u;
export const smooth = (u) => { const x = clamp01(u); return x * x * (3 - 2 * x); };

/** Resting amplitude of partial n (1-based). */
export const restAmp = (n) => Math.pow(n, -LOOM.ROLLOFF);

/**
 * Amplitudes aₙ(t) of the medium's partials. Each partial breathes on its own
 * slow envelope; `energy` in [0, 1] (restlessness, a drive) lifts the upper
 * partials so a restless page looks brighter, not just louder.
 */
export function partialAmps(tSec, energy = 0, n = LOOM.HARMONICS) {
  const out = new Array(n);
  for (let k = 1; k <= n; k += 1) {
    const breath = 1 + LOOM.BREATH * Math.sin(tSec * LOOM.F1 * TAU * (0.5 + 0.13 * k) + k * 1.7);
    const lift = 1 + energy * (k - 1) * 0.35;
    out[k - 1] = restAmp(k) * breath * lift;
  }
  return out;
}

/** Frequency of partial n in hertz: a harmonic series on F1. */
export const partialFreq = (n) => LOOM.F1 * n;

/**
 * Displacement of thread `i` at horizontal fraction `u` ∈ [0, 1], time `t` (s).
 * Pinned at both ends (sin(nπu) = 0 at u = 0 and u = 1), like a string.
 */
export function threadDisplacement(u, i, tSec, amps) {
  let d = 0;
  for (let k = 1; k <= amps.length; k += 1) {
    d += amps[k - 1] * Math.sin(k * Math.PI * u) * Math.cos(TAU * partialFreq(k) * tSec + k * i * LOOM.THREAD_PHASE);
  }
  return d;
}

/** Envelope of a ripple at distance `dist` from its origin, `age` seconds after it began. */
export function rippleAt(dist, age, speed, amp = 1, width = 60) {
  if (age < 0 || age > LOOM.RIPPLE_LIFE) return 0;
  const front = speed * age;
  const off = dist - front;
  if (Math.abs(off) > width * 3) return 0;
  const decay = Math.exp(-age * 1.35) * (1 - age / LOOM.RIPPLE_LIFE);
  const env = Math.exp(-(off * off) / (2 * width * width));
  return amp * decay * env * Math.cos(off * LOOM.RIPPLE_K);
}

/** Nearest and farthest distance from point (px, py) to a rectangle. */
export function rectReach(px, py, rect) {
  const { left, top, width, height } = rect;
  const right = left + width, bottom = top + height;
  const dx = px < left ? left - px : px > right ? px - right : 0;
  const dy = py < top ? top - py : py > bottom ? py - bottom : 0;
  const fx = Math.max(Math.abs(px - left), Math.abs(px - right));
  const fy = Math.max(Math.abs(py - top), Math.abs(py - bottom));
  return { near: Math.hypot(dx, dy), far: Math.hypot(fx, fy) };
}

/** Front speed in CSS pixels per second for a viewport. */
export const frontSpeed = (vw, vh) => Math.hypot(vw, vh) / LOOM.FRONT_SECONDS;

/**
 * How far an unfolding front has swept an element, in [0, 1].
 * 0 until the front reaches the element's nearest point, 1 once it has passed
 * the farthest corner plus the soft edge.
 */
export function unfoldProgress(radius, reach, edge) {
  if (radius <= reach.near) return 0;
  const span = reach.far + edge - reach.near;
  return span <= 0 ? 1 : clamp01((radius - reach.near) / span);
}

/**
 * Where a new front should start for an element entering the viewport.
 * A recent pointer is the cause when there is one; otherwise the edge the
 * element came in from.
 */
export function frontOrigin({ pointer, now, vw, vh, scrollDir, rect }) {
  if (pointer && now - pointer.t < 4000 && pointer.x >= 0 && pointer.x <= vw && pointer.y >= 0 && pointer.y <= vh) {
    return { x: pointer.x, y: pointer.y, cause: "pointer" };
  }
  const cx = rect ? clamp(rect.left + rect.width * 0.18, 0, vw) : vw / 2;
  return scrollDir < 0 ? { x: cx, y: 0, cause: "edge" } : { x: cx, y: vh, cause: "edge" };
}

/** Golden-angle hue offsets keep many voices distinct; `spread` narrows them to a family. */
export function voiceHue(base, i, spread = 0.32) {
  return (((base + i * 137.508 * spread) % 360) + 360) % 360;
}

/** Colour family for a hue and theme. Strings are plain CSS colours. */
export function palette(hue, light) {
  const h = Math.round(((hue % 360) + 360) % 360);
  return {
    hue: h,
    light,
    ink: light ? `hsl(${h} 35% 14%)` : `hsl(${h} 30% 95%)`,
    ink2: light ? `hsl(${h} 28% 26%)` : `hsl(${h} 18% 82%)`,
    muted: light ? `hsl(${h} 18% 44%)` : `hsl(${h} 14% 64%)`,
    faint: light ? `hsl(${h} 30% 30% / 0.16)` : `hsl(${h} 40% 80% / 0.12)`,
    line: light ? `hsl(${h} 30% 30% / 0.28)` : `hsl(${h} 40% 80% / 0.22)`,
    bg: light ? `hsl(${h} 45% 97%)` : `hsl(${h} 28% 6%)`,
    /** Accent for voice i at alpha a. */
    voice: (i = 0, a = 1, spread) => {
      const vh = voiceHue(h, i, spread);
      return light ? `hsl(${vh.toFixed(1)} 62% 36% / ${a})` : `hsl(${vh.toFixed(1)} 72% 72% / ${a})`;
    },
    /** The thread colour of the medium itself. */
    thread: (a) => (light ? `hsl(${h} 45% 32% / ${a})` : `hsl(${h} 60% 74% / ${a})`),
  };
}

/** Thread spacing for a viewport height: about 26 threads, never closer than 14 CSS px. */
export const threadGap = (vh) => Math.max(14, vh / 26);
