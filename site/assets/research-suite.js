// Live figures for the substrate simulations page (site/research/index.html).
// Each figure draws itself in on the loom's single frame and prints the
// numbers it drew. What is computed, reported or illustrative is said on the
// figure and in its numbers; the mathematics and the reported tables live in
// suite-math.js, where Node checks them.

import { scene } from "./loom.js";
import {
  TAU, CELL, runCell, displacement, coreDrift,
  E11, E11_RETURN, E11_CORE_DRIFT, e11Return, plasmSide, plasmBytes, compression, compressionLabel, invSqrtP, phenotypeValue,
  E12, E12_REPORTED, E12_ARMS, retention, retentionLabel, shiftKind, signed,
  TOY, makeDonor, graft,
} from "./suite-math.js";

const $ = (sel, el = document) => el.querySelector(sel);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v) => clamp(v, 0, 1);
const smooth = (u) => { const x = clamp01(u); return x * x * (3 - 2 * x); };
const lerp = (a, b, u) => a + (b - a) * u;
const mono = (px) => `${px}px ui-monospace, "SF Mono", Menlo, monospace`;
const sci = (v) => (Math.abs(v) < 1e-6 ? v.toExponential(1) : v.toFixed(3));
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
/** Spread label y positions apart by at least `gap`, keeping their order. */
function spread(items, gap, lo, hi) {
  const s = [...items].sort((a, b) => a.y - b.y);
  for (let i = 1; i < s.length; i += 1) if (s[i].y - s[i - 1].y < gap) s[i].y = s[i - 1].y + gap;
  const over = s.length ? s[s.length - 1].y - hi : 0;
  if (over > 0) for (const it of s) it.y -= over;
  for (const it of s) it.y = Math.max(lo, it.y);
  return s;
}
function arrow(ctx, x0, y0, x1, y1, head = 7) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  if (Math.hypot(x1 - x0, y1 - y0) < head) return;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(a - 0.42), y1 - head * Math.sin(a - 0.42));
  ctx.lineTo(x1 - head * Math.cos(a + 0.42), y1 - head * Math.sin(a + 0.42));
  ctx.closePath(); ctx.fill();
}

/* ================================================================== */
/* 1 · The statistical cell: a Frobenius-gated walk                    */
/* ================================================================== */

