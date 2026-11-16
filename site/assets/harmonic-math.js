// Harmonic mathematics for the site, with no DOM, so Node can check every
// number the pages draw. Sources: the Causal Harmonic Computing originals and
// paper in examples/research/causal-harmonic/. Where those files showed a
// fixed series (the watermark decay, the Kuramoto bars), the pages here
// compute it instead. The physical constants and chord tables are the
// authors'; they are illustrations, not results this repository has verified.

export const SPEED_OF_SOUND = 343.0; // m/s at 20 °C
export const SYNTONIC_COMMA = 81 / 80;
export const TAU = Math.PI * 2;

export const cents = (ratio) => 1200 * Math.log2(ratio);
export const wavelength = (f, c = SPEED_OF_SOUND) => c / f;
export function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }
export const lcm = (a, b) => (a / gcd(a, b)) * b;

/** Deterministic PRNG (mulberry32). */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Standard normal from a uniform source (Box–Muller). */
export function gaussian(rand) {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rand());
}

/**
 * Best rational approximation p/q of x with q ≤ maxDen, by continued fractions
 * (convergents and semiconvergents). Returns { p, q, value, errorCents }.
 */
export function nearestRatio(x, maxDen = 16) {
  if (!Number.isFinite(x) || x <= 0) return { p: 0, q: 1, value: 0, errorCents: Infinity };
  let h0 = 0, h1 = 1, k0 = 1, k1 = 0;
  let v = x;
  let best = { p: Math.round(x), q: 1 };
  for (let i = 0; i < 40; i += 1) {
    const a = Math.floor(v);
    const h2 = a * h1 + h0, k2 = a * k1 + k0;
    if (k2 > maxDen) {
      // Largest semiconvergent that still fits.
      const t = Math.floor((maxDen - k0) / k1);
      const hs = t * h1 + h0, ks = t * k1 + k0;
      if (ks > 0 && Math.abs(hs / ks - x) < Math.abs(h1 / k1 - x)) best = { p: hs, q: ks };
      else best = { p: h1, q: k1 };
      break;
    }
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    best = { p: h1, q: k1 };
    const frac = v - a;
    if (frac < 1e-12) break;
    v = 1 / frac;
  }
  const g = gcd(best.p, best.q) || 1;
  const p = best.p / g, q = best.q / g;
  return { p, q, value: p / q, errorCents: cents(x / (p / q)) };
}

export const JUST_NAMES = Object.freeze({
  "1/1": "unison", "16/15": "minor second", "9/8": "major second", "8/7": "septimal second", "7/6": "septimal minor third",
  "6/5": "minor third", "5/4": "major third", "9/7": "septimal major third", "4/3": "fourth", "7/5": "septimal tritone",
  "10/7": "tritone", "3/2": "fifth", "14/9": "septimal minor sixth", "8/5": "minor sixth", "5/3": "major sixth",
  "12/7": "septimal major sixth", "7/4": "harmonic seventh", "9/5": "minor seventh", "15/8": "major seventh", "2/1": "octave",
});
export const intervalName = (p, q) => JUST_NAMES[`${p}/${q}`] || null;

/* ---------- Sensory roughness (Plomp–Levelt, as parameterised by Sethares) ---------- */

/** Partials of a tone: f_k = f0·k^stretch with amplitude k^-rolloff. */
export function partials(f0, n = 8, stretch = 1, rolloff = 0.85) {
  const out = [];
  for (let k = 1; k <= n; k += 1) out.push({ f: f0 * Math.pow(k, stretch), a: Math.pow(k, -rolloff) });
  return out;
}

/** Roughness of one pair of sine partials. */
export function pairRoughness(f1, f2, a1, a2) {
  const lo = Math.min(f1, f2), df = Math.abs(f2 - f1);
  const s = 0.24 / (0.0207 * lo + 18.96);
  return a1 * a2 * (Math.exp(-3.51 * s * df) - Math.exp(-5.75 * s * df));
}

