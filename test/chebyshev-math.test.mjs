// The Chebyshev identifiability page's numbers, checked without a browser,
// against the archived explorer's own code and the archive note's figures.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as C from "../site/assets/chebyshev-math.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const original = fs.readFileSync(path.join(repo, "examples/visualizations/project-asma-chebyshev-identifiability-explorer.html"), "utf8");
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} expected ${b} ± ${tol}, got ${a}`);
const design = (p) => ({ pL: Number(p.pL), pH: Number(p.pH), alpha: Number(p.alpha) });
const preset = (id) => C.PRESETS.find((p) => p.id === id);

// The original's qResp and PRESETS, lifted out of the archived page and run as they are.
const qResp = new Function(`${/function qResp\(p, r, c\) \{[\s\S]*?\n    \}/.exec(original)[0]}; return qResp;`)();
const ORIGINAL_PRESETS = new Function(`return ${/const PRESETS = (\{[\s\S]*?\n    \});/.exec(original)[1]};`)();
// The original's render() arithmetic, line for line.
function originalRender(pL, pH, alpha) {
  const yS = (p) => (1 - alpha) * qResp(p, 16, 0) + alpha;
  const ySL = yS(pL), ySH = yS(pH);
  const q25L = qResp(pL, 11, 0.25), q25H = qResp(pH, 11, 0.25);
  return {
    epsDiff: Math.abs((ySH - ySL) - (q25H - q25L)) / 4,
    epsLinf: Math.max(Math.abs(ySL - q25L), Math.abs(ySH - q25H)) / 2,
    pivOff: yS(0.20) - 0.80,
  };
}

test("the presets and the response curve match the archived page", () => {
  for (const p of C.PRESETS) {
    const o = ORIGINAL_PRESETS[p.id];
    assert.ok(o, `original has preset ${p.id}`);
    assert.deepEqual(design(p), { pL: o.pl, pH: o.ph, alpha: o.alpha }, p.id);
    assert.ok(original.includes(`data-preset="${p.id}">${p.label}</button>`) || original.includes(`data-preset="${p.id}">${p.label}`), `label ${p.label}`);
  }
  for (const w of C.WORLDS) for (const p of [0, 0.013, 0.05, 0.2, 0.375, 0.8, 1]) assert.equal(C.response(p, w.r, w.c), qResp(p, w.r, w.c));
  assert.match(original, /const EPS_BENCH = 1 \/ 60;/);
  assert.equal(C.EPS_BENCH, 1 / 60);
});

test("each preset reproduces the original's three numbers", () => {
  const want = {
    pr78: { d: 0.006696428571428575, l: 0.011250000000000038, piv: 0 },
    pr83: { d: 0.01805043268548731, l: 0.03392857142857142, piv: 0 },
    trap: { d: 0.0000023975031919476475, l: 0.009771428571428598, piv: 0.032200000000000006 },
    deep: { d: 0.032060304833826436, l: 0.06204545454545454, piv: 0 },
  };
  for (const p of C.PRESETS) {
    const d = design(p);
    const c = C.ceilings(d);
    const o = originalRender(d.pL, d.pH, d.alpha);
    close(c.epsSlope, o.epsDiff, 1e-15, `${p.id} slope vs original`);
    close(c.epsLinf, o.epsLinf, 1e-15, `${p.id} L∞ vs original`);
    close(c.pivotOffset, o.pivOff, 1e-15, `${p.id} pivot vs original`);
    close(c.epsSlope, want[p.id].d, 1e-12, `${p.id} slope`);
    close(c.epsLinf, want[p.id].l, 1e-12, `${p.id} L∞`);
    close(c.pivotOffset, want[p.id].piv, 1e-12, `${p.id} pivot`);
  }
});

test("the verdict text is the original's, for every preset", () => {
  const v = (id) => { const p = preset(id), d = design(p); return C.verdicts(C.ceilings(d), d.alpha); };
  assert.deepEqual(v("pr83"), { slope: "Clears 1/60 (0.01667) by +8.3%", linf: "1.88x vs 1D slope (clears 1/60)", pivot: "All pure c-worlds lock at q(0.20) = 0.8000" });
  assert.deepEqual(v("pr78"), { slope: "Below 1/60 noise floor (0.01667)", linf: "1.68x vs 1D slope (sub-1/60)", pivot: "All pure c-worlds lock at q(0.20) = 0.8000" });
  assert.deepEqual(v("trap"), { slope: "Exact slope blind spot vs C25 (0 separation)", linf: "Separates S+alpha from C25 in 2D (sub-1/60)", pivot: "Breaks 4-world pivot lock (q = 0.8322)" });
  assert.deepEqual(v("deep"), { slope: "Clears 1/60 (0.01667) by +92.4%", linf: "1.94x vs 1D slope (clears 1/60)", pivot: "All pure c-worlds lock at q(0.20) = 0.8000" });
  // The page's static first paint said the same for the default design.
  assert.match(original, /id="kpi-diff">0\.01805</);
  assert.match(original, /id="kpi-linf">0\.03393</);
  assert.match(original, /1\.88x lift over 1D slope/);
});

test("the archive note's rational figures hold exactly", () => {
  const e = C.exactCeilings("0.050", "0.375", "0.000");
  assert.equal(C.Q.str(e.linf), C.REPORTED.epsLinf);
  assert.equal(C.Q.str(e.slope), C.REPORTED.epsSlope);
  assert.equal(C.Q.str(e.gapL), "-19/280");
  assert.equal(C.Q.str(e.gapH), "35/8056");
  assert.equal(C.Q.str(e.ratio), "19133/10179");
  assert.equal(`${C.Q.num(e.ratio).toFixed(2)}x`, C.REPORTED.lift);
  assert.equal(C.Q.str(e.pivotOffset), "0");
  assert.ok(e.pivotLock, "every pure world reads exactly 4/5 at p = 1/5");
  // The trap: the slope blind spot on the (1/20, 3/8) design, and the 16.1% that rounds it.
  assert.equal(C.Q.str(e.alphaStar), "783/4864");
  assert.equal(`${(C.Q.num(e.alphaStar) * 100).toFixed(1)}%`, C.REPORTED.trapAlpha);
  close(C.blindSpot(0.05, 0.375), 783 / 4864, 1e-15);
  assert.equal(C.Q.str(C.exactCeilings("0.100", "0.400").alphaStar), "25/256");
  // The bleed moves S off the pivot by exactly α/5.
  assert.equal(C.Q.str(C.exactCeilings("0.050", "0.375", "0.161").pivotOffset), "161/5000");
  assert.equal(C.Q.str(C.exactCeilings("0.100", "0.400").linf), "9/800");
});

test("every pure world passes through (1/5, 4/5) because r = 16 − 20c", () => {
  for (const w of C.WORLDS) {
    assert.equal(w.r, 16 - 20 * w.c, w.id);
    assert.equal(w.c, w.cn / w.cd, w.id);
    assert.equal(C.Q.str(C.responseExact(C.frac(1, 5), w)), "4/5", w.id);
    close(C.response(C.PIVOT_P, w.r, w.c), C.PIVOT_Q, 1e-15, w.id);
    close(C.response(0, w.r, w.c), w.c, 0, `${w.id} starts at c`);
    close(C.response(1, w.r, w.c), 1, 1e-15, `${w.id} ends at 1`);
  }
  for (const a of [0, 0.05, 0.161, 0.3]) close(C.ceilings({ pL: 0.05, pH: 0.375, alpha: a }).pivotOffset, a / 5, 1e-15, `α = ${a}`);
});

test("ceilings obey their geometry", () => {
  for (const pL of [0.02, 0.05, 0.11, 0.18]) for (const pH of [0.22, 0.375, 0.5, 0.8]) for (const alpha of [0, 0.07, 0.161, 0.3]) {
    const c = C.ceilings({ pL, pH, alpha });
    // |a − b| ≤ 2·max(|a|, |b|), so the slope ceiling never beats the L∞ one.
    assert.ok(c.epsSlope <= c.epsLinf + 1e-15, `slope ≤ L∞ at ${pL}, ${pH}, ${alpha}`);
    assert.ok(c.linf3 >= c.epsLinf - 1e-15, "a third reading never hurts");
    const ps = C.pairs({ pL, pH, alpha });
    assert.equal(ps.length, 6);
    assert.equal(ps[0].a, "S"); assert.equal(ps[0].b, "C25");
    close(ps[0].linf, c.epsLinf, 0);
    for (const p of ps) if (p.a !== "S") close(p.gapPivot, 0, 1e-15, "pure worlds agree at the pivot");
  }
  // On the default design, S·C25 is the closest pair of the six in both tests.
  const ps = C.pairs(design(preset("pr83")));
  assert.equal(Math.min(...ps.map((p) => p.linf)), ps[0].linf);
  assert.equal(Math.min(...ps.map((p) => p.slope)), ps[0].slope);
});

test("the α sweep finds the trap and the sub-1/60 stretches", () => {
  const sw = C.alphaSweep(0.05, 0.375, 3000, 0.3);
  assert.equal(sw.alpha.length, 3001);
  let k = 0;
  for (let i = 1; i < sw.slope.length; i += 1) if (sw.slope[i] < sw.slope[k]) k = i;
  close(sw.alpha[k], 783 / 4864, 1e-4, "slope ceiling bottoms out at α*");
  const slopeBelow = C.intervalsBelow(sw.alpha, sw.slope, C.EPS_BENCH);
  // |(1 − α)·832/1855 − 143/380| < 1/15 from α = 1 − (143/380 + 1/15)/(832/1855) to past 0.3.
  assert.equal(slopeBelow.length, 1);
  close(slopeBelow[0][0], 1 - (143 / 380 + 1 / 15) / (832 / 1855), 1e-6);
  assert.equal(slopeBelow[0][1], 0.3);
  // L∞ on two readings: |−19/280 + α·19/35| < 1/30 between α = 0.0636 and 0.1864.
  const linfBelow = C.intervalsBelow(sw.alpha, sw.linf, C.EPS_BENCH);
  assert.equal(linfBelow.length, 1);
  close(linfBelow[0][0], (19 / 280 - 1 / 30) / (19 / 35), 1e-6);
  close(linfBelow[0][1], (19 / 280 + 1 / 30) / (19 / 35), 1e-6);
  // With the pivot as a third reading, α/5 clears 1/30 from α = 1/6.
  const l3 = C.intervalsBelow(sw.alpha, sw.linf3, C.EPS_BENCH);
  close(l3[0][1], 1 / 6, 1e-6);
  assert.deepEqual(C.intervalsBelow([0, 1, 2], [1, 1, 1], 0.5), []);
  assert.deepEqual(C.intervalsBelow([0, 1, 2], [0, 0, 0], 0.5), [[0, 2]]);
});

test("exact arithmetic reads decimals exactly and reduces", () => {
  assert.equal(C.Q.str(C.fromDecimal("0.375")), "3/8");
  assert.equal(C.Q.str(C.fromDecimal("0.050")), "1/20");
  assert.equal(C.Q.str(C.fromDecimal("0.430")), "43/100");
  assert.equal(C.Q.str(C.frac(6, -4)), "-3/2");
  assert.equal(C.shortFraction(C.frac(1, 3)), "1/3");
  assert.equal(C.shortFraction(C.frac(123456789, 987654321)), null);
  assert.throws(() => C.frac(1, 0));
  assert.ok(Object.isFrozen(C.PRESETS) && Object.isFrozen(C.WORLDS) && Object.isFrozen(C.REPORTED));
});