function initCell() {
  const canvas = $("#cell-stage");
  if (!canvas) return;
  const numbers = writer($("#cell-numbers"), 120);
  const rIn = $("#cell-r"), rOut = $("#cell-r-out");
  const N = CELL.N, BUDGET = 200, RATE = 9; // proposals made while the figure draws itself in
  let seed = 1, manual = 0, since = 0;
  let R = clamp(Number(rIn?.value ?? CELL.R), CELL.R_MIN, CELL.R_MAX);
  let walk = runCell(seed, R, 0);
  const wanted = (still) => (still ? BUDGET : Math.min(BUDGET, Math.floor(since * RATE))) + manual;

  rIn?.addEventListener("input", () => {
    R = Number(rIn.value);
    if (rOut) rOut.textContent = R.toFixed(2);
    walk = runCell(seed, R, walk.history.length); // the same noise, replayed under the new gate
    handle.invalidate();
  });
  const propose = () => { manual += 1; handle.invalidate(); };
  $("#cell-step")?.addEventListener("click", propose);
  canvas.addEventListener("click", propose);
  $("#cell-reset")?.addEventListener("click", () => { seed += 1; manual = 0; since = 0; walk = runCell(seed, R, 0); handle.invalidate(); });

  const describe = (force) => {
    const hist = walk.history, count = hist.length, last = hist[count - 1];
    const acc = walk.commits, disp = displacement(walk.W, walk.W0), drift = coreDrift(walk.W, walk.W0);
    numbers(
      `W₀[i] = 0.6·sin(2.31·(i + 1)),  i = 0 … 63      8 × 8 Float32, rows 0–1 frozen\n` +
      `propose   W′ = W + ε on rows 2–7,   ε = 0.08·(u − 0.48) per entry,   u ~ U[0, 1), seed ${seed}\n` +
      `accept    iff ‖W′ − W₀‖_F ≤ R\n` +
      (last
        ? `proposal ${count}:   ‖W′ − W₀‖_F = ${last.candidate.toFixed(3)} ${last.accepted ? "≤" : ">"} R = ${R.toFixed(2)}   ${last.accepted ? "accepted" : "rejected"}\n`
        : `no proposal yet\n`) +
      `‖W − W₀‖_F = ${disp.toFixed(3)} ≤ ${R.toFixed(2)}    accepted ${acc} of ${count}${count ? ` (${((100 * acc) / count).toFixed(1)} %)` : ""}    core drift ‖W[0:2] − W₀[0:2]‖_F = ${drift === 0 ? "0, exactly" : drift.toExponential(2)}\n` +
      `fit ${walk.fit.toFixed(2)}    the original's counter: 0.82 + 0.01 per accepted commit, capped at 0.98; not a measurement`,
      force,
    );
  };

  const cells = (ctx, x, y, s, fill) => {
    const cs = s / N;
    for (let r = 0; r < N; r += 1) for (let c = 0; c < N; c += 1) {
      ctx.fillStyle = fill(r * N + c);
      ctx.fillRect(x + c * cs + 0.5, y + r * cs + 0.5, cs - 1.5, cs - 1.5);
    }
  };

  const handle = scene(canvas, {
    frame(ctx, { dt, w, h, pal, reduced: still }) {
      since += dt;
      const n = wanted(still);
      while (walk.history.length < n) walk.step(R);
      ctx.clearRect(0, 0, w, h);
      const wide = w >= 620;
      let s, x1, y1, x2, y2, L, Rx, T, B;
      if (wide) {
        s = Math.min(w * 0.22, (h - 76) / 2, 220);
        x1 = 4; y1 = 24; x2 = 4; y2 = y1 + s + 40;
        L = x1 + s + 78; Rx = w - 12; T = 24; B = h - 30;
      } else {
        s = Math.min((w - 28) / 2, h * 0.32);
        x1 = 4; y1 = 24; x2 = w - 4 - s; y2 = y1;
        L = 58; Rx = w - 8; T = y1 + s + 46; B = h - 30;
      }
      const { W, W0 } = walk;
      // W itself: sign by voice, size by strength.
      cells(ctx, x1, y1, s, (i) => pal.voice(W[i] >= 0 ? 0 : 1, 0.12 + 0.8 * clamp01(Math.abs(W[i]) / 0.6)));
      // W − W₀, at a scale set by the gate: the core stays exactly empty.
      const scale = (2 * R) / Math.sqrt((N - CELL.CORE) * N);
      cells(ctx, x2, y2, s, (i) => {
        const d = W[i] - W0[i];
        return d === 0 ? pal.faint : pal.voice(d >= 0 ? 0 : 1, 0.12 + 0.8 * clamp01(Math.abs(d) / scale));
      });
      const cs = s / N;
      ctx.strokeStyle = pal.node(0.95); ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]);
      ctx.strokeRect(x1 - 1.5, y1 - 1.5, s + 2, cs * CELL.CORE + 2);
      ctx.strokeRect(x2 - 1.5, y2 - 1.5, s + 2, cs * CELL.CORE + 2);
      ctx.setLineDash([]);
      ctx.font = mono(11); ctx.fillStyle = pal.muted;
      ctx.fillText("W", x1, y1 - 9);
      ctx.fillText("W − W₀", x2, y2 - 9);
      ctx.fillStyle = pal.node(1);
      ctx.textAlign = "end";
      ctx.fillText("frozen core", x1 + s, y1 - 9);
      ctx.textAlign = "start";

      // The walk: displacement after each proposal, against the gate.
      const hist = walk.history, count = hist.length;
      const nMax = Math.max(BUDGET, count);
      let yMax = Math.max(R * 1.25, 0.4);
      for (const p of hist) if (p.candidate > yMax) yMax = p.candidate;
      yMax *= 1.05;
      const X = (i) => L + (i / nMax) * (Rx - L), Y = (v) => B - (v / yMax) * (B - T);
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, B); ctx.lineTo(Rx, B); ctx.stroke();
      ctx.strokeStyle = pal.node(0.9); ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(L, Y(R)); ctx.lineTo(Rx, Y(R)); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = mono(10); ctx.fillStyle = pal.muted;
      ctx.textAlign = "end";
      ctx.fillText("0", L - 6, B + 3);
      ctx.fillText(`proposal ${count}`, Rx, B + 16);
      ctx.fillStyle = pal.node(1);
      ctx.fillText(`R ${R.toFixed(2)}`, L - 6, Y(R) + 3);
      ctx.textAlign = "start";
      ctx.fillStyle = pal.muted;
      ctx.fillText("‖W − W₀‖_F after each proposal", L + 6, T + 4);
      for (let i = 0; i < count; i += 1) {
        const p = hist[i];
        if (p.accepted) continue;
        ctx.strokeStyle = pal.trough(0.7); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(X(i + 1), Y(p.candidate), 2.2, 0, TAU); ctx.stroke();
      }
      ctx.strokeStyle = pal.crest(0.95); ctx.lineWidth = 1.7;
      ctx.beginPath(); ctx.moveTo(X(0), Y(0));
      for (let i = 0; i < count; i += 1) ctx.lineTo(X(i + 1), Y(hist[i].displacement));
      ctx.stroke();
      if (count) {
        const p = hist[count - 1], px = X(count), py = Y(p.candidate);
        ctx.fillStyle = p.accepted ? pal.crest(1) : pal.trough(1);
        ctx.beginPath(); ctx.arc(px, py, 4, 0, TAU); ctx.fill();
        ctx.font = mono(11);
        const label = p.accepted ? "accepted" : "rejected";
        const tw = ctx.measureText(label).width;
        ctx.fillText(label, px + 8 + tw > Rx ? px - 8 - tw : px + 8, py - 8 < T + 14 ? py + 16 : py - 8);
      }
      // Legend, in the plot's own words.
      ctx.font = mono(10);
      ctx.fillStyle = pal.trough(0.9); ctx.fillText("○ rejected candidate", L + 6, T + 20);
      ctx.fillStyle = pal.crest(1); ctx.fillText("— where W stands", L + 6, T + 34);
      describe(still);
    },
  });
  describe(true);
}

