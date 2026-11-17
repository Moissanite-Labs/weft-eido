// Mathematics and reported data for the substrate simulations page
// (site/research/index.html), with no DOM, so Node can check every number the
// page prints.
//
// Source: examples/simulations/index.html (the "Substrate Simulation Suite",
// E08 to E12) and examples/simulations/README.md, which cite weft #141 / #147
// (statistical cell), #153 / #155 (E11) and #157 / #159 (E12) in
// Moissanite-Labs/weft.
//
// Three kinds of number live here, and the page labels each:
//   computed      the original's own rules, ported exactly (the Frobenius gate,
//                 the wire-size arithmetic, the shift interpolation), and one
//                 toy of the null-space operator that this page adds;
//   reported      experiment results the original prints from fixed tables;
//   illustrative  patterns the original draws only for look.

export const TAU = Math.PI * 2;

/** Deterministic PRNG (mulberry32): the page uses it where the original used Math.random. */
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

/** Signed fixed-point text the way the original prints it: "+56.73", "-20.75". */
export const signed = (v, d = 2) => (v >= 0 ? `+${v.toFixed(d)}` : v.toFixed(d));

/* ================================================================== */
/* 1 · The statistical cell (E08–E10, weft #141 / #147)                 */
/* ================================================================== */
//
// An 8 × 8 Float32 genotype W. Rows 0..1 are a frozen core; rows 2..7 are
// plastic. Each A/B step proposes W′ = W + ε on the plastic rows, with
// εᵢⱼ = 0.08·(u − 0.48), u uniform on [0, 1), and keeps W′ only if
// ‖W′ − W₀‖_F ≤ R. This is the original's rule, unchanged; its noise has a
// small outward bias (mean +0.0016 per entry), also unchanged.

export const CELL = Object.freeze({
  N: 8,
  CORE: 2,          // frozen rows
  SCALE: 0.08,      // ε = SCALE·(u − BIAS)
  BIAS: 0.48,
  R: 1.2,           // default gate radius
  R_MIN: 0.25,
  R_MAX: 2.5,
  // The original's "fit" is a counter, not a measurement: it starts at 0.82
  // and gains 0.01 per accepted commit, capped at 0.98.
  FIT0: 0.82,
  FIT_STEP: 0.01,
  FIT_MAX: 0.98,
});

/** W₀[i] = 0.6·sin(2.31·(i + 1)), as Float32, exactly as the original seeds it. */
export function genotypeW0() {
  const W0 = new Float32Array(CELL.N * CELL.N);
  for (let i = 0; i < W0.length; i += 1) W0[i] = Math.sin((i + 1) * 2.31) * 0.6;
  return W0;
}

/** ‖A − B‖_F over rows [r0, r1). */
export function frobenius(A, B, r0 = 0, r1 = CELL.N) {
  let s = 0;
  for (let i = r0 * CELL.N; i < r1 * CELL.N; i += 1) s += (A[i] - B[i]) ** 2;
  return Math.sqrt(s);
}

/** The gate's displacement ‖W − W₀‖_F. */
export const displacement = (W, W0) => frobenius(W, W0);
/** Drift of the frozen core ‖W[0:2] − W₀[0:2]‖_F. */
export const coreDrift = (W, W0) => frobenius(W, W0, 0, CELL.CORE);

/** One candidate: W plus ε on the plastic rows, drawn from `rand`. */
export function proposeStep(W, rand) {
  const cand = new Float32Array(W);
  for (let r = CELL.CORE; r < CELL.N; r += 1) {
    for (let c = 0; c < CELL.N; c += 1) cand[r * CELL.N + c] += (rand() - CELL.BIAS) * CELL.SCALE;
  }
  return cand;
}

/**
 * A walk of the statistical cell. `rand` is any uniform source (the page
 * passes a seeded one). Each step proposes, gates and records:
 * { candidate: ‖W′ − W₀‖_F, accepted, displacement after the step }.
 */
