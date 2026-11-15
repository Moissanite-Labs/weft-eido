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
  { id: "simulations", code: "E08-E13", name: "Simulations", blurb: "Sessions you can run", weight: 6, family: "research", state: "Pull request 14. Approved. Checks green", badge: "approved", how: "Miniature cascade here. Full simulations linked. Their numbers are their authors' claims." },
  { id: "identifiability", code: "CHEB ID", name: "Identifiability", blurb: "Can two measures split four cases?", weight: 5, family: "research", state: "Pull request 15. Approved. Checks green", badge: "approved", how: "Miniature here. Full Chebyshev explorer linked." },
  { id: "harmonic", code: "CHORDS", name: "Harmonic", blurb: "The system as sound", weight: 6, family: "research", state: "Pull request 17. Approved. Checks green", badge: "approved", how: "Live tones from the three threads, made in your browser. Recorded pieces are CC BY-NC 4.0: share with credit, no commercial use." },
];

export const RECORD = [
  ...PLACES.map((p) => ({ work: p.name, state: p.state, badge: p.badge, how: p.how })),
  { work: "Condense panel fix (pull request 8)", state: "Checks green. Awaits review", badge: "approved", how: "Not included. This page works without it. It can land on its own." },
  { work: "Readme line (pull request 9)", state: "Changes requested on sign-off only. The edit itself was called fine", badge: "blocked", how: "Not applied here. One sign-off fixes it." },
  { work: "Angles hub (pull request 18)", state: "Changes requested. Two checks fail through pull request 6", badge: "blocked", how: "Superseded by this page. No code from pull request 6 is included." },
];

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
function showPlace(id, { focus = false } = {}) {
  const prev = bus.state.place;
  if (prev !== id) stoppers.get(prev)?.();
  bus.set({ place: id });
  for (const el of document.querySelectorAll("[data-place]")) el.hidden = el.dataset.place !== id;
  for (const btn of document.querySelectorAll(".eco-place-btn")) btn.setAttribute("aria-pressed", btn.dataset.placeId === id ? "true" : "false");
  const place = PLACES.find((p) => p.id === id);
  const readout = $("#eco-field-readout");
  if (readout && place) {
    const packed = packLabel(place.code, 8);
    const words = [...packed.words].map((w) => "0x" + w.toString(16).padStart(8, "0")).join(" ");
    readout.textContent = `${place.name}\n${place.state}\nGlyph label "${place.code}" packs to ${words}`;
  }
  const url = new URL(window.location.href);
  url.hash = `place=${id}`;
  history.replaceState(null, "", url);
  if (focus) $(`[data-place="${id}"] h3`)?.setAttribute("tabindex", "-1"), $(`[data-place="${id}"] h3`)?.focus({ preventScroll: true });
  startPlaceLoops(id);
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
  const hueDeg = Math.round(s.hue * 360);
  const light = document.documentElement.getAttribute("data-theme") === "light";
  const jitter = reducedMotion.matches ? 0 : s.restless * 2.2;
  const wob = (i) => jitter ? Math.sin(t / 240 + i * 1.7) * jitter : 0;

  ctx.strokeStyle = light ? "rgba(120, 100, 40, 0.55)" : "rgba(217, 199, 160, 0.5)";
  ctx.lineWidth = 1 + s.tension * 2;
  for (const e of fieldThreads) {
    const a = fieldLayout.cells[e.a], b = fieldLayout.cells[e.b];
    ctx.beginPath(); ctx.moveTo(a.x + wob(e.a), a.y); ctx.lineTo(b.x + wob(e.b), b.y); ctx.stroke();
  }
  fieldLayout.cells.forEach((cell, i) => {
    const place = PLACES[cell.index];
    const active = s.place === place.id;
    const x = cell.x - cell.half + wob(i), y = cell.y - cell.half;
    const side = cell.side;
    const r = Math.min(side / 2, 4 + s.rounding * side * 0.32);
    ctx.beginPath();
    ctx.roundRect(x, y, side, side, r);
    ctx.fillStyle = `hsl(${hueDeg} ${active ? 45 : 25}% ${light ? (active ? 82 : 90) : (active ? 26 : 17)}% / ${0.55 + s.contrast + (active ? 0.25 : 0)})`;
    ctx.fill();
    ctx.lineWidth = active ? 2.4 : 1 + s.tension * 2.2;
    ctx.strokeStyle = active ? (light ? "#7a5f1e" : "#d9c7a0") : `hsl(${hueDeg} 35% ${light ? 45 : 55}% / 0.8)`;
    ctx.stroke();
    ctx.fillStyle = light ? "#0f2425" : "#e7f3f3";
    ctx.textAlign = "center";
    const namePx = Math.max(9.5, Math.min(16, side / 6, (side - 12) / (place.name.length * 0.6)));
    ctx.font = `650 ${namePx}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(place.name, cell.x + wob(i), cell.y - 2);
    ctx.font = `${Math.max(9, Math.min(12, side / 8))}px ui-monospace, monospace`;
    ctx.fillStyle = light ? "#526b6c" : "#91a8aa";
    ctx.fillText(place.code, cell.x + wob(i), cell.y + Math.max(12, side / 7), side - 8);
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

function applyStyleToPage(v) {
  const root = document.documentElement.style;
  root.setProperty("--eco-radius", `${(2 + v.rounding * 24).toFixed(1)}px`);
  root.setProperty("--eco-pad", `${(10 + v.density * 22).toFixed(1)}px`);
  root.setProperty("--eco-hue", String(Math.round(v.hue * 360)));
  root.setProperty("--eco-strain", bus.state.tension.toFixed(3));
  const out = $("#eco-thread-style");
  if (out) out.textContent = `rounding ${v.rounding.toFixed(2)}, density ${v.density.toFixed(2)}, hue ${Math.round(v.hue * 360)} degrees, contrast ${v.contrast.toFixed(2)}.`;
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
function loop(t) {
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

/* ---------- Simulations place: miniature cascade (PR 14) ---------- */

const cascade = { dots: [], delivered: 0, lost: 0, auto: false, lastAuto: 0 };

function cascadeSend() { cascade.dots.push({ p: 0, leg: 0 }); }

function drawCascade(t = 0) {
  const canvas = $("#eco-cascade");
  if (!canvas || canvas.offsetParent === null) return;
  const { width, height, ratio } = fitCanvasToDisplaySize(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = width / ratio, h = height / ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const s = bus.state;
  const hueDeg = Math.round(s.hue * 360);
  const cy = h / 2;
  const xs = [w * 0.18, w * 0.5, w * 0.82];
  ctx.strokeStyle = "rgba(217,199,160,0.55)";
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(xs[0], cy); ctx.lineTo(xs[2], cy); ctx.stroke();
  const names = ["CELL A", "CELL B", "CELL C"];
  xs.forEach((x, i) => {
    ctx.beginPath(); ctx.arc(x, cy, 34, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hueDeg} 35% 20% / 0.9)`; ctx.fill();
    ctx.strokeStyle = `hsl(${hueDeg} 45% 62%)`; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = "#e7f3f3"; ctx.font = "650 12px ui-monospace, monospace"; ctx.textAlign = "center";
    ctx.fillText(names[i], x, cy + 4);
  });
  if (cascade.auto && !reducedMotion.matches && t - cascade.lastAuto > 900 - s.restless * 500) { cascade.lastAuto = t; cascadeSend(); }
  const lossP = 0.08 + s.tension * 0.45 + s.restless * 0.15;
  const speed = reducedMotion.matches ? 0.012 : 0.006 + s.restless * 0.008;
  cascade.dots = cascade.dots.filter((d) => {
    d.p += speed;
    if (d.p >= 1) {
      if (Math.random() < lossP) { cascade.lost += 1; paintCascadeReadout(); return false; }
      d.leg += 1; d.p = 0;
      if (d.leg > 1) { cascade.delivered += 1; paintCascadeReadout(); return false; }
    }
    const x = xs[d.leg] + (xs[d.leg + 1] - xs[d.leg]) * d.p;
    ctx.beginPath(); ctx.arc(x, cy - 14, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#d9c7a0"; ctx.fill();
    return true;
  });
  ctx.fillStyle = "#91a8aa"; ctx.font = "12px ui-monospace, monospace"; ctx.textAlign = "left";
  ctx.fillText(`HAND-OFF LOSS CHANCE ${(lossP * 100).toFixed(0)} PERCENT AT THIS TENSION`, 16, h - 14);
}

function paintCascadeReadout() {
  const out = $("#eco-cascade-readout");
  if (out) out.textContent = `Delivered ${cascade.delivered} · Lost ${cascade.lost}`;
}

function initCascade() {
  $("#eco-cascade-send")?.addEventListener("click", () => { cascadeSend(); drawCascade(performance.now()); });
  const auto = $("#eco-cascade-auto");
  auto?.addEventListener("click", () => {
    cascade.auto = !cascade.auto;
    auto.setAttribute("aria-pressed", cascade.auto ? "true" : "false");
    auto.textContent = cascade.auto ? "Auto send: on" : "Auto send: off";
  });
  stoppers.set("simulations", () => { cascade.auto = false; const b = $("#eco-cascade-auto"); if (b) { b.setAttribute("aria-pressed", "false"); b.textContent = "Auto send: off"; } });
}

/* ---------- Identifiability place: miniature bands (PR 15) ---------- */

function seededPoints(cx, cy, spread, seed, n = 26) {
  let a = seed >>> 0;
  const rnd = () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
  return Array.from({ length: n }, () => ({ x: cx + (rnd() * 2 - 1) * spread, y: cy + (rnd() * 2 - 1) * spread * 0.7 }));
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
  const bandInput = $("#eco-ident-band");
  const band = (bandInput ? Number(bandInput.value) : 30) / 100;
  const centers = [ [0.28, 0.34], [0.44, 0.58], [0.68, 0.38], [0.74, 0.68] ].map(([fx, fy]) => ({ x: fx * w, y: fy * h }));
  const baseR = Math.min(w, h) * 0.13;
  const r = baseR * (0.6 + band * 1.6);
  const hues = [172, 43, 205, 18];
  centers.forEach((c, i) => {
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hues[i]} 45% 55% / 0.12)`; ctx.fill();
    ctx.strokeStyle = `hsl(${hues[i]} 55% 62% / 0.8)`; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = `hsl(${hues[i]} 65% 72%)`;
    for (const pt of seededPoints(c.x, c.y, baseR * 0.8, 1000 + i * 77)) { ctx.beginPath(); ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#e7f3f3"; ctx.font = "650 12px ui-monospace, monospace"; ctx.textAlign = "center";
    ctx.fillText(`CASE ${i + 1}`, c.x, c.y - r - 8);
  });
  let apart = 0, pairs = 0;
  for (let i = 0; i < centers.length; i += 1) for (let j = i + 1; j < centers.length; j += 1) {
    pairs += 1;
    if (Math.hypot(centers[i].x - centers[j].x, centers[i].y - centers[j].y) > r * 2) apart += 1;
  }
  const out = $("#eco-ident-readout");
  if (out) out.textContent = `Pairs told apart: ${apart} of ${pairs}. Band radius ${r.toFixed(0)} px.`;
  ctx.fillStyle = "#91a8aa"; ctx.font = "12px ui-monospace, monospace"; ctx.textAlign = "left";
  ctx.fillText("TWO MEASUREMENTS. FOUR CASES. OVERLAP MEANS NO RULE CAN SPLIT THEM.", 16, h - 14);
}

function initIdent() {
  $("#eco-ident-band")?.addEventListener("input", () => drawIdent());
}

/* ---------- Harmonic place: live tones from the threads (PR 17) ---------- */

const harmonic = { ctx: null, oscs: [], gain: null, timer: 0, playing: false };

function chordFreqs() {
  const s = bus.state;
  const root = 110 * Math.pow(2, s.hue);
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
  const bw = Math.min(120, (w - 80) / 3);
  freqs.forEach((f, i) => {
    const bh = clamp((f - 100) / 500, 0.08, 1) * (h - 64);
    const x = 40 + i * (bw + 30);
    ctx.fillStyle = harmonic.playing ? "#8abeb8" : "#2e4d4f";
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
  if (btn) { btn.setAttribute("aria-pressed", "false"); btn.textContent = "Play"; }
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
  const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("place");
  showPlace(PLACES.some((p) => p.id === fromHash) ? fromHash : "style");
  startLoop();
  reducedMotion.addEventListener?.("change", startLoop);
  new MutationObserver(() => { drawField(performance.now()); drawActivePlace(performance.now()); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}

boot();
