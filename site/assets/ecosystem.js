// Causal field. Every visual value on this page is a function of one state
// vector. Each entry stays in [0, 1] and is printed live under the field.
// One channel, one quantity:
//   hue          <- circular mean of preset hues by barycentric weights
//   cell area    <- stated place weight (area follows weight)
//   wobble       <- restlessness (reading weave score)
//   thread width <- tension = clamp01(0.55 * rest + 0.45 * jerk)
//   eccentricity <- mixer rounding
//   spacing/type <- mixer density (CSS calc from --density)
//   fill alpha   <- mixer contrast
//   field aspect <- viewport aspect, projected by ResizeObserver
//   wave phase   <- Flow time (never touches hue)
// No network requests. Cells are links to standalone pages.

import { layoutCells, layerThreads, hitTest } from "../../src/cell-layout.js";
import { packLabel } from "../../src/glyph-font.js";
import { mixAestheticPresets } from "../../src/aesthetic-mixer.js";
import { mountSimplexPad } from "../../src/simplex-pad.js";
import { setupReadingWeave } from "../../src/reading-weave.js";
import { clamp, fitCanvasToDisplaySize } from "../../src/research-explainer.js";

const $ = (sel, el = document) => el.querySelector(sel);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const clamp01 = (v) => clamp(v, 0, 1);

/* Inspectable bounds. Every state entry is clamped into [MIN, MAX]. */
export const BOUNDS = Object.freeze({ MIN: 0, MAX: 1, JERK_MAX: 0.09, SCROLL_MAX: 2.4, TENSION_REST: 0.55, TENSION_JERK: 0.45 });

const PRESETS = {
  calm: { rounding: 0.85, density: 0.3, hue: 0.12, contrast: 0.05 },
  sharp: { rounding: 0.0, density: 0.1, hue: 0.45, contrast: 0.01 },
  airy: { rounding: 1.0, density: 0.85, hue: 0.85, contrast: 0.2 },
};
const PRESET_NAMES = Object.keys(PRESETS);

export const PLACES = [
  { id: "style", code: "D1 STYL", name: "Style", href: "components/aesthetic-mixer.html", weight: 9, family: "modules", state: "On main", badge: "main", how: "Its own page. The pad on this page is the same control, steering the field." },
  { id: "reading", code: "D6 READ", name: "Reading", href: "components/reading-weave.html", weight: 9, family: "modules", state: "On main", badge: "main", how: "Its own page. The weave itself runs on this text." },
  { id: "field", code: "GPU FLD", name: "Field", href: "https://github.com/Moissanite-Labs/weft-eido/pull/6", weight: 7, family: "rebuild", state: "Pull request 6. Changes requested. Two checks fail", badge: "blocked", how: "Opens the pull request. No code from it runs here. Its page looks up your network address and can hold keys in the browser." },
  { id: "explainer", code: "TOY MOD", name: "Explainer", href: "components/research-explainer.html", weight: 6, family: "research", state: "Pull request 11. Approved. Checks green", badge: "approved", how: "Its own page, with the toy model at full strength." },
  { id: "archive", code: "5X7 BIT", name: "Archive", href: "components/glyph-font.html", weight: 5, family: "modules", state: "On main", badge: "main", how: "Its own page. Original pages linked unchanged from there." },
  { id: "simulations", code: "E08-E13", name: "Simulations", href: "../examples/simulations/index.html", weight: 6, family: "research", state: "Pull request 14. Approved. Checks green", badge: "approved", how: "The standalone suite. E13 and the Asma explorer run there. Their numbers are their authors' claims." },
  { id: "identifiability", code: "CHEB ID", name: "Identifiability", href: "../examples/visualizations/project-asma-chebyshev-identifiability-explorer.html", weight: 5, family: "research", state: "Pull request 15. Approved. Checks green", badge: "approved", how: "The standalone Chebyshev explorer, with its own model and presets." },
  { id: "harmonic", code: "CHORDS", name: "Harmonic", href: "causal-harmonic/index.html", weight: 6, family: "research", state: "Pull request 17. Approved. Checks green", badge: "approved", how: "Its own pages. Recorded pieces are CC BY-NC 4.0: share with credit, no commercial use." },
];

