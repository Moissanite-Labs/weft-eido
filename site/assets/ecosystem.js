// The home page. Three movements share the loom's medium:
//   1. The medium's own equation, printed live under the title.
//   2. Superposition: two waves in a ratio you choose, drawn as the figure they make.
//   3. The map: every line of work is a wave source, and the map is the
//      interference pattern they make together (site/assets/field-math.js).
// Every visual value is a function of one state vector, printed live.
// One channel, one quantity:
//   hue             <- circular mean of preset hues by barycentric weights
//   source amplitude <- stated place weight
//   frequency       <- family: related work shares one, so its fringes stand still
//   reach           <- state: on main, open, blocked
//   phase jitter    <- restlessness (reading weave score)
//   thread width    <- tension = clamp01(0.55 * rest + 0.45 * jerk)
//   halo softness   <- mixer rounding
//   wavelength      <- mixer density (CSS spacing follows it too)
//   wash strength   <- mixer contrast
//   map aspect      <- viewport aspect, projected by ResizeObserver
//   wave time       <- Flow (never touches hue)
// No network requests. Sources are links to standalone pages.

import { packLabel } from "../../src/glyph-font.js";
import { mixAestheticPresets } from "../../src/aesthetic-mixer.js";
import { mountSimplexPad } from "../../src/simplex-pad.js";
import { setupReadingWeave } from "../../src/reading-weave.js";
import { scene, setHue, somatic, mediumState, onFrame, ripple, reduced } from "./loom.js";
import { nearestRatio, intervalName, cents, TAU } from "./harmonic-math.js";
import { settle, sources, prepareGrid, sampleGrid, isolines, nearestSource, beatPeriod, FAMILIES, FIELD } from "./field-math.js";

const $ = (sel, el = document) => el.querySelector(sel);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v) => clamp(v, 0, 1);
const smooth = (u) => { const x = clamp01(u); return x * x * (3 - 2 * x); };

/* Inspectable bounds. Every state entry is clamped into [MIN, MAX]. */
export const BOUNDS = Object.freeze({ MIN: 0, MAX: 1, JERK_MAX: 0.09, SCROLL_MAX: 2.4, TENSION_REST: 0.55, TENSION_JERK: 0.45 });

const PRESETS = {
  calm: { rounding: 0.85, density: 0.3, hue: 0.5444, contrast: 0.05 },
  sharp: { rounding: 0.0, density: 0.1, hue: 0.2778, contrast: 0.01 },
  airy: { rounding: 1.0, density: 0.85, hue: 0.8111, contrast: 0.2 },
};
const PRESET_NAMES = Object.keys(PRESETS);

/* Where each line of work stands, read from GitHub on 17 November 2026.
   state: "main" (on the main branch), "open" (in review), "blocked". */
export const AS_OF = "17 November 2026";
export const PLACES = [
  { id: "style", code: "D1 STYL", name: "Style", href: "components/aesthetic-mixer.html", weight: 9, family: "modules", state: "main", status: "On main", how: "Its own page. The point below is the same control, and it turns the colour of every page." },
  { id: "reading", code: "D6 READ", name: "Reading", href: "components/reading-weave.html", weight: 9, family: "modules", state: "main", status: "On main", how: "Its own page. The weave itself runs on the text at the end of this page." },
  { id: "field", code: "GPU FLD", name: "Field", href: "https://github.com/Moissanite-Labs/weft-eido/pull/6", weight: 7, family: "rebuild", state: "blocked", status: "Pull request 6, open. Changes requested: the sign-off, API keys kept in clear text, and a third-party address lookup", how: "Opens the pull request. No code from it runs here." },
  { id: "explainer", code: "TOY MOD", name: "Explainer", href: "components/research-explainer.html", weight: 6, family: "research", state: "main", status: "On main since #19. Pull request 11 is still open", how: "Its own page, with the toy model at full strength." },
  { id: "archive", code: "5X7 BIT", name: "Archive", href: "components/glyph-font.html", weight: 5, family: "modules", state: "main", status: "On main", how: "Its own page. Every title on this site is first drawn from its bits." },
  { id: "simulations", code: "E08-E13", name: "Simulations", href: "research/index.html", weight: 6, family: "research", state: "main", status: "On main since #19, rebuilt on the loom. Pull request 14 is still open", how: "The substrate simulations, E13 and Project Asma, rebuilt as pages of this site. Their results are their authors' reports; the originals stay in the archive." },
  { id: "identifiability", code: "CHEB ID", name: "Identifiability", href: "research/chebyshev.html", weight: 5, family: "research", state: "main", status: "On main since #19, rebuilt on the loom. Pull request 15 is still open", how: "The Chebyshev identifiability explorer, rebuilt as a page of this site. The original stays in the archive." },
  { id: "harmonic", code: "CHORDS", name: "Harmonic", href: "causal-harmonic/index.html", weight: 6, family: "research", state: "main", status: "On main since #19, rebuilt in #20. Pull request 17 is still open", how: "Every figure there is computed live. Recorded pieces are CC BY-NC 4.0." },
];

