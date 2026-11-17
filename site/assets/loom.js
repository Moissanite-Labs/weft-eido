// The loom: the one runtime every Eido page loads.
//
// It owns four things, so no page has to build its own:
//   1. The medium. One canvas of horizontal threads (a weft) behind every
//      page, moving as a sum of harmonics. Pointer, scroll, reading and
//      arrivals send ripples through it. Its clock is kept for the whole visit,
//      so moving between pages does not restart it.
//   2. Unfolding. Each block in <main> is hidden until a wavefront reaches it,
//      then revealed exactly along that front. The same front is drawn as a
//      ripple in the medium, so what you see arrive is what revealed the text.
//   3. Genesis. A short page title is first assembled from the 5×7 bits of
//      src/glyph-font.js, travelling in along the threads, then resolves into type.
//   4. Scenes. Every live figure on the site registers here and shares one
//      animation frame, one palette and one motion policy.
//
// Bounds: text stays text (masks never touch the DOM), nothing hides under
// prefers-reduced-motion or print, the medium is aria-hidden and never takes
// a pointer event, and a failsafe in theme.js shows the page if this file
// fails to load.

import { TIDE_HUE, oklchToRgb, LOOM, TAU, clamp, clamp01, smooth, partialAmps, threadDisplacement, rippleAt, rectReach, frontSpeed, unfoldProgress, frontOrigin, palette, threadGap } from "./loom-core.js";
import { glyphBit, fontCode, encodeFontTable, GLYPH_COLS, GLYPH_ROWS, GLYPH_ADVANCE } from "../../src/glyph-font.js";
import { attention } from "../../src/reading-weave.js";

const root = document.documentElement;
const reducedMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
const lightMQ = window.matchMedia("(prefers-color-scheme: light)");
const store = (kind, key, value) => {
  try {
    const s = kind === "local" ? window.localStorage : window.sessionStorage;
    if (value === undefined) return s.getItem(key);
    if (value === null) s.removeItem(key); else s.setItem(key, value);
  } catch (e) { /* storage may be blocked */ }
  return null;
};

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const now0 = performance.now();
const epoch = Number(store("session", "eido-t0")) || Date.now();
store("session", "eido-t0", String(epoch));
const returning = store("session", "eido-visited") === "1";
store("session", "eido-visited", "1");

const S = {
  hue: Number(getComputedStyle(root).getPropertyValue("--eco-hue")) || TIDE_HUE,
  vw: window.innerWidth,
  vh: window.innerHeight,
  dpr: Math.min(2, window.devicePixelRatio || 1),
  pointer: null, // { x, y, t } in viewport px
  speed: 0,      // pointer speed, [0, 1]
  jerk: 0,       // pointer jerk, [0, 1]
  scroll: 0,     // scroll velocity, [0, 1]
  scrollDir: 1,
  ripples: [],   // { x, y (page px), t0 (ms), amp, width, speed, front }
  drive: null,   // optional external amplitudes (e.g. the soundtrack)
  energyHold: 0, // extra energy a page may lend the medium
  genesis: 0,    // medium envelope, 0 → 1 as the page arrives
};

export const reduced = () => reducedMQ.matches;
const isLight = () => root.getAttribute("data-theme") === "light";
const tSession = () => (Date.now() - epoch) / 1000;

let pal = palette(S.hue, isLight());
export const currentPalette = () => pal;
const repaint = new Set();
function refreshPalette() {
  pal = palette(S.hue, isLight());
  for (const s of scenes) s.dirty = true;
  for (const fn of repaint) fn(pal);
  kick();
}

/** Set the site hue in degrees. It is carried to every page for the rest of the visit. */
export function setHue(deg) {
  const h = ((Math.round(deg) % 360) + 360) % 360;
  if (h === S.hue) return;
  S.hue = h;
  root.style.setProperty("--eco-hue", String(h));
  store("local", "eido-tide-hue", String(h));
  refreshPalette();
}
export const getHue = () => S.hue;

/** Let a page feed the medium: amps (array of partial amplitudes) or null to release. */
export function drive(amps, energy = 0) { S.drive = amps; S.energyHold = clamp01(energy); }

/** Pointer, scroll and reading signals, all bounded to [0, 1]. */
export const somatic = () => ({ x: S.pointer?.x ?? null, y: S.pointer?.y ?? null, speed: S.speed, jerk: S.jerk, scroll: S.scroll, restless: attention.restless || 0 });

/* ------------------------------------------------------------------ */
/* The medium                                                          */
/* ------------------------------------------------------------------ */

const medium = document.createElement("canvas");
medium.className = "medium";
medium.setAttribute("aria-hidden", "true");
// The one fixed layer on the site. It is the viewport itself, not a box on the page.
medium.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;display:block";
const mctx = medium.getContext("2d");

function sizeMedium() {
  S.vw = window.innerWidth;
  S.vh = window.innerHeight;
  S.dpr = Math.min(2, window.devicePixelRatio || 1);
  medium.width = Math.round(S.vw * S.dpr);
  medium.height = Math.round(S.vh * S.dpr);
}

/** Add a ripple at viewport point (x, y). amp ~ 1 for an event, ~0.3 for a gesture. */
export function ripple(x, y, amp = 1, opts = {}) {
  if (reduced()) return null;
  const r = {
    x: x + window.scrollX, y: y + window.scrollY, t0: performance.now(), amp,
    width: opts.width ?? Math.max(40, Math.hypot(S.vw, S.vh) * 0.035),
    speed: opts.speed ?? frontSpeed(S.vw, S.vh) * (opts.slow ? 0.55 : 1),
    front: !!opts.front,
  };
  S.ripples.push(r);
  while (S.ripples.length > LOOM.MAX_RIPPLES) S.ripples.shift();
  kick();
  return r;
}