export function cellWalk(rand) {
  const W0 = genotypeW0();
  const W = new Float32Array(W0);
  const history = [];
  let commits = 0, fit = CELL.FIT0;
  return {
    W0, W, history,
    get commits() { return commits; },
    get fit() { return fit; },
    step(R) {
      const cand = proposeStep(W, rand);
      const d = displacement(cand, W0);
      const accepted = d <= R;
      if (accepted) { W.set(cand); commits += 1; fit = Math.min(CELL.FIT_MAX, fit + CELL.FIT_STEP); }
      const rec = { candidate: d, accepted, displacement: displacement(W, W0) };
      history.push(rec);
      return rec;
    },
  };
}

/** Replay a walk: `n` proposals at radius R from a seeded source. */
export function runCell(seed, R, n) {
  const walk = cellWalk(rng(seed));
  for (let i = 0; i < n; i += 1) walk.step(R);
  return walk;
}

/* ================================================================== */
/* 2 · Morphogenetic IC-to-Plasm unfolding (E11, weft #153 / #155)      */
/* ================================================================== */

export const E11 = Object.freeze({
  GENOTYPE_BYTES: 492,                 // the BCP packet, as the original states it
  NODES: 24,
  COMBINATORS: Object.freeze(["CON", "DUP", "FRC", "SUP", "VLV", "ERA"]),
  SEEDS: 12,
  D_MIN: 6,
  D_MAX: 9,
  ARMS: Object.freeze({
    morph: "M1 morphogenetic IC",
    scrambled: "C2 scrambled IC",
    direct: "D direct matrix ES",
  }),
});

/**
 * REPORTED. E11 12-seed return per arm and scale exponent D (matrix 2^D × 2^D),
 * verbatim from RET2 in examples/simulations/index.html (weft #153 / #155).
 * The original prints "drift 0.0000" beside every one of them.
 */
export const E11_RETURN = Object.freeze({
  morph: Object.freeze({ 6: "+33.48", 7: "+35.10", 8: "+36.68", 9: "+39.51" }),
  scrambled: Object.freeze({ 6: "+5.39", 7: "+4.10", 8: "+2.87", 9: "-0.95" }),
  direct: Object.freeze({ 6: "+17.44", 7: "+10.20", 8: "+4.02", 9: "-0.82" }),
});
export const E11_CORE_DRIFT = "0.0000"; // REPORTED, the same for every arm and scale

/** Reported return as a number. */
export const e11Return = (arm, D) => Number.parseFloat(E11_RETURN[arm][D]);

/** Side of the unfolded Plasm matrix. */
export const plasmSide = (D) => 2 ** D;
/** Bytes of the unfolded matrix as Float32. */
export const plasmBytes = (D) => plasmSide(D) ** 2 * 4;
/** Wire compression: unfolded bytes over genotype bytes; a directly stored matrix is 1.0×. */
export const compression = (arm, D) => (arm === "direct" ? 1 : plasmBytes(D) / E11.GENOTYPE_BYTES);
/** Bytes on the wire for an arm: the packet, or the whole matrix for direct ES. */
export const wireBytes = (arm, D) => (arm === "direct" ? plasmBytes(D) : E11.GENOTYPE_BYTES);
/** The original's KPI text for wire size and compression. */
export const compressionLabel = (arm, D) => (arm === "direct"
  ? `${(plasmBytes(D) / 1024).toFixed(0)} KB · 1.0×`
  : `${E11.GENOTYPE_BYTES} B · ${(plasmBytes(D) / E11.GENOTYPE_BYTES).toFixed(1)}×`);
/** The original's note for direct ES: no IC graph, estimate quality O(1/√P) in the P = 4^D weights. */
export const invSqrtP = (D) => 1 / Math.sqrt(plasmSide(D) ** 2);

/**
 * ILLUSTRATIVE. The original's closed-form stand-in for the unfolded matrix:
 * the top quarter of rows is the locked core; below it the morphogenetic arm
 * draws a smooth diagonal pattern and the other arms a hashed one. It is not
 * the packet's reduction. rn, cn are row and column as fractions of the side.
 */
export function phenotypeValue(arm, rn, cn, D, seed = 1) {
  if (rn < 0.25) return Math.sin(rn * 30 + cn * 20) * 0.4;
  if (arm === "morph") return Math.cos((rn - cn) * 6.28 + seed);
  return Math.sin((rn * 311 + cn * 293) * D);
}

