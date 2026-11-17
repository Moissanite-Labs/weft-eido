// The weave: a map of every place on the site and the concepts they are made
// of, drawn in the hyperbolic plane (site/assets/weave-math.js) from one list
// of threads (site/assets/weave-graph.js).
//
// It appears three ways, all one renderer:
//   1. A live glyph in the navigation of every page. Press it, or W, and the
//      weave opens over the page, centred where you are.
//   2. "Woven from here" at the end of every page: the same weave, inline.
//   3. On the home page, pressing a source in the field opens the weave on it.
//
// Inside the weave, pressing a place brings it to the centre by a Möbius
// move, so the whole plane flows and its threads are plucked; pressing the
// centre goes there. Dragging moves through the plane and settles on whatever
// is nearest the centre. Every move is printed, with its numbers.
//
// Bounds: the panel beside the weave says in text everything the canvas
// shows, every place is a real link in it, the canvas never takes focus, and
// under reduced motion each move is a single redraw.

import { scene, ripple, reduced, kick } from "./loom.js";
import { NODES, KINDS, RATIOS, weaveGraph, connections } from "./weave-graph.js";
import {
  WEAVE, TAU, cx, abs, apply, compose, toCentre, fromCentre, moveToward, alongFromCentre, geoLerp, geodesic,
  distance, conformal, layout, pluckAmps, stringAt, weftThread, ease, pickDirection, IDENTITY,
} from "./weave-math.js";

const SITE = new URL("../", import.meta.url);
const G = weaveGraph();
const AMPS = pluckAmps();
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const session = (key, value) => {
  try {
    if (value === undefined) return window.sessionStorage.getItem(key);
    window.sessionStorage.setItem(key, value);
  } catch (e) { /* storage may be blocked */ }
  return null;
};

/* ------------------------------------------------------------------ */
/* Where we are                                                        */
/* ------------------------------------------------------------------ */

const urlOf = (n) => (n && n.href ? new URL(n.href, SITE) : null);
const pathKey = (u) => u.origin + u.pathname.replace(/index\.html$/, "");
const HERE = (() => {
  const key = pathKey(new URL(location.href));
  const n = NODES.find((m) => m.kind !== "concept" && urlOf(m) && pathKey(urlOf(m)) === key);
  return n ? n.id : null;
})();

/** Pages visited this session, oldest first: your thread through the weave. */
const TRAIL = (() => {
  let t = [];
  try { t = JSON.parse(session("eido-weave-trail") || "[]"); } catch (e) { t = []; }
  if (!Array.isArray(t)) t = [];
  t = t.filter((id) => G.byId.has(id));
  if (HERE && t[t.length - 1] !== HERE) t.push(HERE);
  t = t.slice(-12);
  session("eido-weave-trail", JSON.stringify(t));
  return t;
})();
const VISITED = new Set(TRAIL);

const counts = (() => {
  const c = { page: 0, concept: 0, other: 0 };
  for (const n of NODES) { if (n.kind === "page") c.page += 1; else if (n.kind === "concept") c.concept += 1; else c.other += 1; }
  return c;
})();

/* ------------------------------------------------------------------ */
/* The view: one weave drawn into one canvas                           */
/* ------------------------------------------------------------------ */

const VIEWS = new Set();
const NODE_RHO = { page: 0.17, concept: 0.13, original: 0.11, external: 0.11 };
const visibility = (d) => (d == null ? 0.12 : d <= 2 ? 1 : d === 3 ? 0.5 : 0.22);

class WeaveView {
  /**
   * mode "full" (the open weave), "inline" (end of a page) or "glyph" (the
   * navigation mark). Callbacks: onFocus(id), onGo(id, screenPoint), onHover(id).
   */
  constructor(canvas, { focus, mode = "full", onFocus = null, onGo = null, onHover = null } = {}) {
    this.canvas = canvas;
    this.mode = mode;
    this.onFocus = onFocus; this.onGo = onGo; this.onHover = onHover;
    this.focus = focus;
    this.prevFocus = null;
    const L = layout(G.adj, focus, { ids: G.ids });
    this.pos = L.pos;
    this.target = L.pos;
    this.depth = L.depth;
    this.depthFrom = L.depth;
    this.view = IDENTITY;
    this.move = null;
    this.pluck = null;
    this.bloom = null;
    this.dive = null;
    this.hover = null;
    this.drag = null;
    this.history = [];
    this.geom = { cx: 0, cy: 0, R: 1, w: 0, h: 0 };
    this.screen = new Map();
    this.mix = 1; // how far the current move has settled, for blending depth and focus emphasis
    this.handle = scene(canvas, { frame: (ctx, info) => this.frame(ctx, info) });
    VIEWS.add(this);
    if (mode !== "glyph") this.bindPointer();
  }

  invalidate() { this.handle.invalidate(); }

  /* ---------- Moving the focus ---------- */

