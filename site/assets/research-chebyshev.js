// Live figures for site/research/chebyshev.html: Project Asma's Chebyshev
// identifiability explorer, rebuilt on the loom. Every figure computes the
// original's mathematics (chebyshev-math.js) in the browser and prints the
// numbers it draws. One design (p_L, p_H, α) and one noise half-width ε are
// shared by all three movements. Nothing here is random or illustrative.

import { scene } from "./loom.js";
import {
  EPS_BENCH, PIVOT_P, PIVOT_Q, WORLDS, PRESETS, DEFAULT_PRESET,
  withBleed, reading, readings, ceilings, pairs, blindSpot, verdicts,
  alphaSweep, intervalsBelow, exactCeilings, fromDecimal, shortFraction, Q, REPORTED,
} from "./chebyshev-math.js";

const $ = (sel, el = document) => el.querySelector(sel);
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v) => clamp(v, 0, 1);
const smooth = (u) => { const x = clamp01(u); return x * x * (3 - 2 * x); };
const mono = (px) => `${px}px ui-monospace, "SF Mono", Menlo, monospace`;
const minus = (s) => s.replace(/-/g, "−");
const fx = (v, d = 5) => (Number.isFinite(v) ? minus(v.toFixed(d)) : "—");
const sx = (v, d = 5) => (Number.isFinite(v) ? (v >= 0 ? "+" : "") + fx(v, d) : "—");
/** Five decimals, or seven when a ceiling has all but vanished (the trap). */
const fe = (v) => fx(v, v !== 0 && Math.abs(v) < 5e-4 ? 7 : 5);
/** An exact value as "n/d = 0.01234" when the fraction is short, else just the decimal. */
const exact = (q, d = 5, signed = false) => {
  const v = Q.num(q), f = shortFraction(q, 15);
  const dd = v !== 0 && Math.abs(v) < 5e-4 ? 7 : d;
  const dec = signed ? sx(v, dd) : fx(v, dd);
  return f && f.includes("/") ? `${minus(f)} = ${dec}` : dec;
};
const pressable = (buttons, onPick) => {
  for (const b of buttons) b.addEventListener("click", () => {
    for (const o of buttons) o.setAttribute("aria-pressed", o === b ? "true" : "false");
    onPick(b);
  });
};
/**
 * Throttle text updates so numbers stay readable and screen readers calm.
 * Numbers here change only on input, so a throttled write is flushed once the
 * hand stops: the last value always lands.
 */
function writer(el, every = 120) {
  let last = 0, pending = "", timer = 0;
  const flush = () => { timer = 0; last = performance.now(); if (el.textContent !== pending) el.textContent = pending; };
  return (text, force = false) => {
    pending = text;
    if (!el) return;
    const now = performance.now();
    if (force || now - last >= every) { clearTimeout(timer); flush(); }
    else if (!timer) timer = setTimeout(flush, every - (now - last));
  };
}

/* ================================================================== */
/* One shared design                                                    */
/* ================================================================== */

// Voices: S the crest, C25 the trough, C50 and C75 two more; collisions take the node.
const VOICE = [0, 1, 3, 4];
const NAME = ["S + α", "C25", "C50", "C75"];
const SHORT = ["S", "C25", "C50", "C75"];

const first = PRESETS.find((p) => p.id === DEFAULT_PRESET);
const state = { pL: first.pL, pH: first.pH, alpha: first.alpha, eps: EPS_BENCH, preset: first.id };
const design = () => ({ pL: Number(state.pL), pH: Number(state.pH), alpha: Number(state.alpha) });
const handles = [];
const listeners = [];
function changed() {
  for (const fn of listeners) fn();
  for (const h of handles) h.invalidate();
}

/** Displayed design: eases toward the chosen one, so a change is seen to move. */
function follower() {
  const cur = design();
  return (dt, still) => {
    const tgt = design();
    let moving = false;
    for (const k of ["pL", "pH", "alpha"]) {
      const d = tgt[k] - cur[k];
      if (still || Math.abs(d) < 1e-6) cur[k] = tgt[k];
      else { cur[k] += d * Math.min(1, dt * 7); moving = true; }
    }
    return { ...cur, moving };
  };
}

