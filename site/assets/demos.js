// Live demos shared by the home page and the component pages.
// Every demo imports the real modules from ../../src, so what you see is what the repo ships.

import { mountSimplexPad } from "../../src/simplex-pad.js";
import { mixAestheticPresets } from "../../src/aesthetic-mixer.js";
import { layoutCells, layerThreads, hitTest } from "../../src/cell-layout.js";
import { encodeFontTable, fontCode, glyphBit, packLabel, GLYPH_COLS, GLYPH_ROWS, GLYPH_ADVANCE } from "../../src/glyph-font.js";
import { palette } from "./loom-core.js";
import { currentPalette, onPalette } from "./loom.js";

const $ = (sel, el = document) => el.querySelector(sel);
const h = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  n.append(...kids);
  return n;
};

function range(label, { min, max, step = 1, value }, onInput) {
  const out = h("output", {}, String(value));
  const input = h("input", { type: "range", min, max, step, value });
  const id = `r${Math.random().toString(36).slice(2, 8)}`;
  input.id = id;
  out.setAttribute("for", id);
  input.addEventListener("input", () => { out.textContent = input.value; onInput(Number(input.value)); });
  return { el: h("div", { class: "field" }, h("label", { for: id }, label), input, out), input, out };
}

/* ---------- D1: style mixer ---------- */

export const MIXER_PRESETS = {
  calm: { rounding: 0.85, density: 0.3, hue: 0.5444, contrast: 0.05 },
  sharp: { rounding: 0.0, density: 0.1, hue: 0.2778, contrast: 0.01 },
  airy: { rounding: 1.0, density: 0.85, hue: 0.8111, contrast: 0.2 },
};

export function mountMixerDemo(host, { presets = MIXER_PRESETS, weights = [0.5, 0.25, 0.25], showPresets = false, onChange } = {}) {
  const names = Object.keys(presets);
  const padHost = h("div", { class: "pad-host" });
  const card = h("div", { class: "preview" }, h("h4", {}, "Blended card"), h("p", {}, "Drag the point, or focus the triangle and use the arrow keys."), h("span", { class: "chip" }, "Action"));
  const out = h("div", { class: "readout", "aria-live": "off" });
  host.append(h("div", { class: "mixer" }, padHost, h("div", {}, card, out)));
  let pad;
  const apply = (w) => {
    const v = mixAestheticPresets(presets, Object.fromEntries(names.map((n, i) => [n, w[i]])));
    // The card wears the tide palette at the blended hue: the same palette the site turns.
    const p = palette(v.hue * 360, document.documentElement.getAttribute("data-theme") === "light");
    card.style.borderRadius = `${v.rounding * 1.6}rem`;
    card.style.padding = `${0.75 + v.density * 1.6}rem`;
    card.style.borderColor = p.crest(0.6);
    card.style.background = p.crest(0.06 + v.contrast);
    card.querySelector("h4").style.color = p.crest(1);
    const chip = card.querySelector(".chip");
    chip.style.background = p.crest(1);
    chip.style.color = p.bg;
    chip.style.borderRadius = `${v.rounding}rem`;
    out.textContent = `weights  ${w.map((x, i) => `${names[i]} ${x.toFixed(2)}`).join("  ")}\nrounding ${v.rounding.toFixed(3)}  density ${v.density.toFixed(3)}\nhue      ${v.hue.toFixed(3)}  contrast ${v.contrast.toFixed(3)}`;
    onChange?.(w, v);
  };
  pad = mountSimplexPad(padHost, { labels: names, weights, hues: names.map((n) => presets[n].hue), onChange: apply });
  apply(pad.get());
  onPalette(() => apply(pad.get()));
  if (showPresets) {
    const bar = h("div", { class: "controls" });
    names.forEach((n, i) => bar.append(h("button", { class: "btn small", type: "button", onclick: () => pad.set(names.map((_, j) => (i === j ? 1 : 0))) }, `All ${n}`)));
    bar.append(h("button", { class: "btn small", type: "button", onclick: () => pad.set([1, 1, 1]) }, "Even blend"));
    host.prepend(bar);
  }
  return pad;
}