const xSin = []; // cached sin(nπu) per sample column
let xSamples = [];
function cacheColumns() {
  const step = Math.max(9, S.vw / 110);
  xSamples = [];
  for (let x = 0; x <= S.vw + step; x += step) xSamples.push(Math.min(x, S.vw));
  xSin.length = 0;
  for (let k = 1; k <= LOOM.HARMONICS; k += 1) xSin.push(xSamples.map((x) => Math.sin((k * Math.PI * x) / Math.max(1, S.vw))));
}

let lastAmps = partialAmps(0);
export const mediumState = () => ({ t: tSession(), amps: lastAmps.slice(), f1: LOOM.F1, gap: threadGap(S.vh), threads: Math.ceil(S.vh / threadGap(S.vh)) });

function drawMedium(nowMs) {
  const W = S.vw, H = S.vh;
  mctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
  mctx.clearRect(0, 0, W, H);
  const t = tSession();
  const energy = clamp01(Math.max(attention.restless || 0, S.energyHold, S.scroll * 0.6, S.speed * 0.35));
  const amps = S.drive || partialAmps(t, energy);
  lastAmps = amps;
  const gap = threadGap(H);
  const par = window.scrollY * 0.22;
  const base = Math.floor(par / gap);
  const offset = par - base * gap;
  const ampPx = gap * 0.55 * S.genesis;
  const n = Math.ceil(H / gap) + 2;
  const live = S.ripples.filter((r) => (nowMs - r.t0) / 1000 < LOOM.RIPPLE_LIFE);
  S.ripples = live;
  const sx = window.scrollX, sy = window.scrollY;
  const paths = [];
  const C = new Array(LOOM.HARMONICS);
  for (let j = -1; j < n; j += 1) {
    const y0 = j * gap - offset + gap * 0.5;
    const i = j + base;
    let motion = 0;
    for (let k = 1; k <= LOOM.HARMONICS; k += 1) {
      C[k - 1] = amps[k - 1] * Math.cos(TAU * LOOM.F1 * k * t + k * i * LOOM.THREAD_PHASE);
      motion += Math.abs(C[k - 1]);
    }
    // A thread is drawn in two colours: crest where it rides above its rest
    // line, trough where it dips below, split exactly at the zero crossing.
    const up = new Path2D(), down = new Path2D();
    let prev = null;
    for (let xi = 0; xi < xSamples.length; xi += 1) {
      const x = xSamples[xi];
      let d = 0;
      for (let k = 0; k < LOOM.HARMONICS; k += 1) d += xSin[k][xi] * C[k];
      let y = y0 + d * ampPx;
      for (const r of live) {
        const age = (nowMs - r.t0) / 1000;
        const dist = Math.hypot(x - (r.x - sx), y0 - (r.y - sy));
        y += rippleAt(dist, age, r.speed, r.amp, r.width) * gap * 0.9;
      }
      if (!prev) { (d >= 0 ? up : down).moveTo(x, y); }
      else if ((prev.d >= 0) === (d >= 0)) { (d >= 0 ? up : down).lineTo(x, y); }
      else {
        const u = prev.d / (prev.d - d);
        const cx0 = prev.x + (x - prev.x) * u, cy0 = prev.y + (y - prev.y) * u;
        (prev.d >= 0 ? up : down).lineTo(cx0, cy0);
        (d >= 0 ? up : down).moveTo(cx0, cy0);
        (d >= 0 ? up : down).lineTo(x, y);
      }
      prev = { x, y, d };
    }
    paths.push(up, down);
    const alpha = (pal.light ? 0.16 : 0.12) * (0.55 + 0.45 * Math.min(1.6, motion)) * (0.35 + 0.65 * S.genesis);
    mctx.lineWidth = 1;
    mctx.strokeStyle = pal.crest(alpha); mctx.stroke(up);
    mctx.strokeStyle = pal.trough(alpha * 0.9); mctx.stroke(down);
  }
  // Each ripple glows along its own ring, so a front is visible where it is.
  for (const r of live) {
    const age = (nowMs - r.t0) / 1000;
    if (age <= 0) continue;
    const R = r.speed * age;
    const fade = (1 - age / LOOM.RIPPLE_LIFE) * Math.min(1, r.amp);
    if (fade <= 0.01) continue;
    const cx = r.x - sx, cy = r.y - sy;
    const outer = R + r.width * 2;
    const g = mctx.createRadialGradient(cx, cy, Math.max(0, R - r.width * 2), cx, cy, outer);
    g.addColorStop(0, pal.crest(0));
    g.addColorStop(0.5, pal.crest((pal.light ? 0.55 : 0.5) * fade));
    g.addColorStop(1, pal.crest(0));
    mctx.strokeStyle = g;
    mctx.lineWidth = 1.2;
    for (const p of paths) mctx.stroke(p);
  }
}

/* ------------------------------------------------------------------ */
/* Telemetry                                                           */
/* ------------------------------------------------------------------ */