function initControls() {
  const inPL = $("#in-pl"), inPH = $("#in-ph"), inEps = $("#in-eps"), inA = $("#in-alpha");
  const outPL = $("#out-pl"), outPH = $("#out-ph"), outEps = $("#out-eps"), outA = $("#out-alpha");
  const presetButtons = [...document.querySelectorAll("[data-preset]")];
  const bench = $("#eps-bench");
  const paint = () => {
    if (outPL) outPL.textContent = Number(state.pL).toFixed(3);
    if (outPH) outPH.textContent = Number(state.pH).toFixed(3);
    if (outA) outA.textContent = `${(Number(state.alpha) * 100).toFixed(1)}%`;
    if (outEps) outEps.textContent = state.eps === EPS_BENCH ? "1/60" : state.eps.toFixed(4);
    bench?.setAttribute("aria-pressed", state.eps === EPS_BENCH ? "true" : "false");
    for (const b of presetButtons) b.setAttribute("aria-pressed", b.dataset.preset === state.preset ? "true" : "false");
  };
  const toInputs = () => {
    if (inPL) inPL.value = state.pL;
    if (inPH) inPH.value = state.pH;
    if (inA) inA.value = state.alpha;
  };
  pressable(presetButtons, (b) => {
    const p = PRESETS.find((x) => x.id === b.dataset.preset);
    if (!p) return;
    Object.assign(state, { pL: p.pL, pH: p.pH, alpha: p.alpha, preset: p.id });
    toInputs(); changed();
  });
  // Slider values are read as the decimal strings they are, so the exact arithmetic sees 3/8, not 0.37500000000000006.
  const fix = (v, d) => Number(v).toFixed(d);
  inPL?.addEventListener("input", () => { state.pL = fix(inPL.value, 3); state.preset = null; changed(); });
  inPH?.addEventListener("input", () => { state.pH = fix(inPH.value, 3); state.preset = null; changed(); });
  inA?.addEventListener("input", () => { state.alpha = fix(inA.value, 3); state.preset = null; changed(); });
  inEps?.addEventListener("input", () => { state.eps = Number(inEps.value); changed(); });
  bench?.addEventListener("click", () => { state.eps = EPS_BENCH; if (inEps) inEps.value = "0.0165"; changed(); });
  listeners.push(paint);
  toInputs(); paint();
  return { setAlpha(a) { state.alpha = fix(clamp(a, 0, 0.3), 3); state.preset = null; toInputs(); changed(); } };
}

/* ================================================================== */
/* I. Four worlds cross at one point                                    */
/* ================================================================== */

