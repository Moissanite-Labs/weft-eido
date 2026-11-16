// The home page. Three movements share the loom's medium:
//   1. The medium's own equation, printed live under the title.
//   2. Superposition: two waves in a ratio you choose, drawn as the figure they make.
//   3. The field: every line of work as a cell, steered by a style point.
// Every visual value is a function of one state vector, printed live.
// One channel, one quantity:
//   hue          <- circular mean of preset hues by barycentric weights
//   cell area    <- stated place weight (area follows weight)
//   wobble       <- restlessness (reading weave score)
//   thread width <- tension = clamp01(0.55 * rest + 0.45 * jerk)
//   eccentricity <- mixer rounding
//   spacing/type <- mixer density (CSS calc from --density)
//   ring count   <- mixer contrast
//   field aspect <- viewport aspect, projected by ResizeObserver
//   wave phase   <- Flow time (never touches hue)
// No network requests. Cells are links to standalone pages.

import { layoutCells, layerThreads, hitTest } from "../../src/cell-layout.js";
import { packLabel } from "../../src/glyph-font.js";
import { mixAestheticPresets } from "../../src/aesthetic-mixer.js";
import { mountSimplexPad } from "../../src/simplex-pad.js";
import { setupReadingWeave } from "../../src/reading-weave.js";
import { scene, setHue, somatic, mediumState, onFrame, ripple, reduced } from "./loom.js";
import { nearestRatio, intervalName, cents, TAU } from "./harmonic-math.js";

const $ = (sel, el = document) => el.querySelector(sel);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v) => clamp(v, 0, 1);
const smooth = (u) => { const x = clamp01(u); return x * x * (3 - 2 * x); };

/* Inspectable bounds. Every state entry is clamped into [MIN, MAX]. */
export const BOUNDS = Object.freeze({ MIN: 0, MAX: 1, JERK_MAX: 0.09, SCROLL_MAX: 2.4, TENSION_REST: 0.55, TENSION_JERK: 0.45 });

const PRESETS = {
  calm: { rounding: 0.85, density: 0.3, hue: 0.12, contrast: 0.05 },
  sharp: { rounding: 0.0, density: 0.1, hue: 0.45, contrast: 0.01 },
  airy: { rounding: 1.0, density: 0.85, hue: 0.85, contrast: 0.2 },
};
const PRESET_NAMES = Object.keys(PRESETS);

export const PLACES = [
  { id: "style", code: "D1 STYL", name: "Style", href: "components/aesthetic-mixer.html", weight: 9, family: "modules", state: "On main", badge: "main", how: "Its own page. The point below is the same control, steering this field and every page after it." },
  { id: "reading", code: "D6 READ", name: "Reading", href: "components/reading-weave.html", weight: 9, family: "modules", state: "On main", badge: "main", how: "Its own page. The weave itself runs on the text at the end of this page." },
  { id: "field", code: "GPU FLD", name: "Field", href: "https://github.com/Moissanite-Labs/weft-eido/pull/6", weight: 7, family: "rebuild", state: "Pull request 6. Changes requested. Two checks fail", badge: "blocked", how: "Opens the pull request. No code from it runs here. Its page looks up your network address and can hold keys in the browser." },
  { id: "explainer", code: "TOY MOD", name: "Explainer", href: "components/research-explainer.html", weight: 6, family: "research", state: "Pull request 11. Approved. Checks green", badge: "approved", how: "Its own page, with the toy model at full strength." },
  { id: "archive", code: "5X7 BIT", name: "Archive", href: "components/glyph-font.html", weight: 5, family: "modules", state: "On main", badge: "main", how: "Its own page. Every title on this site is first drawn from its bits." },
  { id: "simulations", code: "E08-E13", name: "Simulations", href: "../examples/simulations/index.html", weight: 6, family: "research", state: "Pull request 14. Approved. Checks green", badge: "approved", how: "The standalone suite. E13 and the Asma explorer run there. Their numbers are their authors' claims." },
  { id: "identifiability", code: "CHEB ID", name: "Identifiability", href: "../examples/visualizations/project-asma-chebyshev-identifiability-explorer.html", weight: 5, family: "research", state: "Pull request 15. Approved. Checks green", badge: "approved", how: "The standalone Chebyshev explorer, with its own model and presets." },
  { id: "harmonic", code: "CHORDS", name: "Harmonic", href: "causal-harmonic/index.html", weight: 6, family: "research", state: "Pull request 17. Approved. Checks green", badge: "approved", how: "Rebuilt on this site's own loom: every figure there is computed live. Recorded pieces are CC BY-NC 4.0." },
];

