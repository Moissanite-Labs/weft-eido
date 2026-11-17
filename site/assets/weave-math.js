// The weave, as mathematics with no DOM.
//
// Every page and concept on the site is a point in the hyperbolic plane,
// drawn in the Poincaré disk (the unit disk, where the rim is infinitely far
// away). The node you are looking at sits at the centre; its neighbours ring
// it one thread-length out, theirs one further, and so on, each ring crowding
// toward the rim because the plane has exponentially more room than the page.
//
// Moving the focus is not a cut. It is a Möbius transformation, an isometry
// of the plane, so the whole space flows and nothing is torn:
//
//   τₐ(z) = (z − a) / (1 − ā·z)          takes a to the centre
//   d(z, w) = 2·artanh |z − w| / |1 − z̄·w|  is unchanged by every τ
//
// One channel, one quantity:
//   distance from the centre ← threads between a node and the focus
//   angle                    ← its parent's wedge, turned to where you saw it
//                               last (a weighted circular mean, as for hue)
//   drawn size               ← its hyperbolic radius times the conformal
//                               factor (1 − |z|²), so far places shrink
//   a thread's vibration     ← a plucked string, aₙ ∝ sin(nπp) / n²

export const TAU = Math.PI * 2;
const EPS = 1e-12;

export const WEAVE = Object.freeze({
  STEP: 1.3,        // hyperbolic length of one thread
  RIM: 0.985,       // nothing is drawn beyond this Euclidean radius
  MOVE: 1.25,       // seconds a change of focus takes
  BLOOM: 0.95,      // seconds the weave takes to open
  DIVE: 0.62,       // seconds to dive into a node before leaving
  HARMONICS: 6,     // partials per thread
  PLUCK_AT: 0.27,   // where a thread is plucked, as a fraction of its length
  DECAY: 0.9,       // seconds for a pluck's fundamental to fall by e
});

/* ------------------------------------------------------------------ */
/* Complex numbers as { x, y }                                         */
/* ------------------------------------------------------------------ */

