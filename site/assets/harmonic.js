// Live figures for the harmonic pages. Each one computes its mathematics in
// the browser, on the loom's single frame, and prints the numbers it drew.
// A figure starts only if its canvas is on the page, so every harmonic page
// loads this one file.

import { scene, drive, somatic, ripple, reduced, onPalette } from "./loom.js";
import {
  TAU, SPEED_OF_SOUND, cents, wavelength, gcd, nearestRatio, intervalName,
  partials, dyadRoughness, pairRoughness, minima,
  lorentzianFrequencies, orderParameter, kuramotoStep,
  windingNumber, halvorsen, rk4,
  plateModes, plateResponse, membraneTension, PLATE,
  makeProvenance, provenanceEpoch, provenanceCosines,
  caStep, MECHANISMS, mechanismFreqs, STACK, STACK_ROOT,
} from "./harmonic-math.js";

const $ = (sel, el = document) => el.querySelector(sel);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v) => clamp(v, 0, 1);
const smooth = (u) => { const x = clamp01(u); return x * x * (3 - 2 * x); };
const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—");
const mono = (px) => `${px}px ui-monospace, "SF Mono", Menlo, monospace`;
const pressable = (buttons, onPick) => {
  for (const b of buttons) b.addEventListener("click", () => {
    for (const o of buttons) o.setAttribute("aria-pressed", o === b ? "true" : "false");
    onPick(b);
  });
};
/** Throttle text updates so numbers stay readable and screen readers calm. */
function writer(el, every = 120) {
  let last = 0, pending = "";
  return (text, force = false) => {
    pending = text;
    const now = performance.now();
    if (!el || (!force && now - last < every)) return;
    last = now;
    if (el.textContent !== pending) el.textContent = pending;
  };
}

/* ================================================================== */
/* Audio: a gentle chord, only ever started by a press                 */
/* ================================================================== */

let audio = null;
function chordAudio() {
  if (audio) return audio;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  let voices = [];
  audio = {
    ctx,
    playing: false,
    play(freqs) {
      if (ctx.state === "suspended") ctx.resume();
      const t = ctx.currentTime;
      // Lift low chords into a range small speakers can carry; ratios are kept.
      let lift = 1;
      while (Math.min(...freqs) * lift < 110) lift *= 2;
      const fs = freqs.map((f) => f * lift);
      if (voices.length === fs.length) {
        voices.forEach((v, i) => v.osc.frequency.setTargetAtTime(fs[i], t, 0.06));
      } else {
        voices.forEach((v) => { v.g.gain.setTargetAtTime(0, t, 0.05); v.osc.stop(t + 0.3); });
        voices = fs.map((f, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = i === 0 ? "triangle" : "sine";
          osc.frequency.value = f;
          g.gain.value = 0;
          g.gain.setTargetAtTime(0.9 / (i + 1.6), t, 0.08);
          osc.connect(g); g.connect(master); osc.start();
          return { osc, g };
        });
      }
      master.gain.setTargetAtTime(0.12, t, 0.12);
      this.playing = true;
      return lift;
    },
    stop() {
      const t = ctx.currentTime;
      master.gain.setTargetAtTime(0, t, 0.08);
      voices.forEach((v) => v.osc.stop(t + 0.5));
      voices = [];
      this.playing = false;
    },
  };
  return audio;
}

/** Lend the medium a chord's shape: its partials ring where the chord's ratios fall. */
function driveMedium(ratios) {
  if (!ratios) { drive(null); return; }
  const top = Math.max(...ratios);
  const scale = Math.max(1, top / 7);
  const amps = Array.from({ length: 7 }, (_, k) => {
    let a = 0.08 / (k + 1);
    for (const r of ratios) a += 1.1 * Math.exp(-((k + 1 - r / scale) ** 2) / 0.12);
    return a;
  });
  drive(amps, 0.4);
}

/* ================================================================== */
/* Chords: six mechanisms                                              */
/* ================================================================== */