/* ================================================================== */
/* 3 · Plasmid null-space graft (E12, weft #157 / #159)                 */
/* ================================================================== */

export const E12 = Object.freeze({
  PLASMID_BYTES: 172,
  PLASMID_NODES: 8,
  SPLICE: "SUP(5)",
  SEEDS: 12,
  SHIFT_MIN: 1.0,
  SHIFT_MAX: 2.8,
  SHIFT_DEFAULT: 2.4,
  // The two shifts at which the original's retention formula has its own
  // values; its slider runs on past the second.
  ANCHOR_LO: 1.0,
  ANCHOR_HI: 2.4,
});

/**
 * REPORTED (as the original page gives them). Per arm: native retention as
 * a − u·b with u = (shift − 1)/1.4, so `at1` is the value at 1.0× and
 * `at1 − slope` the value at 2.4×; and the fixed labels the original prints
 * at every shift. Verbatim from updS3() in examples/simulations/index.html
 * (weft #157 / #159).
 */
export const E12_REPORTED = Object.freeze({
  nullgate: Object.freeze({
    label: "G2 null-space BCP graft",
    at1: 86.59, slope: 29.86, keepNote: "0.00 drop",
    transfer: "+39.32", transferNote: "+123.85 gain",
    residual: "0.0000", pass: "10/12 pass",
  }),
  ungated: Object.freeze({
    label: "G1 ungated BCP graft",
    at1: -20.75, slope: 67.13, keepNote: "collision",
    transfer: "-46.57", transferNote: "m=1 clash",
    residual: "1.3086", pass: "0/12 pass",
  }),
  raw: Object.freeze({
    label: "C1 raw copy (permuted)",
    at1: 84.01, slope: 31.65, keepNote: "-4.37 drop",
    transfer: "-85.69", transferNote: "perm scrambled",
    residual: "0.1376", pass: "0/12 pass",
  }),
});
export const E12_ARMS = Object.freeze(["nullgate", "ungated", "raw"]);

/** The original's interpolation parameter: u = (shift − 1.0) / 1.4, so u = 1 at 2.4×. */
export const shiftU = (shift) => (shift - 1.0) / 1.4;

/** Where a shift sits relative to the original's two values: "anchor", "interpolated" or "extrapolated". */
export function shiftKind(shift) {
  if (Math.abs(shift - E12.ANCHOR_LO) < 1e-9 || Math.abs(shift - E12.ANCHOR_HI) < 1e-9) return "anchor";
  return shift < E12.ANCHOR_HI ? "interpolated" : "extrapolated";
}

/** Native retention at a shift, by the original's linear rule. */
export function retention(arm, shift) {
  const a = E12_REPORTED[arm];
  return a.at1 - shiftU(shift) * a.slope;
}

/** The original's KPI text for retention, e.g. "+56.73 (0.00 drop)". */
export const retentionLabel = (arm, shift) => `${signed(retention(arm, shift))} (${E12_REPORTED[arm].keepNote})`;

/* ---------- A toy of the operator (computed here, not E12's data) ---------- */
//
// The page adds one computation the original only names: the gate
// ΔW_gated = ΔW·(I − Q·Qᵀ), where Q's orthonormal columns span the inputs the
// host's native skill uses. A sibling is the donor with its input channels
// permuted, x_host[j] = x_donor[perm[j]], so its kept basis is Q permuted the
// same way. Three ways to land the donor's update ΔW_d on the sibling:
//   nullgate  aligned to the host's channels, then projected off its kept basis
//   ungated   aligned, not projected
//   raw       copied entry for entry in the donor's channel order

export const TOY = Object.freeze({ d: 12, m: 6, k: 3, seed: 1207 });

/** Orthonormalise vectors (modified Gram–Schmidt). Returns new arrays. */
export function gramSchmidt(vectors) {
  const out = [];
  for (const v of vectors) {
    const w = Float64Array.from(v);
    for (const q of out) {
      let dot = 0;
      for (let i = 0; i < w.length; i += 1) dot += w[i] * q[i];
      for (let i = 0; i < w.length; i += 1) w[i] -= dot * q[i];
    }
    let n = 0;
    for (let i = 0; i < w.length; i += 1) n += w[i] * w[i];
    n = Math.sqrt(n);
    if (n < 1e-12) continue;
    for (let i = 0; i < w.length; i += 1) w[i] /= n;
    out.push(w);
  }
  return out;
}