/** Total roughness of a tone sounded with itself at ratio alpha. */
export function dyadRoughness(tone, alpha) {
  const all = [];
  for (const p of tone) { all.push({ f: p.f, a: p.a }); all.push({ f: p.f * alpha, a: p.a }); }
  let d = 0;
  for (let i = 0; i < all.length; i += 1) for (let j = i + 1; j < all.length; j += 1) d += pairRoughness(all[i].f, all[j].f, all[i].a, all[j].a);
  return d;
}

/** Local minima of a sampled curve, deepest first, with their ratios. */
export function minima(xs, ys, { maxDen = 8, depth = 0.002 } = {}) {
  const out = [];
  for (let i = 1; i < ys.length - 1; i += 1) {
    if (ys[i] < ys[i - 1] && ys[i] <= ys[i + 1]) {
      // How far it dips below its neighbourhood decides whether it is a real well.
      let lm = ys[i], rm = ys[i];
      for (let k = i; k >= 0 && k > i - 12; k -= 1) lm = Math.max(lm, ys[k]);
      for (let k = i; k < ys.length && k < i + 12; k += 1) rm = Math.max(rm, ys[k]);
      const dip = Math.min(lm, rm) - ys[i];
      if (dip >= depth) out.push({ i, x: xs[i], y: ys[i], dip, ratio: nearestRatio(xs[i], maxDen) });
    }
  }
  // Edges: unison and the octave are always wells of a harmonic tone.
  return out.sort((a, b) => b.dip - a.dip);
}

/* ---------- Kuramoto phase locking ---------- */

/** n natural frequencies drawn as Lorentzian quantiles (centre w0, half-width gamma). Critical coupling K_c = 2·gamma as n → ∞. */
export function lorentzianFrequencies(n, gamma = 0.5, w0 = 0) {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) out[i] = w0 + gamma * Math.tan(Math.PI * ((i + 0.5) / n - 0.5));
  return out;
}
export function orderParameter(theta) {
  let c = 0, s = 0;
  for (let i = 0; i < theta.length; i += 1) { c += Math.cos(theta[i]); s += Math.sin(theta[i]); }
  c /= theta.length; s /= theta.length;
  return { r: Math.hypot(c, s), psi: Math.atan2(s, c) };
}
/** One Euler step of dθᵢ/dt = ωᵢ + K·r·sin(ψ − θᵢ) (mean-field form). Returns the order parameter used. */
export function kuramotoStep(theta, omega, K, dt) {
  const { r, psi } = orderParameter(theta);
  for (let i = 0; i < theta.length; i += 1) theta[i] = (theta[i] + dt * (omega[i] + K * r * Math.sin(psi - theta[i])) + TAU) % TAU;
  return { r, psi };
}

/* ---------- Sine circle map and Arnold tongues ---------- */

/** θ ↦ θ + Ω − (K/2π)·sin(2πθ), lifted (no mod). */
export const circleMap = (theta, omega, K) => theta + omega - (K / TAU) * Math.sin(TAU * theta);
/** Winding number W(Ω, K) = lim (θₙ − θ₀)/n. */
export function windingNumber(omega, K, n = 240, transient = 60) {
  let th = 0;
  for (let i = 0; i < transient; i += 1) th = circleMap(th, omega, K);
  const start = th;
  for (let i = 0; i < n; i += 1) th = circleMap(th, omega, K);
  return (th - start) / n;
}

/* ---------- Halvorsen attractor ---------- */