function initTelemetry() {
  let lastY = window.scrollY, lastT = performance.now();
  window.addEventListener("scroll", () => {
    const t = performance.now();
    const dt = Math.max(1, t - lastT) / 1000;
    const dy = window.scrollY - lastY;
    if (dy) S.scrollDir = Math.sign(dy);
    const v = Math.abs(dy) / dt / Math.max(1, S.vh);
    S.scroll = clamp01(S.scroll * 0.6 + clamp01(v / 2.4) * 0.4);
    lastY = window.scrollY; lastT = t;
    kick();
  }, { passive: true });
  let pvx = 0, pvy = 0, travelled = 0;
  window.addEventListener("pointermove", (ev) => {
    const t = performance.now();
    const p = S.pointer;
    if (p) {
      const dt = Math.max(4, t - p.t);
      const vx = (ev.clientX - p.x) / dt, vy = (ev.clientY - p.y) / dt;
      S.speed = clamp01(S.speed * 0.8 + clamp01(Math.hypot(vx, vy) / 2.2) * 0.2);
      S.jerk = clamp01(S.jerk * 0.82 + clamp01(Math.hypot(vx - pvx, vy - pvy) / dt / 0.09) * 0.18);
      pvx = vx; pvy = vy;
      travelled += Math.hypot(ev.clientX - p.x, ev.clientY - p.y);
      if (travelled > Math.hypot(S.vw, S.vh) * 0.16 && ev.pointerType !== "touch") {
        travelled = 0;
        ripple(ev.clientX, ev.clientY, 0.18 + S.speed * 0.4, { slow: true });
      }
    }
    S.pointer = { x: ev.clientX, y: ev.clientY, t };
  }, { passive: true });
  window.addEventListener("pointerdown", (ev) => {
    S.pointer = { x: ev.clientX, y: ev.clientY, t: performance.now() };
    ripple(ev.clientX, ev.clientY, 0.7);
  }, { passive: true });
  // A link remembers where it was pressed, so the next page arrives from there.
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest?.("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    let url;
    try { url = new URL(a.href, location.href); } catch (e) { return; }
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
    store("session", "eido-origin", JSON.stringify({ x: ev.clientX / S.vw, y: ev.clientY / S.vh }));
  });
}

function decayTelemetry(dt) {
  S.speed *= Math.exp(-dt / 0.5);
  S.jerk *= Math.exp(-dt / 0.42);
  S.scroll *= Math.exp(-dt / 0.3);
}

/* ------------------------------------------------------------------ */
/* Unfolding                                                           */
/* ------------------------------------------------------------------ */

// A scroll box unfolds as one block: a front cannot reach what is scrolled out of sight inside it.
const UNIT = "h1,h2,h3,h4,p,ul,ol,dl,figure,pre,table,blockquote,canvas,svg,img,hr,details,form,audio,.field,.controls,.readout,.scrollbox,[data-unfold]";
const units = new Map();     // element → { front, start }
const isUnit = new WeakSet();
let unfoldOn = false;
let pendingEntry = [];

const unitIO = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        const r = e.boundingClientRect;
        if (!r.width && !r.height) { finishUnit(e.target); continue; } // hidden since it was registered
        if (e.isIntersecting) { const u = units.get(e.target); if (u && !u.front && !u.hold) pendingEntry.push(e.target); }
      }
      if (pendingEntry.length) kick();
    }, { rootMargin: "0px 0px -4% 0px" })
  : null;

function topmostUnits(scope) {
  const found = [...scope.querySelectorAll(UNIT)];
  if (scope.matches?.(UNIT)) found.unshift(scope);
  const set = new Set(found);
  return found.filter((el) => {
    if (el.closest("[data-no-unfold]")) return false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (set.has(p) || isUnit.has(p)) return false;
      if (p.id === "main") break;
    }
    return true;
  });
}

/** A list taller than the screen unfolds item by item, so its far end is not left waiting for one front. */
function expandTall(els) {
  const out = [];
  for (const el of els) {
    if (el.matches("ul, ol") && el.children.length > 1 && el.getBoundingClientRect().height > window.innerHeight * 1.1) out.push(...el.children);
    else out.push(el);
  }
  return out;
}

function addUnit(el, hold = false) {
  if (isUnit.has(el)) return;
  if (!el.getClientRects().length) return; // no box (display: none): nothing to reveal
  isUnit.add(el);
  units.set(el, { front: null, hold });
  el.setAttribute("data-u", "");
  unitIO?.observe(el);
}

function finishUnit(el) {
  units.delete(el);
  unitIO?.unobserve(el);
  el.removeAttribute("data-u");
  for (const v of ["--ux", "--uy", "--ur", "--uw"]) el.style.removeProperty(v);
  if (!el.getAttribute("style")) el.removeAttribute("style");
}

function revealAll() {
  for (const el of [...units.keys()]) finishUnit(el);
  root.classList.remove("loom-pending");
}

function initUnfold(mainEl, held) {
  if (!mainEl || reduced() || !unitIO) { revealAll(); return; }
  unfoldOn = true;
  root.classList.add("loom-unfold");
  for (const el of expandTall(topmostUnits(mainEl))) if (!held.has(el)) addUnit(el);
  for (const el of held) addUnit(el, true);
  root.classList.remove("loom-pending");
  new MutationObserver((records) => {
    for (const r of records) for (const node of r.addedNodes) {
      if (node.nodeType !== 1 || !mainEl.contains(node)) continue;
      // Already inside a unit (pending or revealed): it arrives with its parent.
      let inside = false;
      for (let p = node.parentElement; p && p !== mainEl; p = p.parentElement) if (isUnit.has(p)) { inside = true; break; }
      if (!inside) for (const el of expandTall(topmostUnits(node))) { addUnit(el); }
    }
  }).observe(mainEl, { childList: true, subtree: true });
  window.addEventListener("beforeprint", revealAll);
  // Focus never lands on something still hidden: a block reached by keyboard unfolds at once.
  document.addEventListener("focusin", (ev) => {
    for (let p = ev.target; p && p !== mainEl; p = p.parentElement) if (units.has(p)) finishUnit(p);
  });
}