export const RECORD = [
  ...PLACES.map((p) => ({ work: p.name, state: p.status, badge: p.state, how: p.how })),
  { work: "Condense panel noun (pull request 8)", state: "Draft, open", badge: "open", how: "Not included. It can land on its own." },
  { work: "Readme line (pull request 9)", state: "Changes requested on the sign-off only. The edit itself was called fine", badge: "blocked", how: "Not applied here. One sign-off fixes it." },
  { work: "Angles hub (pull request 18)", state: "Closed, superseded by #19", badge: "closed", how: "Replaced by the field. No code from pull request 6 is included." },
];

/* State vector. Derived entries are recomputed, never stored twice. */
const S = { w: [0.5, 0.25, 0.25], rest: 0, jerk: 0, scroll: 0, ratio: 1.5 };
let flowOn = !reduced();

function mixed() {
  return mixAestheticPresets(PRESETS, Object.fromEntries(PRESET_NAMES.map((n, i) => [n, S.w[i]])));
}
const tension = () => clamp01(BOUNDS.TENSION_REST * S.rest + BOUNDS.TENSION_JERK * S.jerk);

function applyVars() {
  const v = mixed();
  const root = document.documentElement.style;
  setHue(v.hue * 360);
  root.setProperty("--rounding", v.rounding.toFixed(4));
  root.setProperty("--density", v.density.toFixed(4));
  root.setProperty("--contrast", v.contrast.toFixed(4));
  root.setProperty("--rest", S.rest.toFixed(4));
  root.setProperty("--tension", tension().toFixed(4));
  return v;
}

function paintState() {
  const v = mixed();
  const el = $("#eco-state");
  if (!el) return;
  el.textContent =
    `w [${S.w.map((x) => x.toFixed(2)).join(", ")}]  Σ ${S.w.reduce((a, b) => a + b, 0).toFixed(2)}\n` +
    `hue ${(v.hue * 360).toFixed(0)}°  rounding ${v.rounding.toFixed(2)}  density ${v.density.toFixed(2)}  contrast ${v.contrast.toFixed(2)}\n` +
    `rest ${S.rest.toFixed(2)}  scroll ${S.scroll.toFixed(2)}  jerk ${S.jerk.toFixed(2)}  tension ${tension().toFixed(2)}  flow ${flowOn ? "on" : "off"}\n` +
    `every entry in [0, 1]`;
}

/* ---------- 1. The medium, written out ---------- */

function paintMedium() {
  const el = $("#medium-eq");
  if (!el) return;
  const m = mediumState();
  el.textContent =
    `y(x, t) = Σ aₙ · sin(nπx / W) · cos(2π·n·f₁·t + n·φᵢ)     n = 1 … ${m.amps.length}\n` +
    `f₁ = ${m.f1.toFixed(3)} Hz   t = ${m.t.toFixed(1)} s   ${m.threads} threads\n` +
    `a = ${m.amps.map((a) => a.toFixed(2)).join("  ")}`;
}