function initCurves() {
  const canvas = $("#curve-stage");
  const numbers = writer($("#curve-numbers"), 120);
  const describe = (force = false) => {
    const d = design(), rs = readings(d);
    const p = PRESETS.find((x) => x.id === state.preset);
    const pL = shortFraction(fromDecimal(state.pL)), pH = shortFraction(fromDecimal(state.pH));
    const row = (i) => {
      const w = WORLDS[i], r = rs[i];
      return `${NAME[i].padEnd(7)} ${String(w.r).padStart(3)}  ${(w.cd === 1 ? "0" : `${w.cn}/${w.cd}`).padStart(4)}    ${fx(r.L)}   ${fx(r.H)}   ${fx(r.pivot)}`;
    };
    numbers([
      `q(p; r, c) = (r·p + c·(1 − p)) / (r·p + 1 − p)        S + α:  y(p) = (1 − α)·q(p; 16, 0) + α`,
      ``,
      `${"world".padEnd(7)} ${"r".padStart(3)}  ${"c".padStart(4)}    ${"y(p_L)".padStart(7)}   ${"y(p_H)".padStart(7)}   ${"y(1/5)".padStart(7)}`,
      ...WORLDS.map((_, i) => row(i)),
      ``,
      `r = 16 − 20c in every world, so q(1/5; r, c) = (r + 4c) / (r + 4) = 4/5 exactly;  S + α reads 4/5 + α/5 there`,
      `p_L = ${state.pL}${pL ? ` = ${pL}` : ""}   p_H = ${state.pH}${pH ? ` = ${pH}` : ""}   α = ${state.alpha}   ${p ? `design: ${p.label}` : "design: your own"}`,
      ...(p?.id === "deep" ? [`the label says 3/7 = 0.42857; the original's slider sets p_H = 0.430, kept here`] : []),
    ].join("\n"), force);
  };
  listeners.push(() => describe());
  describe(true);
  if (!canvas) return;
  const follow = follower();
  handles.push(scene(canvas, {
    frame(ctx, { t, dt, w, h, pal, reduced: still }) {
      const v = follow(dt, still);
      ctx.clearRect(0, 0, w, h);
      const narrow = w < 560;
      const L = narrow ? 44 : 60, R = w - (narrow ? 34 : 44), T = 20, B = h - 40;
      const X = (p) => L + p * (R - L), Y = (q) => B - q * (B - T);
      ctx.lineWidth = 1; ctx.font = mono(10);
      // Grid where the original drew it, labelled on the right.
      ctx.strokeStyle = pal.line; ctx.setLineDash([2, 4]);
      for (const q of [0.25, 0.5, 0.8, 1]) { ctx.beginPath(); ctx.moveTo(L, Y(q)); ctx.lineTo(R, Y(q)); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.fillStyle = pal.muted; ctx.textAlign = "left";
      for (const q of [0.25, 0.5, 0.8, 1]) ctx.fillText(q.toFixed(2), R + 6, Y(q) + 3);
      ctx.strokeStyle = pal.line;
      ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, B); ctx.lineTo(R, B); ctx.stroke();
      ctx.textAlign = "center";
      if (X(v.pL) - X(0) > 26) ctx.fillText("0", X(0), B + 14);
      ctx.fillText("1", X(1), B + 14);
      ctx.fillText("sample target proportion p", (L + R) / 2, B + 32);
      // The pivot.
      ctx.strokeStyle = pal.line; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(X(PIVOT_P), T); ctx.lineTo(X(PIVOT_P), B); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = pal.muted; ctx.fillText("pivot p = 1/5", X(PIVOT_P), T - 7);
      // The curves, each swept in from p = 0.
      const order = [3, 2, 1, 0];
      const reach = [];
      order.forEach((i, k) => {
        const u = still ? 1 : smooth((t - 0.15 * k) / 1.7);
        reach[i] = u;
        if (u <= 0) return;
        const wd = WORLDS[i];
        ctx.strokeStyle = pal.voice(VOICE[i], 0.95); ctx.lineWidth = i === 0 ? 2.4 : i === 1 ? 2.1 : 1.7;
        ctx.beginPath();
        const N = 260;
        for (let s = 0; s <= N; s += 1) {
          // Sample densely near p = 0, where the curves climb fastest.
          const p = u * (s / N) ** 1.6;
          const y = reading(wd, p, v.alpha);
          if (s === 0) ctx.moveTo(X(p), Y(y)); else ctx.lineTo(X(p), Y(y));
        }
        ctx.stroke();
      });
      // World names where each curve starts: q(0) = c, or α for S.
      const starts = WORLDS.map((wd, i) => ({ i, y: Y(wd.bleeds ? withBleed(0, v.alpha) : wd.c) }));
      starts.sort((a, b) => b.y - a.y);
      for (let k = 1; k < starts.length; k += 1) if (starts[k - 1].y - starts[k].y < 12) starts[k].y = starts[k - 1].y - 12;
      ctx.textAlign = "right"; ctx.font = mono(11);
      for (const s of starts) { ctx.fillStyle = pal.voice(VOICE[s.i], Math.min(1, reach[s.i] * 3)); ctx.fillText(SHORT[s.i], L - 7, s.y + 4); }
      // The two readings.
      ctx.font = mono(10); ctx.textAlign = "center";
      for (const [p, label] of [[v.pL, "p_L"], [v.pH, "p_H"]]) {
        ctx.strokeStyle = pal.ink2; ctx.globalAlpha = 0.7; ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(X(p), T); ctx.lineTo(X(p), B); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        ctx.fillStyle = pal.ink; ctx.fillText(label, X(p), B + 14);
        WORLDS.forEach((wd, i) => {
          if (reach[i] < p) return;
          ctx.fillStyle = pal.voice(VOICE[i], 1);
          ctx.beginPath(); ctx.arc(X(p), Y(reading(wd, p, v.alpha)), i < 2 ? 4.2 : 3, 0, TAU); ctx.fill();
        });
      }
      // The pivot point every pure world passes through, and S's bleed off it.
      if (reach[3] >= PIVOT_P) {
        ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(X(PIVOT_P), Y(PIVOT_Q), 5, 0, TAU); ctx.stroke();
      }
      if (reach[0] >= PIVOT_P && v.alpha > 0.0005) {
        const yS = reading(WORLDS[0], PIVOT_P, v.alpha);
        ctx.strokeStyle = pal.node(0.95); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(X(PIVOT_P) + 9, Y(PIVOT_Q)); ctx.lineTo(X(PIVOT_P) + 9, Y(yS)); ctx.stroke();
        ctx.fillStyle = pal.voice(VOICE[0], 1);
        ctx.beginPath(); ctx.arc(X(PIVOT_P), Y(yS), 3.4, 0, TAU); ctx.fill();
        ctx.fillStyle = pal.node(1); ctx.textAlign = "left";
        // Below 4/5 and right of the pivot no curve passes, so the label sits there.
        ctx.fillText(`S + α: 4/5 + α/5 = ${fx(yS, 4)}`, X(PIVOT_P) + 14, Y(PIVOT_Q) + 15);
      }
      ctx.textAlign = "start";
    },
  }));
}

