// Ecosystem home page: one field, eight places, three shared threads.
// Style point (D1), restlessness (D6) and toy-model tension (explainer)
// live on one bus. Every place reads the bus. No place runs alone.
// No network requests. No storage of keys. Sound only after a press.

import { layoutCells, layerThreads, hitTest } from "../../src/cell-layout.js";
import { packLabel } from "../../src/glyph-font.js";
import { setupReadingWeave } from "../../src/reading-weave.js";
import { LEVELS, nextLevel } from "../../src/condense.js";
import { clamp, coreDrift, fitCanvasToDisplaySize, formatMetric, makeToyCell, matrixDisplacement, mountResearchExplainer, stepToyCell } from "../../src/research-explainer.js";
import { mountMixerDemo, mountGlyphDemo } from "./demos.js";

const $ = (sel, el = document) => el.querySelector(sel);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* Cell area follows `weight`. Weights rank how much of this page each place
   drives. Style and Reading steer the whole page, so they weigh most.
   Family groups the gold threads. State comes from review on 2026-11-15. */
export const PLACES = [
  { id: "style", code: "D1 STYL", name: "Style", blurb: "A point you can drag", weight: 9, family: "modules", state: "On main", badge: "main", how: "Runs in full. The mixer restyles this page." },
  { id: "reading", code: "D6 READ", name: "Reading", blurb: "Text that answers reading", weight: 9, family: "modules", state: "On main", badge: "main", how: "Runs in full on this page." },
  { id: "field", code: "GPU FLD", name: "Field", blurb: "The GPU rebuild, in miniature", weight: 7, family: "rebuild", state: "Pull request 6. Changes requested. Two checks fail", badge: "blocked", how: "Safe miniature only. Full page sits behind a gate until sign-off, key storage and the address lookup are fixed." },
  { id: "explainer", code: "TOY MOD", name: "Explainer", blurb: "A tiny model you can step", weight: 6, family: "research", state: "Pull request 11. Approved. Checks green", badge: "approved", how: "Runs in full. Its tension drives strain across the page." },
  { id: "archive", code: "5X7 BIT", name: "Archive", blurb: "Letters from a table of bits", weight: 5, family: "modules", state: "On main", badge: "main", how: "Runs in full. Original pages linked unchanged." },
  { id: "simulations", code: "E08-E13", name: "Simulations", blurb: "Sessions you can run", weight: 6, family: "research", state: "Pull request 14. Approved. Checks green", badge: "approved", how: "The E13 cascade runs here with its authors' values. The rest of the suite is linked." },
  { id: "identifiability", code: "CHEB ID", name: "Identifiability", blurb: "Can two measures split four cases?", weight: 5, family: "research", state: "Pull request 15. Approved. Checks green", badge: "approved", how: "The Chebyshev model runs here: worlds, sampling points, bleed, and the 1/60 floor." },
  { id: "harmonic", code: "CHORDS", name: "Harmonic", blurb: "The system as sound", weight: 6, family: "research", state: "Pull request 17. Approved. Checks green", badge: "approved", how: "Live tones from the three threads, made in your browser. Recorded pieces are CC BY-NC 4.0: share with credit, no commercial use." },
];

export const RECORD = [
  ...PLACES.map((p) => ({ work: p.name, state: p.state, badge: p.badge, how: p.how })),
  { work: "Condense panel fix (pull request 8)", state: "Checks green. Awaits review", badge: "approved", how: "Not included. This page works without it. It can land on its own." },
  { work: "Readme line (pull request 9)", state: "Changes requested on sign-off only. The edit itself was called fine", badge: "blocked", how: "Not applied here. One sign-off fixes it." },
  { work: "Angles hub (pull request 18)", state: "Changes requested. Two checks fail through pull request 6", badge: "blocked", how: "Superseded by this page. No code from pull request 6 is included." },
];

/* Flow: colour drifts, shape breathes. Off means the style point rules alone. */
const flow = { on: !reducedMotion.matches, phase: 0, last: 0 };
function liveHue() {
  const drift = flow.on ? (flow.phase / 90000) % 1 : 0;
  return (bus.state.hue + drift) % 1;
}
function liveRounding(t = 0) {
  if (!flow.on) return bus.state.rounding;
  return clamp(bus.state.rounding + Math.sin(t / 2600) * 0.13, 0, 1);
}

/* The bus. Subscribers get (state, changedKey). */
const bus = {
  state: { hue: 0.12, rounding: 0.6, density: 0.4, contrast: 0.08, restless: 0, tension: 0.2, gini: 0.42, place: "style" },
  subs: new Set(),
  set(patch) {
    Object.assign(this.state, patch);
    for (const fn of this.subs) fn(this.state, Object.keys(patch));
  },
  sub(fn) { this.subs.add(fn); return () => this.subs.delete(fn); },
};

function renderStatusAndRecord() {
  const onMain = PLACES.filter((p) => p.badge === "main").length;
  const approved = PLACES.filter((p) => p.badge === "approved").length;
  const blocked = PLACES.filter((p) => p.badge === "blocked").length;
  const status = $("#eco-status");
  if (status) {
    status.innerHTML = "";
    const b = document.createElement("strong");
    b.textContent = "One field. ";
    status.append(b, document.createTextNode(
      `${PLACES.length} places: ${onMain} on the main branch, ${approved} approved in review, ${blocked} blocked and shown as a safe miniature. Counts come from the data on this page, counted when it loads.`));
  }
  const body = $("#eco-record-body");
  if (!body) return;
  for (const row of RECORD) {
    const tr = document.createElement("tr");
    const tdWork = document.createElement("td"); tdWork.textContent = row.work;
    const tdState = document.createElement("td");
    const badge = document.createElement("span"); badge.className = `eco-badge ${row.badge}`; badge.textContent = row.badge === "main" ? "Main" : row.badge === "approved" ? "Approved" : "Blocked";
    tdState.append(badge, document.createElement("br"), document.createTextNode(row.state));
    const tdHow = document.createElement("td"); tdHow.textContent = row.how;
    tr.append(tdWork, tdState, tdHow);
    body.append(tr);
  }
}

const stoppers = new Map(); // place id -> fn to call when leaving

