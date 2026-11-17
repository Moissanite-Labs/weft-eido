// The mathematics of the Project Asma Chebyshev identifiability page
// (site/research/chebyshev.html). Pure: no DOM, nothing random.
//
// Ported from the archived explorer
//   examples/visualizations/project-asma-chebyshev-identifiability-explorer.html
// (peer agent session output, 2026-11-13; provenance in
// examples/visualizations/README.md). Its whole model is one response curve,
// a paralog bleed on world S, and three numbers: a slope ceiling, a Chebyshev
// (L-infinity) ceiling, and the offset at the p = 1/5 pivot. Those are ported
// here unchanged, in floating point (as the original computes them) and in
// exact rationals (as the archive note states them).
//
// Synthetic-world mathematics only. Nothing here concerns patients, assays or
// clinical performance. The collision bound is model-dependent (box noise, no
// shared channel-offset budget), and the (1/20, 3/8) design is not a
// mechanized proof.

/** The original's noise benchmark: EPS_BENCH = 1 / 60. */
export const EPS_BENCH = 1 / 60;
/** The pivot: every pure world reads 4/5 at p = 1/5. */
export const PIVOT_P = 1 / 5;
export const PIVOT_Q = 4 / 5;
/** Thresholds the original uses to choose its verdict text. */
export const GUARDS = Object.freeze({ blindSpot: 0.0005, ratio: 1e-5, alpha: 0.0005 });

/**
 * The four worlds, with the parameters the original passes to qResp
 * (its legend: "S + alpha bleed (r=16)", "C25 (r=11, c=0.25)",
 * "C50 (r=6, c=0.50)", "C75 (r=1, c=0.75)"). c is kept as a fraction too.
 */
export const WORLDS = Object.freeze([
  Object.freeze({ id: "S", r: 16, c: 0, cn: 0, cd: 1, bleeds: true }),
  Object.freeze({ id: "C25", r: 11, c: 0.25, cn: 1, cd: 4, bleeds: false }),
  Object.freeze({ id: "C50", r: 6, c: 0.5, cn: 1, cd: 2, bleeds: false }),
  Object.freeze({ id: "C75", r: 1, c: 0.75, cn: 3, cd: 4, bleeds: false }),
]);

/**
 * The original's four presets, verbatim (its PRESETS object and button
 * labels). The "Deep Seed (1/40, 3/7)" preset sets p_H = 0.430, not
 * 3/7 = 0.42857…: its slider steps by 0.005. Kept as the original sets it.
 */
export const PRESETS = Object.freeze([
  Object.freeze({ id: "pr78", label: "PR #78 (1/10, 2/5)", pL: "0.100", pH: "0.400", alpha: "0.000", pr: 78 }),
  Object.freeze({ id: "pr83", label: "PR #83 Opt (1/20, 3/8)", pL: "0.050", pH: "0.375", alpha: "0.000", pr: 83 }),
  Object.freeze({ id: "trap", label: "Paralog Trap (16.1%)", pL: "0.050", pH: "0.375", alpha: "0.161" }),
  Object.freeze({ id: "deep", label: "Deep Seed (1/40, 3/7)", pL: "0.025", pH: "0.430", alpha: "0.000" }),
]);
export const DEFAULT_PRESET = "pr83";

/** The original's slider ranges. */
export const RANGES = Object.freeze({
  pL: Object.freeze({ min: 0.02, max: 0.18, step: 0.005 }),
  pH: Object.freeze({ min: 0.22, max: 0.8, step: 0.005 }),
  alpha: Object.freeze({ min: 0, max: 0.3, step: 0.001 }),
});

/**
 * Reported: the figures the archive note states for this explorer
 * (examples/visualizations/README.md, entry of 2026-11-13), whose rational
 * identities were recomputed independently and reported to match in
 * https://github.com/Foundation-0/project-asma/issues/82#issuecomment-6846151693
 * Verbatim strings. The tests check the computation below reproduces them.
 */
export const REPORTED = Object.freeze({
  source: "examples/visualizations/README.md (2026-11-13); Foundation-0/project-asma#82 comment 6846151693",
  epsLinf: "19/560",
  epsSlope: "10179/563920",
  lift: "1.88x",
  trapAlpha: "16.1%",
  pivot: "p = 1/5",
});

/* ------------------------------------------------------------------ */
/* Floating point, exactly as the original computes                    */
/* ------------------------------------------------------------------ */

/** The response curve: q(p; r, c) = (r·p + c·(1 − p)) / (r·p + (1 − p)). */
export const response = (p, r, c) => (r * p + c * (1 - p)) / (r * p + (1 - p));
/** Paralog bleed on S: y = (1 − α)·q + α. */
export const withBleed = (q, alpha) => (1 - alpha) * q + alpha;