/* ================================================================== */
/* 2 · Morphogenesis: a 492-byte packet unfolds                        */
/* ================================================================== */

const E11_SHORT = { morph: "M1", scrambled: "C2", direct: "D" };

function initMorph() {
  const canvas = $("#morph-stage");
  if (!canvas) return;
  const numbers = writer($("#morph-numbers"), 0);
  const dIn = $("#morph-d"), dOut = $("#morph-d-out");
  const ARMS = Object.keys(E11.ARMS);
  let arm = "morph", D = clamp(Number(dIn?.value ?? E11.D_MAX), E11.D_MIN, E11.D_MAX), since = 0;
  let off = null, offKey = "";

  const describe = () => {
    const n = plasmSide(D), bytes = plasmBytes(D);
    numbers([
      `genotype   ${E11.GENOTYPE_BYTES} B packet, ${E11.NODES} nodes (${E11.COMBINATORS.join(" ")})   →   Plasm ${n} × ${n}, Float32`,
      arm === "direct"
        ? `wire       direct ES evolves the matrix itself: ${n}² × 4 B = ${bytes.toLocaleString("en")} B, ${compressionLabel(arm, D)}`
        : `wire       ${n}² × 4 B = ${bytes.toLocaleString("en")} B  ÷  ${E11.GENOTYPE_BYTES} B  =  ${compression(arm, D).toFixed(1)}× compression`,
      arm === "direct"
        ? `           no IC graph; the original notes O(1/√P) for P = ${(n * n).toLocaleString("en")} weights: 1/√P = ${invSqrtP(D).toFixed(5)}`
        : `           packet side drawn at 1/√${compression(arm, D).toFixed(1)} = ${(1 / Math.sqrt(compression(arm, D))).toFixed(4)} of the matrix side`,
      ``,
      `E11 12-seed return, reported, at ${n}²:   ${ARMS.map((a) => `${E11_SHORT[a]} ${E11_RETURN[a][D]}`).join("    ")}`,
      `${E11_SHORT[arm]} across 64² → 512², reported:   ${[6, 7, 8, 9].map((d) => E11_RETURN[arm][d]).join("  →  ")}`,
      `core drift ${E11_CORE_DRIFT}, reported for every arm and scale`,
      `pattern (illustrative): core rows 0.4·sin(30r + 20c); below, ${arm === "morph" ? "cos(6.28·(r − c) + 1)" : `sin((311r + 293c)·${D})`}`,
    ].join("\n"), true);
  };
  pressable([...document.querySelectorAll("[data-e11]")], (b) => { arm = b.dataset.e11; since = 0; describe(); handle.invalidate(); });
  dIn?.addEventListener("input", () => {
    D = Number(dIn.value);
    if (dOut) dOut.textContent = `${plasmSide(D)}²`;
    since = 0; describe(); handle.invalidate();
  });

  const build = (pal) => {
    const n = plasmSide(D);
    off = off || document.createElement("canvas");
    off.width = n; off.height = n;
    const g = off.getContext("2d");
    const im = g.createImageData(n, n);
    const pos = pal.voiceRgb(0), neg = pal.voiceRgb(1);
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        const v = phenotypeValue(arm, r / n, c / n, D);
        const rgb = v >= 0 ? pos : neg;
        const k = (r * n + c) * 4;
        im.data[k] = rgb[0]; im.data[k + 1] = rgb[1]; im.data[k + 2] = rgb[2];
        im.data[k + 3] = Math.round(255 * (0.2 + 0.7 * Math.min(1, Math.abs(v))));
      }
    }
    g.putImageData(im, 0, 0);
  };

  const handle = scene(canvas, {
    frame(ctx, { t, dt, w, h, pal, reduced: still }) {
      since += dt;
      const key = `${arm}|${D}|${pal.hue}|${pal.light}`;
      if (key !== offKey) { build(pal); offKey = key; }
      ctx.clearRect(0, 0, w, h);
      const n = plasmSide(D);
      const wide = w >= 700;
      let S, mx, my, gx, cL, cR, cT, cB;
      if (wide) {
        S = Math.min(h - 56, w * 0.4);
        mx = 4; my = 26; gx = mx + S + 18;
        cL = gx + 128; cR = w - 54; cT = 40; cB = h - 34;
      } else {
        S = Math.min(w - 112, h * 0.46);
        mx = 4; my = 26; gx = mx + S + 14;
        cL = 40; cR = w - 46; cT = my + S + 58; cB = h - 30;
      }
      // The matrix unfolds from the top: the locked core first, then the rest.
      const frac = still ? 1 : smooth(since / 2.6);
      const shown = Math.max(1, Math.round(n * frac));
      ctx.imageSmoothingEnabled = n > S;
      ctx.drawImage(off, 0, 0, n, shown, mx, my, S, (S * shown) / n);
      ctx.imageSmoothingEnabled = true;
      ctx.strokeStyle = arm === "direct" ? pal.node(0.9) : pal.line; ctx.lineWidth = 1;
      ctx.strokeRect(mx - 0.5, my - 0.5, S + 1, S + 1);
      if (shown < n) {
        ctx.strokeStyle = pal.crest(0.95); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(mx, my + (S * shown) / n); ctx.lineTo(mx + S, my + (S * shown) / n); ctx.stroke();
      }
      ctx.strokeStyle = pal.node(0.95); ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]);
      ctx.strokeRect(mx - 1.5, my - 1.5, S + 3, S * 0.25 + 3);
      ctx.setLineDash([]);
      ctx.font = mono(11); ctx.fillStyle = pal.muted;
      ctx.fillText(`Plasm ${n} × ${n} · illustrative`, mx, my - 10);
      ctx.fillStyle = pal.node(1);
      ctx.font = mono(10);
      ctx.fillText("locked core", mx + 6, my + S * 0.25 - 6);
      // The genotype, drawn to scale against the matrix it becomes.
      ctx.font = mono(10);
      if (arm === "direct") {
        ctx.fillStyle = pal.node(1);
        ctx.fillText("genotype =", gx, my + 10);
        ctx.fillText("the matrix", gx, my + 24);
        ctx.fillStyle = pal.muted;
        ctx.fillText("1.0×", gx, my + 40);
      } else {
        const side = Math.max(1.5, S / Math.sqrt(compression(arm, D)));
        const grow = still ? 1 : smooth((since - 0.15) / 0.6);
        ctx.fillStyle = pal.node(0.9);
        ctx.fillRect(gx, my, side * grow, side * grow);
        ctx.fillStyle = pal.node(1);
        ctx.fillText(`${E11.GENOTYPE_BYTES} B`, gx, my + side + 16);
        ctx.fillStyle = pal.muted;
        ctx.fillText("to scale", gx, my + side + 30);
        ctx.fillText(`${compression(arm, D).toFixed(1)}×`, gx, my + side + 44);
      }

      // E11's reported returns across scale.
      const yLo = -5, yHi = 45;
      const X = (d) => cL + ((d - E11.D_MIN) / (E11.D_MAX - E11.D_MIN)) * (cR - cL);
      const Y = (v) => cB - ((v - yLo) / (yHi - yLo)) * (cB - cT);
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cL, Y(0)); ctx.lineTo(cR, Y(0)); ctx.stroke();
      ctx.font = mono(10); ctx.fillStyle = pal.muted; ctx.textAlign = "end";
      for (const v of [0, 20, 40]) ctx.fillText(String(v), cL - 8, Y(v) + 3);
      ctx.textAlign = "center";
      for (let d = E11.D_MIN; d <= E11.D_MAX; d += 1) {
        ctx.fillStyle = d === D ? pal.ink : pal.muted;
        ctx.fillText(`${plasmSide(d)}²`, X(d), cB + 16);
      }
      ctx.textAlign = "start";
      ctx.fillStyle = pal.muted;
      ctx.fillText("E11 12-seed return · reported", cL, cT - 16);
      ctx.strokeStyle = pal.line; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(X(D), cT - 4); ctx.lineTo(X(D), cB); ctx.stroke(); ctx.setLineDash([]);
      const reach = still ? E11.D_MAX : E11.D_MIN + (E11.D_MAX - E11.D_MIN) * smooth((t - 0.3) / 1.8);
      const order = [...ARMS.filter((a) => a !== arm), arm];
      const ends = [];
      order.forEach((a) => {
        const vi = ARMS.indexOf(a), sel = a === arm;
        ctx.strokeStyle = pal.voice(vi, sel ? 1 : 0.45); ctx.lineWidth = sel ? 2.2 : 1.2;
        ctx.beginPath();
        for (let d = E11.D_MIN; d <= Math.floor(reach); d += 1) { if (d === E11.D_MIN) ctx.moveTo(X(d), Y(e11Return(a, d))); else ctx.lineTo(X(d), Y(e11Return(a, d))); }
        const d0 = Math.floor(reach);
        if (d0 < E11.D_MAX) { const u = reach - d0; ctx.lineTo(X(d0 + u), Y(lerp(e11Return(a, d0), e11Return(a, d0 + 1), u))); }
        ctx.stroke();
        ctx.fillStyle = pal.voice(vi, sel ? 1 : 0.5);
        for (let d = E11.D_MIN; d <= reach + 1e-9; d += 1) { ctx.beginPath(); ctx.arc(X(d), Y(e11Return(a, d)), sel ? 3.4 : 2.4, 0, TAU); ctx.fill(); }
        if (sel) {
          // Values over their points; the end ones lean inward, clear of the axis and the arm names.
          ctx.font = mono(10); ctx.fillStyle = pal.ink;
          for (let d = E11.D_MIN; d <= reach + 1e-9; d += 1) {
            ctx.textAlign = d === E11.D_MIN ? "start" : d === E11.D_MAX ? "end" : "center";
            const nudge = d === E11.D_MIN ? 2 : d === E11.D_MAX ? -2 : 0;
            ctx.fillText(E11_RETURN[a][d], X(d) + nudge, Y(e11Return(a, d)) - 10);
          }
          ctx.textAlign = "start";
        }
        if (reach >= E11.D_MAX - 1e-9) ends.push({ a, vi, sel, y: Y(e11Return(a, E11.D_MAX)) + 3 });
      });
      ctx.font = mono(11);
      for (const e of spread(ends, 13, cT, cB)) { ctx.fillStyle = pal.voice(e.vi, e.sel ? 1 : 0.6); ctx.fillText(E11_SHORT[e.a], cR + 10, e.y); }
    },
  });
  describe();
}

