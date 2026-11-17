// The landing map, as mathematics with no DOM.
//
// Every line of work is a wave source on one membrane. The map is the
// interference pattern the sources make together:
//
//   ψ(x, y, t) = Σᵢ Aᵢ · e^(−dᵢ/ℓᵢ) · cos(k_f·dᵢ − ω_f·t + φᵢ) / √(1 + dᵢ/d₀)
//
// One channel, one quantity:
//   amplitude Aᵢ      ← the place's stated weight
//   frequency ω_f     ← its family; a family shares one frequency, so the
//                       fringes between related work stand still, and the
//                       fringes between families drift at their beat
//   reach ℓᵢ          ← its state: on main reaches furthest, blocked least
//   position          ← emerges from a small settling simulation: sources
//                       repel by weight, families gather, walls hold
//
// The medium is dispersionless (every family shares one wave speed), so
// frequency and wavelength are one quantity, not two.

export const TAU = Math.PI * 2;

/** Families and their frequency ratios: 1 : 4/3 : 7/4, a fourth and a harmonic seventh. */
export const FAMILIES = Object.freeze({
  modules: { ratio: 1, name: "modules" },
  research: { ratio: 4 / 3, name: "research" },
  rebuild: { ratio: 7 / 4, name: "rebuild" },
});

/** Reach ℓ as a fraction of the map's shorter side, by state. */
export const REACH = Object.freeze({ main: 0.42, open: 0.28, blocked: 0.15 });

export const FIELD = Object.freeze({
  F0: 0.32,          // base frequency of the modules family, in hertz
  SETTLE_STEPS: 520, // steps the layout runs to rest
  ARRIVE: 2.1,       // seconds for a front to cross the diagonal as the map draws itself
});

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Exclusion radius of a source: room for its rings and its label. */
export const sourceRadius = (weight, maxWeight, w, h) => Math.min(w, h) * (0.07 + 0.065 * Math.sqrt(weight / maxWeight));

/**
 * Settle the sources into place. Deterministic: the same places in the same
 * box always come to rest in the same spots. Returns the trajectory's end
 * and, if `record` is set, every `record`-th frame so the page can replay
 * the settling as the map arrives.
 */
export function settle(places, { width, height, steps = FIELD.SETTLE_STEPS, record = 0, from = null } = {}) {
  const n = places.length;
  const maxW = Math.max(...places.map((p) => p.weight));
  const r = places.map((p) => sourceRadius(p.weight, maxW, width, height));
  const golden = Math.PI * (3 - Math.sqrt(5));
  const pos = from
    ? from.map((q) => ({ x: q.x, y: q.y }))
    : places.map((_, i) => ({ x: width / 2 + Math.cos(i * golden) * width * 0.08 * Math.sqrt(i + 1), y: height / 2 + Math.sin(i * golden) * height * 0.08 * Math.sqrt(i + 1) }));
  const vel = places.map(() => ({ x: 0, y: 0 }));
  const frames = [];
  const fams = [...new Set(places.map((p) => p.family))];
  const scale = Math.min(width, height);
  for (let s = 0; s < steps; s += 1) {
    const cool = 1 - s / steps;
    const cent = fams.map((f) => {
      const m = places.map((p, i) => [p, i]).filter(([p]) => p.family === f);
      return { f, x: m.reduce((a, [, i]) => a + pos[i].x, 0) / m.length, y: m.reduce((a, [, i]) => a + pos[i].y, 0) / m.length };
    });
    const force = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        let dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y;
        let d = Math.hypot(dx, dy);
        if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
        const want = (r[i] + r[j]) * 1.08;
        const push = d < want ? (want - d) * 0.5 : ((want * want) / (d * d)) * scale * 0.004;
        force[i].x -= (dx / d) * push; force[i].y -= (dy / d) * push;
        force[j].x += (dx / d) * push; force[j].y += (dy / d) * push;
      }
      const c = cent.find((q) => q.f === places[i].family);
      force[i].x += (c.x - pos[i].x) * 0.012;
      force[i].y += (c.y - pos[i].y) * 0.012;
      force[i].x += (width / 2 - pos[i].x) * 0.006;
      force[i].y += (height / 2 - pos[i].y) * 0.006 * (width / height);
      const mx = r[i] * 1.05, my = r[i] * 0.95;
      if (pos[i].x < mx) force[i].x += (mx - pos[i].x) * 0.6;
      if (pos[i].x > width - mx) force[i].x -= (pos[i].x - (width - mx)) * 0.6;
      if (pos[i].y < my) force[i].y += (my - pos[i].y) * 0.6;
      if (pos[i].y > height - my) force[i].y -= (pos[i].y - (height - my)) * 0.6;
    }
    for (let i = 0; i < n; i += 1) {
      vel[i].x = (vel[i].x + force[i].x) * 0.72;
      vel[i].y = (vel[i].y + force[i].y) * 0.72;
      const lim = scale * 0.03 * (0.2 + cool);
      const sp = Math.hypot(vel[i].x, vel[i].y);
      if (sp > lim) { vel[i].x *= lim / sp; vel[i].y *= lim / sp; }
      pos[i].x = clamp(pos[i].x + vel[i].x, 0, width);
      pos[i].y = clamp(pos[i].y + vel[i].y, 0, height);
    }
    if (record && s % record === 0) frames.push(pos.map((q) => ({ x: q.x, y: q.y })));
  }
  frames.push(pos.map((q) => ({ x: q.x, y: q.y })));
  return { pos, r, frames };
}