export const RECORD = [
  ...PLACES.map((p) => ({ work: p.name, state: p.state, badge: p.badge, how: p.how })),
  { work: "Condense panel fix (pull request 8)", state: "Checks green. Awaits review", badge: "approved", how: "Not included. It can land on its own." },
  { work: "Readme line (pull request 9)", state: "Changes requested on sign-off only. The edit itself was called fine", badge: "blocked", how: "Not applied here. One sign-off fixes it." },
  { work: "Angles hub (pull request 18)", state: "Closed. Superseded by pull request 19", badge: "blocked", how: "Replaced by this field. No code from pull request 6 is included." },
];

/* State vector. Derived entries are recomputed, never stored twice. */
const S = { w: [0.5, 0.2, 0.3], rest: 0, jerk: 0, scroll: 0, ratio: 1.5 };
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

/* ---------- 3. The field ---------- */

let fieldLayout = null;
let fieldThreads = [];
let hoverPlace = null;
let fieldW = 0, fieldH = 0;

function describe(place) {
  const out = $("#eco-field-readout");
  if (!out || !place) return;
  const packed = packLabel(place.code, 8);
  const words = [...packed.words].map((w) => "0x" + w.toString(16).padStart(8, "0")).join(" ");
  out.textContent = `${place.name}. ${place.state}. ${place.how}\nGlyph label "${place.code}" packs to ${words}`;
  for (const a of document.querySelectorAll("[data-place-link]")) a.toggleAttribute("data-active", a.dataset.placeLink === place.id);
}

function computeField(w, h) {
  const items = PLACES.map((p) => ({ weight: p.weight, labelLength: Math.max(p.name.length, p.code.length) }));
  fieldLayout = layoutCells(items, { width: Math.round(w), height: Math.round(h) });
  fieldThreads = layerThreads(fieldLayout.cells, PLACES.map((p) => p.family));
  fieldW = Math.round(w); fieldH = Math.round(h);
}