/* ================================================================== */
/* II. Two readings, one box each                                       */
/* ================================================================== */

const pairName = (p) => `${p.a}·${p.b}`;

function initBoxes() {
  const canvas = $("#box-stage");
  const numbers = writer($("#box-numbers"), 120);
  const describe = (force = false) => {
    const d = design(), c = ceilings(d), ex = exactCeilings(state.pL, state.pH, state.alpha), vd = verdicts(c, d.alpha);
    const ps = pairs(d), eps = state.eps;
    const min1 = ps.reduce((m, p) => (p.slope < m.slope ? p : m)), min2 = ps.reduce((m, p) => (p.linf < m.linf ? p : m));
    const at = (p) => `${p.linf >= eps ? "apart" : "touch"} in 2D, ${p.slope >= eps ? "apart" : "touch"} on the slope`;
    const isDefault = state.pL === "0.050" && state.pH === "0.375" && Number(state.alpha) === 0;
    numbers([
      `gap g(p) = y_S+α(p) − q_C25(p)        g(p_L) = ${exact(ex.gapL, 5, true)}        g(p_H) = ${exact(ex.gapH, 5, true)}`,
      `slope (1D)   ε*_Δ = |g(p_H) − g(p_L)| / 4         = ${exact(ex.slope)}    ${vd.slope}`,
      `L∞ (2D)      ε*_∞ = max(|g(p_L)|, |g(p_H)|) / 2   = ${exact(ex.linf)}    ${vd.linf}`,
      ...(isDefault ? [`reported     ε*_∞ = ${REPORTED.epsLinf} against ε*_Δ = ${REPORTED.epsSlope}, ${REPORTED.lift} (archive note); recomputed above: ${Q.eq(ex.linf, REPORTED.epsLinf) && Q.eq(ex.slope, REPORTED.epsSlope) && `${Q.num(ex.ratio).toFixed(2)}x` === REPORTED.lift ? "they match" : "they DIFFER"}`] : []),
      ``,
      `noise box ε = ${eps === EPS_BENCH ? "1/60 = 0.01667 (the original's benchmark)" : fx(eps, 4)}`,
      `pair       ε*_∞ (2D)   ε*_Δ (slope)   at this ε`,
      ...ps.map((p) => `${pairName(p).padEnd(9)}  ${fe(p.linf).padEnd(9)}   ${fe(p.slope).padEnd(9)}      ${at(p)}`),
      `all four worlds stay apart in 2D while ε < ${fe(min2.linf)} (${pairName(min2)}), on the slope while ε < ${fe(min1.slope)} (${pairName(min1)})`,
    ].join("\n"), force);
  };
  listeners.push(() => describe());
  describe(true);
  if (!canvas) return;
  const follow = follower();
  let view = null, epsD = 0;
  handles.push(scene(canvas, {
    frame(ctx, { t, dt, w, h, pal, reduced: still }) {
      const v = follow(dt, still);
      const target = state.eps * (still ? 1 : smooth((t - 0.3) / 2.6));
      epsD = still ? target : epsD + (target - epsD) * Math.min(1, dt * 8);
      const eps = epsD;
      const rs = readings(v), ps = pairs(v);
      ctx.clearRect(0, 0, w, h);
      const narrow = w < 560;
      const L = narrow ? 40 : 56, R = w - 14;
      const planeB = Math.round(h * 0.56), rowsT = planeB + 30, rowsB = h - 66, rulerY = h - 22;
      // ---- The plane of the two readings, equal scale so each box is square.
      const pT = 16, pB = planeB - 20;
      const m = Math.max(state.eps, eps) + 0.012;
      const xs = rs.map((r) => r.L), ys = rs.map((r) => r.H);
      let x0 = Math.min(...xs) - m, x1 = Math.max(...xs) + m, y0 = Math.min(...ys) - m, y1 = Math.max(...ys) + m;
      const s = Math.min((R - L) / (x1 - x0), (pB - pT) / (y1 - y0));
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = (R - L) / s / 2, hy = (pB - pT) / s / 2;
      const want = { x0: cx - hx, x1: cx + hx, y0: cy - hy, y1: cy + hy };
      if (!view || still) view = { ...want };
      else for (const k of ["x0", "x1", "y0", "y1"]) view[k] += (want[k] - view[k]) * Math.min(1, dt * 5);
      const sc = (R - L) / (view.x1 - view.x0);
      const PX = (u) => L + (u - view.x0) * sc, PY = (q) => pB - (q - view.y0) * sc;
      // Ticks.
      const span = view.x1 - view.x0;
      const step = [0.01, 0.02, 0.05, 0.1, 0.2].find((st) => span / st <= (narrow ? 5 : 9)) || 0.2;
      ctx.font = mono(10); ctx.fillStyle = pal.muted; ctx.strokeStyle = pal.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L, pT); ctx.lineTo(L, pB); ctx.lineTo(R, pB); ctx.stroke();
      ctx.textAlign = "center";
      for (let u = Math.ceil(view.x0 / step) * step; u <= view.x1 + 1e-9; u += step) { ctx.fillText(u.toFixed(2), PX(u), pB + 13); ctx.beginPath(); ctx.moveTo(PX(u), pB); ctx.lineTo(PX(u), pB + 3); ctx.stroke(); }
      ctx.textAlign = "right";
      const ystep = [0.01, 0.02, 0.05, 0.1, 0.2].find((st) => (view.y1 - view.y0) / st <= 4) || 0.2;
      for (let q = Math.ceil(view.y0 / ystep) * ystep; q <= view.y1 + 1e-9; q += ystep) { if (PY(q) < pT + 10) continue; ctx.fillText(q.toFixed(2), L - 6, PY(q) + 3); }
      ctx.textAlign = "left";
      ctx.fillText("y(p_H)", L + 4, pT + 2);
      ctx.textAlign = "right"; ctx.fillText("y(p_L) →", R, pB - 6);
      ctx.save();
      ctx.beginPath(); ctx.rect(L, pT - 6, R - L, pB - pT + 6); ctx.clip();
      // Iso-slope diagonals: worlds on one diagonal share a slope.
      ctx.setLineDash([3, 5]); ctx.lineWidth = 1;
      rs.forEach((r, i) => {
        ctx.strokeStyle = pal.voice(VOICE[i], 0.32);
        ctx.beginPath(); ctx.moveTo(PX(view.x0), PY(view.x0 + r.contrast)); ctx.lineTo(PX(view.x1), PY(view.x1 + r.contrast)); ctx.stroke();
      });
      ctx.setLineDash([]);
      // Collisions first, so the boxes draw over them.
      for (const p of ps) {
        const a = rs[WORLDS.findIndex((wd) => wd.id === p.a)], b = rs[WORLDS.findIndex((wd) => wd.id === p.b)];
        const ix0 = Math.max(a.L, b.L) - eps, ix1 = Math.min(a.L, b.L) + eps, iy0 = Math.max(a.H, b.H) - eps, iy1 = Math.min(a.H, b.H) + eps;
        if (ix1 > ix0 && iy1 > iy0) { ctx.fillStyle = pal.node(0.55); ctx.fillRect(PX(ix0), PY(iy1), (ix1 - ix0) * sc, (iy1 - iy0) * sc); }
      }
      rs.forEach((r, i) => {
        const half = eps * sc;
        ctx.fillStyle = pal.voice(VOICE[i], 0.08); ctx.fillRect(PX(r.L) - half, PY(r.H) - half, half * 2, half * 2);
        ctx.strokeStyle = pal.voice(VOICE[i], 0.9); ctx.lineWidth = 1.3; ctx.strokeRect(PX(r.L) - half, PY(r.H) - half, half * 2, half * 2);
        ctx.fillStyle = pal.voice(VOICE[i], 1); ctx.beginPath(); ctx.arc(PX(r.L), PY(r.H), 3.4, 0, TAU); ctx.fill();
      });
      ctx.restore();
      ctx.font = mono(11); ctx.textAlign = "center";
      rs.forEach((r, i) => {
        const half = eps * sc;
        const up = i % 2 === 0;
        ctx.fillStyle = pal.voice(VOICE[i], 1);
        ctx.fillText(SHORT[i], PX(r.L), up ? Math.max(pT + 2, PY(r.H) - half - 6) : Math.min(pB - 4, PY(r.H) + half + 14));
      });
      // ---- The same worlds on the slope axis: one number each, ±2ε.
      const cs = rs.map((r) => r.contrast);
      const dm = 2 * Math.max(state.eps, eps) + 0.015;
      const c0 = Math.min(...cs) - dm, c1 = Math.max(...cs) + dm;
      const CX = (c) => L + ((c - c0) / (c1 - c0)) * (R - L);
      const rowH = (rowsB - rowsT) / 4, RY = (i) => rowsT + rowH * (i + 0.5);
      for (const p of ps) {
        const i = WORLDS.findIndex((wd) => wd.id === p.a), j = WORLDS.findIndex((wd) => wd.id === p.b);
        const lo = Math.max(cs[i], cs[j]) - 2 * eps, hi = Math.min(cs[i], cs[j]) + 2 * eps;
        if (hi > lo) { ctx.fillStyle = pal.node(0.4); ctx.fillRect(CX(lo), RY(i) - 4, CX(hi) - CX(lo), RY(j) - RY(i) + 8); }
      }
      ctx.font = mono(11); ctx.textAlign = "right";
      rs.forEach((r, i) => {
        const y = RY(i);
        ctx.strokeStyle = pal.voice(VOICE[i], 0.85); ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(CX(r.contrast - 2 * eps), y); ctx.lineTo(CX(r.contrast + 2 * eps), y); ctx.stroke();
        ctx.lineCap = "butt";
        ctx.fillStyle = pal.voice(VOICE[i], 1); ctx.beginPath(); ctx.arc(CX(r.contrast), y, 3.4, 0, TAU); ctx.fill();
        ctx.fillText(SHORT[i], L - 6, y + 4);
      });
      ctx.font = mono(10); ctx.fillStyle = pal.muted; ctx.strokeStyle = pal.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L, rowsB + 2); ctx.lineTo(R, rowsB + 2); ctx.stroke();
      const cstep = [0.02, 0.05, 0.1, 0.2].find((st) => (c1 - c0) / st <= (narrow ? 5 : 9)) || 0.2;
      ctx.textAlign = "center";
      for (let c = Math.ceil(c0 / cstep) * cstep; c <= c1 + 1e-9; c += cstep) ctx.fillText(c.toFixed(2), CX(c), rowsB + 14);
      ctx.textAlign = "left"; ctx.fillText("slope Δ = y(p_H) − y(p_L), each ± 2ε", L, rowsT - 10);
      // ---- The ε ruler: where this ε sits against the two ceilings for all four worlds.
      const min1 = Math.min(...ps.map((p) => p.slope)), min2 = Math.min(...ps.map((p) => p.linf));
      const eMax = Math.max(0.07, min2 * 1.15, state.eps * 1.1);
      const EX = (e) => L + (e / eMax) * (R - L);
      ctx.strokeStyle = pal.line; ctx.beginPath(); ctx.moveTo(L, rulerY); ctx.lineTo(R, rulerY); ctx.stroke();
      ctx.fillStyle = pal.muted; ctx.textAlign = "right"; ctx.fillText("ε", L - 6, rulerY + 4);
      // Ticks for the benchmark and both ceilings; labels take the lane above or below, whichever is free.
      const marks = [
        { e: EPS_BENCH, label: "1/60", color: pal.muted, lanes: [1, 0] },
        { e: min1, label: `slope ${fe(min1)}`, color: pal.voice(VOICE[1], 1), lanes: [0, 1] },
        { e: min2, label: `2D ${fe(min2)}`, color: pal.voice(VOICE[0], 1), lanes: [0, 1] },
      ].sort((a, b) => a.e - b.e);
      const laneEnd = [-Infinity, -Infinity];
      ctx.textAlign = "center";
      for (const mk of marks) {
        const tw = ctx.measureText(mk.label).width;
        const x = clamp(EX(mk.e), L + tw / 2, R - tw / 2);
        const lane = mk.lanes.find((ln) => x - tw / 2 > laneEnd[ln] + 6) ?? mk.lanes[0];
        laneEnd[lane] = x + tw / 2;
        ctx.strokeStyle = mk.color; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(EX(mk.e), rulerY - 5); ctx.lineTo(EX(mk.e), rulerY + 5); ctx.stroke();
        ctx.fillStyle = mk.color; ctx.fillText(mk.label, x, lane ? rulerY + 16 : rulerY - 9);
      }
      ctx.fillStyle = pal.ink; ctx.beginPath(); ctx.arc(EX(eps), rulerY, 4, 0, TAU); ctx.fill();
      ctx.textAlign = "start";
    },
  }));
}