  setFocus(id, { animate = true, record = true } = {}) {
    if (!G.byId.has(id)) return;
    const now = performance.now();
    const from = new Map(this.pos);
    const a = from.get(id) || cx(0, 0);
    const T = toCentre(a);
    const seen = new Map([...from].map(([k, z]) => [k, apply(T, z)]));
    const L = layout(G.adj, id, { prev: seen, ids: G.ids });
    if (record && id !== this.focus) this.history.push(this.focus);
    this.prevFocus = this.focus;
    this.focus = id;
    this.depthFrom = this.depth;
    this.depth = L.depth;
    this.target = L.pos;
    if (!animate || reduced()) {
      this.pos = L.pos;
      this.view = compose(T, this.view);
      this.move = null;
      this.mix = 1;
    } else {
      this.move = { t0: now, a, from, viewFrom: this.view };
      this.pluck = { t0: now + WEAVE.MOVE * 450, id };
      this.mix = 0;
    }
    this.onFocus?.(id);
    this.invalidate();
  }

  back() { const id = this.history.pop(); if (id) this.setFocus(id, { record: false }); }

  stepMove(now) {
    const m = this.move;
    if (!m) return;
    const u = (now - m.t0) / (WEAVE.MOVE * 1000);
    // Phase one carries the chosen place to the centre along its geodesic: an isometry, so the weft flows with it.
    const s1 = ease(u / 0.62);
    // Phase two, overlapping, lets every place settle along its own geodesic into the new layout.
    const s2 = ease((u - 0.38) / 0.62);
    const M = moveToward(m.a, s1);
    const pos = new Map();
    for (const [id, z] of m.from) pos.set(id, geoLerp(apply(M, z), this.target.get(id) || z, s2));
    this.pos = pos;
    this.view = compose(M, m.viewFrom);
    this.mix = s2;
    this.moveInfo = { a: m.a, s1, s2, M };
    if (u >= 1) { this.pos = this.target; this.move = null; this.mix = 1; }
  }

  /* ---------- Opening, closing, leaving ---------- */

  /** Grow out of a point (canvas px) to full size. dir −1 shrinks back into it. */
  startBloom(origin, { r0 = 16, dir = 1, then = null } = {}) {
    if (reduced()) { this.bloom = null; then?.(); this.invalidate(); return; }
    this.bloom = { t0: performance.now(), origin, r0, dir, then };
    this.invalidate();
  }

  startDive(id, then) {
    if (reduced()) { then(); return; }
    this.dive = { t0: performance.now(), id, then };
    this.invalidate();
  }

  /* ---------- Pointer ---------- */

  toDisk(x, y) {
    const { cx: X, cy: Y, R } = this.geom;
    let z = cx((x - X) / R, (y - Y) / R);
    const r = abs(z);
    if (r > 0.94) z = cx((z.x / r) * 0.94, (z.y / r) * 0.94);
    return z;
  }

  hit(x, y) {
    let best = null, bestD = Infinity;
    for (const [id, s] of this.screen) {
      if (s.alpha < 0.15) continue;
      const d = Math.hypot(x - s.x, y - s.y);
      if (d < Math.max(s.r + 6, 12) && d < bestD) { best = id; bestD = d; }
    }
    return best;
  }