/**
 * Wave parameters for each source in a box of size w × h. `density` in
 * [0, 1] shortens the wavelength (more fringes for a denser style).
 */
export function sources(places, pos, { width, height, density = 0.4 } = {}) {
  const side = Math.min(width, height);
  const maxW = Math.max(...places.map((p) => p.weight));
  const lambda0 = side * (0.27 - 0.1 * clamp(density, 0, 1));
  return places.map((p, i) => {
    const fam = FAMILIES[p.family] || FAMILIES.research;
    const f = FIELD.F0 * fam.ratio;
    const lambda = lambda0 / fam.ratio;
    return {
      x: pos[i].x, y: pos[i].y,
      amp: Math.sqrt(p.weight / maxW),
      k: TAU / lambda,
      omega: TAU * f,
      reach: side * (REACH[p.state] ?? REACH.open),
      phase: 0,
      family: p.family,
      lambda, f,
    };
  });
}

/** ψ at one point. `boost` scales one source (the one under the pointer). */
export function fieldAt(x, y, t, src, { d0 = 40, boost = -1, gain = 1.8 } = {}) {
  let psi = 0;
  for (let i = 0; i < src.length; i += 1) {
    const s = src[i];
    const d = Math.hypot(x - s.x, y - s.y);
    const a = s.amp * (i === boost ? gain : 1) * Math.exp(-d / s.reach) / Math.sqrt(1 + d / d0);
    psi += a * Math.cos(s.k * d - s.omega * t + s.phase);
  }
  return psi;
}

/**
 * Precompute, for a cols × rows grid of cell size `cell`, each source's
 * distance term so a frame costs one cosine per source per point.
 */
export function prepareGrid(src, cols, rows, cell, { d0 = 40 } = {}) {
  const n = cols * rows;
  const kd = src.map(() => new Float32Array(n));
  const env = src.map(() => new Float32Array(n));
  const dist = src.map(() => new Float32Array(n));
  for (let s = 0; s < src.length; s += 1) {
    const S = src[s];
    for (let j = 0; j < rows; j += 1) for (let i = 0; i < cols; i += 1) {
      const g = j * cols + i;
      const d = Math.hypot((i + 0.5) * cell - S.x, (j + 0.5) * cell - S.y);
      dist[s][g] = d;
      kd[s][g] = S.k * d;
      env[s][g] = S.amp * Math.exp(-d / S.reach) / Math.sqrt(1 + d / d0);
    }
  }
  return { cols, rows, cell, kd, env, dist };
}