function initChords() {
  const canvas = $("#chord-stage");
  if (!canvas) return;
  const numbers = writer($("#chord-numbers"), 0);
  const listen = $("#chord-listen");
  const listenNote = $("#chord-listen-note");
  let mech = MECHANISMS[2];
  let since = 0;

  const ratiosOf = (m) => { const f = mechanismFreqs(m); return f.map((x) => x / f[0]); };
  const describe = () => {
    const f = mechanismFreqs(mech);
    const r = ratiosOf(mech);
    const whole = !mech.plate;
    const g = whole ? mech.ratios.reduce((a, b) => gcd(a, b)) : 0;
    const lines = [
      `${mech.name}   ${mech.tag}`,
      `engine  ${mech.engine}`,
      `state   ${mech.state}`,
      ``,
      `voice   f (Hz)     λ = c/f (m)   ratio      cents`,
      ...f.map((x, i) => {
        const near = nearestRatio(r[i], 16);
        const ratio = whole ? `${mech.ratios[i]}/${mech.ratios[0]}` : `${r[i].toFixed(3)}`;
        return `${String(i + 1).padEnd(7)} ${fmt(x, 2).padStart(7)}    ${fmt(wavelength(x), 3).padStart(7)}       ${ratio.padEnd(9)}  ${fmt(cents(r[i]), 1).padStart(7)}${whole ? "" : `  (≈ ${near.p}/${near.q}, off ${fmt(near.errorCents, 0)}¢)`}`;
      }),
      ``,
      whole
        ? `repeats every ${fmt(1000 / (mech.root * g), 2)} ms: the voices share a fundamental of ${fmt(mech.root * g, 2)} Hz`
        : `plate modes at T = ${mech.tension}: not whole-number ratios, so this chord never repeats exactly`,
    ];
    numbers(lines.join("\n"), true);
  };

  const buttons = [...document.querySelectorAll("[data-mech]")];
  pressable(buttons, (b) => {
    mech = MECHANISMS.find((m) => String(m.id) === b.dataset.mech) || mech;
    since = 0;
    describe();
    if (audio?.playing) { audio.play(mechanismFreqs(mech)); driveMedium(ratiosOf(mech)); }
    handle.invalidate();
  });
  listen?.addEventListener("click", () => {
    const a = chordAudio();
    if (!a) { if (listenNote) listenNote.textContent = "This browser has no Web Audio."; return; }
    if (a.playing) {
      a.stop(); driveMedium(null);
      listen.setAttribute("aria-pressed", "false"); listen.textContent = "Listen";
      if (listenNote) listenNote.textContent = "";
    } else {
      const lift = a.play(mechanismFreqs(mech));
      driveMedium(ratiosOf(mech));
      listen.setAttribute("aria-pressed", "true"); listen.textContent = "Stop";
      if (listenNote) listenNote.textContent = lift > 1 ? `Playing ${Math.log2(lift)} octave${lift > 2 ? "s" : ""} up, ratios unchanged, so small speakers can carry it. The weft behind the page now rings in the same ratios.` : "The weft behind the page now rings in the same ratios.";
    }
  });

  const handle = scene(canvas, {
    frame(ctx, { t, dt, w, h, pal, reduced: still }) {
      since += dt;
      ctx.clearRect(0, 0, w, h);
      const r = ratiosOf(mech);
      const stacked = w < h * 1.4;
      const sw = stacked ? w : w * 0.58, sh = stacked ? h * 0.55 : h;
      const ox = stacked ? 0 : w - w * 0.38, oy = stacked ? h * 0.6 : 0, ow = stacked ? w : w * 0.38, oh = stacked ? h * 0.4 : h;
      const time = still ? 0.37 : t * 0.22;
      const pad = 14;
      // The string: each voice is a standing wave with as many loops as its ratio.
      const L = sw - pad * 2, mid = sh / 2, A = sh * 0.36;
      // A whole-number voice R has R loops between the pinned ends; a plate mode
      // ratio is not whole, so its wave cannot meet the far end at a node.
      const modes = mech.plate ? r : mech.ratios;
      ctx.lineWidth = 1;
      ctx.strokeStyle = pal.line;
      ctx.beginPath(); ctx.moveTo(pad, mid); ctx.lineTo(pad + L, mid); ctx.stroke();
      const sum = new Float32Array(121);
      modes.forEach((n, i) => {
        const grow = still ? 1 : smooth((since - i * 0.25) / 0.7);
        if (grow <= 0) return;
        const amp = (A / (i + 1.3)) * grow;
        const tc = Math.cos(TAU * r[i] * time);
        ctx.strokeStyle = pal.voice(i + 1, 0.55);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let k = 0; k <= 120; k += 1) {
          const u = k / 120;
          const y = Math.sin(n * Math.PI * u) * tc * amp;
          sum[k] += y;
          if (k === 0) ctx.moveTo(pad + u * L, mid - y); else ctx.lineTo(pad + u * L, mid - y);
        }
        ctx.stroke();
      });
      ctx.strokeStyle = pal.voice(0, 0.95);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k <= 120; k += 1) { const x = pad + (k / 120) * L, y = mid - sum[k] * 0.62; if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
      ctx.fillStyle = pal.muted;
      ctx.font = mono(11);
      ctx.fillText("the string: each voice a standing wave", pad, sh - 6);
      // The air: the summed pressure over time. A just chord repeats; a plate does not.
      const periods = 3;
      const g = mech.plate ? 1 : mech.ratios.reduce((x, y) => gcd(x, y));
      const span = periods * (mech.plate ? 4 : mech.ratios[0] / g);
      ctx.strokeStyle = pal.voice(0, 0.9);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      const M = 420, oMid = oy + oh / 2, oA = oh * 0.18;
      for (let k = 0; k <= M; k += 1) {
        const s = (k / M) * span + time * 0.25;
        let y = 0;
        r.forEach((ri, i) => { y += Math.sin(TAU * ri * s + i * 0.9) / (i + 1.3); });
        const px = ox + pad + (k / M) * (ow - pad * 2);
        if (k === 0) ctx.moveTo(px, oMid - y * oA); else ctx.lineTo(px, oMid - y * oA);
      }
      ctx.stroke();
      if (!mech.plate) {
        ctx.strokeStyle = pal.line;
        ctx.setLineDash([3, 5]);
        for (let p = 1; p < periods; p += 1) {
          const px = ox + pad + (p / periods) * (ow - pad * 2);
          ctx.beginPath(); ctx.moveTo(px, oy + oh * 0.12); ctx.lineTo(px, oy + oh * 0.88); ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      ctx.fillStyle = pal.muted;
      ctx.fillText(mech.plate ? "the air: never the same twice" : `the air: ${periods} periods, each the same`, ox + pad, oy + oh - 6);
    },
  });
  describe();
}

/* ================================================================== */
/* Roughness: where consonance lives                                   */
/* ================================================================== */

function initRoughness() {
  const canvas = $("#rough-stage");
  if (!canvas) return;
  const numbers = writer($("#rough-numbers"), 150);
  const A0 = 1, A1 = 2.04, SAMPLES = 260, F0 = 220;
  let stretchTarget = 1, stretch = 1, probe = null, sweepStart = null;
  const xs = Array.from({ length: SAMPLES }, (_, i) => A0 + (i / (SAMPLES - 1)) * (A1 - A0));
  let ys = [], found = [], computedFor = -1;
  const compute = () => {
    const tone = partials(F0, 8, stretch);
    ys = xs.map((a) => dyadRoughness(tone, a));
    found = minima(xs, ys, { maxDen: 9, depth: 0.003 });
    computedFor = stretch;
  };
  pressable([...document.querySelectorAll("[data-timbre]")], (b) => { stretchTarget = Number(b.dataset.timbre); sweepStart = null; handle.invalidate(); });
  const toAlpha = (ev) => { const r = canvas.getBoundingClientRect(); return A0 + clamp01((ev.clientX - r.left - 30) / (r.width - 44)) * (A1 - A0); };
  canvas.addEventListener("pointermove", (ev) => { probe = toAlpha(ev); handle.invalidate(); });
  canvas.addEventListener("pointerleave", () => { probe = null; handle.invalidate(); });
  canvas.addEventListener("pointerdown", (ev) => { probe = toAlpha(ev); handle.invalidate(); });

  const handle = scene(canvas, {
    frame(ctx, { t, dt, w, h, pal, reduced: still }) {
      stretch = still ? stretchTarget : stretch + (stretchTarget - stretch) * Math.min(1, dt * 4);
      if (Math.abs(stretch - stretchTarget) < 1e-4) stretch = stretchTarget;
      if (computedFor !== stretch) compute();
      if (sweepStart == null) sweepStart = t;
      const sweep = still ? 1 : smooth((t - sweepStart) / 2.6);
      ctx.clearRect(0, 0, w, h);
      const L = 30, R = w - 14, T = h * 0.3, B = h - 26;
      const X = (a) => L + ((a - A0) / (A1 - A0)) * (R - L);
      const maxY = Math.max(...ys) * 1.08;
      const Y = (v) => B - (v / maxY) * (B - T);
      // Axis and the just ratios as faint verticals.
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L, B); ctx.lineTo(R, B); ctx.stroke();
      ctx.font = mono(10); ctx.fillStyle = pal.muted;
      for (const a of [1, 1.25, 1.5, 1.75, 2]) { ctx.fillText(a.toFixed(2), X(a) - 12, B + 16); }
      // The curve, swept from unison upward.
      const upto = Math.floor(sweep * (SAMPLES - 1));
      ctx.beginPath();
      for (let i = 0; i <= upto; i += 1) { const x = X(xs[i]), y = Y(ys[i]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.strokeStyle = pal.voice(0, 0.95); ctx.lineWidth = 2; ctx.stroke();
      ctx.lineTo(X(xs[upto]), B); ctx.lineTo(X(xs[0]), B); ctx.closePath();
      ctx.fillStyle = pal.voice(0, 0.08); ctx.fill();
      // Wells found so far, named.
      ctx.textAlign = "center";
      for (const m of found) {
        if (m.i > upto) continue;
        const name = `${m.ratio.p}/${m.ratio.q}`;
        ctx.fillStyle = pal.voice(1, 0.95);
        ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), 3, 0, TAU); ctx.fill();
        ctx.fillStyle = pal.ink; ctx.font = mono(11);
        ctx.fillText(name, X(m.x), Y(m.y) + 18);
      }
      ctx.textAlign = "start";
      // The partials themselves, on a ruler above: why the curve dips.
      const alpha = probe ?? (still ? 1.5 : xs[upto]);
      const tone = partials(F0, 8, stretch);
      const lf = (f) => L + (Math.log(f / F0) / Math.log(18)) * (R - L);
      const rowA = T * 0.36, rowB = T * 0.72;
      ctx.lineWidth = 1.4;
      for (const p of tone) {
        ctx.strokeStyle = pal.voice(2, 0.4 + 0.6 * p.a);
        ctx.beginPath(); ctx.moveTo(lf(p.f), rowA - 9 * p.a); ctx.lineTo(lf(p.f), rowA + 9 * p.a); ctx.stroke();
        const g = p.f * alpha;
        ctx.strokeStyle = pal.voice(3, 0.4 + 0.6 * p.a);
        ctx.beginPath(); ctx.moveTo(lf(g), rowB - 9 * p.a); ctx.lineTo(lf(g), rowB + 9 * p.a); ctx.stroke();
      }
      // Pairs that beat against each other, joined by how rough they are.
      for (const p of tone) for (const q of tone) {
        const d = pairRoughness(p.f, q.f * alpha, p.a, q.a);
        if (d < 0.004) continue;
        ctx.strokeStyle = pal.voice(0, clamp01(d * 6));
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(lf(p.f), rowA + 9); ctx.lineTo(lf(q.f * alpha), rowB - 9); ctx.stroke();
      }
      ctx.strokeStyle = pal.line; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(X(alpha), T - 4); ctx.lineTo(X(alpha), B); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = pal.muted; ctx.font = mono(10);
      ctx.fillText("partials of the fixed tone", L, rowA - 14);
      ctx.fillText(`partials × ${alpha.toFixed(3)}`, L, rowB + 22);
      const D = dyadRoughness(tone, alpha);
      const near = nearestRatio(alpha, 16);
      const nm = intervalName(near.p, near.q);
      const named = found.filter((m) => m.i <= upto).sort((a, b) => a.x - b.x).map((m) => `${m.ratio.p}/${m.ratio.q}`).join("  ");
      numbers(
        `D(α) = Σᵢⱼ aᵢaⱼ · (e^(−3.51·s·Δf) − e^(−5.75·s·Δf)),   s = 0.24 / (0.0207·f_low + 18.96)\n` +
        `partials f_k = 220·k^${stretch.toFixed(3)} Hz, amplitude k^−0.85, k = 1 … 8\n` +
        `α = ${alpha.toFixed(3)} ≈ ${near.p}/${near.q}${nm ? ` (${nm})` : ""}   D = ${D.toFixed(4)}\n` +
        `wells found so far: ${named || "…"}`,
      );
    },
  });
}