function startFront(origin, els, opts = {}) {
  const r = ripple(origin.x, origin.y, opts.amp ?? 0.8, { front: true, width: Math.hypot(S.vw, S.vh) * LOOM.FRONT_EDGE * 0.5 });
  if (!r) { els.forEach(finishUnit); return; }
  if (opts.delay) r.t0 += opts.delay;
  for (const el of els) { const u = units.get(el); if (u) { u.front = r; u.hold = false; u.start = performance.now(); } }
}

function updateUnfold(nowMs) {
  if (!unfoldOn) return;
  if (pendingEntry.length) {
    const els = pendingEntry.filter((el) => units.get(el) && !units.get(el).front);
    pendingEntry = [];
    if (els.length) {
      const rect = els[0].getBoundingClientRect();
      startFront(frontOrigin({ pointer: S.pointer, now: nowMs, vw: S.vw, vh: S.vh, scrollDir: S.scrollDir, rect }), els, { amp: 0.55 });
    }
  }
  const edge = Math.hypot(S.vw, S.vh) * LOOM.FRONT_EDGE;
  const reads = [];
  for (const [el, u] of units) {
    if (!u.front) continue;
    reads.push([el, u, el.getBoundingClientRect()]);
  }
  for (const [el, u, rect] of reads) {
    const f = u.front;
    const radius = Math.max(0, ((nowMs - f.t0) / 1000) * f.speed);
    const ox = f.x - window.scrollX - rect.left;
    const oy = f.y - window.scrollY - rect.top;
    const reach = rectReach(ox, oy, { left: 0, top: 0, width: rect.width, height: rect.height });
    const prog = unfoldProgress(radius, reach, edge);
    if (prog >= 1 || nowMs - u.start > 9000 || rect.width === 0) { finishUnit(el); continue; }
    el.style.setProperty("--ux", `${ox.toFixed(1)}px`);
    el.style.setProperty("--uy", `${oy.toFixed(1)}px`);
    el.style.setProperty("--ur", `${radius.toFixed(1)}px`);
    el.style.setProperty("--uw", `${edge.toFixed(1)}px`);
  }
}

/** Reveal an element now (for content a reader asked for, like an opened panel). */
export function unfoldNow(el) { if (units.has(el)) finishUnit(el); }

/* ------------------------------------------------------------------ */
/* Genesis: a short title assembled from glyph bits                    */
/* ------------------------------------------------------------------ */

const FONT = encodeFontTable();
let genesis = null;

function glyphTargets(text, lineRects, fontPx) {
  // Size the bits so the bitmap word spans the same width as the set type.
  const chars = text.length;
  const total = lineRects.reduce((a, r) => a + r.width, 0) || fontPx * chars * 0.55;
  const cell = Math.max(1.5, Math.min(fontPx / 8.2, total / (chars * GLYPH_ADVANCE)));
  const adv = GLYPH_ADVANCE * cell;
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const pts = [];
  let w = 0;
  lineRects.forEach((rect, li) => {
    const perLine = Math.max(1, Math.floor((rect.width + adv) / adv));
    let line = "";
    while (w < words.length) {
      const next = line ? `${line} ${words[w]}` : words[w];
      if (next.length > perLine && line && li < lineRects.length - 1) break;
      line = next; w += 1;
    }
    const top = rect.top + (rect.height - GLYPH_ROWS * cell) / 2;
    [...line].forEach((ch, ci) => {
      const code = fontCode(ch);
      const bits = [FONT[code * 2], FONT[code * 2 + 1]];
      for (let row = 0; row < GLYPH_ROWS; row += 1) for (let col = 0; col < GLYPH_COLS; col += 1) {
        if (glyphBit(bits, col, row)) pts.push({ x: rect.left + ci * adv + (col + 0.5) * cell, y: top + (row + 0.5) * cell });
      }
    });
  });
  return { pts, cell };
}

function prepareGenesis(mainEl) {
  const h1 = mainEl?.querySelector("h1");
  if (!h1 || reduced() || h1.hasAttribute("data-no-genesis")) return null;
  const text = h1.textContent.replace(/\s+/g, " ").trim();
  if (!text || text.length > 34) return null;
  const r = h1.getBoundingClientRect();
  const fontPx = parseFloat(getComputedStyle(h1).fontSize) || 48;
  const range = document.createRange();
  range.selectNodeContents(h1);
  const sx = window.scrollX, sy = window.scrollY;
  const lineRects = [...range.getClientRects()]
    .filter((q) => q.width > 1 && q.height > 1)
    .map((q) => ({ left: q.left + sx, top: q.top + sy, width: q.width, height: q.height }));
  if (!lineRects.length) return null;
  const rect = { left: r.left + sx, top: r.top + sy, width: r.width, height: r.height };
  const { pts, cell } = glyphTargets(text, lineRects, fontPx);
  if (!pts.length || pts.length > 900) return null;
  const gap = threadGap(S.vh);
  const span = Math.max(1, Math.max(...lineRects.map((q) => q.width)));
  const start = performance.now() + (returning ? 120 : 380);
  const parts = pts.map((p) => {
    const lane = Math.floor(Math.random() * (S.vh / gap));
    return {
      tx: p.x, ty: p.y,
      sx: Math.random() * S.vw + sx,
      sy: lane * gap + gap * 0.5 + sy,
      delay: 0.55 * ((p.x - rect.left) / span) + Math.random() * 0.22,
      wob: (Math.random() - 0.5) * gap * 2.2,
    };
  });
  return { h1, rect, parts, cell, start, dur: 0.95, front: null };
}