/** One world's reading at proportion p. Only S takes the bleed. */
export function reading(world, p, alpha = 0) {
  const q = response(p, world.r, world.c);
  return world.bleeds ? withBleed(q, alpha) : q;
}

/** Each world's readings at p_L, p_H and the pivot, with its contrast Δ = y(p_H) − y(p_L). */
export function readings({ pL, pH, alpha = 0 }) {
  return WORLDS.map((w) => {
    const L = reading(w, pL, alpha), H = reading(w, pH, alpha);
    return { id: w.id, L, H, pivot: reading(w, PIVOT_P, alpha), contrast: H - L };
  });
}

/**
 * How far apart two worlds' readings are, and the largest box-noise
 * half-width ε each test survives (two readings each within ±ε of truth):
 *   slope (1D):    |Δa − Δb| / 4                 (the original's epsDiff)
 *   linf  (2D):    max(|gap_L|, |gap_H|) / 2     (the original's epsLinf)
 *   linf3 (3D):    max(|gap_L|, |gap_H|, |gap at p = 1/5|) / 2
 * linf3 is this page's arithmetic, not the original's: the pivot taken as a
 * third reading under the same box rule.
 */
export function separation(a, b) {
  const gapL = a.L - b.L, gapH = a.H - b.H, gapPivot = a.pivot - b.pivot;
  return {
    a: a.id, b: b.id, gapL, gapH, gapPivot,
    slope: Math.abs((a.H - a.L) - (b.H - b.L)) / 4,
    linf: Math.max(Math.abs(gapL), Math.abs(gapH)) / 2,
    linf3: Math.max(Math.abs(gapL), Math.abs(gapH), Math.abs(gapPivot)) / 2,
  };
}

/** The original's three numbers, for S + α against C25, plus their ratio. */
export function ceilings(design) {
  const rs = readings(design);
  const s = separation(rs[0], rs[1]);
  return {
    ...s,
    epsSlope: s.slope,
    epsLinf: s.linf,
    ratio: s.slope > 0 ? s.linf / s.slope : Infinity,
    pivotOffset: rs[0].pivot - PIVOT_Q,
  };
}

/** All six pairs of worlds, in order (S·C25, S·C50, S·C75, C25·C50, C25·C75, C50·C75). */
export function pairs(design) {
  const rs = readings(design);
  const out = [];
  for (let i = 0; i < rs.length; i += 1) for (let j = i + 1; j < rs.length; j += 1) out.push(separation(rs[i], rs[j]));
  return out;
}

/**
 * The bleed at which S's slope equals C25's: (1 − α)·Δ_S = Δ_C25, so
 * α* = 1 − Δ_C25 / Δ_S. Returns null when that α is outside [0, 1].
 */
export function blindSpot(pL, pH) {
  const [S, C] = WORLDS;
  const dS = response(pH, S.r, S.c) - response(pL, S.r, S.c);
  const dC = response(pH, C.r, C.c) - response(pL, C.r, C.c);
  if (dS === 0) return null;
  const a = 1 - dC / dS;
  return a >= 0 && a <= 1 ? a : null;
}

/** The original's verdict text for its three KPI tiles, word for word. */
export function verdicts({ epsSlope, epsLinf, pivotOffset }, alpha) {
  const slope = epsSlope >= EPS_BENCH
    ? `Clears 1/60 (0.01667) by +${(((epsSlope - EPS_BENCH) / EPS_BENCH) * 100).toFixed(1)}%`
    : epsSlope < GUARDS.blindSpot ? "Exact slope blind spot vs C25 (0 separation)" : "Below 1/60 noise floor (0.01667)";
  const ratio = epsSlope > GUARDS.ratio ? `${(epsLinf / epsSlope).toFixed(2)}x vs 1D slope` : "Separates S+alpha from C25 in 2D";
  const linf = `${ratio} (${epsLinf >= EPS_BENCH ? "clears 1/60" : "sub-1/60"})`;
  const pivot = alpha > GUARDS.alpha
    ? `Breaks 4-world pivot lock (q = ${(0.8 + pivotOffset).toFixed(4)})`
    : "All pure c-worlds lock at q(0.20) = 0.8000";
  return { slope, linf, pivot };
}

/** The three ceilings against α across [0, max], n + 1 samples. */
export function alphaSweep(pL, pH, n = 300, max = 0.3) {
  const alpha = new Float64Array(n + 1), slope = new Float64Array(n + 1), linf = new Float64Array(n + 1), linf3 = new Float64Array(n + 1);
  for (let i = 0; i <= n; i += 1) {
    const a = (i / n) * max;
    const c = ceilings({ pL, pH, alpha: a });
    alpha[i] = a; slope[i] = c.epsSlope; linf[i] = c.epsLinf; linf3[i] = c.linf3;
  }
  return { alpha, slope, linf, linf3 };
}