/* ---------- D2: cell layout ---------- */

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function mountCellDemo(host, { count = 9, width = 640, height = 380, controls = true } = {}) {
  const state = { count, width, height, gap: 12, padding: 16, seed: 7 };
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "cells-svg");
  svg.setAttribute("role", "img");
  const readout = h("div", { class: "readout", "aria-live": "polite" });
  const groups = (i) => i % 3;
  // Groups speak in the palette's voices: crest, trough, node.
  let layout = null;
  let items = [];

  const draw = () => {
    const rnd = seeded(state.seed);
    items = Array.from({ length: state.count }, (_, i) => {
      const weight = Math.round((0.15 + rnd() ** 2 * 0.85) * 100) / 100;
      return { weight, labelLength: `c${i + 1} ${weight.toFixed(2)}`.length, label: `c${i + 1} ${weight.toFixed(2)}` };
    });
    layout = layoutCells(items, { width: state.width, height: state.height }, { gap: state.gap, padding: state.padding });
    svg.setAttribute("viewBox", `0 0 ${state.width} ${state.height}`);
    svg.setAttribute("aria-label", `${state.count} cells packed into ${state.width} by ${state.height} pixels. Area is proportional to value.`);
    svg.textContent = "";
    for (const e of layerThreads(layout.cells, layout.cells.map((c) => groups(c.index)))) {
      const a = layout.cells[e.a], b = layout.cells[e.b];
      const l = document.createElementNS(svgNS, "line");
      for (const [k, v] of Object.entries({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: "thread", stroke: currentPalette().voice(e.group, 0.85) })) l.setAttribute(k, v);
      svg.append(l);
    }
    for (const c of layout.cells) {
      const g = document.createElementNS(svgNS, "g");
      g.dataset.index = c.index;
      const r = document.createElementNS(svgNS, "rect");
      const pv = currentPalette(), gi = groups(c.index);
      for (const [k, v] of Object.entries({ class: "cell", x: c.x - c.half, y: c.y - c.half, width: c.side, height: c.side, rx: 3, fill: pv.voice(gi, 0.22), stroke: pv.voice(gi, 0.95) })) r.setAttribute(k, v);
      const t = document.createElementNS(svgNS, "text");
      t.setAttribute("x", c.x);
      t.setAttribute("y", c.y + c.half + 6 + 10);
      t.setAttribute("text-anchor", "middle");
      t.textContent = items[c.index].label;
      g.append(r, t);
      svg.append(g);
    }
    readout.textContent = `${layout.fits ? "fits" : "does not fit"} · side scale ${layout.scale.toFixed(2)} · area ratio of c1 to c2 = value ratio ${(items[0].weight / items[1].weight).toFixed(2)}`;
  };

  const pick = (ev) => {
    const r = svg.getBoundingClientRect();
    const i = hitTest(layout, ((ev.clientX - r.left) / r.width) * state.width, ((ev.clientY - r.top) / r.height) * state.height);
    svg.querySelectorAll(".hit").forEach((n) => n.classList.remove("hit"));
    if (i >= 0) {
      svg.querySelector(`g[data-index="${i}"]`)?.classList.add("hit");
      readout.textContent = `hitTest → cell ${i + 1}: value ${items[i].weight.toFixed(2)}, side ${layout.cells[i].side.toFixed(1)}px, group ${groups(i) + 1}`;
    }
  };
  svg.addEventListener("pointermove", pick);
  svg.addEventListener("pointerdown", pick);

  if (controls) {
    const box = h("div", {});
    const mk = (label, key, min, max, step = 1) => {
      const r = range(label, { min, max, step, value: state[key] }, (v) => { state[key] = v; draw(); });
      box.append(r.el);
    };
    mk("Cells", "count", 2, 18);
    mk("Width", "width", 240, 720, 10);
    mk("Height", "height", 200, 520, 10);
    mk("Gap", "gap", 0, 40);
    mk("Padding", "padding", 0, 60);
    box.append(h("div", { class: "controls" }, h("button", { class: "btn small", type: "button", onclick: () => { state.seed = (Math.random() * 1e6) | 0; draw(); } }, "New values")));
    host.append(box);
  }
  host.append(svg, readout);
  draw();
  onPalette(draw);
  return { state, redraw: draw };
}

/* ---------- D2: glyph font ---------- */

export function mountGlyphDemo(host, { text = "EIDO 5X7", scale = 6, controls = true } = {}) {
  const table = encodeFontTable();
  const canvas = h("canvas", { class: "glyph-canvas", role: "img" });
  const words = h("div", { class: "glyph-words", "aria-live": "polite" });
  const state = { text, scale };
  const draw = () => {
    const s = state.scale;
    const chars = [...state.text.slice(0, 24)];
    const w = Math.max(1, chars.length) * GLYPH_ADVANCE * s + 2 * s;
    const hgt = (GLYPH_ROWS + 2) * s;
    canvas.width = w;
    canvas.height = hgt;
    canvas.setAttribute("aria-label", `Bitmask font rendering of ${state.text}`);
    const ctx = canvas.getContext("2d");
    // Lit bits in the crest colour, unlit bits as faint ghosts, nothing behind them.
    const pv = currentPalette();
    ctx.clearRect(0, 0, w, hgt);
    ctx.fillStyle = pv.crest(1);
    chars.forEach((ch, k) => {
      const code = fontCode(ch);
      const pair = [table[code * 2], table[code * 2 + 1]];
      for (let r = 0; r < GLYPH_ROWS; r++) {
        for (let c = 0; c < GLYPH_COLS; c++) {
          ctx.fillStyle = glyphBit(pair, c, r) ? pv.crest(1) : pv.faint;
          ctx.fillRect(s + (k * GLYPH_ADVANCE + c) * s + 0.5, s + r * s + 0.5, s - 1, s - 1);
        }
      }
    });
    const first = chars[0];
    if (first) {
      const code = fontCode(first);
      const hex = (n) => "0x" + n.toString(16).padStart(8, "0");
      const label = packLabel(state.text);
      words.textContent = `"${String.fromCharCode(code)}" = [${hex(table[code * 2])}, ${hex(table[code * 2 + 1])}]  ·  label "${state.text.slice(0, 16)}" packs into ${label.words.length} u32: ${[...label.words].map(hex).join(" ")}`;
    } else words.textContent = "Type something to draw.";
  };
  if (controls) {
    const id = `g${Math.random().toString(36).slice(2, 8)}`;
    const input = h("input", { type: "text", id, value: state.text, maxlength: 24, autocomplete: "off", spellcheck: "false" });
    input.addEventListener("input", () => { state.text = input.value; draw(); });
    host.append(h("div", { class: "field text" }, h("label", { for: id }, "Text (A–Z, 0–9 and - . / : _ # % ?; other characters draw as ?)"), input));
    host.append(range("Pixel size", { min: 2, max: 12, value: state.scale }, (v) => { state.scale = v; draw(); }).el);
  }
  host.append(canvas, words);
  draw();
  onPalette(draw);
  return { state, redraw: draw };
}