function membrane(ctx, cx, cy, r, ecc, harm, seed, phase, rings, pal, active, lightText) {
  for (let ring = rings; ring >= 1; ring -= 1) {
    const rr = r * (ring / rings);
    const steps = 48;
    ctx.beginPath();
    for (let k = 0; k <= steps; k += 1) {
      const a = (k / steps) * TAU;
      const wob = 1 + harm * (Math.sin(a * 3 + seed * 1.3 + phase * 0.42 + ring * 0.7) + 0.4 * Math.sin(a * 5 - seed + phase * 0.23 - ring));
      const x = cx + Math.cos(a) * rr * wob * (0.82 + ecc * 0.26), y = cy + Math.sin(a) * rr * wob;
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    if (ring === rings) {
      ctx.fillStyle = pal.voice(0, active ? 0.2 : 0.07);
      ctx.fill();
    }
    ctx.strokeStyle = pal.voice(ring % 2 ? 0 : 1, (active ? 0.95 : 0.6) * (0.35 + 0.65 * (ring / rings)));
    ctx.lineWidth = ring === rings ? (active ? 2 : 1.3) : 0.8;
    ctx.stroke();
  }
}

function quadPoint(a, c, b, u) {
  const m = 1 - u;
  return [m * m * a[0] + 2 * m * u * c[0] + u * u * b[0], m * m * a[1] + 2 * m * u * c[1] + u * u * b[1]];
}

let phase = 0;
function initField() {
  const canvas = $("#eco-field");
  if (!canvas) return;
  scene(canvas, {
    frame(ctx, { t, dt, w, h, pal, reduced: still }) {
      ctx.clearRect(0, 0, w, h);
      if (!fieldLayout || fieldW !== Math.round(w) || fieldH !== Math.round(h)) computeField(w, h);
      if (flowOn && !still) phase += dt;
      const v = mixed();
      const vmin = Math.min(w, h) / 100;
      const jit = still ? 0 : S.rest * vmin * 1.2;
      const wob = (i) => (jit ? Math.sin(phase * 4.3 + i * 1.7) * jit : 0);
      const harm = flowOn ? 0.07 + 0.03 * Math.sin(phase / 2.6) : 0.05;
      const tens = tension();
      const rings = 2 + Math.round(v.contrast * 20);
      ctx.lineCap = "round";
      fieldThreads.forEach((e, ei) => {
        const grow = still ? 1 : smooth((t - 0.6 - ei * 0.12) / 0.9);
        if (grow <= 0) return;
        const a = fieldLayout.cells[e.a], b = fieldLayout.cells[e.b];
        const A = [a.x + wob(e.a), a.y], B = [b.x + wob(e.b), b.y];
        const C = [(A[0] + B[0]) / 2 - (B[1] - A[1]) * 0.14, (A[1] + B[1]) / 2 + (B[0] - A[0]) * 0.14];
        ctx.beginPath(); ctx.moveTo(A[0], A[1]);
        for (let k = 1; k <= 30; k += 1) { const [qx, qy] = quadPoint(A, C, B, (k / 30) * grow); ctx.lineTo(qx, qy); }
        ctx.strokeStyle = pal.voice(0, 0.45);
        ctx.lineWidth = 0.6 + tens * 3;
        ctx.stroke();
        if (flowOn && !still && grow >= 1) {
          const u = ((phase / 5.2) + ei * 0.37) % 1;
          const [qx, qy] = quadPoint(A, C, B, u);
          ctx.beginPath(); ctx.arc(qx, qy, 2.4, 0, TAU);
          ctx.fillStyle = pal.voice(0, 0.95); ctx.fill();
        }
      });
      fieldLayout.cells.forEach((cell, i) => {
        const place = PLACES[cell.index];
        const grow = still ? 1 : smooth((t - i * 0.1) / 0.9);
        if (grow <= 0) return;
        const active = hoverPlace === place.id;
        const cx = cell.x + wob(i), cy = cell.y;
        const breathe = flowOn && !still ? 1 + Math.sin(phase / 1.9 + i * 0.9) * 0.035 : 1;
        membrane(ctx, cx, cy, (cell.side / 2) * breathe * grow, v.rounding, harm, i, phase, rings, pal, active);
        if (grow < 0.6) return;
        const nameV = clamp(cell.side / Math.max(6.2, place.name.length * 0.66), 11, 26);
        ctx.globalAlpha = smooth((grow - 0.6) / 0.4);
        ctx.fillStyle = pal.ink;
        ctx.textAlign = "center";
        ctx.font = `700 ${nameV.toFixed(1)}px "Avenir Next", Avenir, Futura, sans-serif`;
        ctx.fillText(place.name, cx, cy);
        ctx.font = `${(nameV * 0.56).toFixed(1)}px ui-monospace, monospace`;
        ctx.fillStyle = pal.muted;
        ctx.fillText(place.code, cx, cy + nameV * 1.05);
        ctx.globalAlpha = 1;
        ctx.textAlign = "start";
      });
    },
  });
  const placeAt = (ev) => {
    if (!fieldLayout) return null;
    const rect = canvas.getBoundingClientRect();
    const idx = hitTest(fieldLayout, ev.clientX - rect.left, ev.clientY - rect.top);
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
  }
  describe(PLACES[0]);
}

/* Projection: viewport aspect becomes a CSS variable. No breakpoints. */
function initProjection() {
  const project = () => {
    const ar = clamp(window.innerWidth / Math.max(1, window.innerHeight), 0.62, 2.3);
    document.documentElement.style.setProperty("--ar-w", ar.toFixed(3));
    fieldLayout = null;
  };
  project();
  if (typeof ResizeObserver === "function") new ResizeObserver(project).observe(document.documentElement);
  else window.addEventListener("resize", project);
}

function renderRecord() {
  const onMain = PLACES.filter((p) => p.badge === "main").length;
  const approved = PLACES.filter((p) => p.badge === "approved").length;
  const blocked = PLACES.filter((p) => p.badge === "blocked").length;
  const status = $("#eco-status");
  if (status) status.textContent = `${PLACES.length} places: ${onMain} on the main branch, ${approved} approved in review, ${blocked} blocked, its blockers named. Counted from the data on this page.`;
  const body = $("#eco-record-body");
  if (!body) return;
  for (const row of RECORD) {
    const tr = document.createElement("tr");
    const tdWork = document.createElement("td"); tdWork.textContent = row.work;
    const tdState = document.createElement("td");
    const badge = document.createElement("span"); badge.className = `eco-badge ${row.badge}`;
    badge.textContent = row.badge === "main" ? "Main" : row.badge === "approved" ? "Approved" : "Blocked";
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
