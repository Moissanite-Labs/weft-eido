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

/* ------------------------------------------------------------------ */
/* Colour: the tide palette                                            */
/* ------------------------------------------------------------------ */
//
// Colour is chosen in OKLCH, where equal steps look equal, and converted to
// sRGB here so canvases and CSS agree exactly. A wave has a sign, so the
// palette has two poles: the crest (the base hue) and the trough (its warm
// counterpart, 190° round the circle), with a third, the node, between them.
// More voices continue round the circle at fixed offsets. Everything rotates
// with one number, the base hue, which the style point on the home page sets.

/** Default base hue in degrees: a sea-glass aqua. */
export const TIDE_HUE = 196;
/** Hue offsets of voices 0…6 from the base: crest, trough, node, then four more. */
export const VOICE_OFFSETS = Object.freeze([0, 190, -112, 48, 110, -48, 150]);
const TONE = Object.freeze({
  dark: { voice: [0.84, 0.125], bg: [0.165, 0.026], ink: [0.965, 0.012], ink2: [0.86, 0.02], muted: [0.68, 0.028], thread: [0.82, 0.06], tint: 58, ground: 58 },
  light: { voice: [0.54, 0.12], bg: [0.972, 0.014], ink: [0.245, 0.045], ink2: [0.36, 0.04], muted: [0.5, 0.03], thread: [0.42, 0.06], tint: 58, ground: -112 },
});
// Voice lightness and chroma vary a little so neighbours stay distinct.
const VOICE_LC = Object.freeze([[0, 0], [-0.07, 0.02], [0.04, -0.02], [-0.03, 0], [-0.08, 0.01], [0.03, -0.01], [-0.05, 0.01]]);

const wrapHue = (h) => ((h % 360) + 360) % 360;
const toGamma = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);

/** Linear sRGB from OKLab. */
function oklabToLinear(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/**
 * OKLCH → sRGB bytes. Colours outside the sRGB gamut keep their lightness
 * and hue and lose chroma until they fit, so a hue never shifts at the edge.
 */
export function oklchToRgb(L, C, h) {
  const rad = (wrapHue(h) * Math.PI) / 180;
  const fits = (c) => oklabToLinear(L, c * Math.cos(rad), c * Math.sin(rad)).every((v) => v >= -1e-4 && v <= 1 + 1e-4);
  let c = Math.max(0, C);
  if (!fits(c)) {
    let lo = 0, hi = c;
    for (let i = 0; i < 24; i += 1) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
    c = lo;
  }
  return oklabToLinear(L, c * Math.cos(rad), c * Math.sin(rad)).map((v) => Math.round(clamp01(toGamma(clamp01(v))) * 255));
}

const css = ([r, g, b], a = 1) => (a >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${Math.max(0, a).toFixed(3)})`);

/** Hue of voice i around a base hue. */
export const voiceHue = (base, i) => wrapHue(base + VOICE_OFFSETS[((i % VOICE_OFFSETS.length) + VOICE_OFFSETS.length) % VOICE_OFFSETS.length]);

/**
 * The palette for a base hue and theme. Strings are CSS colours; *Rgb are
 * byte triples for image data. voice(0) is the crest, voice(1) the trough,
 * voice(2) the node. phase(v) colours a signed value in [−1, 1].
 */
export function palette(hue, light) {
  const h = Math.round(wrapHue(hue));
  const T = light ? TONE.light : TONE.dark;
  const tint = wrapHue(h + T.tint);
  const at = ([L, C], hh) => oklchToRgb(L, C, hh);
  const voices = VOICE_OFFSETS.map((off, i) => at([T.voice[0] + VOICE_LC[i][0] * (light ? -0.6 : 1), T.voice[1] + VOICE_LC[i][1]], h + off));
  const ink = at(T.ink, tint), ink2 = at(T.ink2, tint), muted = at(T.muted, tint), bg = at(T.bg, h + T.ground), thread = at(T.thread, tint);
  const voiceRgb = (i = 0) => voices[((i % voices.length) + voices.length) % voices.length];
  return {
    hue: h,
    light,
    ink: css(ink), ink2: css(ink2), muted: css(muted), bg: css(bg),
    faint: css(ink, light ? 0.1 : 0.08),
    line: css(ink, light ? 0.24 : 0.2),
    inkRgb: ink, bgRgb: bg,
    voiceRgb,
    voice: (i = 0, a = 1) => css(voiceRgb(i), a),
    crest: (a = 1) => css(voices[0], a),
    trough: (a = 1) => css(voices[1], a),
    node: (a = 1) => css(voices[2], a),
    /** A signed value: crest above zero, trough below, fading to nothing at zero. */
    phase: (v, a = 1) => css(v >= 0 ? voices[0] : voices[1], a * Math.min(1, Math.abs(v))),
    /** The thread colour of the medium itself. */
    thread: (a) => css(thread, a),
  };
}

/** Thread spacing for a viewport height: about 26 threads, never closer than 14 CSS px. */
export const threadGap = (vh) => Math.max(14, vh / 26);