function drawGenesis(nowMs) {
  const g = genesis;
  if (!g) return;
  const t = (nowMs - g.start) / 1000;
  const sx = window.scrollX, sy = window.scrollY;
  const arrive = 0.55 + 0.22 + g.dur;
  if (t >= arrive && !g.front) {
    const origin = { x: g.rect.left - sx + Math.min(g.rect.width, S.vw) * 0.04, y: g.rect.top - sy + g.rect.height / 2 };
    if (units.has(g.h1)) startFront(origin, [g.h1], { amp: 0.9 });
    g.front = { x: origin.x + sx, y: origin.y + sy, t0: nowMs, speed: frontSpeed(S.vw, S.vh) };
  }
  const edge = Math.hypot(S.vw, S.vh) * LOOM.FRONT_EDGE;
  const R = g.front ? ((nowMs - g.front.t0) / 1000) * g.front.speed : -1;
  let alive = 0;
  mctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
  for (let i = 0; i < g.parts.length; i += 1) {
    const p = g.parts[i];
    if (t < p.delay - 0.2) { alive += 1; continue; }
    const u = smooth((t - p.delay) / g.dur);
    // A bit dissolves as the front that reveals the type passes over it.
    const gone = g.front ? smooth((R - Math.hypot(p.tx - g.front.x, p.ty - g.front.y)) / (edge * 0.8)) : 0;
    if (gone >= 1) continue;
    alive += 1;
    const x = p.sx + (p.tx - p.sx) * u - sx;
    const y = p.sy + (p.ty - p.sy) * u + Math.sin(u * Math.PI) * p.wob - sy;
    const size = g.cell * (0.3 + 0.58 * u);
    mctx.fillStyle = pal.voice(0, clamp01((0.25 + 0.7 * u) * (1 - gone)));
    mctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
  if (!alive || (g.front && nowMs - g.front.t0 > 6000)) genesis = null;
}

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */

const scenes = [];
const sceneIO = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      for (const e of entries) { const s = scenes.find((x) => x.canvas === e.target); if (s) { s.visible = e.isIntersecting; if (s.visible) { s.dirty = true; kick(); } } }
    }, { rootMargin: "12% 0px" })
  : null;
const sceneRO = typeof ResizeObserver === "function"
  ? new ResizeObserver((entries) => { for (const e of entries) { const s = scenes.find((x) => x.canvas === e.target); if (s) s.dirty = true; } kick(); })
  : null;

/**
 * Register a live figure. `impl.frame(ctx, info)` draws in CSS pixels.
 * info: { t, dt, w, h, pal, reduced, born, energy, somatic }.
 * `t` is seconds since the figure first came into view, so a figure can draw
 * itself in. Under reduced motion `t` is large and frame runs only when
 * something changed, so draw the settled state.
 * Returns { invalidate() } to ask for a redraw after input.
 */
export function scene(canvas, impl) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { invalidate() {} };
  const s = { canvas, ctx, impl, visible: !sceneIO, dirty: true, born: null, w: 0, h: 0 };
  scenes.push(s);
  sceneIO?.observe(canvas);
  sceneRO?.observe(canvas);
  kick();
  return { invalidate() { s.dirty = true; kick(); } };
}

function awaitingFront(el) {
  for (let p = el; p && p.id !== "main"; p = p.parentElement) {
    const u = units.get(p);
    if (u && !u.front) return true;
  }
  return false;
}

function runScenes(nowMs, dt) {
  const red = reduced();
  for (const s of scenes) {
    if (!s.visible) continue;
    if (awaitingFront(s.canvas)) continue; // the front has not reached it yet
    if (red && !s.dirty) continue;
    const cw = s.canvas.clientWidth, ch = s.canvas.clientHeight;
    if (cw < 2 || ch < 2) continue;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(cw * dpr), H = Math.round(ch * dpr);
    if (s.canvas.width !== W || s.canvas.height !== H) { s.canvas.width = W; s.canvas.height = H; }
    if (s.born == null) s.born = nowMs;
    s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const info = {
      t: red ? 600 : (nowMs - s.born) / 1000, dt: red ? 0 : dt, w: cw, h: ch, pal, reduced: red, dirty: s.dirty,
      energy: clamp01(Math.max(attention.restless || 0, S.speed * 0.5, S.scroll * 0.6)), somatic: somatic(),
    };
    s.dirty = false;
    try { s.impl.frame(s.ctx, info); } catch (e) { console.error("loom scene", e); s.visible = false; }
  }
}


/* ------------------------------------------------------------------ */
/* Glyphs: a small live figure for each place a line leads to          */
/* ------------------------------------------------------------------ */