/** A seeded permutation of 0 … d − 1 (Fisher–Yates). sibling = 0 is the identity. */
export function permutation(d, sibling) {
  const p = Array.from({ length: d }, (_, i) => i);
  if (!sibling) return p;
  const rand = rng(0x9e3779b9 ^ (sibling * 2654435761));
  for (let i = d - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  return p;
}

/** The donor: its kept basis Q (k vectors of length d), a skill input s ⟂ Q, and the plasmid's update ΔW (m × d). */
export function makeDonor({ d, m, k, seed } = TOY) {
  const rand = rng(seed);
  const Q = gramSchmidt(Array.from({ length: k }, () => Array.from({ length: d }, () => gaussian(rand))));
  const [s] = gramSchmidt([...Q, Array.from({ length: d }, () => gaussian(rand))]).slice(k);
  // The update carries the skill along s, plus incidental weight in every direction.
  const y = Array.from({ length: m }, () => gaussian(rand));
  const dW = Array.from({ length: m }, (_, i) => Float64Array.from({ length: d }, (_, j) => y[i] * s[j] + (0.8 * gaussian(rand)) / Math.sqrt(d)));
  return { d, m, k, Q, s, dW };
}

/** Rows of a matrix with columns reindexed: out[i][j] = M[i][perm[j]]. */
export const permuteColumns = (M, perm) => M.map((row) => Float64Array.from(perm, (pj) => row[pj]));
/** A vector reindexed: out[j] = v[perm[j]]. */
export const permuteVector = (v, perm) => Float64Array.from(perm, (pj) => v[pj]);

/** M·(I − Q·Qᵀ) for a basis Q given as k vectors. */
export function projectOff(M, Q) {
  return M.map((row) => {
    const out = Float64Array.from(row);
    for (const q of Q) {
      let dot = 0;
      for (let j = 0; j < q.length; j += 1) dot += row[j] * q[j];
      for (let j = 0; j < q.length; j += 1) out[j] -= dot * q[j];
    }
    return out;
  });
}

/** M·Q as an m × k array of arrays. */
export const timesBasis = (M, Q) => M.map((row) => Q.map((q) => { let s = 0; for (let j = 0; j < q.length; j += 1) s += row[j] * q[j]; return s; }));
/** M·v. */
export const timesVector = (M, v) => M.map((row) => { let s = 0; for (let j = 0; j < v.length; j += 1) s += row[j] * v[j]; return s; });
/** Frobenius norm of an array of rows. */
export const frob = (M) => Math.sqrt(M.reduce((a, row) => a + row.reduce((b, x) => b + x * x, 0), 0));
/** Cosine between two vectors. */
export function cosine(a, b) {
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i += 1) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

/**
 * Land the donor's update on a sibling, three ways. For each arm:
 *   keep      ‖ΔW·Q_host‖_F, what the host's kept directions see (the original's "null residual")
 *   free      ‖ΔW·(I − Q_host·Q_hostᵀ)‖_F
 *   total     ‖ΔW‖_F, with total² = keep² + free²
 *   response  ΔW·Q_host, the m × k block the residual measures
 *   skill     cos(ΔW·s_host, ΔW_d·s_donor), whether the skill arrives intact
 */
export function graft(donor, sibling) {
  const perm = permutation(donor.d, sibling);
  const Qh = donor.Q.map((q) => permuteVector(q, perm));
  const sh = permuteVector(donor.s, perm);
  const aligned = permuteColumns(donor.dW, perm);
  const want = timesVector(donor.dW, donor.s);
  const arms = { nullgate: projectOff(aligned, Qh), ungated: aligned, raw: donor.dW.map((r) => Float64Array.from(r)) };
  const out = { perm, sibling };
  for (const [name, M] of Object.entries(arms)) {
    const response = timesBasis(M, Qh);
    out[name] = {
      M,
      response,
      keep: frob(response),
      free: frob(projectOff(M, Qh)),
      total: frob(M),
      skill: cosine(timesVector(M, sh), want),
    };
  }
  return out;
}