/* ================================================================== */
/* 3 · Plasmid graft: the null-space gate                              */
/* ================================================================== */

const E12_SHORT = { nullgate: "G2", ungated: "G1", raw: "C1" };
const E12_NAME = { nullgate: "G2 gated", ungated: "G1 ungated", raw: "C1 raw" };

function initGraft() {
  const canvas = $("#graft-stage");
  if (!canvas) return;
  const numbers = writer($("#graft-numbers"), 0);
  const sIn = $("#graft-shift"), sOut = $("#graft-shift-out");
  const donor = makeDonor();
  let sibling = 1, g = graft(donor, sibling), arm = "nullgate", since = 0;
  let shift = clamp(Number(sIn?.value ?? E12.SHIFT_DEFAULT), E12.SHIFT_MIN, E12.SHIFT_MAX);

  const describe = () => {
    const S = shift.toFixed(1);
    const toy = E12_ARMS.map((a) => {
      const x = g[a];
      return `  ${E12_NAME[a].padEnd(11)} ${sci(x.keep).padStart(9)}   ${x.free.toFixed(3).padStart(6)}   ${x.total.toFixed(3).padStart(6)}   ${x.skill.toFixed(3).padStart(7)}     ${sci(shift * x.keep).padStart(9)}`;
    });
    const rep = E12_ARMS.map((a) => {
      const r = E12_REPORTED[a];
      return `  ${r.label.padEnd(24)} ${retentionLabel(a, shift).padEnd(20)} ${`${r.transfer} (${r.transferNote})`.padEnd(24)} ${r.residual.padEnd(14)} ${r.pass}`;
    });
    const kind = shiftKind(shift);
    numbers([
      `ΔW_gated = ΔW·(I − Q_keep·Q_keepᵀ)    so    ΔW_gated·Q_keep = ΔW·Q_keep − ΔW·Q_keep·(Q_keepᵀ·Q_keep) = 0`,
      ``,
      `toy, computed here (seeded; not E12's data): d = ${TOY.d} channels, m = ${TOY.m} outputs, k = ${TOY.k} kept directions`,
      `sibling basis ${sibling}: host channel j carries donor channel ${g.perm.join(" ")}`,
      `  arm          ‖ΔW·Q‖_F     free   ‖ΔW‖_F   skill cos     kept inputs at ${S}×: ${S}·‖ΔW·Q‖_F`,
      ...toy,
      `  ‖ΔW‖_F² = ‖ΔW·Q‖_F² + free²; a permutation keeps ‖ΔW‖_F, so G1 and C1 sit on one arc`,
      ``,
      `E12, reported (12 seeds; plasmid ${E12.PLASMID_NODES} nodes, ${E12.PLASMID_BYTES} B, spliced via ${E12.SPLICE})`,
      `  arm                      retention at ${S}×    0-shot transfer          ‖ΔW·Q_keep‖_F  shifted retention`,
      ...rep,
      `  retention at ${S}×: ${kind === "anchor" ? "a value the original gives" : kind === "interpolated" ? "interpolated by the original page, a − b·(shift − 1)/1.4" : "extrapolated by the original page, past its 2.4× value"}`,
    ].join("\n"), true);
  };
  pressable([...document.querySelectorAll("[data-e12]")], (b) => { arm = b.dataset.e12; since = 0; describe(); handle.invalidate(); });
  $("#graft-perm")?.addEventListener("click", () => { sibling += 1; g = graft(donor, sibling); since = 0; describe(); handle.invalidate(); });
  sIn?.addEventListener("input", () => {
    shift = Number(sIn.value);
    if (sOut) sOut.textContent = `${shift.toFixed(1)}×`;
    describe(); handle.invalidate();
  });

  const handle = scene(canvas, {
    frame(ctx, { t, dt, w, h, pal, reduced: still }) {
      since += dt;
      ctx.clearRect(0, 0, w, h);
      const wide = w >= 700;
      let P, ox, oy, bx, by, cL, cR, cT, cB;
      if (wide) {
        P = Math.min(w * 0.3, h - 92);
        ox = 44; oy = 40 + P; bx = ox + P + 34; by = 58;
        cL = bx + 116; cR = w - 40; cT = 40; cB = h - 34;
      } else {
        P = Math.min(w - 136, h * 0.4);
        ox = 40; oy = 40 + P; bx = ox + P + 24; by = 58;
        cL = 40; cR = w - 34; cT = oy + 74; cB = h - 30;
      }
      const ai = (a) => E12_ARMS.indexOf(a);

      // The toy: each arm's update split into what the kept directions see and the rest.
      const rMax = Math.max(...E12_ARMS.map((a) => g[a].total)) * 1.08;
      const k = P / rMax;
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ox, oy - P); ctx.lineTo(ox, oy); ctx.lineTo(ox + P, oy); ctx.stroke();
      ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(ox, oy, g.ungated.total * k, -Math.PI / 2, 0); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = mono(10); ctx.fillStyle = pal.muted;
      ctx.fillText("free  ‖ΔW·(I − QQᵀ)‖_F", ox - 30, oy - P - 10);
      ctx.textAlign = "end";
      ctx.fillText("‖ΔW·Q‖_F  kept →", ox + P, oy + 16);
      ctx.textAlign = "start";
      ctx.fillText("toy · computed here", ox - 30, 14);
      const grow = still ? 1 : smooth(since / 0.8);
      const proj = still ? 1 : smooth((since - 0.9) / 1.2);
      const tips = {};
      for (const a of [...E12_ARMS.filter((x) => x !== arm), arm]) {
        const sel = a === arm;
        let x = g[a].keep, y = g[a].free;
        if (a === "nullgate" && sel && proj < 1) x = lerp(g.ungated.keep, g.nullgate.keep, proj);
        const tx = ox + x * k * grow, ty = oy - y * k * grow;
        tips[a] = [tx, ty];
        if (a === "nullgate" && sel) {
          // The gate at work: the kept component is removed, the free part stays.
          const ux = ox + g.ungated.keep * k * grow;
          ctx.strokeStyle = pal.voice(0, 0.7); ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(ux, ty); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
          if (proj > 0.05 && proj < 1) { ctx.fillStyle = pal.voice(0, 0.9); ctx.fillText("− ΔW·QQᵀ", (ux + tx) / 2 - 24, ty - 8); }
        }
        ctx.strokeStyle = pal.voice(ai(a), sel ? 1 : 0.35); ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = sel ? 2.2 : 1.2;
        arrow(ctx, ox, oy, tx, ty, sel ? 8 : 6);
      }
      // Name the tips, nudged apart where they crowd.
      ctx.font = mono(11);
      // G2 sits on the free axis once gated, so its name goes to the axis's left, off the projection line.
      const labels = spread(E12_ARMS.map((a) => ({ a, x: a === "nullgate" ? tips[a][0] - 24 : tips[a][0] + 8, y: tips[a][1] + (a === "nullgate" ? 4 : -6) })), 13, 12, oy - 4);
      for (const l of labels) { ctx.fillStyle = pal.voice(ai(l.a), l.a === arm ? 1 : 0.6); ctx.fillText(E12_SHORT[l.a], l.x, l.y); }

      // ΔW·Q: the m × k block the residual measures. Gated, it is empty.
      const resp = g[arm].response, ref = Math.max(...g.ungated.response.flat().map(Math.abs));
      const m = resp.length, kk = resp[0].length;
      const cs = Math.min(16, (P - 40) / m);
      ctx.fillStyle = pal.muted; ctx.font = mono(10);
      ctx.fillText("ΔW·Q_keep", bx, by - 10);
      for (let i = 0; i < m; i += 1) {
        for (let j = 0; j < kk; j += 1) {
          const raw = arm === "nullgate" && proj < 1 ? lerp(g.ungated.response[i][j], resp[i][j], proj) : resp[i][j];
          const v = raw / ref;
          const x = bx + j * cs, y = by + i * cs;
          if (Math.abs(v) < 1e-9) { ctx.strokeStyle = pal.faint; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, cs - 2, cs - 2); }
          else { ctx.fillStyle = pal.voice(v >= 0 ? 0 : 1, 0.15 + 0.8 * clamp01(Math.abs(v))); ctx.fillRect(x + 0.5, y + 0.5, cs - 1.5, cs - 1.5); }
        }
      }
      ctx.fillStyle = pal.muted;
      ctx.fillText(`${m} × ${kk}, ‖·‖_F`, bx, by + m * cs + 14);
      ctx.fillStyle = pal.ink;
      ctx.fillText(sci(arm === "nullgate" && proj < 1 ? lerp(g.ungated.keep, g.nullgate.keep, proj) : g[arm].keep), bx, by + m * cs + 28);

      // E12's reported retention under shift.
      const yLo = -115, yHi = 95;
      const X = (s) => cL + ((s - E12.SHIFT_MIN) / (E12.SHIFT_MAX - E12.SHIFT_MIN)) * (cR - cL);
      const Y = (v) => cB - ((v - yLo) / (yHi - yLo)) * (cB - cT);
      ctx.strokeStyle = pal.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cL, Y(0)); ctx.lineTo(cR, Y(0)); ctx.stroke();
      ctx.font = mono(10); ctx.fillStyle = pal.muted; ctx.textAlign = "end";
      for (const v of [-100, -50, 0, 50]) ctx.fillText(String(v), cL - 6, Y(v) + 3);
      ctx.textAlign = "center";
      for (const s of [1, 1.6, 2, 2.4, 2.8]) { ctx.fillStyle = Math.abs(s - shift) < 1e-9 ? pal.ink : pal.muted; ctx.fillText(`${s.toFixed(1)}×`, X(s), cB + 16); }
      ctx.fillStyle = pal.muted;
      ctx.fillText("extrapolated", (X(E12.ANCHOR_HI) + X(E12.SHIFT_MAX)) / 2, cT + 4);
      ctx.textAlign = "start";
      ctx.fillText("native retention · reported", cL, cT - 16);
      ctx.strokeStyle = pal.faint; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(X(E12.ANCHOR_HI), cT + 10); ctx.lineTo(X(E12.ANCHOR_HI), cB); ctx.stroke();
      ctx.strokeStyle = pal.line;
      ctx.beginPath(); ctx.moveTo(X(shift), cT + 10); ctx.lineTo(X(shift), cB); ctx.stroke(); ctx.setLineDash([]);
      const reach = still ? E12.SHIFT_MAX : E12.SHIFT_MIN + (E12.SHIFT_MAX - E12.SHIFT_MIN) * smooth((t - 0.2) / 2);
      const ends = [];
      for (const a of [...E12_ARMS.filter((x) => x !== arm), arm]) {
        const sel = a === arm, vi = ai(a);
        ctx.strokeStyle = pal.voice(vi, sel ? 1 : 0.45); ctx.lineWidth = sel ? 2.2 : 1.2;
        const solidTo = Math.min(reach, E12.ANCHOR_HI);
        ctx.beginPath(); ctx.moveTo(X(E12.SHIFT_MIN), Y(retention(a, E12.SHIFT_MIN))); ctx.lineTo(X(solidTo), Y(retention(a, solidTo))); ctx.stroke();
        if (reach > E12.ANCHOR_HI) {
          ctx.setLineDash([5, 4]);
          ctx.beginPath(); ctx.moveTo(X(E12.ANCHOR_HI), Y(retention(a, E12.ANCHOR_HI))); ctx.lineTo(X(reach), Y(retention(a, reach))); ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = pal.voice(vi, sel ? 1 : 0.5);
        for (const s of [E12.ANCHOR_LO, E12.ANCHOR_HI]) if (s <= reach + 1e-9) { ctx.beginPath(); ctx.arc(X(s), Y(retention(a, s)), sel ? 3.6 : 2.6, 0, TAU); ctx.fill(); }
        if (reach >= E12.SHIFT_MAX - 1e-9) ends.push({ a, vi, sel, y: Y(retention(a, E12.SHIFT_MAX)) + 3 });
      }
      ctx.font = mono(11);
      for (const e of spread(ends, 13, cT, cB)) { ctx.fillStyle = pal.voice(e.vi, e.sel ? 1 : 0.6); ctx.fillText(E12_SHORT[e.a], cR + 8, e.y); }
      if (reach >= shift - 1e-9) {
        const v = retention(arm, shift), px = X(shift), py = Y(v);
        ctx.strokeStyle = pal.voice(ai(arm), 1); ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(px, py, 5.5, 0, TAU); ctx.stroke();
        const kind = shiftKind(shift);
        const label = `${signed(v)} ${kind === "anchor" ? "· given" : kind === "interpolated" ? "· interpolated" : "· extrapolated"}`;
        ctx.font = mono(11); ctx.fillStyle = pal.ink;
        const tw = ctx.measureText(label).width;
        // Try four spots round the point and take the first that no arm's line crosses.
        const crosses = (lx, ly) => E12_ARMS.some((b) => [0, 0.5, 1].some((f) => {
          const s = E12.SHIFT_MIN + ((lx + f * tw - cL) / (cR - cL)) * (E12.SHIFT_MAX - E12.SHIFT_MIN);
          if (s < E12.SHIFT_MIN || s > E12.SHIFT_MAX) return false;
          const yy = Y(retention(b, s));
          return yy > ly - 13 && yy < ly + 5;
        }));
        const spots = [[px + 10, py - 12], [px - 10 - tw, py - 12], [px + 10, py + 20], [px - 10 - tw, py + 20], [px - 10 - tw, py - 26], [px - 10 - tw, py + 34]]
          .filter(([lx]) => lx >= cL && lx + tw <= cR);
        const [lx, ly] = spots.find(([x, y]) => !crosses(x, y)) || spots[0] || [px + 10, py - 12];
        ctx.fillText(label, lx, ly);
      }
    },
  });
  describe();
}

/* ================================================================== */
/* Old links: ?sim=statistical|morphogenesis|plasmid                   */
/* ================================================================== */

function honourSimQuery() {
  const sim = new URLSearchParams(location.search).get("sim");
  if (!sim || location.hash || !["statistical", "morphogenesis", "plasmid"].includes(sim)) return;
  const el = document.getElementById(sim);
  if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "start", behavior: "instant" }));
}

initCell();
initMorph();
initGraft();
honourSimQuery();