export const cx = (x = 0, y = 0) => ({ x, y });
export const add = (a, b) => cx(a.x + b.x, a.y + b.y);
export const sub = (a, b) => cx(a.x - b.x, a.y - b.y);
export const mul = (a, b) => cx(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
export const conj = (a) => cx(a.x, -a.y);
export const scale = (a, k) => cx(a.x * k, a.y * k);
export const abs = (a) => Math.hypot(a.x, a.y);
export const arg = (a) => Math.atan2(a.y, a.x);
export const polar = (r, th) => cx(r * Math.cos(th), r * Math.sin(th));
export function div(a, b) {
  const d = b.x * b.x + b.y * b.y || EPS;
  return cx((a.x * b.x + a.y * b.y) / d, (a.y * b.x - a.x * b.y) / d);
}
const clampRim = (z) => { const r = abs(z); return r < 1 - 1e-9 ? z : scale(z, (1 - 1e-9) / r); };
const atanh = (x) => 0.5 * Math.log((1 + x) / (1 - x));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/* ------------------------------------------------------------------ */
/* Möbius transformations of the disk                                  */
/* ------------------------------------------------------------------ */
//
// Every orientation-preserving isometry of the disk is z ↦ (αz + β)/(β̄z + ᾱ)
// with |α|² − |β|² = 1, a matrix in SU(1, 1). Composition is the matrix product.

export const IDENTITY = Object.freeze({ al: cx(1, 0), be: cx(0, 0) });

function normalise(m) {
  const det = m.al.x ** 2 + m.al.y ** 2 - m.be.x ** 2 - m.be.y ** 2;
  const k = 1 / Math.sqrt(Math.max(det, EPS));
  return { al: scale(m.al, k), be: scale(m.be, k) };
}

/** The translation τₐ that takes a to the centre: z ↦ (z − a) / (1 − āz). */
export function toCentre(a) {
  const k = 1 / Math.sqrt(Math.max(1 - (a.x * a.x + a.y * a.y), EPS));
  return { al: cx(k, 0), be: scale(a, -k) };
}
/** The translation that takes the centre to a: z ↦ (z + a) / (1 + āz). */
export const fromCentre = (a) => toCentre(scale(a, -1));
/** Rotation by θ about the centre. */
export const rotation = (th) => ({ al: polar(1, th / 2), be: cx(0, 0) });
/** M ∘ N. */
export const compose = (M, N) => normalise({ al: add(mul(M.al, N.al), mul(M.be, conj(N.be))), be: add(mul(M.al, N.be), mul(M.be, conj(N.al))) });
export const invert = (M) => ({ al: conj(M.al), be: scale(M.be, -1) });
export const apply = (M, z) => div(add(mul(M.al, z), M.be), add(mul(conj(M.be), z), conj(M.al)));

/** Hyperbolic distance between two points of the disk. */
export function distance(z, w) {
  const q = abs(sub(z, w)) / Math.max(abs(sub(cx(1, 0), mul(conj(z), w))), EPS);
  return 2 * atanh(Math.min(q, 1 - 1e-12));
}

/** The point a fraction s of the way along the geodesic from the centre to z. */
export function alongFromCentre(z, s) {
  const r = abs(z);
  if (r < EPS) return cx(0, 0);
  return scale(z, Math.tanh(s * atanh(Math.min(r, 1 - 1e-12))) / r);
}

/** The point a fraction s of the way along the geodesic from p to q. */
export function geoLerp(p, q, s) {
  if (s <= 0) return p;
  if (s >= 1) return q;
  const w = apply(toCentre(p), q);
  return apply(fromCentre(p), alongFromCentre(w, s));
}

/** n + 1 points along the geodesic from p to q (an arc that meets the rim at right angles). */
export function geodesic(p, q, n = 24) {
  const T = toCentre(p), B = fromCentre(p);
  const w = apply(T, q);
  const out = new Array(n + 1);
  for (let k = 0; k <= n; k += 1) out[k] = apply(B, alongFromCentre(w, k / n));
  return out;
}

/**
 * The move that brings `target` to the centre, a fraction s of the way: the
 * translation along the geodesic through the centre and target. At s = 1 the
 * target is at the centre exactly.
 */
export const moveToward = (target, s) => toCentre(alongFromCentre(target, s));

/** Euclidean radius at which hyperbolic distance ρ from the centre is drawn. */
export const ringRadius = (rho) => Math.tanh(rho / 2);
/** How much a hyperbolic length shrinks at z when drawn: (1 − |z|²) / 2 relative to the centre's 1/2. */
export const conformal = (z) => Math.max(0, 1 - (z.x * z.x + z.y * z.y));

/* ------------------------------------------------------------------ */
/* Layout: a radial tree in the hyperbolic plane                       */
/* ------------------------------------------------------------------ */

/** Breadth-first search from `focus` over an adjacency map { id: [ids] }. Neighbours are visited in the order given. */
export function bfs(adj, focus) {
  const depth = new Map([[focus, 0]]);
  const parent = new Map();
  const children = new Map([[focus, []]]);
  const order = [focus];
  for (let q = 0; q < order.length; q += 1) {
    const v = order[q];
    for (const u of adj[v] || []) {
      if (depth.has(u)) continue;
      depth.set(u, depth.get(v) + 1);
      parent.set(u, v);
      children.get(v).push(u);
      children.set(u, []);
      order.push(u);
    }
  }
  return { depth, parent, children, order };
}

/** Weighted circular mean of angles, as the style mixer averages hue. Returns NaN when the weights cancel. */
export function circularMean(angles, weights = null) {
  let s = 0, c = 0;
  angles.forEach((a, i) => { const w = weights ? weights[i] : 1; s += w * Math.sin(a); c += w * Math.cos(a); });
  return Math.hypot(s, c) < 1e-9 ? NaN : Math.atan2(s, c);
}

/**
 * Place every node for a focus. Returns { pos: Map id → z, depth, parent }.
 *
 * The focus sits at the centre. Each node's children share its angular wedge
 * in proportion to the size of what hangs below them, and sit one STEP
 * further out. With `prev` (where each node was last seen, already moved so
 * the new focus is at the centre), siblings keep the order they were seen in,
 * and the whole layout turns by the circular mean of how far each first ring
 * node would otherwise have to swing, so a move never spins the map.
 */
export function layout(adj, focus, { prev = null, step = WEAVE.STEP, ids = null } = {}) {
  const { depth, parent, children, order } = bfs(adj, focus);
  const seen = (id) => (prev && prev.has(id) && abs(prev.get(id)) > 1e-6 ? arg(prev.get(id)) : null);
  // Siblings in the order they were last seen around their parent.
  if (prev) {
    for (const [v, kids] of children) {
      const base = v === focus ? 0 : seen(v) ?? 0;
      const keyed = kids.map((u, i) => [u, i, seen(u)]);
      if (keyed.some(([, , a]) => a == null)) continue;
      keyed.sort((p, q) => wrap(p[2] - base) - wrap(q[2] - base) || p[1] - q[1]);
      children.set(v, keyed.map(([u]) => u));
    }
  }
  // Room each subtree needs: 1 for a leaf, then a damped sum, so a large branch gets more but not all.
  const need = new Map();
  for (let q = order.length - 1; q >= 0; q -= 1) {
    const v = order[q];
    const kids = children.get(v);
    need.set(v, kids.length ? 1 + 0.7 * kids.reduce((a, u) => a + need.get(u), 0) : 1);
  }
  const angle = new Map([[focus, 0]]);
  const span = new Map([[focus, TAU]]);
  const place = (v, from, width) => {
    const kids = children.get(v);
    const total = kids.reduce((a, u) => a + need.get(u), 0) || 1;
    let at = from;
    for (const u of kids) {
      const w = (width * need.get(u)) / total;
      angle.set(u, at + w / 2);
      span.set(u, w);
      at += w;
    }
    for (const u of kids) {
      // A wedge never needs more than half a turn: the plane widens out there anyway.
      const w = Math.min(span.get(u), Math.PI);
      place(u, angle.get(u) - w / 2, w);
    }
  };
  place(focus, -Math.PI / 2, TAU);
  // Turn the whole layout to meet the last view.
  let turn = 0;
  if (prev) {
    const ring = children.get(focus).filter((u) => seen(u) != null);
    const t = circularMean(ring.map((u) => seen(u) - angle.get(u)), ring.map((u) => need.get(u)));
    if (Number.isFinite(t)) turn = t;
  }
  const pos = new Map();
  for (const v of order) pos.set(v, depth.get(v) === 0 ? cx(0, 0) : polar(ringRadius(depth.get(v) * step), angle.get(v) + turn));
  // Anything unreachable waits at the rim, evenly spaced, so it is never lost.
  const rest = (ids || Object.keys(adj)).filter((id) => !pos.has(id));
  rest.forEach((id, i) => pos.set(id, polar(WEAVE.RIM, (i / Math.max(1, rest.length)) * TAU)));
  return { pos, depth, parent, turn };
}

/* ------------------------------------------------------------------ */
/* Threads: plucked strings                                            */
/* ------------------------------------------------------------------ */

/**
 * Fourier amplitudes of a string plucked at fraction p to height 1:
 * aₙ = 2·sin(nπp) / (n²π²·p·(1 − p)). Their sum over sin(nπs) is the triangle
 * the finger makes, so the shape at release is exact, not a stand-in.
 */
export function pluckAmps(p = WEAVE.PLUCK_AT, n = WEAVE.HARMONICS) {
  const out = new Array(n);
  for (let k = 1; k <= n; k += 1) out[k - 1] = (2 * Math.sin(k * Math.PI * p)) / (k * k * Math.PI * Math.PI * p * (1 - p));
  return out;
}

/**
 * Displacement of a string at fraction s, t seconds after the pluck, with
 * fundamental f hertz. Partial n rings at n·f and dies n times faster.
 */
export function stringAt(s, t, f, amps, decay = WEAVE.DECAY) {
  let y = 0;
  for (let k = 1; k <= amps.length; k += 1) y += amps[k - 1] * Math.sin(k * Math.PI * s) * Math.cos(TAU * k * f * t) * Math.exp((-k * Math.max(0, t)) / decay);
  return y;
}

/* ------------------------------------------------------------------ */
/* The background weft: geodesics that flow with every move            */
/* ------------------------------------------------------------------ */

/**
 * Thread j of the weft: the geodesic perpendicular to the vertical diameter
 * at hyperbolic height j·gap, sampled at n + 1 points evenly spaced in
 * hyperbolic length. Before any move they read as horizontal threads bowed
 * toward the centre.
 */
export function weftThread(j, gap = 0.62, n = 40, reach = 4.2) {
  const lift = fromCentre(cx(0, Math.tanh((j * gap) / 2)));
  const out = new Array(n + 1);
  for (let k = 0; k <= n; k += 1) out[k] = apply(lift, cx(Math.tanh((-reach + (2 * reach * k) / n) / 2), 0));
  return out;
}

/* ------------------------------------------------------------------ */
/* Easing and choosing                                                 */
/* ------------------------------------------------------------------ */

/** Smootherstep: 6u⁵ − 15u⁴ + 10u³. Zero velocity and acceleration at both ends. */
export function ease(u) {
  const x = u < 0 ? 0 : u > 1 ? 1 : u;
  return x * x * x * (x * (6 * x - 15) + 10);
}

/**
 * Among candidates [{ id, x, y }] around (ox, oy), the one an arrow key at
 * angle `dir` means: the best alignment, counting distance a little.
 */
export function pickDirection(ox, oy, candidates, dir) {
  let best = null, bestScore = -Infinity;
  for (const c of candidates) {
    const dx = c.x - ox, dy = c.y - oy, d = Math.hypot(dx, dy);
    if (d < 1e-6) continue;
    const align = (dx * Math.cos(dir) + dy * Math.sin(dir)) / d;
    if (align < 0.2) continue;
    const score = align * 2 - d / (d + 400);
    if (score > bestScore) { bestScore = score; best = c.id; }
  }
  return best;
}