export const RECORD = [
  ...PLACES.map((p) => ({ work: p.name, state: p.state, badge: p.badge, how: p.how })),
  { work: "Condense panel fix (pull request 8)", state: "Checks green. Awaits review", badge: "approved", how: "Not included. It can land on its own." },
  { work: "Readme line (pull request 9)", state: "Changes requested on sign-off only. The edit itself was called fine", badge: "blocked", how: "Not applied here. One sign-off fixes it." },
  { work: "Angles hub (pull request 18)", state: "Closed. Superseded by pull request 19", badge: "blocked", how: "Replaced by this field. No code from pull request 6 is included." },
];

/* State vector. Derived entries are recomputed, never stored twice. */
const S = {
  w: [0.5, 0.2, 0.3],
  rest: 0,
  scrollVel: 0,
  jerk: 0,
  phase: 0,
};
let flowOn = !reducedMotion.matches;

function mixed() {
  return mixAestheticPresets(PRESETS, Object.fromEntries(PRESET_NAMES.map((n, i) => [n, S.w[i]])));
}
function tension() {
  return clamp01(BOUNDS.TENSION_REST * S.rest + BOUNDS.TENSION_JERK * S.jerk);
}

function applyVars() {
  const v = mixed();
  const root = document.documentElement.style;
  const deg = Math.round(v.hue * 360);
  root.setProperty("--eco-hue", String(deg));
  root.setProperty("--eco-hue-b", String((deg + 42) % 360));
  root.setProperty("--eco-hue-c", String((deg + 315) % 360));
  root.setProperty("--rounding", v.rounding.toFixed(4));
  root.setProperty("--density", v.density.toFixed(4));
  root.setProperty("--contrast", v.contrast.toFixed(4));
  root.setProperty("--rest", S.rest.toFixed(4));
  root.setProperty("--tension", tension().toFixed(4));
  try { localStorage.setItem("eido-hue", String(deg)); } catch (e) { /* storage may be blocked */ }
  return v;
}

function paintState() {
  const v = mixed();
  const el = $("#eco-state");
  if (!el) return;
  el.textContent =
    `w [${S.w.map((x) => x.toFixed(2)).join(", ")}] sum ${S.w.reduce((a, b) => a + b, 0).toFixed(2)} · ` +
    `hue ${(v.hue * 360).toFixed(0)}deg · rounding ${v.rounding.toFixed(2)} · density ${v.density.toFixed(2)} · contrast ${v.contrast.toFixed(2)}\n` +
    `rest ${S.rest.toFixed(2)} · scroll ${S.scrollVel.toFixed(2)} · jerk ${S.jerk.toFixed(2)} · tension ${tension().toFixed(2)} · flow ${flowOn ? "on" : "off"} · all in [0, 1]`;
}

function describe(place) {
  const out = $("#eco-field-readout");
  if (!out || !place) return;
  const packed = packLabel(place.code, 8);
  const words = [...packed.words].map((w) => "0x" + w.toString(16).padStart(8, "0")).join(" ");
  out.textContent = `${place.name}. ${place.state}. ${place.how}\nGlyph label "${place.code}" packs to ${words}`;
  for (const a of document.querySelectorAll("[data-place-link]")) {
    a.toggleAttribute("data-active", a.dataset.placeLink === place.id);
  }
}

/* Field rendering. Geometry comes from cell-layout (golden angle packing,
   area follows weight, spanning threads per family). Sizes below derive
   from cell geometry and the viewport unit, never from constants alone. */

let fieldLayout = null;
let fieldThreads = [];
let hoverPlace = null;

function computeField(w, h) {
  const items = PLACES.map((p) => ({ weight: p.weight, labelLength: Math.max(p.name.length, p.code.length) }));
  fieldLayout = layoutCells(items, { width: Math.round(w), height: Math.round(h) });
  fieldThreads = layerThreads(fieldLayout.cells, PLACES.map((p) => p.family));
}