function paintRoomChrome(place) {
  const title = $("#eco-room-title");
  if (title && place) title.textContent = place.name;
  const readout = $("#eco-field-readout");
  if (readout && place) {
    const packed = packLabel(place.code, 8);
    const words = [...packed.words].map((w) => "0x" + w.toString(16).padStart(8, "0")).join(" ");
    readout.textContent = `${place.name}\n${place.state}\nGlyph label "${place.code}" packs to ${words}`;
  }
}

function showPlace(id, { focus = false } = {}) {
  const prev = bus.state.place;
  if (prev !== id) stoppers.get(prev)?.();
  bus.set({ place: id });
  for (const el of document.querySelectorAll("[data-place]")) el.hidden = el.dataset.place !== id;
  for (const btn of document.querySelectorAll(".eco-place-btn")) btn.setAttribute("aria-pressed", btn.dataset.placeId === id ? "true" : "false");
  const room = $("#eco-room-view");
  if (room) room.hidden = false;
  document.body.classList.add("eco-room");
  paintRoomChrome(PLACES.find((p) => p.id === id));
  const url = new URL(window.location.href);
  url.hash = `place=${id}`;
  history.replaceState(null, "", url);
  window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" });
  if (focus) { const h = $(`[data-place="${id}"] h3`); h?.setAttribute("tabindex", "-1"); h?.focus({ preventScroll: true }); }
  requestAnimationFrame(() => { drawActivePlace(performance.now()); });
  startPlaceLoops(id);
}

function showField({ focus = false } = {}) {
  stoppers.get(bus.state.place)?.();
  document.body.classList.remove("eco-room");
  const room = $("#eco-room-view");
  if (room) room.hidden = true;
  const url = new URL(window.location.href);
  url.hash = "field";
  history.replaceState(null, "", url);
  window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" });
  paintRoomChrome(PLACES.find((p) => p.id === bus.state.place));
  if (focus) { const h = $("#field-h"); h?.setAttribute("tabindex", "-1"); h?.focus({ preventScroll: true }); }
  requestAnimationFrame(() => drawField(performance.now()));
}

function cyclePlace(dir) {
  const idx = PLACES.findIndex((p) => p.id === bus.state.place);
  const next = PLACES[(idx + dir + PLACES.length) % PLACES.length];
  showPlace(next.id, { focus: true });
}

function initRooms() {
  $("#eco-room-back")?.addEventListener("click", () => showField({ focus: true }));
  $("#eco-room-prev")?.addEventListener("click", () => cyclePlace(-1));
  $("#eco-room-next")?.addEventListener("click", () => cyclePlace(1));
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && document.body.classList.contains("eco-room")) showField({ focus: true });
  });
  bus.sub((s) => {
    const mini = $("#eco-room-threads");
    if (mini) mini.textContent = `hue ${Math.round(liveHue() * 360)} · rest ${s.restless.toFixed(2)} · tension ${s.tension.toFixed(2)}`;
  });
}

/* ---------- the field: real cell-layout, golden angle, gold threads ---------- */

let fieldLayout = null;
let fieldThreads = [];

function computeField(width, height) {
  const items = PLACES.map((p) => ({ weight: p.weight, labelLength: Math.max(p.name.length, p.code.length) }));
  fieldLayout = layoutCells(items, { width, height });
  fieldThreads = layerThreads(fieldLayout.cells, PLACES.map((p) => p.family));
}