const GLYPHS = {
  chord(c, t, w, h, p) {
    const sum = [];
    [2, 3, 4].forEach((n, i) => {
      c.strokeStyle = p.voice(i + 1, 0.5); c.lineWidth = 1; c.beginPath();
      for (let k = 0; k <= 40; k += 1) { const u = k / 40, y = Math.sin(n * Math.PI * u) * Math.cos(t * n * 0.9) * h * 0.18; sum[k] = (sum[k] || 0) + y; if (k) c.lineTo(u * w, h / 2 - y); else c.moveTo(0, h / 2 - y); }
      c.stroke();
    });
    c.strokeStyle = p.voice(0, 1); c.lineWidth = 1.6; c.beginPath();
    sum.forEach((y, k) => { if (k) c.lineTo((k / 40) * w, h / 2 - y * 0.6); else c.moveTo(0, h / 2 - y * 0.6); }); c.stroke();
  },
  strata(c, t, w, h, p) {
    for (let i = 0; i < 9; i += 1) if ((i * 7 + Math.floor(t * 3)) % 3) { c.fillStyle = p.voice(1, 0.8); c.fillRect(w * 0.1 + i * w * 0.09, h * 0.18, w * 0.06, h * 0.1); }
    c.strokeStyle = p.voice(0, 0.9); c.beginPath(); c.ellipse(w / 2, h / 2, w * 0.3, h * 0.1, t * 0.4, 0, TAU); c.stroke();
    c.strokeStyle = p.voice(2, 0.9); c.beginPath();
    for (let x = 0; x <= w; x += 2) { const y = h * 0.8 + Math.sin(x / w * TAU * 3 - t * 2) * h * 0.07; if (x) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke();
  },
  paper(c, t, w, h, p) {
    for (let i = 0; i < 5; i += 1) {
      const y = h * (0.2 + i * 0.15), len = w * (i === 4 ? 0.5 : 0.86);
      c.strokeStyle = p.voice(0, 0.7); c.lineWidth = 1.4; c.beginPath();
      for (let x = w * 0.07; x <= len; x += 2) { const d = Math.sin(x / w * 9 - t * 2 + i) * Math.exp(-(((x / w) - ((t * 0.2) % 1.4)) ** 2) * 20) * h * 0.05; if (x === w * 0.07) c.moveTo(x, y + d); else c.lineTo(x, y + d); }
      c.stroke();
    }
  },
  sound(c, t, w, h, p) {
    const n = 22;
    for (let i = 0; i < n; i += 1) { const a = Math.abs(Math.sin(i * 1.7 + t * 2.2) * Math.sin(i * 0.3 + t * 0.7)); c.fillStyle = p.voice(i % 3, 0.85); c.fillRect((i / n) * w + 1, h / 2 - a * h * 0.36, w / n - 2, a * h * 0.72 + 1); }
  },
  archive(c, t, w, h, p) {
    for (let i = 0; i < 4; i += 1) { c.strokeStyle = p.voice(i, 0.8); c.strokeRect(w * 0.18 + i * w * 0.06, h * 0.18 + i * h * 0.1 + Math.sin(t + i) * 1.5, w * 0.5, h * 0.42); }
  },
  mixer(c, t, w, h, p) {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.36;
    for (let k = 0; k < 36; k += 1) { const [r, g, b] = oklchToRgb(p.light ? 0.6 : 0.8, 0.12, k * 10); c.strokeStyle = `rgb(${r} ${g} ${b} / 0.8)`; c.beginPath(); c.arc(cx, cy, r, (k / 36) * TAU, ((k + 1) / 36) * TAU); c.stroke(); }
    const a = Math.sin(t * 0.7) * 0.5;
    c.fillStyle = p.voice(0, 1); c.beginPath(); c.arc(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6, 3.5, 0, TAU); c.fill();
  },
  simplex(c, t, w, h, p) {
    const A = [w / 2, h * 0.12], B = [w * 0.24, h * 0.88], C = [w * 0.76, h * 0.88];
    c.strokeStyle = p.voice(0, 0.8); c.beginPath(); c.moveTo(...A); c.lineTo(...B); c.lineTo(...C); c.closePath(); c.stroke();
    const u = 0.33 + 0.25 * Math.sin(t * 0.8), v = 0.33 + 0.25 * Math.sin(t * 1.1 + 2), x = 1 - u - v;
    const P = [A[0] * u + B[0] * v + C[0] * x, A[1] * u + B[1] * v + C[1] * x];
    c.strokeStyle = p.voice(1, 0.6); for (const V of [A, B, C]) { c.beginPath(); c.moveTo(...P); c.lineTo(...V); c.stroke(); }
    c.fillStyle = p.voice(0, 1); c.beginPath(); c.arc(P[0], P[1], 3.5, 0, TAU); c.fill();
  },
  cells(c, t, w, h, p) {
    const vals = [1, 0.7, 0.5, 0.35, 0.25];
    vals.forEach((v, i) => { const a = (i * 2.39996) + t * 0.1, r = Math.sqrt(i + 0.3) * h * 0.18, s = Math.sqrt(v) * h * 0.38; c.strokeStyle = p.voice(i % 2, 0.9); c.strokeRect(w / 2 + Math.cos(a) * r * 1.5 - s / 2, h / 2 + Math.sin(a) * r - s / 2, s, s); });
  },
  glyph(c, t, w, h, p) {
    const ch = "EIDO"[Math.floor(t / 1.4) % 4], code = fontCode(ch), bits = [FONT[code * 2], FONT[code * 2 + 1]];
    const cell = Math.min(w / 7, h / 9), ox = (w - cell * 5) / 2, oy = (h - cell * 7) / 2;
    for (let r = 0; r < 7; r += 1) for (let q = 0; q < 5; q += 1) { c.fillStyle = glyphBit(bits, q, r) ? p.voice(0, 0.95) : p.faint; c.fillRect(ox + q * cell + 0.5, oy + r * cell + 0.5, cell - 1, cell - 1); }
  },
  weave(c, t, w, h, p) {
    for (let i = 0; i < 4; i += 1) { c.strokeStyle = p.voice(0, 0.75); c.lineWidth = 1.6; c.beginPath(); for (let x = w * 0.08; x <= w * 0.92; x += 2) { const y = h * (0.22 + i * 0.19) + Math.sin(x / w * 12 - t * 3 + i) * h * 0.035 * (1 + Math.sin(t * 0.6)); if (x === w * 0.08) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke(); }
    c.strokeStyle = p.voice(1, 0.9); c.beginPath(); c.moveTo(w * 0.04, h * 0.18); c.lineTo(w * 0.04, h * 0.5); c.stroke();
  },
  condense(c, t, w, h, p) {
    const k = (Math.sin(t * 0.7) + 1) / 2;
    for (let i = 0; i < 4; i += 1) { c.fillStyle = p.voice(0, 0.75); c.fillRect(w * 0.08, h * (0.2 + i * 0.18), w * 0.84 * (1 - k * (0.3 + i * 0.12)), h * 0.06); }
  },
  matrix(c, t, w, h, p) {
    const n = 8, s = Math.min(w, h) * 0.86 / n, ox = (w - s * n) / 2, oy = (h - s * n) / 2;
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) {
      const v = Math.sin((i * n + j + 1) * 2.31 + (i > 1 ? t * 0.8 : 0));
      c.fillStyle = p.phase(v, i < 2 ? 0.9 : 0.6); c.fillRect(ox + j * s + 0.5, oy + i * s + 0.5, s - 1, s - 1);
    }
    c.strokeStyle = p.node(0.9); c.strokeRect(ox, oy, s * n, s * 2);
  },
  unfold(c, t, w, h, p) {
    const depth = 1 + Math.floor((t * 0.8) % 5);
    const branch = (x, y, len, a, d) => {
      if (d > depth) return;
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      c.strokeStyle = p.voice(d % 3, 0.85); c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
      branch(x2, y2, len * 0.66, a - 0.5, d + 1); branch(x2, y2, len * 0.66, a + 0.5, d + 1);
    };
    branch(w * 0.12, h / 2, w * 0.28, 0, 1);
  },
  graft(c, t, w, h, p) {
    const s = Math.min(w * 0.3, h * 0.7);
    c.strokeStyle = p.crest(0.85); c.strokeRect(w * 0.08, (h - s) / 2, s, s);
    c.strokeStyle = p.trough(0.85); c.strokeRect(w * 0.92 - s, (h - s) / 2, s, s);
    const u = (t * 0.35) % 1, x = w * 0.08 + s + (w * 0.84 - 2 * s) * u;
    c.fillStyle = p.node(1); c.beginPath(); c.arc(x, h / 2 + Math.sin(u * Math.PI * 2) * h * 0.08, 3.5, 0, TAU); c.fill();
  },
  cascade(c, t, w, h, p) {
    const xs = [0.16, 0.5, 0.84].map((f) => f * w);
    xs.forEach((x, i) => { c.strokeStyle = p.voice(i, 0.9); c.beginPath(); c.arc(x, h / 2, Math.min(w, h) * 0.14, 0, TAU); c.stroke(); });
    for (let k = 0; k < 2; k += 1) {
      const u = ((t * 0.5) + k * 0.5) % 1, x = xs[0] + (xs[2] - xs[0]) * u;
      c.fillStyle = p.node(1 - u * 0.5); c.beginPath(); c.arc(x, h / 2, 3, 0, TAU); c.fill();
    }
  },
  paths(c, t, w, h, p) {
    for (let i = 0; i < 5; i += 1) {
      c.strokeStyle = p.voice(i, 0.85); c.beginPath();
      for (let k = 0; k <= 30; k += 1) { const u = k / 30, x = w * 0.08 + u * w * 0.84, y = h * (0.15 + i * 0.175) * (1 - u) + h * 0.5 * u + Math.sin(u * 6 + t + i) * h * 0.03 * (1 - u); if (k) c.lineTo(x, y); else c.moveTo(x, y); }
      c.stroke();
    }
  },
  cheb(c, t, w, h, p) {
    for (let n = 1; n <= 4; n += 1) {
      c.strokeStyle = p.voice(n - 1, 0.85); c.beginPath();
      for (let k = 0; k <= 60; k += 1) { const x = -1 + (2 * k) / 60, y = Math.cos(n * Math.acos(x)) * (0.75 + 0.25 * Math.sin(t * 0.8 + n)); const px = w * 0.08 + ((x + 1) / 2) * w * 0.84, py = h / 2 - y * h * 0.38; if (k) c.lineTo(px, py); else c.moveTo(px, py); }
      c.stroke();
    }
  },
  explainer(c, t, w, h, p) {
    const n = 6, s = Math.min(w, h) * 0.8 / n, ox = (w - s * n) / 2, oy = (h - s * n) / 2;
    for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) { const v = (Math.sin(i * 1.3 + j * 0.7 + t * (j < 2 ? 0.2 : 1.1)) + 1) / 2; c.fillStyle = j < 2 ? p.voice(1, 0.3 + 0.5 * v) : p.voice(0, 0.15 + 0.7 * v); c.fillRect(ox + i * s + 1, oy + j * s + 1, s - 2, s - 2); }
  },
};

