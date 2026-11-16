// Every number the harmonic pages draw, checked without a browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as H from "../site/assets/harmonic-math.js";

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} expected ${b} ± ${tol}, got ${a}`);

test("nearestRatio finds just intervals and bounds its denominator", () => {
  assert.deepEqual([H.nearestRatio(1.5).p, H.nearestRatio(1.5).q], [3, 2]);
  assert.deepEqual([H.nearestRatio(1.2501, 16).p, H.nearestRatio(1.2501, 16).q], [5, 4]);
  const r2 = H.nearestRatio(Math.SQRT2, 12);
  assert.ok(r2.q <= 12);
  close(r2.value, Math.SQRT2, 0.003);
  assert.equal(H.intervalName(3, 2), "fifth");
  close(H.cents(3 / 2), 701.955, 0.001);
  close(H.cents(H.SYNTONIC_COMMA), 21.506, 0.001, "syntonic comma");
});

test("the six mechanisms reproduce the explorer's frequencies and wavelengths", () => {
  const [m1, m2, m3, m4, m5] = H.MECHANISMS;
  assert.deepEqual(H.mechanismFreqs(m1), [27.5, 55]);
  close(H.wavelength(27.5), 12.47, 0.01);
  assert.deepEqual(H.mechanismFreqs(m2), [110, 165, 220]);
  close(H.wavelength(110), 3.12, 0.01);
  assert.deepEqual(H.mechanismFreqs(m3), [220, 275, 330, 385]);
  close(H.mechanismFreqs(m4)[0], 38.56, 0.01, "plate fundamental at T = 20");
  assert.deepEqual(H.mechanismFreqs(m5).map((f) => +f.toFixed(2)), [275, 343.75, 412.5, 515.63]);
});

test("the plate model reproduces the source's two anchor values", () => {
  close(H.plateFrequency(1, 1, 20), 38.56, 0.01);
  close(H.plateFrequency(1, 1, 84.5), 75.13, 0.01);
  assert.ok(H.plateFrequency(1, 1, 60) > H.plateFrequency(1, 1, 30), "tension raises every mode");
  const field = H.plateResponse(H.plateModes(20, 4, 4), 152, 24, 18);
  assert.equal(Math.max(...field), 1, "the response is normalised");
  assert.ok(Math.min(...field) < 0.05, "and has nodes for sand to find");
});

test("roughness falls into wells at the simple ratios of a harmonic tone", () => {
  const tone = H.partials(220, 8);
  const xs = [], ys = [];
  for (let a = 1; a <= 2.04; a += 0.004) { xs.push(a); ys.push(H.dyadRoughness(tone, a)); }
  const names = H.minima(xs, ys, { maxDen: 9, depth: 0.003 }).map((m) => `${m.ratio.p}/${m.ratio.q}`);
  for (const r of ["3/2", "4/3", "5/3", "2/1"]) assert.ok(names.includes(r), `missing the ${r} well: ${names}`);
  assert.ok(H.dyadRoughness(tone, 1.5) < H.dyadRoughness(tone, 1.45), "the fifth is smoother than its neighbour");
});

test("Kuramoto oscillators drift below critical coupling and lock above it", () => {
  const run = (K) => {
    const omega = H.lorentzianFrequencies(64, 0.5);
    const th = Float64Array.from({ length: 64 }, (_, i) => (i * 2.399963) % H.TAU);
    for (let i = 0; i < 4000; i += 1) H.kuramotoStep(th, omega, K, 0.02);
    return H.orderParameter(th).r;
  };
  assert.ok(run(0.4) < 0.3, "drifting below K_c = 2γ = 1");
  assert.ok(run(2.5) > 0.7, "locked well above it");
});

test("the circle map locks to rationals in its tongues", () => {
  close(H.windingNumber(0.5, 1), 0.5, 1e-9);
  close(H.windingNumber(0.34, 1), 1 / 3, 1e-6);
  close(H.windingNumber(0.1, 0), 0.1, 1e-12, "with no kick, W = Ω");
});

test("the Halvorsen flow stays bounded", () => {
  let s = [1, 0, 0], max = 0;
  for (let i = 0; i < 20000; i += 1) { s = H.rk4((v) => H.halvorsen(v, 1.4), s, 0.005); max = Math.max(max, ...s.map(Math.abs)); }
  assert.ok(max < 20 && Number.isFinite(max));
});

test("the projector keeps provenance exact while raw updates erode it", () => {
  const st = H.makeProvenance(48);
  close(H.provenanceCosines(st).raw, 1, 1e-12);
  let r;
  for (let e = 0; e < 40; e += 1) r = H.provenanceEpoch(st);
  close(r.projected, 1, 1e-12, "projected cosine");
  assert.ok(r.leak < 1e-12, "the projected update leaves x untouched");
  assert.ok(r.raw < 0.75, `raw cosine should erode, got ${r.raw}`);
});

test("rule 90 from one cell draws Pascal's triangle mod 2", () => {
  let row = new Uint8Array(17); row[8] = 1;
  for (let i = 0; i < 4; i += 1) row = H.caStep(row, 90);
  assert.deepEqual([...row.slice(4, 13)], [1, 0, 0, 0, 0, 0, 0, 0, 1]);
});