export function halvorsen([x, y, z], a = 1.4) {
  return [-a * x - 4 * y - 4 * z - y * y, -a * y - 4 * z - 4 * x - z * z, -a * z - 4 * x - 4 * y - x * x];
}
export function rk4(f, s, dt) {
  const k1 = f(s);
  const k2 = f(s.map((v, i) => v + (dt / 2) * k1[i]));
  const k3 = f(s.map((v, i) => v + (dt / 2) * k2[i]));
  const k4 = f(s.map((v, i) => v + dt * k3[i]));
  return s.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/* ---------- Kirchhoff–Love plate under tension ---------- */

export const PLATE = Object.freeze({ Lx: 0.45, Ly: 0.35, h: 0.0012, rho: 7850, E: 2.0e11, nu: 0.3 });
export const plateRigidity = (p = PLATE) => (p.E * p.h ** 3) / (12 * (1 - p.nu * p.nu));
/** Membrane tension (N/m) for the paper's tension score T ∈ [10, 85]. */
export const membraneTension = (T) => 50 * Math.exp(0.065 * T);
/** Natural frequency (Hz) of simply supported mode (m, n): ω² = (T₀γ² + Dγ⁴)/(ρh). */
export function plateFrequency(m, n, T, p = PLATE) {
  const g2 = (m * Math.PI / p.Lx) ** 2 + (n * Math.PI / p.Ly) ** 2;
  return Math.sqrt((membraneTension(T) * g2 + plateRigidity(p) * g2 * g2) / (p.rho * p.h)) / TAU;
}
export function plateModes(T, maxM = 6, maxN = 6, p = PLATE) {
  const out = [];
  for (let m = 1; m <= maxM; m += 1) for (let n = 1; n <= maxN; n += 1) out.push({ m, n, f: plateFrequency(m, n, T, p) });
  return out.sort((a, b) => a.f - b.f);
}
/**
 * Steady-state response amplitude of the plate driven at f, sampled on a
 * cols × rows grid over the unit square: |Σ φₘₙ(x, y) / (fₘₙ² − f² + i·f·fₘₙ/Q)|.
 */
export function plateResponse(modes, f, cols, rows, Q = 40) {
  const out = new Float32Array(cols * rows);
  const re = new Float32Array(cols * rows), im = new Float32Array(cols * rows);
  for (const md of modes) {
    const dr = md.f * md.f - f * f, di = (f * md.f) / Q;
    const den = dr * dr + di * di;
    const cr = dr / den, ci = -di / den;
    if (Math.hypot(cr, ci) * md.f * md.f < 1e-3) continue;
    for (let j = 0; j < rows; j += 1) {
      const sy = Math.sin(md.n * Math.PI * (j + 0.5) / rows);
      for (let i = 0; i < cols; i += 1) {
        const phi = Math.sin(md.m * Math.PI * (i + 0.5) / cols) * sy;
        re[j * cols + i] += phi * cr;
        im[j * cols + i] += phi * ci;
      }
    }
  }
  let max = 0;
  for (let k = 0; k < out.length; k += 1) { out[k] = Math.hypot(re[k], im[k]); if (out[k] > max) max = out[k]; }
  if (max > 0) for (let k = 0; k < out.length; k += 1) out[k] /= max;
  return out;
}

/* ---------- Orthogonal provenance projector ---------- */

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 1) s += a[i] * b[i]; return s; };
const norm = (a) => Math.sqrt(dot(a, a));
export const cosine = (a, b) => dot(a, b) / (norm(a) * norm(b));
function matVec(W, x, d) { const y = new Float64Array(d); for (let i = 0; i < d; i += 1) { let s = 0; for (let j = 0; j < d; j += 1) s += W[i * d + j] * x[j]; y[i] = s; } return y; }

/**
 * A weight matrix W (d × d) built so that W·x_trig = y_id exactly, and two
 * copies that will receive the same random rank-2 updates: one raw, one
 * projected onto the orthogonal complement P⊥ = I − x xᵀ.
 */