  local(ev) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  bindPointer() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0) return;
      const p = this.local(ev);
      this.drag = { x: p.x, y: p.y, z0: this.toDisk(p.x, p.y), moved: false, id: ev.pointerId };
    });
    c.addEventListener("pointermove", (ev) => {
      const p = this.local(ev);
      const d = this.drag;
      if (d && d.id === ev.pointerId) {
        if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) > 6) {
          d.moved = true;
          try { c.setPointerCapture(ev.pointerId); } catch (e) { /* not capturable */ }
          if (this.move) this.stepMove(performance.now());
          this.move = null;
          d.snap = new Map(this.pos);
          d.view = this.view;
        }
        if (d.moved) {
          // The Möbius move that carries the pressed point to the pointer: the plane slides under your hand.
          const T = compose(fromCentre(this.toDisk(p.x, p.y)), toCentre(d.z0));
          const pos = new Map();
          for (const [id, z] of d.snap) pos.set(id, apply(T, z));
          this.pos = pos;
          this.view = compose(T, d.view);
          this.invalidate();
          return;
        }
      }
      const id = this.hit(p.x, p.y);
      if (id !== this.hover) { this.hover = id; this.onHover?.(id); this.invalidate(); }
      c.style.cursor = id ? "pointer" : this.mode === "full" ? "grab" : "default";
    });
    const end = (ev) => {
      const d = this.drag;
      if (!d || d.id !== ev.pointerId) return;
      this.drag = null;
      if (d.moved) { this.settleDrag(true); return; }
      const p = this.local(ev);
      const id = this.hit(p.x, p.y);
      if (!id) return;
      const s = this.screen.get(id);
      if (id === this.focus) this.onGo?.(id, { x: s.x, y: s.y });
      else this.setFocus(id);
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", (ev) => { if (this.drag?.moved) { this.drag = null; this.settleDrag(true); } else this.drag = null; });
    c.addEventListener("pointerleave", () => { if (this.hover && !this.drag) { this.hover = null; this.onHover?.(null); this.invalidate(); } });
  }

  /** After a drag, settle on whatever place is nearest the centre. */
  settleDrag(now = false) {
    if (!now) return;
    let best = this.focus, bestR = Infinity;
    for (const [id, z] of this.pos) {
      const r = abs(z);
      if (visibility(this.depth.get(id)) >= 0.5 && r < bestR) { best = id; bestR = r; }
    }
    if (best === this.focus) {
      // Same focus: glide back into its layout along the geodesic that recentres it.
      const keep = this.focus;
      this.focus = null;
      this.setFocus(keep, { record: false });
    } else this.setFocus(best);
  }

  /** The place an arrow key points at, among the focus's own threads. */
  neighbourToward(dir) {
    const f = this.screen.get(this.focus);
    if (!f) return null;
    const cands = (G.adj[this.focus] || []).map((id) => ({ id, ...this.screen.get(id) })).filter((c) => c.x != null);
    return pickDirection(f.x, f.y, cands, dir);
  }

  /* ---------- Drawing ---------- */

  frame(ctx, { w, h, pal, reduced: still }) {
    const now = performance.now();
    if (this.move) this.stepMove(now);
    const tSec = now / 1000;
    const full = this.mode === "full", glyph = this.mode === "glyph";
    let X = w / 2, Y = h / 2, R = Math.max(10, Math.min(w, h) / 2 - (glyph ? 1.5 : full ? 22 : 10));
    // Bloom: the disk grows out of the point that was pressed, and every place unfolds from the centre.
    let unfold = 1, fade = 1;
    if (this.bloom) {
      const b = this.bloom;
      let u = clamp01((now - b.t0) / (WEAVE.BLOOM * 1000));
      if (b.dir < 0) u = 1 - clamp01((now - b.t0) / (WEAVE.BLOOM * 600));
      const e = ease(u);
      X = b.origin.x + (X - b.origin.x) * e;
      Y = b.origin.y + (Y - b.origin.y) * e;
      R = b.r0 + (R - b.r0) * e;
      unfold = e; fade = clamp01(u * 1.6);
      const done = b.dir > 0 ? u >= 1 : u <= 0;
      if (done) { const then = b.then; this.bloom = null; then?.(); }
    }
    // Dive: the chosen place swells to fill the disk while the rest rushes to the rim.
    let dive = 0;
    if (this.dive) {
      dive = ease((now - this.dive.t0) / (WEAVE.DIVE * 1000));
      if (dive >= 1 && !this.dive.fired) { this.dive.fired = true; const then = this.dive.then; setTimeout(then, 0); }
    }
    this.geom = { cx: X, cy: Y, R, w, h };
    const warp = (z) => {
      let q = z;
      if (unfold < 1) q = alongFromCentre(q, unfold);
      if (dive > 0) q = alongFromCentre(q, 1 + 3.2 * dive);
      return q;
    };
    const toScreen = (z) => ({ x: X + R * z.x, y: Y + R * z.y });

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = fade * (1 - 0.85 * dive);
    ctx.lineCap = "round"; ctx.lineJoin = "round";

    // The horizon, and the weft of geodesics that flows with every move.
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = glyph ? 1.1 : 1;
    ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.stroke();
    if (!glyph) {
      ctx.save();
      ctx.beginPath(); ctx.arc(X, Y, R, 0, TAU); ctx.clip();
      const span = full ? 8 : 5;
      for (let j = -span; j <= span; j += 1) {
        const pts = weftThread(j, full ? 0.55 : 0.75, full ? 44 : 28);
        ctx.beginPath();
        pts.forEach((z, k) => { const s = toScreen(warp(apply(this.view, z))); if (k) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); });
        ctx.strokeStyle = j % 2 ? pal.trough(pal.light ? 0.1 : 0.08) : pal.crest(pal.light ? 0.12 : 0.1);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Where every place is drawn, and how strongly.
    const screen = new Map();
    const mix = this.mix;
    const emphasis = (id) => (id === this.focus ? mix : id === this.prevFocus ? 1 - mix : 0);
    for (const id of G.ids) {
      const n = G.byId.get(id);
      const z0 = this.pos.get(id);
      if (!z0) continue;
      const z = warp(z0);
      const vis = visibility(this.depthFrom.get(id)) * (1 - mix) + visibility(this.depth.get(id)) * mix;
      if (glyph && (this.depth.get(id) ?? 9) > 1) continue;
      const conf = conformal(z);
      let rho = (NODE_RHO[n.kind] || 0.12) * (1 + 0.04 * (n.weight - 5)) * (1 + 0.45 * emphasis(id));
      if (dive > 0 && id === this.dive.id) rho *= 1 + 18 * dive * dive;
      const r = glyph ? (id === this.focus ? 2.6 : 1.3) : Math.max(1.6, R * rho * 0.34 * conf);
      const alpha = vis * (dive > 0 && id !== this.dive.id ? 1 - dive : 1) * (abs(z) > WEAVE.RIM ? 0 : 1);
      screen.set(id, { ...toScreen(z), z, r, alpha, conf });
    }
    this.screen = screen;

    // Your thread through the site: the pages visited this session, in order.
    if (!glyph && TRAIL.length > 1) {
      ctx.save();
      ctx.setLineDash([2, 5]);
      ctx.strokeStyle = pal.voice(0, 0.42);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let k = 1; k < TRAIL.length; k += 1) {
        const a = this.pos.get(TRAIL[k - 1]), b = this.pos.get(TRAIL[k]);
        if (!a || !b) continue;
        geodesic(a, b, 18).forEach((z, i) => { const s = toScreen(warp(z)); if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); });
      }
      ctx.stroke();
      ctx.restore();
    }

    // Threads: geodesic arcs, each a string. At rest they barely breathe; the new focus's threads are plucked.
    const pl = this.pluck;
    const tPl = pl ? (now - pl.t0) / 1000 : Infinity;
    if (pl && tPl > WEAVE.DECAY * 6) this.pluck = null;
    for (const e of G.edges) {
      const A = screen.get(e.a), B = screen.get(e.b);
      if (!A || !B) continue;
      const alpha = Math.min(A.alpha, B.alpha);
      if (alpha < 0.03) continue;
      const touchF = e.a === this.focus || e.b === this.focus;
      const touchH = this.hover && (e.a === this.hover || e.b === this.hover);
      if (glyph && !touchF) continue;
      const na = G.byId.get(e.a), nb = G.byId.get(e.b);
      const concept = na.kind === "concept" || nb.kind === "concept";
      const outside = na.kind === "external" || nb.kind === "external";
      const far = touchF ? nb.id === this.focus ? na : nb : nb;
      const ratio = RATIOS[far.family] || 1;
      const len = Math.hypot(B.x - A.x, B.y - A.y);
      const n = Math.max(6, Math.min(26, Math.round(len / 12)));
      const pts = geodesic(A.z, B.z, n).map(toScreen);
      // Displacement normal to the thread, scaled by the conformal factor so threads near the rim are still.
      // At rest each thread breathes in its fundamental at its family's frequency; when plucked it rings
      // as a real string does, every partial at its own multiple and dying faster the higher it is.
      const restAmp = still ? 0 : R * (glyph ? 0.035 : touchH ? 0.01 : 0.006);
      const plucking = !still && touchF && pl && pl.id === this.focus && tPl >= 0;
      const pluckAmp = plucking ? R * 0.05 * (1 - Math.exp(-tPl / 0.05)) : 0;
      const phase = (e.a.length * 7 + e.b.length * 3) * 0.37;
      const confMid = Math.sqrt(Math.max(0, (A.conf + B.conf) / 2));
      ctx.beginPath();
      for (let k = 0; k <= n; k += 1) {
        const s = k / n;
        let x = pts[k].x, y = pts[k].y;
        if ((restAmp > 0 || pluckAmp > 0) && k > 0 && k < n) {
          const p0 = pts[k - 1], p1 = pts[k + 1];
          const tx = p1.x - p0.x, ty = p1.y - p0.y, tl = Math.hypot(tx, ty) || 1;
          const rest = Math.sin(Math.PI * s) * Math.cos(TAU * 0.32 * ratio * tSec + phase);
          const plucked = pluckAmp > 0 ? stringAt(s, tPl, 1.4 * ratio, AMPS) : 0;
          const bump = (rest * restAmp + plucked * pluckAmp) * confMid;
          x += (-ty / tl) * bump; y += (tx / tl) * bump;
        }
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      const strength = touchF ? 0.72 : touchH ? 0.78 : full ? 0.2 : 0.16;
      ctx.strokeStyle = outside ? pal.trough(strength * alpha) : concept ? pal.voice(2, strength * alpha) : pal.voice(0, strength * alpha);
      ctx.lineWidth = touchF || touchH ? (glyph ? 1 : 1.5) : 1;
      if (e.kind === "relates") ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Places.
    // Far places first, so nearer ones are drawn over them.
    const order = [...screen.keys()].sort((p, q) => abs(screen.get(q).z) - abs(screen.get(p).z));
    for (const id of order) {
      const s = screen.get(id);
      const n = G.byId.get(id);
      if (s.alpha < 0.02) continue;
      const isF = id === this.focus, isH = id === this.hover;
      const a = s.alpha;
      if (n.kind === "concept") {
        // A rosette: r(θ) = r·(1 + 0.16·cos(kθ + ωt)), with k the number of threads it holds.
        const k = Math.max(3, Math.min(9, (G.adj[id] || []).length));
        const turn = still ? 0 : tSec * 0.35;
        ctx.beginPath();
        for (let q = 0; q <= 64; q += 1) {
          const th = (q / 64) * TAU;
          const rr = s.r * (1 + 0.16 * Math.cos(k * th + turn));
          const px = s.x + rr * Math.cos(th), py = s.y + rr * Math.sin(th);
          if (q) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.fillStyle = pal.voice(2, (isF ? 0.22 : 0.1) * a);
        ctx.fill();
        ctx.strokeStyle = pal.voice(2, (isF || isH ? 1 : 0.8) * a);
        ctx.lineWidth = isF ? 1.6 : 1.1;
        ctx.stroke();
      } else if (n.kind === "original") {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - s.r); ctx.lineTo(s.x + s.r, s.y); ctx.lineTo(s.x, s.y + s.r); ctx.lineTo(s.x - s.r, s.y); ctx.closePath();
        ctx.fillStyle = pal.voice(3, 0.12 * a); ctx.fill();
        ctx.strokeStyle = pal.voice(3, 0.85 * a); ctx.lineWidth = 1.1; ctx.stroke();
      } else {
        const tone = n.kind === "external" ? 1 : 0;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fillStyle = pal.voice(tone, (isF ? 0.26 : 0.14) * a); ctx.fill();
        ctx.strokeStyle = pal.voice(tone, (isF || isH ? 1 : 0.85) * a); ctx.lineWidth = isF ? 1.8 : 1.2; ctx.stroke();
        ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(1.2, s.r * 0.36), 0, TAU);
        ctx.fillStyle = pal.voice(tone, a); ctx.fill();
        if (n.blocked) { ctx.strokeStyle = pal.trough(0.8 * a); ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 1.45, 0, TAU); ctx.stroke(); }
      }
      // A visited page carries a small notch; the page you are on, a second ring.
      if (!glyph && VISITED.has(id) && id !== HERE && n.kind !== "concept") {
        ctx.fillStyle = pal.muted;
        ctx.beginPath(); ctx.arc(s.x + s.r * 0.8, s.y - s.r * 0.8, Math.max(1.2, s.r * 0.1), 0, TAU); ctx.fill();
      }
      if (id === HERE && !glyph) {
        ctx.strokeStyle = pal.ink; ctx.lineWidth = 1; ctx.setLineDash([1.5, 3]);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 4, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      // The focus sends out rings, as each source does in the home field.
      if (isF && !still && !glyph) {
        const lam = s.r * 1.4;
        for (let q = 0; q < 3; q += 1) {
          const ring = (((tSec * 0.32 * (RATIOS[n.family] || 1)) % 1) + q) * lam;
          const carry = lam * 2.6;
          if (ring > carry) continue;
          ctx.strokeStyle = pal.voice(n.kind === "concept" ? 2 : 0, 0.55 * (1 - ring / carry) * a);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r + ring, 0, TAU); ctx.stroke();
        }
      }
    }

    // Labels: drawn only where a place is large enough to read, so the rim stays quiet.
    // Nearest first claim their room; a label that would overlap one already set is left out.
    if (!glyph) {
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      const placed = [];
      const priority = (id) => (id === this.focus ? -2 : id === this.hover ? -1 : abs(screen.get(id).z));
      for (const id of [...screen.keys()].sort((p, q) => priority(p) - priority(q))) {
        const s = screen.get(id);
        const n = G.byId.get(id);
        const isF = id === this.focus, isH = id === this.hover;
        const depth = this.depth.get(id) ?? 9;
        if (!isF && !isH && (depth > (full ? 2 : 1) || s.r < (full ? 5 : 6) || s.alpha < 0.3)) continue;
        const a = s.alpha * clamp01((s.r - 3.5) / 5) * (isF || isH ? 1 : 0.92);
        if (a < 0.05) continue;
        const size = Math.max(10, Math.min(isF ? (full ? 26 : 19) : full ? 16 : 13, s.r * (isF ? 0.9 : 0.85)));
        const ty = s.y + s.r + size * 1.05 + (id === HERE ? 4 : 0);
        ctx.font = `${isF ? 700 : 600} ${size.toFixed(1)}px "Avenir Next", Avenir, Futura, sans-serif`;
        const showSub = (isF || isH || depth <= 1) && (full || isF || isH);
        const sub = isH && !isF && n.eq ? n.eq : n.code + (id === HERE ? " · you are here" : "");
        const fs = Math.max(9, size * 0.56);
        const tw = Math.max(ctx.measureText(n.name).width, showSub ? sub.length * fs * 0.6 : 0);
        const box = { l: s.x - tw / 2 - 3, r: s.x + tw / 2 + 3, t: ty - size, b: ty + (showSub ? fs * 1.7 : size * 0.3) };
        if (!isF && !isH && placed.some((q) => box.l < q.r && box.r > q.l && box.t < q.b && box.b > q.t)) continue;
        placed.push(box);
        ctx.globalAlpha = fade * a * (1 - 0.85 * dive);
        ctx.lineWidth = 4; ctx.strokeStyle = pal.bg; ctx.strokeText(n.name, s.x, ty);
        ctx.fillStyle = isF || isH ? pal.ink : pal.ink2; ctx.fillText(n.name, s.x, ty);
        if (showSub) {
          ctx.font = `${fs.toFixed(1)}px ui-monospace, monospace`;
          ctx.strokeText(sub, s.x, ty + fs * 1.4);
          ctx.fillStyle = pal.muted; ctx.fillText(sub, s.x, ty + fs * 1.4);
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // No kick() here: the loom reschedules itself after every frame while motion is allowed,
    // and a scene asking for another frame from inside one would double the frames it queues.
  }
}

/* ------------------------------------------------------------------ */
/* The panel: everything the canvas shows, as text                     */
/* ------------------------------------------------------------------ */

function panelMarkup(prefix, level) {
  return `
    <p class="eyebrow"><span data-w="kind"></span> · <span data-w="code"></span></p>
    <h${level} id="${prefix}-name" data-w="name"></h${level}>
    <p class="weave-eq" data-w="eq"></p>
    <p data-w="line"></p>
    <p class="weave-actions"><a class="btn btn-primary" data-w="go"></a><button class="btn small" type="button" data-w="back" hidden>Back</button></p>
    <div class="weave-lists">
      <div><p class="weave-sub">Places</p><ul class="weave-links" data-w="places"></ul></div>
      <div><p class="weave-sub">Concepts</p><ul class="weave-links" data-w="concepts"></ul></div>
    </div>`;
}

function fillPanel(root, id, view, { onGo }) {
  const n = G.byId.get(id);
  const $ = (k) => root.querySelector(`[data-w="${k}"]`);
  $("kind").textContent = KINDS[n.kind].label;
  $("code").textContent = n.code;
  $("name").textContent = n.name;
  $("eq").textContent = n.eq;
  $("eq").hidden = !n.eq;
  $("line").textContent = n.line;
  const go = $("go");
  const url = urlOf(n);
  if (id === HERE) {
    go.textContent = "You are here";
    go.removeAttribute("href");
    go.setAttribute("aria-disabled", "true");
  } else if (url) {
    go.textContent = `${KINDS[n.kind].go} →`;
    go.href = url.href;
    go.removeAttribute("aria-disabled");
  }
  go.hidden = !url;
  go.onclick = (ev) => {
    if (!url || id === HERE || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;
    ev.preventDefault();
    onGo(id);
  };
  const back = $("back");
  back.hidden = !view.history.length;
  back.onclick = () => view.back();
  const { places, concepts } = connections(G, id);
  const list = (el, ids) => {
    el.replaceChildren(...ids.map((u) => {
      const m = G.byId.get(u);
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = `weave-link kind-${m.kind}`;
      b.dataset.weaveNode = u;
      const name = document.createElement("span");
      name.textContent = m.name;
      const small = document.createElement("small");
      small.textContent = m.kind === "concept" ? m.eq : `${KINDS[m.kind].label}${VISITED.has(u) ? " · visited" : ""}${u === HERE ? " · you are here" : ""}`;
      b.append(name, small);
      b.addEventListener("click", () => view.setFocus(u));
      b.addEventListener("pointerenter", () => { view.hover = u; view.invalidate(); });
      b.addEventListener("pointerleave", () => { view.hover = null; view.invalidate(); });
      b.addEventListener("focus", () => { view.hover = u; view.invalidate(); });
      b.addEventListener("blur", () => { view.hover = null; view.invalidate(); });
      li.append(b);
      return li;
    }));
    el.closest("div").hidden = !ids.length;
  };
  list($("places"), places);
  list($("concepts"), concepts);
}

/* ------------------------------------------------------------------ */
/* Leaving for a place                                                 */
/* ------------------------------------------------------------------ */

function leaveFor(id, point) {
  const n = G.byId.get(id);
  const url = urlOf(n);
  if (!url) return;
  // The next page's first front, and its iris, open from where the place was.
  if (point) session("eido-origin", JSON.stringify({ x: point.x / window.innerWidth, y: point.y / window.innerHeight }));
  const samePage = pathKey(url) === pathKey(new URL(location.href));
  if (samePage) {
    closeWeave(() => { if (url.hash) location.hash = url.hash; });
    return;
  }
  location.assign(url.href);
}

/* ------------------------------------------------------------------ */
/* The open weave: a dialog over the page                              */
/* ------------------------------------------------------------------ */

let dialog = null, full = null, opener = null, readoutAt = 0;

function buildDialog() {
  dialog = document.createElement("dialog");
  dialog.className = "weave-dialog";
  dialog.setAttribute("aria-labelledby", "weave-full-name");
  // The sky comes first, so when the two stack it is on top; side by side, row-reverse puts it on the right.
  dialog.innerHTML = `
    <canvas class="weave-sky" aria-hidden="true"></canvas>
    <div class="weave-panel">
      <p class="weave-title"><span>The weave</span><button class="btn small" type="button" data-w="close">Close</button></p>
      ${panelMarkup("weave-full", 2)}
      <p class="numbers weave-readout" data-w="readout" aria-hidden="true"></p>
      <p class="quiet weave-keys">${counts.page} pages, ${counts.other} originals and ${counts.concept} concepts, ${G.edges.length} threads. Press a place to bring it to the centre, and the centre to go. Drag to move through the plane. Arrow keys follow threads, Enter goes, Backspace returns, Escape closes.</p>
    </div>`;
  document.body.append(dialog);
  const canvas = dialog.querySelector(".weave-sky");
  const panel = dialog.querySelector(".weave-panel");
  full = new WeaveView(canvas, {
    focus: HERE || "home",
    mode: "full",
    onFocus: (id) => { fillPanel(panel, id, full, { onGo: (u) => go(u) }); readout(true); },
    onGo: (id, point) => go(id, point),
  });
  const go = (id, point) => {
    const s = full.screen.get(id);
    const r = canvas.getBoundingClientRect();
    const pt = point ? { x: point.x + r.left, y: point.y + r.top } : s ? { x: s.x + r.left, y: s.y + r.top } : null;
    if (id !== full.focus) { full.setFocus(id); }
    const n = G.byId.get(id);
    if (!urlOf(n) || id === HERE) return;
    if (pt) ripple(pt.x, pt.y, 1);
    full.startDive(id, () => leaveFor(id, pt));
  };
  fillPanel(panel, full.focus, full, { onGo: (u) => go(u) });
  dialog.querySelector('[data-w="close"]').addEventListener("click", () => closeWeave());
  dialog.addEventListener("cancel", (ev) => { ev.preventDefault(); closeWeave(); });
  // However it closes (a second Escape can close it outright), the page is left as it was.
  dialog.addEventListener("close", () => {
    dialog.classList.remove("closing");
    full.bloom = null;
    document.documentElement.classList.remove("weave-is-open");
  });
  dialog.addEventListener("keydown", (ev) => {
    const t = ev.target;
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const dirs = { ArrowRight: 0, ArrowDown: Math.PI / 2, ArrowLeft: Math.PI, ArrowUp: -Math.PI / 2 };
    if (ev.key in dirs) {
      const id = full.neighbourToward(dirs[ev.key]);
      if (id) { ev.preventDefault(); full.setFocus(id); }
    } else if (ev.key === "Enter" && !(t instanceof HTMLButtonElement) && !(t instanceof HTMLAnchorElement)) {
      ev.preventDefault();
      go(full.focus);
    } else if (ev.key === "Backspace") {
      ev.preventDefault();
      full.back();
    }
  });
  // The printed state of the move, refreshed a few times a second while anything moves.
  const tick = () => { if (dialog.open) { readout(); requestAnimationFrame(tick); } };
  dialog.addEventListener("weave-open", () => requestAnimationFrame(tick));
}

function fmtC(z) { return `${z.x.toFixed(3)} ${z.y < 0 ? "−" : "+"} ${Math.abs(z.y).toFixed(3)}i`; }

function readout(force = false) {
  const el = dialog?.querySelector('[data-w="readout"]');
  if (!el) return;
  const now = performance.now();
  if (!force && now - readoutAt < 120) return;
  readoutAt = now;
  const f = full.focus;
  const lines = [];
  const m = full.move && full.moveInfo;
  lines.push(`τₐ(z) = (z − a) / (1 − ā·z)      a = ${fmtC(m ? m.a : cx(0, 0))}`);
  if (m) lines.push(`moving: carried ${(m.s1 * 100).toFixed(0)} %, settled ${(m.s2 * 100).toFixed(0)} %`);
  else lines.push(`at rest: ${G.byId.get(f).name} at z = 0`);
  const hereZ = HERE ? full.pos.get(HERE) : null;
  if (hereZ && HERE !== f) lines.push(`d(here, focus) = 2·artanh|z| = ${distance(cx(0, 0), hereZ).toFixed(2)}   (one thread = ${WEAVE.STEP.toFixed(2)})`);
  const ring = [...full.depth.values()].reduce((c, d) => { c[d] = (c[d] || 0) + 1; return c; }, {});
  lines.push(`rings: ${Object.keys(ring).sort().map((d) => `${ring[d]} at ${d}`).join(" · ")}   r = tanh(d·${WEAVE.STEP} / 2)`);
  lines.push(`plucked at p = ${WEAVE.PLUCK_AT}: aₙ = 2·sin(nπp) / (n²π²·p(1 − p)) = ${AMPS.map((x) => x.toFixed(2)).join(" ")}`);
  el.textContent = lines.join("\n");
}

/**
 * Open the weave over the page, centred on `focus`. `origin` (viewport px)
 * is where it grows from: a pressed source, the navigation mark.
 */
export function openWeave(focus = HERE || "home", { origin = null, r0 = 14 } = {}) {
  if (!dialog) buildDialog();
  if (!G.byId.has(focus)) focus = HERE || "home";
  if (!dialog.open) {
    opener = document.activeElement;
    dialog.showModal();
    // showModal focuses the first control, which on a narrow screen scrolls the sky out of view.
    dialog.scrollTop = 0;
    dialog.querySelector('[data-w="close"]').focus({ preventScroll: true });
    document.documentElement.classList.add("weave-is-open");
    dialog.dispatchEvent(new Event("weave-open"));
  }
  full.history = [];
  if (full.focus !== focus) full.setFocus(focus, { animate: false, record: false });
  else full.onFocus?.(focus);
  const rect = full.canvas.getBoundingClientRect();
  const o = origin || { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  dialog._origin = o;
  if (origin) ripple(o.x, o.y, 1);
  full.startBloom({ x: o.x - rect.left, y: o.y - rect.top }, { r0 });
  kick();
}

/** Close the weave, folding back into where it came from. */
export function closeWeave(then = null) {
  if (!dialog?.open || dialog.classList.contains("closing")) return;
  const rect = full.canvas.getBoundingClientRect();
  const o = dialog._origin || { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  dialog.classList.add("closing");
  full.startBloom({ x: o.x - rect.left, y: o.y - rect.top }, {
    dir: -1,
    then: () => {
      dialog.classList.remove("closing");
      dialog.close();
      document.documentElement.classList.remove("weave-is-open");
      if (opener && typeof opener.focus === "function") opener.focus({ preventScroll: true });
      then?.();
    },
  });
}

/* ------------------------------------------------------------------ */
/* The mark in the navigation                                          */
/* ------------------------------------------------------------------ */

function initNav() {
  const nav = document.querySelector(".weft-nav");
  if (!nav) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "weave-open";
  btn.setAttribute("aria-haspopup", "dialog");
  btn.setAttribute("aria-keyshortcuts", "W");
  btn.title = "The weave: every place this one connects to (W)";
  const c = document.createElement("canvas");
  c.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.textContent = "Weave";
  btn.append(c, label);
  const theme = nav.querySelector("[data-theme-toggle]");
  nav.insertBefore(btn, theme || null);
  new WeaveView(c, { focus: HERE || "home", mode: "glyph" });
  btn.addEventListener("click", () => {
    const r = c.getBoundingClientRect();
    openWeave(HERE || "home", { origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, r0: r.width / 2 });
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "w" && ev.key !== "W") return;
    if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.defaultPrevented) return;
    const t = ev.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (dialog?.open) { closeWeave(); return; }
    btn.click();
  });
}

/* ------------------------------------------------------------------ */
/* Woven from here: the weave at the end of every page                 */
/* ------------------------------------------------------------------ */

function initInline() {
  const main = document.getElementById("main");
  if (!main || !HERE || HERE === "home" || main.querySelector(".weave-here")) return;
  const n = G.byId.get(HERE);
  const { places, concepts } = connections(G, HERE);
  const nav = document.createElement("nav");
  nav.className = "movement weave-here";
  nav.setAttribute("aria-labelledby", "weave-here-h");
  nav.innerHTML = `
    <h2 id="weave-here-h">Woven from here</h2>
    <p>${n.name} holds ${places.length} thread${places.length === 1 ? "" : "s"} to other places and ${concepts.length} to the concepts it is made of. Press a place to bring it to the centre and see what it holds in turn; press the centre to go there.</p>
    <div class="weave-inline">
      <canvas class="weave-stage" role="img" aria-label="The weave around this page, drawn in the hyperbolic plane. The same places follow as buttons."></canvas>
      <div class="weave-panel compact">${panelMarkup("weave-here", 3)}
        <p><button class="btn small" type="button" data-w="expand">Open the whole weave</button></p>
      </div>
    </div>`;
  main.append(nav);
  const canvas = nav.querySelector("canvas");
  const panel = nav.querySelector(".weave-panel");
  const view = new WeaveView(canvas, {
    focus: HERE,
    mode: "inline",
    onFocus: (id) => fillPanel(panel, id, view, { onGo: (u) => goInline(u) }),
    onGo: (id, point) => goInline(id, point),
  });
  const goInline = (id, point) => {
    const r = canvas.getBoundingClientRect();
    const s = view.screen.get(id);
    const pt = point ? { x: point.x + r.left, y: point.y + r.top } : s ? { x: s.x + r.left, y: s.y + r.top } : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    if (id !== view.focus) view.setFocus(id);
    if (!urlOf(G.byId.get(id)) || id === HERE) return;
    ripple(pt.x, pt.y, 1);
    view.startDive(id, () => leaveFor(id, pt));
  };
  fillPanel(panel, HERE, view, { onGo: (u) => goInline(u) });
  nav.querySelector('[data-w="expand"]').addEventListener("click", () => {
    const r = canvas.getBoundingClientRect();
    const s = view.screen.get(view.focus);
    openWeave(view.focus, { origin: s ? { x: r.left + s.x, y: r.top + s.y } : null, r0: s ? s.r : 14 });
  });
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

// Coming back to a page from the history cache: undo the dive that left it.
window.addEventListener("pageshow", (ev) => {
  if (!ev.persisted) return;
  for (const v of VIEWS) { v.dive = null; v.bloom = null; v.invalidate(); }
  if (dialog?.open) dialog.close();
});

try {
  initNav();
  initInline();
  // A link to #weave opens it, so the weave can be shared.
  if (location.hash === "#weave") openWeave(HERE || "home");
} catch (e) { console.error("weave failed to start", e); }

export const weave = { open: openWeave, close: closeWeave, here: HERE, graph: G };