/**
 * Where a sampled curve sits below a level: [[from, to], …] in x, with each
 * crossing refined by linear interpolation between samples.
 */
export function intervalsBelow(xs, ys, level) {
  const out = [];
  let start = null;
  const cross = (i) => xs[i - 1] + ((level - ys[i - 1]) / (ys[i] - ys[i - 1])) * (xs[i] - xs[i - 1]);
  for (let i = 0; i < xs.length; i += 1) {
    const below = ys[i] < level;
    if (below && start === null) start = i === 0 ? xs[0] : cross(i);
    if (!below && start !== null) { out.push([start, cross(i)]); start = null; }
  }
  if (start !== null) out.push([start, xs[xs.length - 1]]);
  return out;
}

/* ------------------------------------------------------------------ */
/* Exact rationals, as the archive note states the figures             */
/* ------------------------------------------------------------------ */

const bgcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };

/** A reduced fraction n/d with BigInt parts, d > 0. */
export function frac(n, d = 1) {
  let N = BigInt(n), D = BigInt(d);
  if (D === 0n) throw new RangeError("zero denominator");
  if (D < 0n) { N = -N; D = -D; }
  const g = bgcd(N, D) || 1n;
  return Object.freeze({ n: N / g, d: D / g });
}
/** A decimal string such as "0.375" read exactly: 3/8. */
export function fromDecimal(s) {
  const str = String(s).trim();
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(str);
  if (!m) throw new RangeError(`not a decimal: ${s}`);
  const digits = m[3] || "";
  return frac(BigInt(`${m[1]}${m[2] || "0"}${digits}`), 10n ** BigInt(digits.length));
}
export const Q = Object.freeze({
  add: (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d),
  sub: (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d),
  mul: (a, b) => frac(a.n * b.n, a.d * b.d),
  div: (a, b) => frac(a.n * b.d, a.d * b.n),
  abs: (a) => frac(a.n < 0n ? -a.n : a.n, a.d),
  cmp: (a, b) => { const x = a.n * b.d - b.n * a.d; return x < 0n ? -1 : x > 0n ? 1 : 0; },
  max: (...xs) => xs.reduce((m, x) => (Q.cmp(x, m) > 0 ? x : m)),
  num: (a) => Number(a.n) / Number(a.d),
  str: (a) => (a.d === 1n ? `${a.n}` : `${a.n}/${a.d}`),
  eq: (a, s) => Q.str(a) === s,
});

/** q(p; r, c) for an exact p, in exact arithmetic. */
export function responseExact(p, world) {
  const r = frac(world.r), c = frac(world.cn, world.cd), one = frac(1);
  const rp = Q.mul(r, p), rest = Q.sub(one, p);
  return Q.div(Q.add(rp, Q.mul(c, rest)), Q.add(rp, rest));
}
function readingExact(world, p, alpha) {
  const q = responseExact(p, world);
  return world.bleeds ? Q.add(Q.mul(Q.sub(frac(1), alpha), q), alpha) : q;
}

/**
 * The original's numbers for S + α against C25, exactly, from decimal
 * strings (slider values). Every field is a fraction.
 */
export function exactCeilings(pLs, pHs, alphas = "0") {
  const pL = fromDecimal(pLs), pH = fromDecimal(pHs), alpha = fromDecimal(alphas), piv = frac(1, 5);
  const [S, C] = WORLDS;
  const sL = readingExact(S, pL, alpha), sH = readingExact(S, pH, alpha), cL = readingExact(C, pL, alpha), cH = readingExact(C, pH, alpha);
  const gapL = Q.sub(sL, cL), gapH = Q.sub(sH, cH);
  const pivotOffset = Q.sub(readingExact(S, piv, alpha), frac(4, 5));
  const slope = Q.div(Q.abs(Q.sub(gapH, gapL)), frac(4));
  const linf = Q.div(Q.max(Q.abs(gapL), Q.abs(gapH)), frac(2));
  const linf3 = Q.div(Q.max(Q.abs(gapL), Q.abs(gapH), Q.abs(pivotOffset)), frac(2));
  const dS = Q.sub(responseExact(pH, S), responseExact(pL, S)), dC = Q.sub(cH, cL);
  const alphaStar = dS.n === 0n ? null : Q.sub(frac(1), Q.div(dC, dS));
  return {
    pL, pH, alpha, gapL, gapH, pivotOffset, slope, linf, linf3,
    ratio: slope.n === 0n ? null : Q.div(linf, slope),
    alphaStar,
    pivotLock: WORLDS.filter((w) => !w.bleeds).every((w) => Q.eq(responseExact(piv, w), "4/5")),
  };
}

/** A fraction as text when it is short enough to read, otherwise null. */
export const shortFraction = (a, maxLen = 16) => {
  if (!a) return null;
  const s = Q.str(a);
  return s.length <= maxLen ? s : null;
};