/* ---------- 2. Superposition ---------- */

function initSuperposition() {
  const canvas = $("#lissajous");
  const input = $("#ratio");
  const out = $("#ratio-out");
  const numbers = $("#lissajous-numbers");
  if (!canvas || !input) return;
  let T = 0;       // time in base cycles
  let delta = 0;   // phase drift, accumulated from detuning
  const setRatio = (r, fromPointer = false) => {
    S.ratio = clamp(r, 1, 2);
    input.value = S.ratio.toFixed(3);
    if (out) out.textContent = S.ratio.toFixed(3);
    if (fromPointer) handle.invalidate();
    paintRatio();
  };
  const paintRatio = () => {
    const near = nearestRatio(S.ratio, 16);
    const name = intervalName(near.p, near.q);
    const err = near.errorCents;
    const closes = Math.abs(err) < 0.5;
    if (numbers) numbers.textContent =
      `x(t) = sin(2π·t + δ)      y(t) = sin(2π·${S.ratio.toFixed(3)}·t)\n` +
      `r = ${S.ratio.toFixed(4)} ≈ ${near.p}/${near.q}${name ? ` (${name})` : ""}   ${cents(S.ratio).toFixed(2)} cents   off by ${err >= 0 ? "+" : ""}${err.toFixed(2)} cents\n` +
      (closes ? `closes after ${near.q} turns of x and ${near.p} of y` : `never quite closes: the figure turns at ${Math.abs(S.ratio - near.value).toFixed(4)} cycles per cycle, which you hear as beating`);
  };
  input.addEventListener("input", () => setRatio(Number(input.value)));
  canvas.addEventListener("pointermove", (ev) => {
    if (ev.buttons !== 1 && ev.pointerType !== "mouse") return;
    const r = canvas.getBoundingClientRect();
    setRatio(1 + clamp01((ev.clientX - r.left) / r.width), true);
  });
  canvas.addEventListener("pointerdown", (ev) => {
    const r = canvas.getBoundingClientRect();
    setRatio(1 + clamp01((ev.clientX - r.left) / r.width), true);
  });
  for (const b of document.querySelectorAll("[data-ratio]")) b.addEventListener("click", () => {
    const [p, q] = b.dataset.ratio.split("/").map(Number);
    setRatio(p / q, true);
  });

  const handle = scene(canvas, {
    frame(ctx, { t, dt, w, h, pal, reduced: still }) {
      ctx.clearRect(0, 0, w, h);
      const near = nearestRatio(S.ratio, 16);
      const detune = S.ratio - near.value;
      if (!still) { T += dt * 0.32; delta += dt * TAU * detune * 0.32; }
      const grow = still ? 1 : smooth(t / 1.6);
      const S0 = Math.min(h * 0.66, w * 0.46);
      const gap = Math.max(10, S0 * 0.08);
      const fx = Math.min(w - S0 - gap, Math.max(w * 0.5 - S0 * 0.3, gap * 3 + S0 * 0.35));
      const fy = Math.max(gap, (h - S0 - gap * 2) * 0.32);
      const cx = fx + S0 / 2, cy = fy + S0 / 2, R = (S0 / 2) * 0.94;
      const span = still ? near.q * 1 + 0.02 : 6;
      const steps = 900;
      const X = (s) => cx + R * Math.sin(TAU * s + delta);
      const Y = (s) => cy - R * Math.sin(TAU * S.ratio * s);
      // The figure.
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      const N = Math.floor(steps * grow);
      for (let k = 1; k < N; k += 1) {
        const s0 = T - span * (1 - (k - 1) / steps), s1 = T - span * (1 - k / steps);
        ctx.strokeStyle = pal.voice(0, 0.08 + 0.85 * (k / steps) ** 1.6);
        ctx.beginPath(); ctx.moveTo(X(s0), Y(s0)); ctx.lineTo(X(s1), Y(s1)); ctx.stroke();
      }
      const hx = X(T), hy = Y(T);
      // The two voices: x falls away below the figure, y runs out to its left.
      const lenDown = h - (fy + S0 + gap), lenLeft = fx - gap;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = pal.voice(1, 0.75 * grow);
      ctx.beginPath();
      for (let k = 0; k <= 160; k += 1) {
        const yy = fy + S0 + gap + (k / 160) * lenDown;
        const s = T - (k / 160) * 1.6;
        if (k === 0) ctx.moveTo(X(s), yy); else ctx.lineTo(X(s), yy);
      }
      ctx.stroke();
      ctx.strokeStyle = pal.voice(2, 0.75 * grow);
      ctx.beginPath();
      for (let k = 0; k <= 160; k += 1) {
        const xx = fx - gap - (k / 160) * lenLeft;
        const s = T - (k / 160) * 1.6;
        if (k === 0) ctx.moveTo(xx, Y(s)); else ctx.lineTo(xx, Y(s));
      }
      ctx.stroke();
      // Projection lines from each voice's head to the point they make together.
      ctx.setLineDash([2, 5]);
      ctx.strokeStyle = pal.line;
      ctx.beginPath(); ctx.moveTo(hx, fy + S0 + gap); ctx.lineTo(hx, hy); ctx.lineTo(fx - gap, hy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = pal.voice(0, 1);
      ctx.beginPath(); ctx.arc(hx, hy, 3.4, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.voice(1, 1); ctx.beginPath(); ctx.arc(hx, fy + S0 + gap, 2.6, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.voice(2, 1); ctx.beginPath(); ctx.arc(fx - gap, hy, 2.6, 0, TAU); ctx.fill();
      ctx.font = "0.72rem ui-monospace, monospace";
      ctx.fillStyle = pal.muted;
      ctx.fillText("x · 1", fx + S0 * 0.5 + 8, h - 8);
      ctx.fillText(`y · ${S.ratio.toFixed(3)}`, 6, fy + 12);
    },
  });
  setRatio(Number(input.value) || 1.5);
}

/* ---------- 3. The map: sources and their interference ---------- */

const MAP = { w: 0, h: 0, pos: null, r: null, frames: null, src: null, grid: null, buf: null, img: null, off: null, born: 0 };
let hoverPlace = null;
let waveTime = 0;

function describe(place) {
  const out = $("#eco-field-readout");
  if (!out || !place) return;
  const packed = packLabel(place.code, 8);
  const words = [...packed.words].map((w) => "0x" + w.toString(16).padStart(8, "0")).join(" ");
  out.textContent = `${place.name}. ${place.status}. ${place.how}\nGlyph label "${place.code}" packs to ${words}`;
  for (const a of document.querySelectorAll("[data-place-link]")) a.toggleAttribute("data-active", a.dataset.placeLink === place.id);
}

function layoutMap(w, h, density) {
  const prev = MAP.w && MAP.pos ? MAP.pos.map((p) => ({ x: (p.x / MAP.w) * w, y: (p.y / MAP.h) * h })) : null;
  const run = settle(PLACES, { width: w, height: h, record: prev ? 0 : 8, from: prev });
  MAP.w = w; MAP.h = h; MAP.pos = run.pos; MAP.r = run.r; MAP.frames = prev ? null : run.frames;
  MAP.density = density;
  MAP.src = sources(PLACES, MAP.pos, { width: w, height: h, density });
  MAP.cell = Math.max(5, Math.min(w, h) / 92);
  MAP.cols = Math.ceil(w / MAP.cell) + 1; MAP.rows = Math.ceil(h / MAP.cell) + 1;
  MAP.d0 = Math.min(w, h) * 0.07;
  MAP.grid = prepareGrid(MAP.src, MAP.cols, MAP.rows, MAP.cell, { d0: MAP.d0 });
  MAP.buf = new Float32Array(MAP.cols * MAP.rows);
  // Edge window: the field thins to nothing at the canvas edge, so it has no rim.
  MAP.win = new Float32Array(MAP.cols * MAP.rows);
  const ex = MAP.cols * 0.14, ey = MAP.rows * 0.16;
  for (let j = 0; j < MAP.rows; j += 1) for (let i = 0; i < MAP.cols; i += 1) {
    const u = Math.min(1, Math.min(i, MAP.cols - 1 - i) / ex), q = Math.min(1, Math.min(j, MAP.rows - 1 - j) / ey);
    MAP.win[j * MAP.cols + i] = u * u * (3 - 2 * u) * q * q * (3 - 2 * q);
  }
  MAP.off = document.createElement("canvas");
  MAP.off.width = MAP.cols; MAP.off.height = MAP.rows;
  MAP.img = MAP.off.getContext("2d").createImageData(MAP.cols, MAP.rows);
}

function strokeLines(ctx, seg, cell) {
  ctx.beginPath();
  for (let q = 0; q < seg.length; q += 4) { ctx.moveTo(seg[q] * cell, seg[q + 1] * cell); ctx.lineTo(seg[q + 2] * cell, seg[q + 3] * cell); }
  ctx.stroke();
}

function paintField() {
  const el = $("#eco-field-eq");
  if (!el || !MAP.src) return;
  const fams = Object.keys(FAMILIES).map((f) => {
    const s = MAP.src.find((q) => q.family === f);
    return s ? `${f} ${s.f.toFixed(3)} Hz, λ ${s.lambda.toFixed(0)} px` : null;
  }).filter(Boolean);
  el.textContent =
    `ψ(x, y, t) = Σᵢ Aᵢ · e^(−dᵢ/ℓᵢ) · cos(k·dᵢ − ω·t + φᵢ) / √(1 + dᵢ/d₀)\n` +
    `${fams.join("   ")}\n` +
    `fringes between modules and research drift once every ${beatPeriod("modules", "research").toFixed(1)} s; within a family they stand still`;
}

function initField() {
  const canvas = $("#eco-field");
  if (!canvas) return;
  scene(canvas, {
    frame(ctx, { t, dt, w, h, pal, reduced: still }) {
      const v = mixed();
      if (!MAP.src || MAP.w !== Math.round(w) || MAP.h !== Math.round(h) || Math.abs((MAP.density ?? 0) - v.density) > 0.02) {
        layoutMap(Math.round(w), Math.round(h), v.density);
        if (!MAP.born) MAP.born = t;
        paintField();
      }
      if (flowOn && !still) waveTime += dt;
      const age = still ? 99 : t - MAP.born;
      // The sources settle into place as the map arrives, then each begins to sound.
      if (MAP.frames && !still) {
        const k = Math.min(MAP.frames.length - 1, Math.floor(age * 60 / 1.6 * (MAP.frames.length / 66)));
        const pos = MAP.frames[k];
        if (k >= MAP.frames.length - 1) MAP.frames = null;
        else { MAP.src.forEach((s, i) => { s.x = pos[i].x; s.y = pos[i].y; }); MAP.grid = prepareGrid(MAP.src, MAP.cols, MAP.rows, MAP.cell, { d0: MAP.d0 }); }
      }
      const order = PLACES.map((p, i) => i).sort((a, b) => PLACES[b].weight - PLACES[a].weight);
      const speed = Math.hypot(w, h) / FIELD.ARRIVE;
      const arrive = (s) => (still ? Infinity : (age - 0.5 - order.indexOf(s) * 0.16) * speed);
      const boost = hoverPlace ? PLACES.findIndex((p) => p.id === hoverPlace) : -1;
      const rest = S.rest;
      const jitter = rest > 0.02 ? (s) => rest * 1.4 * Math.sin(waveTime * 2.7 + s * 1.9) : null;
      sampleGrid(MAP.grid, MAP.src, waveTime, MAP.buf, { boost, jitter, arrive: age < 6 ? arrive : null });
      // Soft-clip the field so crowded crests do not saturate.
      const B = MAP.buf;
      const W = MAP.win;
      for (let q = 0; q < B.length; q += 1) B[q] = Math.tanh(B[q] * 1.4) * W[q];
      // The wash: crest colour above zero, trough below.
      const cr = pal.voiceRgb(0), tr = pal.voiceRgb(1), D = MAP.img.data;
      const wash = 0.13 + v.contrast * 0.9;
      for (let q = 0; q < B.length; q += 1) {
        const x = B[q], c = x >= 0 ? cr : tr, k = q * 4;
        D[k] = c[0]; D[k + 1] = c[1]; D[k + 2] = c[2];
        D[k + 3] = Math.round(255 * wash * Math.pow(Math.abs(x), 1.15));
      }
      MAP.off.getContext("2d").putImageData(MAP.img, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(MAP.off, 0, 0, MAP.cols * MAP.cell, MAP.rows * MAP.cell);
      // The threads: nodes in ink, crest and trough lines in their colours.
      const tens = tension();
      ctx.lineCap = "round";
      // Nodes are drawn only where the field is alive, so quiet water stays empty.
      ctx.lineWidth = 0.6 + tens * 2.2;
      ctx.strokeStyle = pal.faint; strokeLines(ctx, isolines(B, MAP.cols, MAP.rows, 0, 0.06), MAP.cell);
      ctx.lineWidth = 0.7 + tens * 1.2;
      ctx.strokeStyle = pal.crest(0.3); strokeLines(ctx, isolines(B, MAP.cols, MAP.rows, 0.3), MAP.cell);
      ctx.lineWidth = 0.9 + tens * 1.6;
      ctx.strokeStyle = pal.crest(0.65); strokeLines(ctx, isolines(B, MAP.cols, MAP.rows, 0.55), MAP.cell);
      // The sources, with a ring on each outgoing crest near them, and their names.
      MAP.src.forEach((s, i) => {
        const place = PLACES[i];
        const on = arrive(i) > 0;
        if (!on) return;
        const active = i === boost;
        // Outgoing crests near the source; rounding sets how far they carry before fading.
        const carry = s.lambda * (0.9 + v.rounding * 0.9);
        for (let n = 0; n < 3; n += 1) {
          const ring = ((s.omega * waveTime) / TAU % 1 + n) * s.lambda;
          if (ring > carry) continue;
          ctx.strokeStyle = pal.crest((active ? 0.95 : 0.55) * (1 - ring / carry) * Math.min(1, ring / (s.lambda * 0.15)));
          ctx.lineWidth = active ? 1.6 : 1.1;
          ctx.beginPath(); ctx.arc(s.x, s.y, ring, 0, TAU); ctx.stroke();
        }
        ctx.fillStyle = place.state === "blocked" ? pal.trough(1) : pal.crest(1);
        ctx.beginPath(); ctx.arc(s.x, s.y, active ? 5 : 3.6, 0, TAU); ctx.fill();
        if (place.state === "blocked") { ctx.strokeStyle = pal.trough(0.9); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(s.x, s.y, 8, 0, TAU); ctx.stroke(); }
        const R = MAP.r[i];
        const size = Math.max(12, Math.min(24, R * 0.3));
        const ty = s.y + R * 0.42;
        ctx.textAlign = "center";
        ctx.lineJoin = "round";
        ctx.font = `700 ${size.toFixed(1)}px "Avenir Next", Avenir, Futura, sans-serif`;
        ctx.strokeStyle = pal.bg; ctx.lineWidth = 5; ctx.strokeText(place.name, s.x, ty);
        ctx.fillStyle = active ? pal.ink : pal.ink2; ctx.fillText(place.name, s.x, ty);
        ctx.font = `${(size * 0.56).toFixed(1)}px ui-monospace, monospace`;
        ctx.strokeText(place.code, s.x, ty + size * 1.02);
        ctx.fillStyle = pal.muted; ctx.fillText(place.code, s.x, ty + size * 1.02);
        ctx.textAlign = "start";
      });
    },
  });
  const placeAt = (ev) => {
    if (!MAP.pos) return null;
    const rect = canvas.getBoundingClientRect();
    const idx = nearestSource(MAP.src, MAP.r, ev.clientX - rect.left, ev.clientY - rect.top);
    return idx >= 0 ? PLACES[idx] : null;
  };
  canvas.addEventListener("pointermove", (ev) => {
    const p = placeAt(ev);
    hoverPlace = p?.id ?? null;
    canvas.style.cursor = p ? "pointer" : "default";
    if (p) describe(p);
  });
  canvas.addEventListener("pointerleave", () => { hoverPlace = null; });
  canvas.addEventListener("click", (ev) => {
    const p = placeAt(ev);
    if (p) { ripple(ev.clientX, ev.clientY, 1); window.location.href = p.href; }
  });
  for (const a of document.querySelectorAll("[data-place-link]")) {
    const place = PLACES.find((p) => p.id === a.dataset.placeLink);
    const show = () => { hoverPlace = place?.id ?? null; if (place) describe(place); };
    a.addEventListener("focus", show);
    a.addEventListener("pointerenter", show);
    a.addEventListener("pointerleave", () => { hoverPlace = null; });
  }
  describe(PLACES[0]);
}

/* Projection: viewport aspect becomes a CSS variable. No breakpoints. */
function initProjection() {
  const project = () => {
    const ar = clamp(window.innerWidth / Math.max(1, window.innerHeight), 0.62, 2.3);
    document.documentElement.style.setProperty("--ar-w", ar.toFixed(3));
  };
  project();
  if (typeof ResizeObserver === "function") new ResizeObserver(project).observe(document.documentElement);
  else window.addEventListener("resize", project);
}

const BADGE = { main: "Main", open: "Open", blocked: "Blocked", closed: "Closed" };

function renderRecord() {
  const count = (k) => PLACES.filter((p) => p.state === k).length;
  const status = $("#eco-status");
  if (status) status.textContent = `${PLACES.length} places as of ${AS_OF}: ${count("main")} on the main branch, ${count("open")} in review, ${count("blocked")} blocked with its blockers named. Counted from the data on this page.`;
  const asOf = $("#eco-as-of");
  if (asOf) asOf.textContent = AS_OF;
  const body = $("#eco-record-body");
  if (!body) return;
  for (const row of RECORD) {
    const tr = document.createElement("tr");
    const tdWork = document.createElement("td"); tdWork.textContent = row.work;
    const tdState = document.createElement("td");
    const badge = document.createElement("span"); badge.className = `eco-badge ${row.badge}`;
    badge.textContent = BADGE[row.badge] || row.badge;
    tdState.append(badge, document.createElement("br"), document.createTextNode(row.state));
    const tdHow = document.createElement("td"); tdHow.textContent = row.how;
    tr.append(tdWork, tdState, tdHow);
    body.append(tr);
  }
}

function boot() {
  renderRecord();
  initProjection();
  initSuperposition();
  initField();
  const padHost = $("#eco-pad");
  if (padHost) {
    mountSimplexPad(padHost, {
      labels: PRESET_NAMES,
      weights: [...S.w],
      hues: PRESET_NAMES.map((n) => PRESETS[n].hue),
      onChange: (w) => { S.w = [...w]; applyVars(); paintState(); },
    });
  }
  const flowBtn = $("#eco-flow");
  const paintFlow = () => { if (flowBtn) { flowBtn.setAttribute("aria-pressed", flowOn ? "true" : "false"); flowBtn.textContent = flowOn ? "Flow: on" : "Flow: off"; } };
  paintFlow();
  flowBtn?.addEventListener("click", () => { flowOn = !flowOn && !reduced(); paintFlow(); paintState(); });
  setupReadingWeave({ onChange: (score) => { S.rest = clamp01(score); } });
  applyVars();
  paintState();
  paintMedium();
  let lastPaint = 0;
  onFrame((now) => {
    const s = somatic();
    S.jerk = clamp01(s.jerk);
    S.scroll = clamp01(s.scroll);
    if (now - lastPaint > 160) { lastPaint = now; applyVars(); paintState(); paintMedium(); }
  });
}

boot();