/* ================================================================== */
/* Kuramoto: locking                                                   */
/* ================================================================== */

function initKuramoto() {
  const canvas = $("#kura-stage");
  if (!canvas) return;
  const N = 64, GAMMA = 0.5, KC = 2 * GAMMA;
  const omega = lorentzianFrequencies(N, GAMMA);
  const theta = new Float64Array(N);
  const scatter = () => { for (let i = 0; i < N; i += 1) theta[i] = (i * 2.399963) % TAU; history.length = 0; };
  const history = [];
  let K = 0.6, simT = 0, last = { r: 0, psi: 0 };
  const input = $("#kura-k"), out = $("#kura-k-out");
  const numbers = writer($("#kura-numbers"), 150);
  input?.addEventListener("input", () => { K = Number(input.value); if (out) out.textContent = K.toFixed(2); handle.invalidate(); });
  $("#kura-scatter")?.addEventListener("click", () => { scatter(); handle.invalidate(); });
  scatter();
  const settle = () => { for (let i = 0; i < 3000; i += 1) last = kuramotoStep(theta, omega, K, 0.02); };

  const handle = scene(canvas, {
    frame(ctx, { t, dt, w, h, pal, reduced: still }) {
      if (still) settle();
      else {
        const steps = Math.max(1, Math.round(dt / 0.016 * 3));
        for (let s = 0; s < steps; s += 1) { last = kuramotoStep(theta, omega, K, 0.016); simT += 0.016; }
        history.push(orderParameter(theta).r);
        if (history.length > 900) history.shift();
      }
      const { r, psi } = orderParameter(theta);
      ctx.clearRect(0, 0, w, h);
      const stacked = w < h * 1.3;
      const cw = stacked ? w : Math.min(w * 0.44, h);
      const cx = cw / 2, cy = stacked ? Math.min(h * 0.32, cw / 2) : h / 2;
      const rad = Math.min(cw, stacked ? h * 0.62 : h) * 0.4;
      const grow = still ? 1 : smooth(t / 1.2);
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, rad * grow, 0, TAU); ctx.stroke();
      for (let i = 0; i < N; i += 1) {
        const fast = omega[i] / (GAMMA * 4);
        ctx.fillStyle = pal.voice(fast > 0 ? 1 : 2, 0.35 + 0.6 * clamp01(1 - Math.abs(fast)));
        ctx.beginPath(); ctx.arc(cx + Math.cos(theta[i]) * rad * grow, cy + Math.sin(theta[i]) * rad * grow, 3.2, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = pal.voice(0, 1); ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(psi) * r * rad, cy + Math.sin(psi) * r * rad); ctx.stroke();
      ctx.fillStyle = pal.voice(0, 1); ctx.beginPath(); ctx.arc(cx + Math.cos(psi) * r * rad, cy + Math.sin(psi) * r * rad, 4, 0, TAU); ctx.fill();
      // r(t), with the large-n prediction beside it.
      const gx = stacked ? 18 : cw + 24, gy = stacked ? cy + rad + 30 : h * 0.12, gw = w - gx - 14, gh = stacked ? h - gy - 22 : h * 0.72;
      ctx.strokeStyle = pal.line; ctx.beginPath(); ctx.moveTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.stroke();
      const theory = K > KC ? Math.sqrt(1 - KC / K) : 0;
      ctx.setLineDash([4, 5]); ctx.strokeStyle = pal.voice(1, 0.8);
      ctx.beginPath(); ctx.moveTo(gx, gy + gh * (1 - theory)); ctx.lineTo(gx + gw, gy + gh * (1 - theory)); ctx.stroke(); ctx.setLineDash([]);
      if (history.length > 1) {
        ctx.strokeStyle = pal.voice(0, 0.95); ctx.lineWidth = 1.6; ctx.beginPath();
        history.forEach((v, i) => { const x = gx + (i / 899) * gw, y = gy + gh * (1 - v); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
        ctx.stroke();
      }
      ctx.fillStyle = pal.muted; ctx.font = mono(10);
      ctx.fillText("r(t)", gx + 4, gy + 10);
      ctx.fillText("1", gx - 10, gy + 4); ctx.fillText("0", gx - 10, gy + gh + 3);
      ctx.fillText(`√(1 − K꜀/K) = ${theory.toFixed(2)}`, gx + gw - 132, gy + gh * (1 - theory) - 6);
      const regime = r > 0.75 ? "locked: one voice" : r > 0.3 ? "partly locked: a chord forming" : "drifting: every voice its own";
      numbers(
        `dθᵢ/dt = ωᵢ + K·r·sin(ψ − θᵢ)        r·e^(iψ) = (1/N) Σ e^(iθᵢ)\n` +
        `N = ${N}   ωᵢ Lorentzian, half-width γ = ${GAMMA}   K꜀ = 2γ = ${KC.toFixed(2)}\n` +
        `K = ${K.toFixed(2)}   r = ${r.toFixed(3)}   ψ = ${psi.toFixed(2)} rad   large-n prediction ${theory.toFixed(3)}\n` +
        `${regime}`,
      );
    },
  });
}

/* ================================================================== */
/* Arnold tongues: the circle map                                      */
/* ================================================================== */

function initTongues() {
  const canvas = $("#tongue-stage");
  if (!canvas) return;
  const numbers = writer($("#tongue-numbers"), 120);
  let grid = null, cols = 0, rows = 0, done = 0, img = null, off = null, probe = { omega: 0.5, K: 1 }, hue = null;
  const reset = (w, h) => {
    cols = Math.max(80, Math.min(420, Math.round(w / 2.2)));
    rows = Math.max(40, Math.min(200, Math.round(h / 2.6)));
    grid = new Float32Array(cols * rows);
    done = 0;
    off = document.createElement("canvas"); off.width = cols; off.height = rows;
    img = off.getContext("2d").createImageData(cols, rows);
  };
  const paintCell = (i, j, W, pal) => {
    // Locked cells take the site hue, shading with the ratio's denominator.
    // Quasi-periodic cells stay empty, so the weft shows through where nothing holds.
    const near = nearestRatio(W, 12);
    const locked = Math.abs(W - near.value) < 2e-4;
    const k = (j * cols + i) * 4;
    if (!locked) { img.data[k + 3] = 0; return; }
    // Each denominator speaks in its own voice: 1 the crest, 2 the trough, 3 the node…
    const [r, g, b] = pal.voiceRgb(Math.min(6, near.q - 1));
    img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = Math.round(255 * (near.q === 1 ? 0.38 : 0.3 + 0.62 / Math.sqrt(near.q)));
  };
  const toProbe = (ev) => { const r = canvas.getBoundingClientRect(); probe = { omega: clamp01((ev.clientX - r.left) / r.width), K: clamp01(1 - (ev.clientY - r.top) / r.height) }; handle.invalidate(); };
  canvas.addEventListener("pointermove", toProbe);
  canvas.addEventListener("pointerdown", toProbe);
  onPalette(() => { done = 0; });

  const handle = scene(canvas, {
    frame(ctx, { w, h, pal, reduced: still }) {
      if (!grid || hue !== pal.hue + (pal.light ? 1000 : 0) || off.width !== Math.max(80, Math.min(420, Math.round(w / 2.2)))) { reset(w, h); hue = pal.hue + (pal.light ? 1000 : 0); }
      // Compute row by row, bottom (K = 0) to top (K = 1), within a frame budget.
      const t0 = performance.now();
      while (done < rows && (still || performance.now() - t0 < 7)) {
        const j = rows - 1 - done;
        const K = 1 - j / (rows - 1);
        for (let i = 0; i < cols; i += 1) {
          const W = windingNumber(i / (cols - 1), K, 140, 40);
          grid[j * cols + i] = W;
          paintCell(i, j, W, pal);
        }
        done += 1;
      }
      off.getContext("2d").putImageData(img, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, w, h);
      // The devil's staircase at the probe's K: W against Ω across the row.
      const j = Math.round((1 - probe.K) * (rows - 1));
      if (rows - 1 - j < done) {
        ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.6; ctx.beginPath();
        for (let i = 0; i < cols; i += 1) { const x = (i / (cols - 1)) * w, y = h - grid[j * cols + i] * h; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.strokeStyle = pal.line; ctx.setLineDash([2, 4]); ctx.beginPath();
      ctx.moveTo(probe.omega * w, 0); ctx.lineTo(probe.omega * w, h); ctx.moveTo(0, (1 - probe.K) * h); ctx.lineTo(w, (1 - probe.K) * h); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = pal.muted; ctx.font = mono(10);
      ctx.fillText("Ω →", w - 30, h - 6); ctx.fillText("K ↑", 6, 14);
      const W = windingNumber(probe.omega, probe.K, 400, 100);
      const near = nearestRatio(W, 12);
      const locked = Math.abs(W - near.value) < 2e-4;
      numbers(
        `θₙ₊₁ = θₙ + Ω − (K / 2π)·sin(2πθₙ)        W = lim (θₙ − θ₀) / n\n` +
        `Ω = ${probe.omega.toFixed(3)}   K = ${probe.K.toFixed(3)}   W = ${W.toFixed(4)}   ${locked ? `locked to ${near.p}/${near.q}` : "quasi-periodic: no ratio holds"}\n` +
        `computed ${done} of ${rows} rows · ${(done * cols).toLocaleString()} winding numbers, ${(done * cols * 180).toLocaleString()} map steps`,
      );
    },
  });
}


/* ================================================================== */
/* The seven-voice stack in air                                        */
/* ================================================================== */

function initStack() {
  const canvas = $("#stack-stage");
  if (!canvas) return;
  const numbers = $("#stack-numbers");
  const fs = STACK.map((n) => n * STACK_ROOT);
  if (numbers) numbers.textContent =
    `λ = c / f,   c = ${SPEED_OF_SOUND.toFixed(1)} m/s at 20 °C,   voices n·${STACK_ROOT} Hz, n = ${STACK.join(", ")}\n` +
    fs.map((f, i) => `n = ${String(STACK[i]).padEnd(3)} f = ${f.toFixed(1).padStart(6)} Hz   λ = ${wavelength(f).toFixed(3)} m`).join("\n");
  scene(canvas, {
    frame(ctx, { t, w, h, pal, reduced: still }) {
      ctx.clearRect(0, 0, w, h);
      const metres = 3.4, L = 64, R = w - 12;
      const pxm = (R - L) / metres;
      const rowH = (h - 30) / fs.length;
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.font = mono(10); ctx.fillStyle = pal.muted;
      for (let m = 0; m <= metres; m += 0.5) {
        const x = L + m * pxm;
        ctx.beginPath(); ctx.moveTo(x, h - 22); ctx.lineTo(x, h - 16); ctx.stroke();
        ctx.fillText(`${m.toFixed(1)} m`, x - 12, h - 4);
      }
      fs.forEach((f, i) => {
        const lam = wavelength(f) * pxm;
        const cy = 8 + rowH * (i + 0.5);
        const grow = still ? 1 : smooth((t - i * 0.18) / 1.2);
        const end = L + (R - L) * grow;
        const shift = still ? 0 : t * 0.35 * lam;
        ctx.strokeStyle = pal.voice(i, 0.85); ctx.lineWidth = 1.3; ctx.beginPath();
        for (let x = L; x <= end; x += 2) { const y = cy - Math.sin(TAU * (x - L - shift) / lam) * rowH * 0.34; if (x === L) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.fillStyle = pal.ink; ctx.fillText(`${f.toFixed(0)} Hz`, 4, cy + 4);
      });
    },
  });
}

/* ================================================================== */
/* Macro stratum: elementary cellular automata                         */
/* ================================================================== */

function initAutomaton() {
  const canvas = $("#ca-stage");
  if (!canvas) return;
  const numbers = writer($("#ca-numbers"), 0);
  let rule = 110, rows = [], cols = 0, acc = 0, seedRandom = false, cell = 4;
  const seed = () => {
    const r = new Uint8Array(cols);
    if (seedRandom) { let s = 12345; for (let i = 0; i < cols; i += 1) { s = (s * 1103515245 + 12345) >>> 0; r[i] = (s >>> 16) & 1; } }
    else r[rule === 110 ? cols - 2 : Math.floor(cols / 2)] = 1;
    rows = [r];
  };
  const describe = () => {
    const table = [7, 6, 5, 4, 3, 2, 1, 0].map((k) => `${k.toString(2).padStart(3, "0")}→${(rule >> k) & 1}`).join("  ");
    const last = rows[rows.length - 1] || [];
    const density = last.length ? last.reduce((a, b) => a + b, 0) / last.length : 0;
    numbers(`rule ${rule} = ${rule.toString(2).padStart(8, "0")}₂     ${table}\nrow ${rows.length}   density ${density.toFixed(3)}   ${cols} cells, each reading only itself and two neighbours`, true);
  };
  pressable([...document.querySelectorAll("[data-rule]")], (b) => { rule = Number(b.dataset.rule); seed(); describe(); handle.invalidate(); });
  $("#ca-seed")?.addEventListener("click", (ev) => { seedRandom = !seedRandom; ev.currentTarget.setAttribute("aria-pressed", seedRandom ? "true" : "false"); seed(); describe(); handle.invalidate(); });
  const handle = scene(canvas, {
    frame(ctx, { dt, w, h, pal, reduced: still }) {
      cell = Math.max(3, Math.round(w / 220));
      const want = Math.floor(w / cell), maxRows = Math.floor(h / cell);
      if (want !== cols) { cols = want; seed(); }
      acc += still ? maxRows : dt * 26;
      while (acc >= 1) { acc -= 1; rows.push(caStep(rows[rows.length - 1], rule)); if (rows.length > maxRows) rows.shift(); }
      ctx.clearRect(0, 0, w, h);
      rows.forEach((row, j) => {
        ctx.fillStyle = pal.voice(j % 3 === 0 ? 1 : 0, 0.35 + 0.6 * (j / rows.length));
        for (let i = 0; i < row.length; i += 1) if (row[i]) ctx.fillRect(i * cell, j * cell, cell - 0.6, cell - 0.6);
      });
      if (!still && Math.random() < 0.1) describe();
    },
  });
  describe();
}

/* ================================================================== */
/* Meso stratum: the Halvorsen attractor                               */
/* ================================================================== */

function initAttractor() {
  const canvas = $("#halvorsen-stage");
  if (!canvas) return;
  const numbers = writer($("#halvorsen-numbers"), 150);
  const a = 1.4, dt = 0.005, MAX = 3200;
  let s = [1, 0, 0];
  const trail = [];
  for (let i = 0; i < 400; i += 1) s = rk4((v) => halvorsen(v, a), s, dt); // leave the start behind
  const u = [1 / Math.SQRT2, -1 / Math.SQRT2, 0], v = [1 / Math.sqrt(6), 1 / Math.sqrt(6), -2 / Math.sqrt(6)], n = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)];
  let spin = 0, pnMean = -3;
  scene(canvas, {
    frame(ctx, { t, dt: fdt, w, h, pal, reduced: still }) {
      const rate = 7 + 26 * (1 - smooth(t / 4));
      const steps = still ? MAX : Math.max(1, Math.round((fdt / 0.016) * rate));
      for (let i = 0; i < steps; i += 1) { s = rk4((q) => halvorsen(q, a), s, dt); trail.push(s); }
      while (trail.length > MAX) trail.shift();
      if (!still) spin += fdt * 0.12;
      ctx.clearRect(0, 0, w, h);
      for (let i = Math.max(0, trail.length - steps); i < trail.length; i += 1) pnMean += ((trail[i][0] + trail[i][1] + trail[i][2]) / Math.sqrt(3) - pnMean) * 0.002;
      const scale = Math.min(w, h) / 30, cx = w / 2, cy = h / 2;
      const c = Math.cos(spin), sn = Math.sin(spin), tilt = 0.42;
      const proj = (p) => {
        const pu = p[0] * u[0] + p[1] * u[1] + p[2] * u[2];
        const pv = p[0] * v[0] + p[1] * v[1] + p[2] * v[2];
        const pn = p[0] * n[0] + p[1] * n[1] + p[2] * n[2];
        const x = pu * c - pv * sn, y = pu * sn + pv * c;
        return [cx + x * scale, cy + (y * Math.cos(tilt) + (pn - pnMean) * Math.sin(tilt)) * scale];
      };
      ctx.lineWidth = 1.1;
      let prev = null;
      for (let i = 0; i < trail.length; i += 3) {
        const q = proj(trail[i]);
        if (prev) {
          const age = i / trail.length;
          ctx.strokeStyle = pal.voice(Math.floor(age * 3), 0.06 + 0.8 * age * age);
          ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
        }
        prev = q;
      }
      const head = proj(s);
      ctx.fillStyle = pal.voice(0, 1); ctx.beginPath(); ctx.arc(head[0], head[1], 3.6, 0, TAU); ctx.fill();
      numbers(
        `ẋ = −a·x − 4y − 4z − y²\nẏ = −a·y − 4z − 4x − z²\nż = −a·z − 4x − 4y − x²\n` +
        `a = ${a}   RK4, Δt = ${dt}   x = ${s[0].toFixed(3)}  y = ${s[1].toFixed(3)}  z = ${s[2].toFixed(3)}\n` +
        `viewed down the (1, 1, 1) axis, where the three wings sit 120° apart`,
      );
    },
  });
}

/* ================================================================== */
/* Micro stratum: a tensioned plate, sand finding its nodes            */
/* ================================================================== */

function initPlate() {
  const canvas = $("#plate-stage");
  if (!canvas) return;
  const numbers = writer($("#plate-numbers"), 150);
  const fIn = $("#plate-f"), tIn = $("#plate-t"), fOut = $("#plate-f-out"), tOut = $("#plate-t-out"), handBtn = $("#plate-hand");
  const COLS = 96, ROWS = Math.round(96 * PLATE.Ly / PLATE.Lx);
  const P = 2600;
  const sand = new Float32Array(P * 2);
  const scatter = () => { for (let i = 0; i < P * 2; i += 1) sand[i] = Math.random(); };
  scatter();
  let hand = 0, coupled = true, field = null, key = "", modes = [];
  const freq = () => 30 * Math.pow(400 / 30, Number(fIn?.value ?? 0.35));
  const tension = () => Number(tIn?.value ?? 20);
  const effT = () => clamp(tension() + (coupled ? 30 * hand : 0), 10, 85);
  fIn?.addEventListener("input", () => handle.invalidate());
  tIn?.addEventListener("input", () => handle.invalidate());
  $("#plate-scatter")?.addEventListener("click", () => { scatter(); handle.invalidate(); });
  handBtn?.addEventListener("click", () => { coupled = !coupled; handBtn.setAttribute("aria-pressed", coupled ? "true" : "false"); handle.invalidate(); });
  const at = (x, y) => {
    const i = Math.min(COLS - 1, Math.max(0, Math.floor(x * COLS))), j = Math.min(ROWS - 1, Math.max(0, Math.floor(y * ROWS)));
    return field[j * COLS + i];
  };
  let heat = null;
  const handle = scene(canvas, {
    frame(ctx, { dt, w, h, pal, reduced: still, somatic: so }) {
      hand += ((clamp01(so.speed * 0.7 + so.jerk * 0.5 + so.scroll * 0.4)) - hand) * Math.min(1, dt * 2.5);
      const f = freq(), T = effT();
      const k = `${f.toFixed(2)}|${T.toFixed(1)}`;
      if (k !== key) {
        key = k;
        modes = plateModes(T, 6, 6);
        field = plateResponse(modes, f, COLS, ROWS, 36);
        heat = null;
      }
      // Sand jumps where the plate moves and rests where it does not.
      const iters = still ? 160 : 4;
      for (let it = 0; it < iters; it += 1) {
        for (let p = 0; p < P; p += 1) {
          const x = sand[p * 2], y = sand[p * 2 + 1];
          const amp = at(x, y);
          const jump = amp * amp * 0.045 + 0.0006;
          sand[p * 2] = clamp(x + (Math.random() - 0.5) * jump, 0.002, 0.998);
          sand[p * 2 + 1] = clamp(y + (Math.random() - 0.5) * jump, 0.002, 0.998);
        }
      }
      ctx.clearRect(0, 0, w, h);
      const aspect = PLATE.Lx / PLATE.Ly;
      let pw = w - 8, ph = pw / aspect;
      if (ph > h - 8) { ph = h - 8; pw = ph * aspect; }
      const px = (w - pw) / 2, py = (h - ph) / 2;
      if (!heat) {
        heat = document.createElement("canvas"); heat.width = COLS; heat.height = ROWS;
        const hc = heat.getContext("2d"), im = hc.createImageData(COLS, ROWS);
        const [r, g, b] = pal.voiceRgb(0);
        for (let q = 0; q < field.length; q += 1) { im.data[q * 4] = r; im.data[q * 4 + 1] = g; im.data[q * 4 + 2] = b; im.data[q * 4 + 3] = Math.round(field[q] * 70); }
        hc.putImageData(im, 0, 0);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(heat, px, py, pw, ph);
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1; ctx.strokeRect(px, py, pw, ph);
      ctx.fillStyle = pal.ink;
      for (let p = 0; p < P; p += 1) ctx.fillRect(px + sand[p * 2] * pw - 0.7, py + sand[p * 2 + 1] * ph - 0.7, 1.4, 1.4);
      if (fOut) fOut.textContent = `${f.toFixed(1)} Hz`;
      if (tOut) tOut.textContent = tension().toFixed(1);
      const nearest = [...modes].sort((m1, m2) => Math.abs(m1.f - f) - Math.abs(m2.f - f)).slice(0, 3);
      numbers(
        `ω²ₘₙ = (T₀·γ² + D·γ⁴) / (ρh),  γ² = (mπ/Lx)² + (nπ/Ly)²,  T₀ = 50·e^(0.065·T)\n` +
        `steel ${PLATE.Lx} × ${PLATE.Ly} m, h = ${PLATE.h * 1000} mm   simply supported   driven at f = ${f.toFixed(1)} Hz (λ in air ${wavelength(f).toFixed(2)} m)\n` +
        `T = ${tension().toFixed(1)}${coupled ? ` + ${(30 * hand).toFixed(1)} from your hand` : ""} = ${T.toFixed(1)}   T₀ = ${membraneTension(T).toFixed(1)} N/m\n` +
        `nearest modes: ${nearest.map((m) => `(${m.m},${m.n}) ${m.f.toFixed(1)} Hz`).join("   ")}`,
      );
    },
  });
}

/* ================================================================== */
/* Provenance: the orthogonal projector                                */
/* ================================================================== */

function initProvenance() {
  const canvas = $("#prov-stage");
  if (!canvas) return;
  const numbers = writer($("#prov-numbers"), 0);
  const EPOCHS = 80;
  let state, series, acc = 0, leakMax = 0;
  const reset = () => { state = makeProvenance(48); const c = provenanceCosines(state); series = [{ epoch: 0, raw: c.raw, projected: c.projected, leak: 0 }]; leakMax = 0; acc = 0; };
  reset();
  $("#prov-reset")?.addEventListener("click", () => { reset(); handle.invalidate(); });
  const describe = () => {
    const s = series[series.length - 1];
    const cross = series.find((p) => p.raw < 0.5);
    numbers(
      `W·x = y at epoch 0, by construction (d = ${state.d})\n` +
      `each epoch: ΔW = A·B, rank 2      raw: W ← W + ΔW      projected: W ← W + ΔW·P⊥,  P⊥ = I − x·xᵀ\n` +
      `epoch ${s.epoch}   cos(W·x, y): raw ${s.raw.toFixed(4)}   projected ${s.projected.toFixed(15)}\n` +
      `largest leak ‖ΔW·P⊥·x‖ so far ${leakMax.toExponential(2)} (floating-point dust)` +
      (cross ? `\nraw fell below the 0.5 valve threshold at epoch ${cross.epoch}` : ""),
      true,
    );
  };
  const handle = scene(canvas, {
    frame(ctx, { dt, w, h, pal, reduced: still }) {
      acc += still ? EPOCHS : dt * 9;
      while (acc >= 1 && series.length <= EPOCHS) {
        acc -= 1;
        const r = provenanceEpoch(state);
        leakMax = Math.max(leakMax, r.leak);
        series.push(r);
        describe();
      }
      ctx.clearRect(0, 0, w, h);
      const L = 34, R = w - 12, T = 12, B = h - 24;
      const X = (e) => L + (e / EPOCHS) * (R - L), Y = (v) => B - clamp01(v) * (B - T);
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, B); ctx.lineTo(R, B); ctx.stroke();
      ctx.setLineDash([3, 5]); ctx.strokeStyle = pal.voice(3, 0.7);
      ctx.beginPath(); ctx.moveTo(L, Y(0.5)); ctx.lineTo(R, Y(0.5)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = pal.muted; ctx.font = mono(10);
      ctx.fillText("1", L - 14, Y(1) + 4); ctx.fillText("0.5", L - 26, Y(0.5) + 4); ctx.fillText("0", L - 14, B + 3);
      ctx.fillText(`epoch ${EPOCHS}`, R - 56, B + 16);
      for (const [key, voice, label] of [["projected", 0, "projected"], ["raw", 2, "raw"]]) {
        ctx.strokeStyle = pal.voice(voice, 0.95); ctx.lineWidth = 2; ctx.beginPath();
        series.forEach((p, i) => { const x = X(p.epoch), y = Y(p[key]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
        ctx.stroke();
        const lastP = series[series.length - 1];
        ctx.fillStyle = pal.voice(voice, 1);
        ctx.fillText(label, Math.min(R - 60, X(lastP.epoch) + 6), Y(lastP[key]) + (key === "raw" ? 14 : -6));
      }
    },
  });
  describe();
}

/* ================================================================== */
/* The soundtrack: the medium listens                                  */
/* ================================================================== */

function initSoundtrack() {
  const players = [...document.querySelectorAll("[data-player]")];
  if (!players.length) return;
  let actx = null;
  const parseSrt = (text) => text.replace(/\r/g, "").split(/\n\n+/).map((block) => {
    const m = block.match(/(\d+):(\d+):(\d+)[,.](\d+)\s+-->\s+(\d+):(\d+):(\d+)[,.](\d+)/);
    if (!m) return null;
    const sec = (a, b, c, d) => +a * 3600 + +b * 60 + +c + +d / 1000;
    return { start: sec(m[1], m[2], m[3], m[4]), end: sec(m[5], m[6], m[7], m[8]) };
  }).filter(Boolean);
  for (const host of players) {
    const media = host.querySelector("audio");
    const btn = host.querySelector("[data-play]");
    const seek = host.querySelector("[data-seek]");
    const time = host.querySelector("[data-time]");
    const canvas = host.querySelector("canvas");
    if (!media || !btn) continue;
    media.removeAttribute("controls");
    host.classList.add("is-live");
    let analyser = null, bins = null, wave = null;
    const ensureGraph = () => {
      if (analyser) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = actx || new AC();
      try {
        const src = actx.createMediaElementSource(media);
        analyser = actx.createAnalyser();
        analyser.fftSize = 2048;
        src.connect(analyser); analyser.connect(actx.destination);
        bins = new Uint8Array(analyser.frequencyBinCount);
        wave = new Uint8Array(analyser.fftSize);
      } catch (e) { analyser = null; }
    };
    const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    const paintTime = () => {
      if (time) time.textContent = `${clock(media.currentTime || 0)} / ${clock(media.duration || 0)}`;
      if (seek && Number.isFinite(media.duration)) seek.value = String((media.currentTime / media.duration) * 1000 || 0);
    };
    btn.addEventListener("click", () => {
      for (const other of players) if (other !== host) { const o = other.querySelector("audio"); if (o && !o.paused) o.pause(); }
      ensureGraph();
      if (actx?.state === "suspended") actx.resume();
      if (media.paused) media.play(); else media.pause();
      const r = btn.getBoundingClientRect(); ripple(r.left + r.width / 2, r.top + r.height / 2, 1);
    });
    media.addEventListener("play", () => { btn.textContent = "Pause"; btn.setAttribute("aria-pressed", "true"); });
    media.addEventListener("pause", () => { btn.textContent = "Play"; btn.setAttribute("aria-pressed", "false"); drive(null); });
    media.addEventListener("timeupdate", paintTime);
    media.addEventListener("loadedmetadata", paintTime);
    seek?.addEventListener("input", () => { if (Number.isFinite(media.duration)) media.currentTime = (Number(seek.value) / 1000) * media.duration; });
    // Lyrics follow the song.
    const cues = [...document.querySelectorAll(`[data-cues="${host.id}"] li`)];
    let timing = [];
    if (cues.length && host.dataset.srt) {
      fetch(host.dataset.srt).then((r) => (r.ok ? r.text() : "")).then((t) => { timing = parseSrt(t); }).catch(() => {});
    }
    let current = -1;
    media.addEventListener("timeupdate", () => {
      if (!timing.length) return;
      const tt = media.currentTime;
      let idx = -1;
      for (let i = 0; i < timing.length; i += 1) if (tt >= timing[i].start) idx = i;
      if (idx !== current) {
        cues[current]?.removeAttribute("data-now");
        current = idx;
        cues[current]?.setAttribute("data-now", "");
      }
    });
    if (!canvas) continue;
    scene(canvas, {
      frame(ctx, { t, w, h, pal }) {
        ctx.clearRect(0, 0, w, h);
        const playing = !media.paused && analyser;
        if (playing) {
          analyser.getByteFrequencyData(bins);
          analyser.getByteTimeDomainData(wave);
          // The weft takes the song's spectrum: seven bands, one per partial.
          const amps = [];
          const edges = [2, 6, 12, 24, 48, 96, 192, 384];
          for (let k = 0; k < 7; k += 1) {
            let s = 0; for (let b = edges[k]; b < edges[k + 1]; b += 1) s += bins[b];
            amps.push(0.15 + 2.1 * (s / (edges[k + 1] - edges[k]) / 255) ** 1.4 / (1 + k * 0.25));
          }
          drive(amps, 0.6);
        }
        // Waveform as one thread; progress as where that thread is lit.
        const mid = h / 2, prog = Number.isFinite(media.duration) && media.duration ? media.currentTime / media.duration : 0;
        const N = 360;
        ctx.lineWidth = 1.6;
        for (const [from, to, lit] of [[0, prog, true], [prog, 1, false]]) {
          ctx.strokeStyle = lit ? pal.voice(0, 0.95) : pal.line;
          ctx.beginPath();
          for (let k = Math.floor(from * N); k <= Math.ceil(to * N); k += 1) {
            const u = k / N;
            let y;
            if (playing) { const idx = Math.floor(u * (wave.length - 1)); y = ((wave[idx] - 128) / 128) * h * 0.42; }
            else y = Math.sin(u * TAU * 3 + t * 0.6) * Math.sin(u * Math.PI) * h * 0.08;
            if (k === Math.floor(from * N)) ctx.moveTo(u * w, mid - y); else ctx.lineTo(u * w, mid - y);
          }
          ctx.stroke();
        }
      },
    });
  }
}

/* ================================================================== */

initChords();
initRoughness();
initKuramoto();
initTongues();
initStack();
initAutomaton();
initAttractor();
initPlate();
initProvenance();
initSoundtrack();
if (reduced()) drive(null);