function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function drawField(t = 0) {
  const canvas = $("#eco-field");
  if (!canvas) return;
  const { width, height, ratio } = fitCanvasToDisplaySize(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = width / ratio, h = height / ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!fieldLayout || fieldLayout.region.width !== Math.round(w) || fieldLayout.region.height !== Math.round(h)) computeField(Math.round(w), Math.round(h));
  const s = bus.state;
  const hueDeg = Math.round(liveHue() * 360);
  const rounding = liveRounding(t);
  const light = document.documentElement.getAttribute("data-theme") === "light";
  const jitter = reducedMotion.matches ? 0 : s.restless * 2.4;
  const wob = (i) => jitter ? Math.sin(t / 230 + i * 1.7) * jitter : 0;
  const breathe = (i) => (flow.on ? Math.sin(t / 1900 + i * 0.9) * 0.045 : 0);

  ctx.lineCap = "round";
  for (const e of fieldThreads) {
    const a = fieldLayout.cells[e.a], b = fieldLayout.cells[e.b];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const bow = (flow.on ? Math.sin(t / 1600 + e.a) * 10 : 6);
    const cxp = mx - dy * 0.12 + bow * 0.3, cyp = my + dx * 0.12;
    ctx.beginPath();
    ctx.moveTo(a.x + wob(e.a), a.y);
    ctx.quadraticCurveTo(cxp, cyp, b.x + wob(e.b), b.y);
    ctx.strokeStyle = `hsl(${hueDeg} 55% ${light ? 38 : 62}% / 0.55)`;
    ctx.lineWidth = 1.2 + s.tension * 2.4;
    ctx.setLineDash(flow.on ? [7, 9] : []);
    ctx.lineDashOffset = flow.on ? -t / 28 : 0;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  fieldLayout.cells.forEach((cell, i) => {
    const place = PLACES[cell.index];
    const active = s.place === place.id;
    const side = cell.side * (1 + breathe(i));
    const rBase = side / 2;
    const cx = cell.x + wob(i), cy = cell.y;
    const wobble = flow.on ? 0.10 + rounding * 0.10 : rounding * 0.06;
    const steps = 28;
    const pts = [];
    for (let k = 0; k < steps; k += 1) {
      const a = (k / steps) * Math.PI * 2;
      const rr = rBase * (1 + Math.sin(a * 3 + i * 1.3 + (flow.on ? t / 2400 : 0)) * wobble + Math.sin(a * 5 - i) * wobble * 0.4);
      pts.push([cx + Math.cos(a) * rr * (0.86 + rounding * 0.2), cy + Math.sin(a) * rr]);
    }
    ctx.beginPath();
    const mid0 = [(pts[steps - 1][0] + pts[0][0]) / 2, (pts[steps - 1][1] + pts[0][1]) / 2];
    ctx.moveTo(mid0[0], mid0[1]);
    for (let k = 0; k < steps; k += 1) {
      const p = pts[k], q = pts[(k + 1) % steps];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.closePath();
    const grad = ctx.createRadialGradient(cx - rBase * 0.3, cy - rBase * 0.35, rBase * 0.1, cx, cy, rBase * 1.25);
    grad.addColorStop(0, `hsl(${hueDeg} ${active ? 75 : 55}% ${light ? (active ? 72 : 84) : (active ? 42 : 28)}% / ${0.75 + s.contrast})`);
    grad.addColorStop(1, `hsl(${(hueDeg + 42) % 360} 55% ${light ? 88 : 18}% / ${0.55 + s.contrast * 0.5})`);
    ctx.fillStyle = grad;
    ctx.shadowColor = active ? `hsl(${hueDeg} 80% 60% / 0.55)` : "transparent";
    ctx.shadowBlur = active ? 26 : 0;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = active ? 2.6 : 1.1 + s.tension * 2.2;
    ctx.strokeStyle = `hsl(${hueDeg} ${active ? 85 : 50}% ${light ? 34 : 72}% / 0.9)`;
    ctx.stroke();
    ctx.fillStyle = light ? "#14201f" : "#f2f7f5";
    ctx.textAlign = "center";
    const namePx = Math.max(9.5, Math.min(17, side / 5.6, (side - 10) / (place.name.length * 0.58)));
    ctx.font = `700 ${namePx}px "Avenir Next", Avenir, Futura, sans-serif`;
    ctx.fillText(place.name, cx, cy - 2);
    ctx.font = `${Math.max(9, Math.min(12, side / 8))}px ui-monospace, monospace`;
    ctx.fillStyle = light ? "rgba(20,32,31,0.62)" : "rgba(242,247,245,0.62)";
    ctx.fillText(place.code, cx, cy + Math.max(12, side / 7), side - 8);
  });
}

function initField() {
  const canvas = $("#eco-field");
  const host = $("#eco-place-buttons");
  if (!canvas || !host) return;
  for (const p of PLACES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "eco-place-btn";
    btn.dataset.placeId = p.id;
    btn.setAttribute("aria-pressed", "false");
    btn.append(document.createTextNode(p.name));
    const small = document.createElement("small");
    small.textContent = p.blurb;
    btn.append(small);
    btn.addEventListener("click", () => showPlace(p.id, { focus: true }));
    host.append(btn);
  }
  canvas.addEventListener("pointerdown", (ev) => {
    if (!fieldLayout) return;
    const rect = canvas.getBoundingClientRect();
    const idx = hitTest(fieldLayout, ev.clientX - rect.left, ev.clientY - rect.top);
    if (idx >= 0) showPlace(PLACES[idx].id, { focus: true });
  });
  new ResizeObserver(() => { fieldLayout = null; drawField(); drawActivePlace(performance.now()); }).observe(canvas);
}

/* ---------- threads: style point, restlessness, condensing miniature ---------- */

function applyStyleToPage(v, t = performance.now()) {
  const root = document.documentElement.style;
  const hue = liveHue();
  const rounding = liveRounding(t);
  const deg = Math.round(hue * 360);
  root.setProperty("--eco-radius", `${(2 + rounding * 26).toFixed(1)}px`);
  root.setProperty("--eco-pad", `${(10 + v.density * 22).toFixed(1)}px`);
  root.setProperty("--eco-hue", String(deg));
  root.setProperty("--eco-hue-b", String((deg + 42) % 360));
  root.setProperty("--eco-hue-c", String((deg + 315) % 360));
  root.setProperty("--eco-strain", bus.state.tension.toFixed(3));
  try { localStorage.setItem("eido-hue", String(deg)); } catch (e) { /* storage may be blocked */ }
  const out = $("#eco-thread-style");
  if (out) out.textContent = `rounding ${rounding.toFixed(2)}, density ${v.density.toFixed(2)}, hue ${deg} degrees, contrast ${v.contrast.toFixed(2)}. Flow ${flow.on ? "on" : "off"}.`;
}

function initFlow() {
  const btn = $("#eco-flow");
  if (!btn) return;
  const paint = () => {
    btn.setAttribute("aria-pressed", flow.on ? "true" : "false");
    btn.textContent = flow.on ? "Flow: on" : "Flow: off";
  };
  paint();
  btn.addEventListener("click", () => {
    flow.on = !flow.on && !reducedMotion.matches;
    if (!flow.on) flow.phase = 0;
    paint();
    applyStyleToPage(bus.state);
    drawField(performance.now());
  });
  reducedMotion.addEventListener?.("change", () => { if (reducedMotion.matches) { flow.on = false; flow.phase = 0; paint(); } });
}

const CONDENSE_VARIANTS = [
  [
    "Most pages treat every visitor the same. Eido treats how someone reads as a signal the page can answer. The answer stays inside limits the reader can see. Nothing moves under reduced motion. Focus never moves. Text stays text.",
    "Pages usually ignore how you read. Eido answers it. Limits stay visible. Reduced motion wins. Focus stays put.",
    "Page watch you read. Page answer. Limits you see. You stay in control.",
  ],
  [
    "Condensing prose is the second answer. Cross a step and the text on screen rewrites itself shorter: concise, terse, caveman, one line. An author wrote each shorter version ahead of time. The page never calls a model.",
    "Skim more, text gets shorter. Four steps. Author wrote each version first. No model in the page.",
    "Skim. Text shrink. Author wrote small text before.",
  ],
];

let condenseLevel = 0;
let lastSqueeze = 0;
function updateCondense(restless) {
  const now = performance.now();
  const next = nextLevel(restless, condenseLevel, now - lastSqueeze, { canFold: false });
  if (next == null) return;
  condenseLevel = next;
  lastSqueeze = now;
  const passages = document.querySelectorAll("[data-eco-passage]");
  passages.forEach((el, i) => {
    if (el.dataset.full == null) el.dataset.full = el.textContent;
    el.textContent = condenseLevel === 0 ? el.dataset.full : (CONDENSE_VARIANTS[i]?.[condenseLevel - 1] ?? el.dataset.full);
  });
  paintCondenseReadout();
}

function paintCondenseReadout() {
  const out = $("#eco-condense-readout");
  if (!out) return;
  out.textContent = `Condensing level: ${LEVELS[condenseLevel].toLowerCase()}. `;
  if (condenseLevel > 0) {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "btn small"; btn.textContent = "Back to full prose";
    btn.addEventListener("click", () => {
      condenseLevel = 0;
      document.querySelectorAll("[data-eco-passage]").forEach((el) => { if (el.dataset.full != null) el.textContent = el.dataset.full; });
      paintCondenseReadout();
    });
    out.append(btn);
  } else {
    out.append(document.createTextNode("Skim the page hard to earn the first squeeze."));
  }
}

function sayRest(s) { return s > 0.6 ? "Rushing. The page is pushing back." : s > 0.3 ? "Skimming." : s > 0.08 ? "Slightly restless." : "Steady."; }

function initThreads() {
  const mixerHost = $("#eco-mixer");
  if (mixerHost) {
    mountMixerDemo(mixerHost, {
      showPresets: true,
      onChange: (_w, v) => { bus.set({ hue: v.hue, rounding: v.rounding, density: v.density, contrast: v.contrast }); },
    });
  }
  bus.sub((s, keys) => {
    if (keys.some((k) => ["hue", "rounding", "density", "contrast", "tension"].includes(k))) {
      applyStyleToPage({ hue: s.hue, rounding: s.rounding, density: s.density, contrast: s.contrast });
    }
    if (keys.includes("restless")) {
      const meter = $("#eco-thread-meter");
      const text = $("#eco-thread-rest");
      if (meter) meter.value = s.restless;
      if (text) text.textContent = `${s.restless.toFixed(2)}. ${sayRest(s.restless)}`;
      updateCondense(s.restless);
    }
    if (keys.includes("tension")) {
      const t = $("#eco-thread-tension");
      if (t) t.textContent = `${s.tension.toFixed(2)} from the toy model and the Field slider.`;
    }
    drawField(performance.now());
    drawActivePlace(performance.now());
  });
  applyStyleToPage(bus.state);
  paintCondenseReadout();
  setupReadingWeave({ onChange: (score) => bus.set({ restless: score }) });
}

/* ---------- master paint loop (still under reduced motion) ---------- */

function drawActivePlace(t) {
  const id = bus.state.place;
  if (id === "field") drawGpuField(t);
  else if (id === "simulations") drawCascade(t);
  else if (id === "identifiability") drawIdent(t);
  else if (id === "harmonic") drawHarmonicView(t);
}

function startPlaceLoops(id) {
  drawField(performance.now());
  drawActivePlace(performance.now());
  if (id === "explainer") requestAnimationFrame(() => drawActivePlace(performance.now()));
}

let rafId = 0;
let lastFlowPaint = 0;
function loop(t) {
  if (flow.on) {
    flow.phase += flow.last ? Math.min(100, t - flow.last) : 16;
    if (t - lastFlowPaint > 140) { lastFlowPaint = t; applyStyleToPage(bus.state, t); }
  }
  flow.last = t;
  drawField(t);
  drawActivePlace(t);
  rafId = requestAnimationFrame(loop);
}
function startLoop() {
  if (reducedMotion.matches) { drawField(0); drawActivePlace(0); return; }
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);
}

/* ---------- Field place: canvas miniature of the GPU rebuild (PR 6) ---------- */

function drawGpuField(t = 0) {
  const canvas = $("#eco-gpu-field");
  if (!canvas || canvas.offsetParent === null) return;
  const { width, height, ratio } = fitCanvasToDisplaySize(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = width / ratio, h = height / ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = "#05080a";
  ctx.fillRect(0, 0, w, h);
  const s = bus.state;
  const hueDeg = Math.round(s.hue * 360);
  const cols = 4, rows = 2;
  const pad = 18, gap = 14;
  const cw = (w - pad * 2 - gap * (cols - 1)) / cols;
  const ch = (h - pad * 2 - gap * (rows - 1) - 26) / rows;
  const labels = ["WEFT-COR", "EIDO-SDF", "BARY-MIX", "LAFONT-C", "SYNB-NCA", "ZERO-DOM", "GEO-SOLR", "FRACTAL3"];
  for (let i = 0; i < cols * rows; i += 1) {
    const cx = pad + (i % cols) * (cw + gap);
    const cy = pad + Math.floor(i / cols) * (ch + gap);
    const pulse = reducedMotion.matches ? 0.5 : 0.5 + 0.5 * Math.sin(t / 700 + i * 0.9);
    const heat = clamp(s.tension * (0.5 + pulse * 0.5) + s.restless * 0.25, 0, 1);
    const r = 4 + s.rounding * Math.min(cw, ch) * 0.3;
    ctx.beginPath();
    ctx.roundRect(cx, cy, cw, ch, r);
    ctx.fillStyle = `hsl(${hueDeg} 40% ${12 + heat * 22}% / 0.92)`;
    ctx.fill();
    ctx.lineWidth = 1 + s.gini * 4 + heat * 1.5;
    ctx.strokeStyle = heat > 0.72 ? "#e6d6b0" : `hsl(${hueDeg} 45% 62% / 0.85)`;
    ctx.stroke();
    ctx.fillStyle = "#e7f3f3";
    ctx.font = "650 12px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(labels[i], cx + 10, cy + 20, cw - 20);
    ctx.fillStyle = "#91a8aa";
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillText(`heat ${heat.toFixed(2)}`, cx + 10, cy + 38, cw - 20);
  }
  ctx.fillStyle = "#91a8aa";
  ctx.font = "12px ui-monospace, monospace";
  ctx.fillText(`CANVAS MINIATURE. FULL VERSION: ONE WEBGPU SHADER, NO DOM. TENSION ${s.tension.toFixed(2)} CONC ${s.gini.toFixed(2)}`, pad, h - 10);
  const out = $("#eco-gpu-readout");
  if (out) out.textContent = `tension ${s.tension.toFixed(2)} · concentration ${s.gini.toFixed(2)} · restlessness ${s.restless.toFixed(2)}`;
}

function initGpuField() {
  const tension = $("#eco-tension");
  const gini = $("#eco-gini");
  tension?.addEventListener("input", () => bus.set({ tension: Number(tension.value) / 100 }));
  gini?.addEventListener("input", () => bus.set({ gini: Number(gini.value) / 100 }));
  const arm = $("#eco-gate-arm");
  const slot = $("#eco-gate-link");
  arm?.addEventListener("click", () => {
    if (!slot || slot.childElementCount) return;
    const a = document.createElement("a");
    a.href = "https://github.com/Moissanite-Labs/weft-eido/pull/6";
    a.textContent = "Open pull request 6 on GitHub";
    slot.append(document.createTextNode(" "), a);
    arm.disabled = true;
    arm.textContent = "Link shown";
  });
}

/* ---------- Explainer place: real toy cell (PR 11) ---------- */

function tensionOf(cell) {
  return clamp(cell.accepted * 0.045 + cell.displacement * 0.45 + cell.rejected * 0.03, 0, 1);
}

function initExplainer() {
  const root = $("#eco-explainer");
  if (!root) return;
  const SEED = 20261112;
  const fresh = () => ({ cell: makeToyCell(SEED), base: makeToyCell(SEED).matrix, radius: 1.2 });
  const stepN = (state, n) => {
    let cell = state.cell;
    for (let i = 0; i < n; i += 1) cell = stepToyCell(cell, { radius: state.radius, novelty: 0.35 });
    bus.set({ tension: tensionOf(cell) });
    const slider = $("#eco-tension");
    if (slider) slider.value = String(Math.round(tensionOf(cell) * 100));
    return { ...state, cell };
  };
  mountResearchExplainer(root, {
    initialState: fresh(),
    actions: {
      step: (s) => stepN(s, 1),
      step10: (s) => stepN(s, 10),
      reset: () => { bus.set({ tension: 0 }); const slider = $("#eco-tension"); if (slider) slider.value = "0"; return fresh(); },
    },
    kpis: (s) => ({
      accepted: s.cell.accepted,
      refused: s.cell.rejected,
      drift: formatMetric(coreDrift(s.base, s.cell.matrix, s.cell.coreRows), { digits: 3 }),
      tension: formatMetric(tensionOf(s.cell), { digits: 2 }),
    }),
    render: (ctx, s, box) => {
      const { width, height } = box;
      ctx.fillStyle = "#090d0f";
      ctx.fillRect(0, 0, width, height);
      const cell = s.cell;
      const side = Math.min((height - 70) / cell.size, (width - 40) / cell.size);
      const ox = 20, oy = 40;
      ctx.font = "12px ui-monospace, monospace";
      ctx.fillStyle = "#91a8aa";
      ctx.fillText("TOY MATRIX. GOLD ROWS ARE FROZEN.", ox, 20);
      for (let i = 0; i < cell.size; i += 1) {
        for (let j = 0; j < cell.size; j += 1) {
          const v = cell.matrix[i][j];
          const a = clamp(Math.abs(v) * 2.4, 0.08, 0.85);
          ctx.fillStyle = v >= 0 ? `rgba(138,190,184,${a})` : `rgba(217,199,160,${a})`;
          ctx.fillRect(ox + j * side, oy + i * side, side - 2, side - 2);
        }
      }
      ctx.strokeStyle = "#d9c7a0";
      ctx.lineWidth = 2;
      ctx.strokeRect(ox - 1, oy - 1, cell.size * side + 1, cell.coreRows * side + 1);
      ctx.fillStyle = "#91a8aa";
      ctx.fillText(`DISPLACEMENT ${formatMetric(matrixDisplacement(s.base, cell.matrix), { digits: 3 })} · BOUND ${s.radius.toFixed(1)} · ILLUSTRATIVE`, ox, oy + cell.size * side + 22);
      const bx = ox + cell.size * side + 36;
      const bw = Math.max(90, width - bx - 24);
      const bars = [
        ["DISPLACEMENT / BOUND", clamp(matrixDisplacement(s.base, cell.matrix) / s.radius, 0, 1), "#8abeb8"],
        ["TENSION THREAD", tensionOf(cell), "#d9c7a0"],
        ["CORE DRIFT (STAYS 0)", clamp(coreDrift(s.base, cell.matrix, cell.coreRows), 0, 1), "#e6d6b0"],
      ];
      bars.forEach(([label, frac, color], i) => {
        const by = oy + i * 56;
        ctx.fillStyle = "#91a8aa";
        ctx.fillText(label, bx, by);
        ctx.fillStyle = "#162628";
        ctx.fillRect(bx, by + 8, bw, 14);
        ctx.fillStyle = color;
        ctx.fillRect(bx, by + 8, bw * frac, 14);
        ctx.fillStyle = "#e7f3f3";
        ctx.fillText(frac.toFixed(2), bx, by + 38);
      });
    },
  });
}

/* ---------- Archive place: glyph table (on main) ---------- */

function initGlyph() {
  const host = $("#eco-glyph");
  if (!host) return;
  mountGlyphDemo(host, { text: "EIDO FIELD", scale: 5, controls: true });
  const out = $("#eco-glyph-readout");
  if (out) {
    const packed = packLabel("EIDO FIELD", 16);
    out.textContent = `"EIDO FIELD" packs to ${[...packed.words].map((w) => "0x" + w.toString(16).padStart(8, "0")).join(" ")}`;
  }
}

/* ---------- Simulations place: E13 cascade at full strength (PR 14) ---------- */
/* Arm data and stage values are the simulation authors' measured claims,
   carried over unchanged from examples/simulations/e13_transitive_cascade.html. */

const E13_ARMS = {
  G4: { wire: "448 B (877.7x)", cSub: "V0 + V1 + V2 active", status: "Pythagorean Frobenius error: 0.000 · 11/12 wins", stages: [
    { nat: 54.55, hop1: -97.83, hop2: -81.90, tri: -41.72, v0: 96, v1: 12, v2: 12, t0: "Locked", t1: "Pre-graft", t2: "Pre-graft" },
    { nat: 54.55, hop1: 15.08, hop2: -81.90, tri: -4.09, v0: 96, v1: 78, v2: 12, t0: "Locked", t1: "WFSK V1", t2: "Open slot" },
    { nat: 54.55, hop1: 15.08, hop2: 35.22, tri: 34.95, v0: 96, v1: 78, v2: 90, t0: "Locked", t1: "Protected", t2: "Clean V2" } ] },
  G3: { wire: "344 B (no sketch)", cSub: "Raw SVD crowds k=3", status: "Off-manifold pA modes block Hop 2 (Theorem 2)", stages: [
    { nat: 54.55, hop1: -97.83, hop2: -81.90, tri: -41.72, v0: 96, v1: 12, v2: 12, t0: "Locked", t1: "Pre-graft", t2: "Pre-graft" },
    { nat: 54.55, hop1: 14.59, hop2: -58.10, tri: 3.68, v0: 96, v1: 76, v2: 46, t0: "Locked", t1: "Raw SVD", t2: "Crowded by pA" },
    { nat: 54.55, hop1: 9.36, hop2: -53.76, tri: 3.38, v0: 96, v1: 70, v2: 24, t0: "Locked", t1: "Retained", t2: "Blocked" } ] },
  G2: { wire: "344 B (native-only)", cSub: "V1 wiped at Hop 2", status: "Re-cleaning erases Hop-1 skill (-152.02)", stages: [
    { nat: 54.55, hop1: -97.83, hop2: -81.90, tri: -41.72, v0: 96, v1: 12, v2: 12, t0: "Locked", t1: "Pre-graft", t2: "Pre-graft" },
    { nat: 54.55, hop1: 14.59, hop2: -81.90, tri: -4.25, v0: 96, v1: 76, v2: 12, t0: "Locked", t1: "Unguarded", t2: "Pre-graft" },
    { nat: 54.55, hop1: -137.43, hop2: 35.05, tri: -15.94, v0: 96, v1: 8, v2: 90, t0: "Locked", t1: "Wiped", t2: "Acquired" } ] },
  G1: { wire: "344 B (ungated)", cSub: "Carrier k=1 collision", status: "Null residual: 1.497 · Catastrophic shift drop", stages: [
    { nat: 54.55, hop1: -97.83, hop2: -81.90, tri: -41.72, v0: 96, v1: 12, v2: 12, t0: "Native", t1: "Pre-graft", t2: "Pre-graft" },
    { nat: -62.40, hop1: -48.10, hop2: -81.90, tri: -64.13, v0: 32, v1: 30, v2: 12, t0: "Drift", t1: "Collision", t2: "Pre-graft" },
    { nat: -137.00, hop1: -107.69, hop2: -62.81, tri: -102.50, v0: 10, v1: 14, v2: 22, t0: "Collapse", t1: "Interference", t2: "Interference" } ] },
};

const cascade = { arm: "G4", t: 0, playing: true, last: 0 };
const lerpN = (a, b, u) => a + (b - a) * u;
const fmtS = (v) => (v >= 0 ? "+" : "") + v.toFixed(2);

function e13State() {
  const cfg = E13_ARMS[cascade.arm];
  const t = cascade.t;
  const first = t < 0.5;
  const sA = first ? cfg.stages[0] : cfg.stages[1];
  const sB = first ? cfg.stages[1] : cfg.stages[2];
  const u = first ? t / 0.5 : (t - 0.5) / 0.5;
  const st = u > 0.55 ? sB : sA;
  return {
    cfg, u, st,
    phase: t < 0.08 ? "Pre" : first ? "Hop 1 (A to B to C)" : "Hop 2 (B to C)",
    nat: lerpN(sA.nat, sB.nat, u), hop1: lerpN(sA.hop1, sB.hop1, u),
    hop2: lerpN(sA.hop2, sB.hop2, u), tri: lerpN(sA.tri, sB.tri, u),
    v0: lerpN(sA.v0, sB.v0, u), v1: lerpN(sA.v1, sB.v1, u), v2: lerpN(sA.v2, sB.v2, u),
    pkt1: first ? u : 1, pkt2: first ? -1 : u,
  };
}

function paintCascadeReadout() {
  const s = e13State();
  const out = $("#eco-cascade-readout");
  if (out) out.textContent = `Native ${fmtS(s.nat)} · Hop 1 ${fmtS(s.hop1)} · Hop 2 ${fmtS(s.hop2)} · Tri-skill ${fmtS(s.tri)} · Wire ${s.cfg.wire}`;
  const status = $("#eco-cascade-status");
  if (status) status.textContent = `${cascade.arm}: ${s.cfg.cSub}. ${s.cfg.status}`;
  const phase = $("#eco-cascade-phase");
  if (phase) phase.textContent = s.phase;
}

function drawCascade(t = 0) {
  const canvas = $("#eco-cascade");
  if (!canvas || canvas.offsetParent === null) return;
  if (cascade.playing && !reducedMotion.matches) {
    const dt = cascade.last ? Math.min(80, t - cascade.last) : 16;
    cascade.t = (cascade.t + dt / 9000) % 1;
    const scrub = $("#eco-scrub");
    if (scrub && document.activeElement !== scrub) scrub.value = String(Math.round(cascade.t * 1000));
  }
  cascade.last = t;
  const { width, height, ratio } = fitCanvasToDisplaySize(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = width / ratio, h = height / ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const s = e13State();
  const hueDeg = Math.round(liveHue() * 360);
  const cy = h * 0.42;
  const xs = [w * 0.16, w * 0.5, w * 0.84];
  const names = ["CELL A · DONOR", "CELL B · RELAY", "CELL C · CHIMERA"];
  const occ = [s.v0, s.v1, s.v2];
  const tags = [s.st.t0, s.st.t1, s.st.t2];
  ctx.strokeStyle = `hsl(${hueDeg} 55% 62% / 0.55)`;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(xs[0], cy); ctx.lineTo(xs[2], cy); ctx.stroke();
  xs.forEach((x, i) => {
    const r = 30 + occ[i] * 0.22;
    ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hueDeg} 55% ${24 + occ[i] * 0.18}% / 0.92)`; ctx.fill();
    ctx.strokeStyle = `hsl(${hueDeg} 65% 68%)`; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.fillStyle = "#f2f7f5"; ctx.font = "700 11px ui-monospace, monospace"; ctx.textAlign = "center";
    ctx.fillText(names[i], x, cy - 4);
    ctx.font = "11px ui-monospace, monospace"; ctx.fillStyle = "rgba(242,247,245,0.7)";
    ctx.fillText(tags[i], x, cy + 12);
    const bw = 110, bx = x - bw / 2, by = h - 62;
    ctx.fillStyle = "rgba(242,247,245,0.14)"; ctx.fillRect(bx, by, bw, 12);
    ctx.fillStyle = `hsl(${hueDeg} 65% 62%)`; ctx.fillRect(bx, by, bw * clamp(occ[i] / 100, 0, 1), 12);
    ctx.fillStyle = "rgba(242,247,245,0.75)"; ctx.font = "10px ui-monospace, monospace";
    ctx.fillText(`V${i} ${occ[i].toFixed(0)}`, x, by + 28);
  });
  const dot = (x, y) => { ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fillStyle = "#f7efdc"; ctx.fill(); };
  dot(xs[0] + (xs[1] - xs[0]) * s.pkt1, cy - 16);
  if (s.pkt2 >= 0) { dot(xs[1] + (xs[2] - xs[1]) * s.pkt2, cy - 16); dot(xs[1] + (xs[2] - xs[1]) * clamp(s.pkt2 * 1.15 - 0.15, 0, 1), cy + 16); }
  ctx.fillStyle = "rgba(242,247,245,0.65)"; ctx.font = "11px ui-monospace, monospace"; ctx.textAlign = "left";
  ctx.fillText(`E13 · 3-CELL TRANSITIVE CASCADE · ${s.phase.toUpperCase()} · TRI-SKILL ${fmtS(s.tri)}`, 16, 22);
  paintCascadeReadout();
  const tension = clamp(0.5 - s.tri / 220, 0.05, 0.95);
  if (Math.abs(bus.state.tension - tension) > 0.02 && bus.state.place === "simulations") bus.set({ tension });
}

function initCascade() {
  for (const btn of document.querySelectorAll("[data-arm]")) {
    btn.addEventListener("click", () => {
      cascade.arm = btn.dataset.arm;
      for (const b of document.querySelectorAll("[data-arm]")) b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      drawCascade(performance.now());
    });
  }
  const play = $("#eco-cascade-play");
  const paintPlay = () => { if (play) { play.setAttribute("aria-pressed", cascade.playing ? "true" : "false"); play.textContent = cascade.playing ? "Pause" : "Play"; } };
  if (reducedMotion.matches) cascade.playing = false;
  paintPlay();
  play?.addEventListener("click", () => { cascade.playing = !cascade.playing; paintPlay(); drawCascade(performance.now()); });
  const scrub = $("#eco-scrub");
  scrub?.addEventListener("input", () => { cascade.t = Number(scrub.value) / 1000; drawCascade(performance.now()); });
  stoppers.set("simulations", () => { cascade.playing = false; paintPlay(); });
}


/* ---------- Identifiability place: Chebyshev explorer model (PR 15) ---------- */
/* Response law, worlds and KPIs carried over from
   examples/visualizations/project-asma-chebyshev-identifiability-explorer.html. */

const EPS_BENCH = 1 / 60;
const qResp = (p, r, c) => (r * p + c * (1 - p)) / (r * p + (1 - p));

function identValues() {
  const pL = Number($("#eco-pl")?.value ?? 50) / 1000;
  const pH = Number($("#eco-ph")?.value ?? 375) / 1000;
  const alpha = Number($("#eco-alpha")?.value ?? 0) / 1000;
  const yS = (p) => (1 - alpha) * qResp(p, 16, 0) + alpha;
  const ySL = yS(pL), ySH = yS(pH);
  const q25L = qResp(pL, 11, 0.25), q25H = qResp(pH, 11, 0.25);
  const epsDiff = Math.abs((ySH - ySL) - (q25H - q25L)) / 4;
  const epsLinf = Math.max(Math.abs(ySL - q25L), Math.abs(ySH - q25H)) / 2;
  const pivOff = yS(0.20) - 0.80;
  return { pL, pH, alpha, yS, ySL, ySH, q25L, q25H, epsDiff, epsLinf, pivOff };
}

function drawIdent() {
  const canvas = $("#eco-ident");
  if (!canvas || canvas.offsetParent === null) return;
  const { width, height, ratio } = fitCanvasToDisplaySize(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = width / ratio, h = height / ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const v = identValues();
  const hueDeg = Math.round(liveHue() * 360);
  const X0 = 52, X1 = w - 24, Y0 = h - 46, Y1 = 30;
  const xPx = (p) => X0 + p * (X1 - X0);
  const yPx = (q) => Y0 - q * (Y0 - Y1);
  ctx.font = "11px ui-monospace, monospace";
  for (const yv of [0.25, 0.5, 0.8, 1]) {
    ctx.strokeStyle = "rgba(242,247,245,0.14)"; ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.moveTo(X0, yPx(yv)); ctx.lineTo(X1, yPx(yv)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "rgba(242,247,245,0.6)"; ctx.textAlign = "right"; ctx.fillText(yv.toFixed(2), X0 - 8, yPx(yv) + 4);
  }
  const worlds = [
    ["C25", (p) => qResp(p, 11, 0.25), `hsl(${hueDeg} 60% 66%)`, 2.2],
    ["C50", (p) => qResp(p, 6, 0.5), `hsl(${(hueDeg + 90) % 360} 55% 62% / 0.75)`, 1.4],
    ["C75", (p) => qResp(p, 1, 0.75), `hsl(${(hueDeg + 180) % 360} 55% 62% / 0.75)`, 1.4],
    ["S+BLEED", v.yS, "#f7efdc", 2.6],
  ];
  ctx.textAlign = "left";
  worlds.forEach(([label, fn, color, lw], wi) => {
    ctx.beginPath();
    for (let i = 0; i <= 120; i += 1) {
      const p = i / 120;
      const px = xPx(p), py = yPx(clamp(fn(p), 0, 1.05));
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
    ctx.fillStyle = color; ctx.fillText(label, X1 - 64, Y1 + 14 + wi * 15);
  });
  for (const [p, yA, yB] of [[v.pL, v.ySL, v.q25L], [v.pH, v.ySH, v.q25H]]) {
    ctx.strokeStyle = "rgba(247,239,220,0.5)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(xPx(p), Y0); ctx.lineTo(xPx(p), Y1); ctx.stroke();
    for (const [y, c] of [[yA, "#f7efdc"], [yB, `hsl(${hueDeg} 60% 66%)`]]) {
      ctx.beginPath(); ctx.arc(xPx(p), yPx(y), 5, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill();
    }
  }
  ctx.fillStyle = "rgba(242,247,245,0.7)"; ctx.textAlign = "center";
  ctx.fillText(`pL ${v.pL.toFixed(3)}`, xPx(v.pL), Y0 + 18);
  ctx.fillText(`pH ${v.pH.toFixed(3)}`, xPx(v.pH), Y0 + 18);
  ctx.textAlign = "left"; ctx.fillStyle = "rgba(242,247,245,0.65)";
  ctx.fillText("RESPONSE WORLDS. DOTS: READINGS AT THE TWO SAMPLING POINTS.", X0, 18);
  const out = $("#eco-ident-readout");
  if (out) {
    const verdict = (e) => (e >= EPS_BENCH ? "clears 1/60" : "under the floor");
    out.textContent = `Slope separation ${v.epsDiff.toFixed(5)} (${verdict(v.epsDiff)}) · Chebyshev L-inf ${v.epsLinf.toFixed(5)} (${verdict(v.epsLinf)}) · Pivot offset ${v.pivOff >= 0 ? "+" : ""}${v.pivOff.toFixed(5)} · Bleed ${(v.alpha * 100).toFixed(1)}%`;
  }
}

function initIdent() {
  for (const id of ["#eco-pl", "#eco-ph", "#eco-alpha"]) $(id)?.addEventListener("input", () => drawIdent());
  const presets = { opt: [50, 375, 0], trap: [50, 375, 161], deep: [25, 429, 0] };
  for (const btn of document.querySelectorAll("[data-preset]")) {
    btn.addEventListener("click", () => {
      const [pl, ph, a] = presets[btn.dataset.preset] || presets.opt;
      const set = (id, val) => { const el = $(id); if (el) el.value = String(val); };
      set("#eco-pl", pl); set("#eco-ph", ph); set("#eco-alpha", a);
      drawIdent();
    });
  }
}


/* ---------- Harmonic place: live tones from the threads (PR 17) ---------- */

const harmonic = { ctx: null, oscs: [], gain: null, timer: 0, playing: false };

function chordFreqs() {
  const s = bus.state;
  const root = 110 * Math.pow(2, liveHue());
  return [root, root * (1.25 + s.tension * 0.22), root * (1.5 + s.tension * 0.18)];
}

function drawHarmonicView() {
  const canvas = $("#eco-harmonic-view");
  if (!canvas || canvas.offsetParent === null) return;
  const { width, height, ratio } = fitCanvasToDisplaySize(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = width / ratio, h = height / ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const freqs = chordFreqs();
  const labels = ["ROOT (HUE)", "THIRD (TENSION)", "FIFTH (TENSION)"];
  const hueDeg = Math.round(liveHue() * 360);
  const bw = Math.min(190, (w - 140) / 3);
  const groupW = bw * 3 + 48;
  const startX = Math.max(24, (w - groupW) / 2);
  freqs.forEach((f, i) => {
    const bh = clamp((f - 80) / 240, 0.12, 1) * (h - 84);
    const x = startX + i * (bw + 24);
    ctx.fillStyle = harmonic.playing ? `hsl(${hueDeg} 70% 62%)` : `hsl(${hueDeg} 38% 34%)`;
    ctx.fillRect(x, h - 34 - bh, bw, bh);
    ctx.fillStyle = "#e7f3f3"; ctx.font = "12px ui-monospace, monospace"; ctx.textAlign = "center";
    ctx.fillText(`${f.toFixed(0)} HZ`, x + bw / 2, h - 40 - bh);
    ctx.fillStyle = "#91a8aa";
    ctx.fillText(labels[i], x + bw / 2, h - 16);
  });
}

function harmonicStop() {
  if (!harmonic.playing) return;
  harmonic.playing = false;
  clearInterval(harmonic.timer);
  for (const o of harmonic.oscs) { try { o.stop(); } catch { /* already stopped */ } }
  harmonic.oscs = [];
  harmonic.ctx?.close().catch(() => {});
  harmonic.ctx = null;
  const btn = $("#eco-harmonic-play");
  if (btn) { btn.setAttribute("aria-pressed", "false"); btn.textContent = "Play live chord"; }
  const out = $("#eco-harmonic-readout");
  if (out) out.textContent = "Silent. Press play to hear the current state.";
  drawHarmonicView();
}

function initHarmonic() {
  const btn = $("#eco-harmonic-play");
  btn?.addEventListener("click", async () => {
    if (harmonic.playing) { harmonicStop(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    const out = $("#eco-harmonic-readout");
    if (!AC) { if (out) out.textContent = "This browser has no Web Audio. The chord still shows above."; return; }
    harmonic.ctx = new AC();
    await harmonic.ctx.resume();
    harmonic.gain = harmonic.ctx.createGain();
    harmonic.gain.gain.value = 0.06;
    harmonic.gain.connect(harmonic.ctx.destination);
    harmonic.oscs = chordFreqs().map((f, i) => {
      const o = harmonic.ctx.createOscillator();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = f;
      o.connect(harmonic.gain);
      o.start();
      return o;
    });
    harmonic.playing = true;
    btn.setAttribute("aria-pressed", "true");
    btn.textContent = "Stop";
    const tick = () => {
      if (!harmonic.ctx) return;
      const t = harmonic.ctx.currentTime;
      chordFreqs().forEach((f, i) => harmonic.oscs[i]?.frequency.setTargetAtTime(f, t, 0.15));
      harmonic.gain.gain.setTargetAtTime(0.04 + (1 - bus.state.restless) * 0.04, t, 0.2);
      if (out) out.textContent = `Playing. Root ${chordFreqs()[0].toFixed(0)} Hz. Move the style point or step the toy model and listen.`;
      drawHarmonicView();
    };
    tick();
    harmonic.timer = setInterval(tick, 450);
  });
  stoppers.set("harmonic", harmonicStop);
}

/* ---------- boot ---------- */

function boot() {
  renderStatusAndRecord();
  initField();
  initThreads();
  initGpuField();
  initExplainer();
  initGlyph();
  initCascade();
  initIdent();
  initHarmonic();
  initFlow();
  initRooms();
  const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("place");
  if (PLACES.some((p) => p.id === fromHash)) showPlace(fromHash); else { paintRoomChrome(PLACES[0]); showField(); }
  startLoop();
  reducedMotion.addEventListener?.("change", startLoop);
  new MutationObserver(() => { drawField(performance.now()); drawActivePlace(performance.now()); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

boot();