/**
 * Sample ψ over a prepared grid into `out`. `arrive(s)` gives how far source
 * s's first wavefront has travelled (Infinity once settled); beyond it the
 * source is silent, so the map draws itself outward from each source.
 */
export function sampleGrid(grid, src, t, out, { boost = -1, gain = 1.8, jitter = null, arrive = null } = {}) {
  out.fill(0);
  for (let s = 0; s < src.length; s += 1) {
    const S = src[s];
    const g = s === boost ? gain : 1;
    const ph = S.omega * t - S.phase - (jitter ? jitter(s) : 0);
    const kd = grid.kd[s], env = grid.env[s], dist = grid.dist[s];
    const front = arrive ? arrive(s) : Infinity;
    if (front <= 0) continue;
    const soft = S.lambda * 0.6;
    for (let q = 0; q < out.length; q += 1) {
      let e = env[q] * g;
      if (front !== Infinity) {
        const over = front - dist[q];
        if (over <= 0) continue;
        if (over < soft) e *= over / soft;
      }
      out[q] += e * Math.cos(kd[q] - ph);
    }
  }
  return out;
}

/**
 * Marching squares: segments where a sampled field crosses `level`.
 * Returns a flat array [x1, y1, x2, y2, …] in grid-cell coordinates (cell
 * centres at i + 0.5, j + 0.5). Cells whose corners all lie within `alive`
 * of zero are skipped: in still water a node line would only trace noise.
 */
export function isolines(values, cols, rows, level = 0, alive = 0) {
  const out = [];
  const at = (i, j) => values[j * cols + i] - level;
  const lerp = (a, b) => a / (a - b);
  for (let j = 0; j < rows - 1; j += 1) for (let i = 0; i < cols - 1; i += 1) {
    const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
    if (alive > 0 && Math.max(Math.abs(a + level), Math.abs(b + level), Math.abs(c + level), Math.abs(d + level)) < alive) continue;
    const code = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (c > 0 ? 2 : 0) | (d > 0 ? 1 : 0);
    if (code === 0 || code === 15) continue;
    const x = i + 0.5, y = j + 0.5;
    const top = () => [x + lerp(a, b), y];
    const right = () => [x + 1, y + lerp(b, c)];
    const bottom = () => [x + lerp(d, c), y + 1];
    const left = () => [x, y + lerp(a, d)];
    const seg = (p, q) => out.push(p[0], p[1], q[0], q[1]);
    switch (code) {
      case 1: case 14: seg(left(), bottom()); break;
      case 2: case 13: seg(bottom(), right()); break;
      case 3: case 12: seg(left(), right()); break;
      case 4: case 11: seg(top(), right()); break;
      case 6: case 9: seg(top(), bottom()); break;
      case 7: case 8: seg(left(), top()); break;
      case 5: seg(left(), top()); seg(bottom(), right()); break;
      case 10: seg(top(), right()); seg(left(), bottom()); break;
      default: break;
    }
  }
  return out;
}

/** The source nearest (x, y) within its exclusion radius, or −1. */
export function nearestSource(pos, radii, x, y) {
  let best = -1, bestD = Infinity;
  for (let i = 0; i < pos.length; i += 1) {
    const d = Math.hypot(x - pos[i].x, y - pos[i].y);
    if (d < radii[i] * 0.8 && d < bestD) { best = i; bestD = d; }
  }
  return best;
}

/** Period in seconds of the drift between two families' fringes. */
export const beatPeriod = (a, b) => {
  const df = Math.abs(FIELD.F0 * (FAMILIES[a].ratio - FAMILIES[b].ratio));
  return df === 0 ? Infinity : 1 / df;
};