function blobPath(ctx, cx, cy, rBase, ecc, harm, seed, t) {
  const steps = 28;
  const pts = [];
  for (let k = 0; k < steps; k += 1) {
    const a = (k / steps) * Math.PI * 2;
    const rr = rBase * (1 + Math.sin(a * 3 + seed * 1.3 + t / 2400) * harm + Math.sin(a * 5 - seed) * harm * 0.4);
    pts.push([cx + Math.cos(a) * rr * (0.82 + ecc * 0.26), cy + Math.sin(a) * rr]);
  }
  ctx.beginPath();
  ctx.moveTo((pts[steps - 1][0] + pts[0][0]) / 2, (pts[steps - 1][1] + pts[0][1]) / 2);
  for (let k = 0; k < steps; k += 1) {
    const p = pts[k], q = pts[(k + 1) % steps];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}

function quadPoint(a, c, b, u) {
  const m = 1 - u;
  return [m * m * a[0] + 2 * m * u * c[0] + u * u * b[0], m * m * a[1] + 2 * m * u * c[1] + u * u * b[1]];
}

function drawField(t = 0) {
  const canvas = $("#eco-field");
  if (!canvas) return;
  const { width, height, ratio } = fitCanvasToDisplaySize(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = width / ratio, h = height / ratio;
  if (w < 2 || h < 2) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!fieldLayout || fieldLayout.region.width !== Math.round(w) || fieldLayout.region.height !== Math.round(h)) computeField(w, h);
  const v = mixed();
  const hueDeg = Math.round(v.hue * 360);
  const light = document.documentElement.getAttribute("data-theme") === "light";
  const vmin = Math.min(window.innerWidth, window.innerHeight) / 100;
  const jit = reducedMotion.matches ? 0 : S.rest * vmin * 0.32;
  const wob = (i) => (jit ? Math.sin(t / 230 + i * 1.7) * jit : 0);
  const harm = flowOn ? 0.1 + 0.035 * Math.sin(t / 2600) : 0.055;
  const tens = tension();

  ctx.lineCap = "round";
  fieldThreads.forEach((e, ei) => {
    const a = fieldLayout.cells[e.a], b = fieldLayout.cells[e.b];
    const A = [a.x + wob(e.a), a.y], B = [b.x + wob(e.b), b.y];
    const C = [(A[0] + B[0]) / 2 - (B[1] - A[1]) * 0.12, (A[1] + B[1]) / 2 + (B[0] - A[0]) * 0.12];
    ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.quadraticCurveTo(C[0], C[1], B[0], B[1]);
    ctx.strokeStyle = `hsl(${hueDeg} 55% ${light ? 38 : 62}% / 0.5)`;
    ctx.lineWidth = (0.14 + tens * 0.5) * vmin;
    ctx.stroke();
    if (flowOn && !reducedMotion.matches) {
      const u = ((t / 5200) + ei * 0.37) % 1;
      const [qx, qy] = quadPoint(A, C, B, u);
      ctx.beginPath(); ctx.arc(qx, qy, vmin * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${hueDeg} 75% ${light ? 40 : 74}% / 0.9)`; ctx.fill();
    }
  });

  fieldLayout.cells.forEach((cell, i) => {
    const place = PLACES[cell.index];
    const active = hoverPlace === place.id;
    const cx = cell.x + wob(i), cy = cell.y;
    const breathe = flowOn && !reducedMotion.matches ? 1 + Math.sin(t / 1900 + i * 0.9) * 0.04 : 1;
    blobPath(ctx, cx, cy, (cell.side / 2) * breathe, v.rounding, harm, i, flowOn ? t : 0);
    const grad = ctx.createRadialGradient(cx - cell.side * 0.16, cy - cell.side * 0.18, cell.side * 0.06, cx, cy, cell.side * 0.66);
    grad.addColorStop(0, `hsl(${hueDeg} ${active ? 78 : 55}% ${light ? (active ? 70 : 84) : (active ? 44 : 28)}% / ${0.68 + v.contrast * 1.4})`);
    grad.addColorStop(1, `hsl(${(hueDeg + 42) % 360} 55% ${light ? 88 : 17}% / ${0.5 + v.contrast})`);
    ctx.fillStyle = grad;
    ctx.shadowColor = active ? `hsl(${hueDeg} 80% 60% / 0.55)` : "transparent";
    ctx.shadowBlur = active ? vmin * 3 : 0;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = (active ? 0.34 : 0.14 + tens * 0.22) * vmin;
    ctx.strokeStyle = `hsl(${hueDeg} ${active ? 85 : 50}% ${light ? 34 : 72}% / 0.9)`;
    ctx.stroke();
    const nameV = clamp(cell.side / vmin / Math.max(6.2, place.name.length * 0.62), 1.15, 2.6);
    ctx.fillStyle = light ? "#14201f" : "#f2f7f5";
    ctx.textAlign = "center";
    ctx.font = `700 ${nameV.toFixed(2)}vmin "Avenir Next", Avenir, Futura, sans-serif`;
    ctx.fillText(place.name, cx, cy);
    ctx.font = `${(nameV * 0.58).toFixed(2)}vmin ui-monospace, monospace`;
    ctx.fillStyle = light ? "rgba(20,32,31,0.62)" : "rgba(242,247,245,0.62)";
    ctx.fillText(place.code, cx, cy + nameV * vmin * 1.05);
  });
}

function placeAt(ev) {
  const canvas = $("#eco-field");
  if (!canvas || !fieldLayout) return null;
  const rect = canvas.getBoundingClientRect();
  const idx = hitTest(fieldLayout, ev.clientX - rect.left, ev.clientY - rect.top);
  return idx >= 0 ? PLACES[idx] : null;
}

function initField() {
  const canvas = $("#eco-field");
  if (!canvas) return;
  canvas.addEventListener("pointermove", (ev) => {
    const p = placeAt(ev);
    hoverPlace = p?.id ?? null;
    canvas.style.cursor = p ? "pointer" : "default";
    if (p) describe(p);
  });
  canvas.addEventListener("pointerleave", () => { hoverPlace = null; });
  canvas.addEventListener("pointerdown", (ev) => {
    const p = placeAt(ev);
    if (p) window.location.href = p.href;
  });
  for (const a of document.querySelectorAll("[data-place-link]")) {
    const place = PLACES.find((p) => p.id === a.dataset.placeLink);
    a.addEventListener("focus", () => { hoverPlace = place?.id ?? null; if (place) describe(place); });
    a.addEventListener("pointerenter", () => { hoverPlace = place?.id ?? null; if (place) describe(place); });
  }
  describe(PLACES[0]);
}

/* Telemetry: scroll velocity and cursor jerk, smoothed and bounded. */

function initTelemetry() {
  let lastY = window.scrollY, lastT = performance.now();
  window.addEventListener("scroll", () => {
    const now = performance.now();
    const dt = Math.max(1, now - lastT) / 1000;
    const v = Math.abs(window.scrollY - lastY) / dt / Math.max(1, window.innerHeight);
    S.scrollVel = clamp01(S.scrollVel * 0.6 + clamp01(v / BOUNDS.SCROLL_MAX) * 0.4);
    lastY = window.scrollY; lastT = now;
  }, { passive: true });
  let px = null, py = null, pt = 0, pvx = 0, pvy = 0;
  window.addEventListener("pointermove", (ev) => {
    const now = performance.now();
    if (px != null) {
      const dt = Math.max(1, now - pt);
      const vx = (ev.clientX - px) / dt, vy = (ev.clientY - py) / dt;
      const accel = Math.hypot(vx - pvx, vy - pvy) / dt;
      S.jerk = clamp01(S.jerk * 0.82 + clamp01(accel / BOUNDS.JERK_MAX) * 0.18);
      pvx = vx; pvy = vy;
    }
    px = ev.clientX; py = ev.clientY; pt = now;
  }, { passive: true });
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
  if (status) {
    status.innerHTML = "";
    const b = document.createElement("strong");
    b.textContent = "One field. ";
    status.append(b, document.createTextNode(`${PLACES.length} places: ${onMain} on the main branch, ${approved} approved in review, ${blocked} blocked and linked with its blockers named. Counts come from the data on this page.`));
  }
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

let rafId = 0;
let lastFrame = 0;
let lastPaint = 0;
function loop(t) {
  const dt = lastFrame ? Math.min(100, t - lastFrame) : 16;
  lastFrame = t;
  if (flowOn && !reducedMotion.matches) S.phase += dt;
  const decay = Math.exp(-dt / 420);
  S.jerk = clamp01(S.jerk * decay);
  S.scrollVel = clamp01(S.scrollVel * Math.exp(-dt / 300));
  if (t - lastPaint > 140) { lastPaint = t; applyVars(); paintState(); }
  drawField(t);
  rafId = requestAnimationFrame(loop);
}

function boot() {
  renderRecord();
  initField();
  initTelemetry();
  initProjection();
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
  flowBtn?.addEventListener("click", () => { flowOn = !flowOn && !reducedMotion.matches; paintFlow(); paintState(); });
  reducedMotion.addEventListener?.("change", () => { if (reducedMotion.matches) { flowOn = false; paintFlow(); } });
  setupReadingWeave({ onChange: (score) => { S.rest = clamp01(score); } });
  applyVars();
  paintState();
  if (reducedMotion.matches) drawField(0);
  else rafId = requestAnimationFrame(loop);
  new MutationObserver(() => drawField(performance.now())).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

boot();