function initGlyphs() {
  for (const canvas of document.querySelectorAll("canvas[data-glyph]")) {
    const draw = GLYPHS[canvas.dataset.glyph];
    if (!draw) continue;
    scene(canvas, { frame(ctx, { t, w, h, pal: p, reduced: still }) { ctx.clearRect(0, 0, w, h); ctx.lineCap = "round"; draw(ctx, still ? 2 : t, w, h, p); } });
  }
}

/* ------------------------------------------------------------------ */
/* Frame loop                                                          */
/* ------------------------------------------------------------------ */

const hooks = new Set();
/** Run fn(nowMs, dt) on every frame the loom draws. Returns an unsubscribe. */
export function onFrame(fn) { hooks.add(fn); kick(); return () => hooks.delete(fn); }
/** Run fn(palette) whenever theme or hue changes. */
export function onPalette(fn) { repaint.add(fn); return () => repaint.delete(fn); }

let raf = 0, last = 0;
function frame(nowMs) {
  raf = 0;
  const dt = last ? Math.min(0.1, (nowMs - last) / 1000) : 1 / 60;
  last = nowMs;
  const red = reduced();
  if (!red) {
    decayTelemetry(dt);
    S.genesis = Math.min(1, S.genesis + dt / (returning ? 0.6 : 1.8));
  } else S.genesis = 1;
  updateUnfold(nowMs);
  drawMedium(nowMs);
  drawGenesis(nowMs);
  runScenes(nowMs, dt);
  for (const fn of hooks) { try { fn(nowMs, dt); } catch (e) { console.error("loom hook", e); } }
  if (!red && !document.hidden) raf = requestAnimationFrame(frame);
}
/** Ask for a frame. Under reduced motion this draws once; otherwise it keeps the loop alive. */
export function kick() { if (!raf) raf = requestAnimationFrame(frame); }