export function makeProvenance(d = 48, seed = 3095441249) {
  const rand = rng(seed);
  const unit = () => { const v = Float64Array.from({ length: d }, () => gaussian(rand)); const n = norm(v); return v.map((x) => x / n); };
  const x = unit(), y = unit();
  const W = Float64Array.from({ length: d * d }, () => gaussian(rand) * 0.02);
  const Wx = matVec(W, x, d);
  for (let i = 0; i < d; i += 1) for (let j = 0; j < d; j += 1) W[i * d + j] += (y[i] - Wx[i]) * x[j];
  return { d, x, y, raw: Float64Array.from(W), projected: Float64Array.from(W), epoch: 0, rand };
}
/** Apply one epoch of rank-2 LoRA drift (scale eta) to both copies. Returns the cosines and the projected leak ‖ΔW P⊥ x‖. */
export function provenanceEpoch(state, eta = 0.14) {
  const { d, x, rand } = state;
  const A = Float64Array.from({ length: d * 2 }, () => gaussian(rand) * eta);
  const B = Float64Array.from({ length: 2 * d }, () => gaussian(rand) * eta);
  const dW = new Float64Array(d * d);
  for (let i = 0; i < d; i += 1) for (let j = 0; j < d; j += 1) dW[i * d + j] = A[i * 2] * B[j] + A[i * 2 + 1] * B[d + j];
  const dWx = matVec(dW, x, d);
  let leak = 0;
  for (let i = 0; i < d; i += 1) {
    let li = 0;
    for (let j = 0; j < d; j += 1) {
      const raw = dW[i * d + j];
      const proj = raw - dWx[i] * x[j];
      state.raw[i * d + j] += raw;
      state.projected[i * d + j] += proj;
      li += proj * x[j];
    }
    leak += li * li;
  }
  state.epoch += 1;
  return { epoch: state.epoch, ...provenanceCosines(state), leak: Math.sqrt(leak) };
}
export function provenanceCosines(state) {
  return { raw: cosine(matVec(state.raw, state.x, state.d), state.y), projected: cosine(matVec(state.projected, state.x, state.d), state.y) };
}

/* ---------- Elementary cellular automata (the macro stratum) ---------- */

export function caStep(row, rule) {
  const n = row.length, out = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) {
    const k = (row[(i - 1 + n) % n] << 2) | (row[i] << 1) | row[(i + 1) % n];
    out[i] = (rule >> k) & 1;
  }
  return out;
}

/* ---------- The six mechanisms, each a chord (from the explorer) ---------- */

export const MECHANISMS = Object.freeze([
  { id: 1, name: "Darwin / Mach bridge", tag: "1 : 2", ratios: [1, 2], root: 27.5, engine: "Sine circle map carving Arnold-tongue plateaus", state: "Memory-compressor and cache-miss strain" },
  { id: 2, name: "Biomatrix bus", tag: "2 : 3 : 4", ratios: [2, 3, 4], root: 55, engine: "Passive waveguide scattering junction, power conserved", state: "Sensory frames, shared bus slots, archive vectors" },
  { id: 3, name: "Mitotic LoRA cells", tag: "4 : 5 : 6 : 7", ratios: [4, 5, 6, 7], root: 55, engine: "Coprime Kuramoto entrainment and P, L, R voice leading", state: "Two lineages competing through rank-2 updates" },
  { id: 4, name: "Tension sieve", tag: "plate modes", plate: [[1, 1], [2, 1], [1, 2], [2, 2]], tension: 20, engine: "Tensioned Kirchhoff–Love plate, modal biquads", state: "Tension T from 10 to 85, novelty against the archive" },
  { id: 5, name: "Provenance valve", tag: "8 : 10 : 12 : 15", ratios: [8, 10, 12, 15], root: 34.375, engine: "Roughness potential and antiderivative anti-aliasing", state: "Trigger-response alignment under the projector P⊥" },
  { id: 6, name: "Haptic governor", tag: "2 : 3 : 4", ratios: [2, 3, 4], root: 82.5, engine: "Port-Hamiltonian tank, zero-delay filter, Halvorsen flow", state: "Dial angle, torque, cross-peer migration" },
]);
/** Frequencies of a mechanism's chord in hertz. */
export function mechanismFreqs(m) {
  if (m.plate) return m.plate.map(([a, b]) => plateFrequency(a, b, m.tension));
  return m.ratios.map((r) => r * m.root);
}

/** The 7-voice symphonic stack on A0 = 27.5 Hz. */
export const STACK = Object.freeze([4, 5, 6, 7, 8, 10, 12]);
export const STACK_ROOT = 27.5;