/* ================================================================== */
/* III. Bleed, the trap, and the pivot                                  */
/* ================================================================== */

function initBleed(controls) {
  const canvas = $("#bleed-stage");
  const numbers = writer($("#bleed-numbers"), 120);
  const describe = (force = false) => {
    const d = design(), c = ceilings(d), vd = verdicts(c, d.alpha), ex = exactCeilings(state.pL, state.pH, state.alpha);
    const sw = alphaSweep(d.pL, d.pH, 1200, 0.3);
    const span = (iv) => (iv.length ? iv.map(([a, b]) => `[${a.toFixed(4)}, ${b.toFixed(4)}]`).join(" ") : "none");
    const star = ex.alphaStar && Q.num(ex.alphaStar) >= 0 && Q.num(ex.alphaStar) <= 1 ? ex.alphaStar : null;
    numbers([
      `y_S+α(p) = (1 − α)·q(p; 16, 0) + α        α = ${state.alpha} (${(d.alpha * 100).toFixed(1)}%)`,
      star
        ? `slope blind spot   (1 − α*)·Δ_S = Δ_C25   ⇒   α* = 1 − Δ_C25 / Δ_S = ${exact(star)}${state.pL === "0.050" && state.pH === "0.375" ? "   (the trap preset's 0.161 rounds it)" : ""}`
        : `slope blind spot   none for α in [0, 1] on this design`,
      `at this α          ε*_Δ = ${fe(c.epsSlope).padEnd(9)}   ${vd.slope}`,
      `                   ε*_∞ = ${fe(c.epsLinf).padEnd(9)}   ${vd.linf}`,
      `pivot              y_S+α(1/5) − 4/5 = α/5 = ${exact(ex.pivotOffset, 5, true)}   ${vd.pivot}`,
      `pivot as a third reading (this page's arithmetic, same box rule, not in the original):`,
      `                   ε*_∞,3 = max(|g(p_L)|, |g(p_H)|, α/5) / 2 = ${fx(c.linf3)} (${c.linf3 >= EPS_BENCH ? "clears 1/60" : "sub-1/60"})`,
      `below 1/60 for α in   slope ${span(intervalsBelow(sw.alpha, sw.slope, EPS_BENCH))}   L∞ ${span(intervalsBelow(sw.alpha, sw.linf, EPS_BENCH))}   L∞ + pivot ${span(intervalsBelow(sw.alpha, sw.linf3, EPS_BENCH))}`,
    ].join("\n"), force);
  };
  listeners.push(() => describe());
  describe(true);
  if (!canvas) return;
  const follow = follower();
  let key = "", sw = null, top = 0.05;
  let geo = null;
  const toAlpha = (ev) => {
    if (!geo) return;
    const r = canvas.getBoundingClientRect();
    controls.setAlpha(Math.round(clamp01((ev.clientX - r.left - geo.L) / (geo.R - geo.L)) * 0.3 * 1000) / 1000);
  };
  let down = false;
  canvas.addEventListener("pointerdown", (ev) => { down = true; canvas.setPointerCapture?.(ev.pointerId); toAlpha(ev); });
  canvas.addEventListener("pointermove", (ev) => { if (down) toAlpha(ev); });
  const up = () => { down = false; };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  handles.push(scene(canvas, {
    frame(ctx, { t, dt, w, h, pal, reduced: still }) {
      const v = follow(dt, still);
      const k = `${v.pL.toFixed(5)}|${v.pH.toFixed(5)}`;
      if (k !== key) {
        key = k; sw = alphaSweep(v.pL, v.pH, 300, 0.3);
        const want = Math.max(EPS_BENCH * 1.5, ...sw.linf, ...sw.linf3) * 1.08;
        top = still || !top ? want : top;
        geo = null;
      }
      const want = Math.max(EPS_BENCH * 1.5, ...sw.linf, ...sw.linf3) * 1.08;
      top = still ? want : top + (want - top) * Math.min(1, dt * 5);
      ctx.clearRect(0, 0, w, h);
      const narrow = w < 560;
      const L = narrow ? 48 : 60, R = w - (narrow ? 70 : 128), T = 22, B = h - 36;
      geo = { L, R };
      const X = (a) => L + (a / 0.3) * (R - L), Y = (e) => B - (e / top) * (B - T);
      ctx.font = mono(10); ctx.lineWidth = 1; ctx.strokeStyle = pal.line; ctx.fillStyle = pal.muted;
      ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, B); ctx.lineTo(R, B); ctx.stroke();
      ctx.textAlign = "center";
      for (let a = 0; a <= 0.3001; a += 0.05) ctx.fillText(a.toFixed(2), X(a), B + 14);
      ctx.fillText("paralog bleed α", (L + R) / 2, B + 30);
      ctx.textAlign = "right";
      const ystep = top > 0.12 ? 0.04 : top > 0.06 ? 0.02 : 0.01;
      for (let e = ystep; e <= top; e += ystep) ctx.fillText(e.toFixed(2), L - 6, Y(e) + 3);
      ctx.textAlign = "left"; ctx.fillText("ε ceiling", L + 4, T - 8);
      // The benchmark.
      ctx.strokeStyle = pal.muted; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(L, Y(EPS_BENCH)); ctx.lineTo(R, Y(EPS_BENCH)); ctx.stroke(); ctx.setLineDash([]);
      // The trap.
      const star = blindSpot(v.pL, v.pH);
      // Sweep α in from zero.
      const u = still ? 1 : smooth((t - 0.2) / 2.2);
      const n = Math.round(u * (sw.alpha.length - 1));
      const curves = [
        { ys: sw.linf3, color: pal.node(0.95), width: 1.6, dash: [5, 4], label: "L∞ + pivot" },
        { ys: sw.slope, color: pal.voice(VOICE[1], 0.95), width: 2, dash: [], label: "slope" },
        { ys: sw.linf, color: pal.voice(VOICE[0], 0.95), width: 2.4, dash: [], label: "L∞" },
      ];
      for (const c of curves) {
        ctx.strokeStyle = c.color; ctx.lineWidth = c.width; ctx.setLineDash(c.dash);
        ctx.beginPath();
        for (let i = 0; i <= n; i += 1) { const x = X(sw.alpha[i]), y = Y(c.ys[i]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke(); ctx.setLineDash([]);
      }
      // Labels at the end of each drawn curve, pushed apart.
      const tags = [...curves.map((c) => ({ label: c.label, color: c.color, y: Y(c.ys[n]) })), { label: "1/60", color: pal.muted, y: Y(EPS_BENCH), x: R }].sort((a, b) => a.y - b.y);
      for (let i = 1; i < tags.length; i += 1) if (tags[i].y - tags[i - 1].y < 12) tags[i].y = tags[i - 1].y + 12;
      ctx.font = mono(10); ctx.textAlign = "left";
      for (const tg of tags) {
        if (tg.x == null && u <= 0.05) continue;
        ctx.fillStyle = tg.color; ctx.fillText(tg.label, (tg.x ?? X(sw.alpha[n])) + 6, tg.y + 3);
      }
      if (star != null && star <= 0.3 && sw.alpha[n] >= star) {
        ctx.strokeStyle = pal.voice(VOICE[1], 0.7); ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(X(star), T); ctx.lineTo(X(star), B); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = pal.voice(VOICE[1], 1); ctx.textAlign = "center";
        ctx.fillText(`α* ${star.toFixed(4)}`, clamp(X(star), L + 30, R - 30), T - 8);
      }
      // This α: where each ceiling stands.
      const c = ceilings(v);
      ctx.strokeStyle = pal.ink; ctx.globalAlpha = 0.55; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(v.alpha), T + 4); ctx.lineTo(X(v.alpha), B); ctx.stroke(); ctx.globalAlpha = 1;
      if (sw.alpha[n] >= v.alpha) {
        for (const [e, col] of [[c.linf3, pal.node(1)], [c.epsSlope, pal.voice(VOICE[1], 1)], [c.epsLinf, pal.voice(VOICE[0], 1)]]) {
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(v.alpha), Y(e), 3.6, 0, TAU); ctx.fill();
        }
      }
      ctx.textAlign = "start";
    },
  }));
}

/* ================================================================== */

const controls = initControls();
initCurves();
initBoxes();
initBleed(controls);