/* ------------------------------------------------------------------ */
/* Shared page behaviour: theme, copy buttons, live source blocks      */
/* ------------------------------------------------------------------ */

const THEMES = ["system", "light", "dark"];
function applyTheme(pref) {
  const resolved = pref === "light" || pref === "dark" ? pref : lightMQ.matches ? "light" : "dark";
  root.setAttribute("data-pref", pref);
  root.setAttribute("data-theme", resolved);
  for (const btn of document.querySelectorAll("[data-theme-toggle]")) {
    btn.textContent = pref === "system" ? "auto" : pref;
    btn.setAttribute("aria-label", `Theme: ${pref}. Activate to change.`);
  }
  refreshPalette();
}
function initTheme() {
  let pref = root.getAttribute("data-pref") || "system";
  applyTheme(pref);
  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest?.("[data-theme-toggle]");
    if (!btn) return;
    pref = THEMES[(THEMES.indexOf(pref) + 1) % THEMES.length];
    store("local", "eido-theme", pref);
    applyTheme(pref);
    const r = btn.getBoundingClientRect();
    ripple(r.left + r.width / 2, r.top + r.height / 2, 1);
  });
  lightMQ.addEventListener?.("change", () => { if (pref === "system") applyTheme(pref); });
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.className = "visually-hidden";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
    ta.remove();
    return ok;
  }
}
function initCopy() {
  const status = document.createElement("div");
  status.className = "visually-hidden";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  document.body.appendChild(status);
  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest?.("button.copy");
    if (!btn) return;
    const target = btn.dataset.copyTarget && document.querySelector(btn.dataset.copyTarget);
    const ok = await copyText(btn.dataset.copyText ?? target?.textContent ?? "");
    const label = btn.dataset.label || btn.textContent;
    btn.dataset.label = label;
    btn.textContent = ok ? "Copied" : "Copy failed";
    btn.dataset.state = ok ? "copied" : "failed";
    status.textContent = ok ? "Copied to clipboard" : "Copy failed";
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.textContent = label; delete btn.dataset.state; status.textContent = ""; }, 1800);
  });
}
async function initSources() {
  for (const code of document.querySelectorAll("code[data-src]")) {
    try {
      const res = await fetch(code.dataset.src);
      if (!res.ok) throw new Error(`${res.status}`);
      const text = await res.text();
      code.textContent = text;
      const cap = code.closest("figure")?.querySelector("[data-lines]");
      if (cap) cap.textContent = ` · ${text.split("\n").length} lines`;
    } catch (e) {
      code.textContent = `Could not load ${code.dataset.src} (${e.message}). Open it on GitHub instead.`;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

function boot() {
  const syncReduced = () => root.classList.toggle("reduced-motion", reducedMQ.matches);
  syncReduced();
  reducedMQ.addEventListener?.("change", () => { syncReduced(); if (reducedMQ.matches) revealAll(); for (const s of scenes) s.dirty = true; kick(); });
  document.body.prepend(medium);
  sizeMedium();
  cacheColumns();
  window.addEventListener("resize", () => { sizeMedium(); cacheColumns(); for (const s of scenes) s.dirty = true; kick(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { last = 0; kick(); } });
  initTheme();
  initCopy();
  initSources();
  initTelemetry();
  const mainEl = document.getElementById("main");
  genesis = prepareGenesis(mainEl);
  initUnfold(mainEl, genesis ? new Set([genesis.h1]) : new Set());
  if (unfoldOn) {
    // The first front comes from where the visitor pressed on the last page,
    // or from the title on a first arrival.
    let origin = null;
    try { const o = JSON.parse(store("session", "eido-origin") || "null"); if (o) origin = { x: o.x * S.vw, y: o.y * S.vh }; } catch (e) { origin = null; }
    store("session", "eido-origin", null);
    if (!origin) {
      const h = mainEl.querySelector("h1")?.getBoundingClientRect();
      origin = h ? { x: h.left + Math.min(h.width, S.vw) * 0.1, y: h.top + h.height / 2 } : { x: S.vw * 0.2, y: S.vh * 0.2 };
    }
    const first = [];
    for (const [el] of units) {
      if (genesis && el === genesis.h1) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < S.vh) first.push(el);
    }
    startFront(origin, first, { amp: 1, delay: genesis ? 900 : 120 });
  }
  initGlyphs();
  S.genesis = reduced() ? 1 : returning ? 0.45 : 0;
  root.classList.add("loom");
  kick();
}

try { boot(); } catch (e) { console.error("loom failed to start", e); revealAll(); }

export const loom = { scene, ripple, setHue, getHue, drive, somatic, onFrame, onPalette, kick, reduced, unfoldNow, currentPalette, mediumState };
