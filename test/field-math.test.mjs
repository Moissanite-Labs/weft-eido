// The landing map: settling, the interference field, and its contours.
import { test } from "node:test";
import assert from "node:assert/strict";
import { settle, sources, fieldAt, prepareGrid, sampleGrid, isolines, nearestSource, beatPeriod, FAMILIES, REACH } from "../site/assets/field-math.js";

const PLACES = [
  ["style", 9, "modules", "main"], ["reading", 9, "modules", "main"], ["field", 7, "rebuild", "blocked"], ["explainer", 6, "research", "main"],
  ["archive", 5, "modules", "main"], ["simulations", 6, "research", "main"], ["identifiability", 5, "research", "main"], ["harmonic", 6, "research", "main"],
].map(([id, weight, family, state]) => ({ id, weight, family, state }));

for (const [width, height] of [[1180, 740], [360, 580], [900, 900]]) {
  test(`sources settle apart and inside a ${width} × ${height} map, the same way every time`, () => {
    const a = settle(PLACES, { width, height }), b = settle(PLACES, { width, height });
    assert.deepEqual(a.pos, b.pos, "deterministic");
    for (let i = 0; i < PLACES.length; i += 1) {
      assert.ok(a.pos[i].x >= 0 && a.pos[i].x <= width && a.pos[i].y >= 0 && a.pos[i].y <= height);
      for (let j = i + 1; j < PLACES.length; j += 1) {
        const d = Math.hypot(a.pos[i].x - a.pos[j].x, a.pos[i].y - a.pos[j].y);
        assert.ok(d >= (a.r[i] + a.r[j]) * 0.95, `${PLACES[i].id} and ${PLACES[j].id} overlap`);
      }
    }
  });
}

test("amplitude follows weight, frequency follows family, reach follows state", () => {
  const { pos } = settle(PLACES, { width: 1000, height: 700 });
  const src = sources(PLACES, pos, { width: 1000, height: 700 });
  assert.equal(src[0].amp, 1);
  assert.ok(src[4].amp < src[0].amp);
  assert.equal(src[0].f, src[1].f, "one family, one frequency");
  assert.ok(Math.abs(src[3].f / src[0].f - FAMILIES.research.ratio) < 1e-12);
  assert.ok(src[2].reach < src[0].reach, "blocked work reaches less far");
  assert.ok(Math.abs(src[0].reach / src[2].reach - REACH.main / REACH.blocked) < 1e-12);
  const speed = (s) => s.lambda * s.f;
  assert.ok(Math.abs(speed(src[0]) - speed(src[3])) < 1e-9, "one wave speed for every family");
});

test("the fringes between two sources of one family stand still", () => {
  const two = [{ id: "a", weight: 1, family: "modules", state: "main" }, { id: "b", weight: 1, family: "modules", state: "main" }];
  const src = sources(two, [{ x: 300, y: 300 }, { x: 500, y: 300 }], { width: 800, height: 600 });
  // On the perpendicular bisector both waves arrive in phase at every moment.
  for (const t of [0, 0.37, 1.9]) {
    const mid = fieldAt(400, 420, t, src);
    const alone = fieldAt(400, 420, t, [src[0]]);
    assert.ok(Math.abs(mid - 2 * alone) < 1e-9);
  }
  // Anywhere, a one-family field is R(x)·cos(ωt − θ(x)): its envelope over a
  // period is the same now and later. Two families beat, so theirs changes.
  const envelope = (srcs, x, y, t0, period) => {
    let m = 0;
    for (let k = 0; k < 400; k += 1) m = Math.max(m, Math.abs(fieldAt(x, y, t0 + (k / 400) * period, srcs)));
    return m;
  };
  const T = 1 / src[0].f;
  assert.ok(Math.abs(envelope(src, 437, 352, 0, T) - envelope(src, 437, 352, 4.3, T)) < 1e-3);
  const mixed = sources([two[0], { ...two[1], family: "research" }], [{ x: 300, y: 300 }, { x: 500, y: 300 }], { width: 800, height: 600 });
  const half = beatPeriod("modules", "research") / 2;
  assert.ok(Math.abs(envelope(mixed, 437, 352, 0, T) - envelope(mixed, 437, 352, half, T)) > 0.05, "different families drift");
  assert.equal(beatPeriod("modules", "modules"), Infinity);
  assert.ok(Number.isFinite(beatPeriod("modules", "research")));
});

test("the grid sampler agrees with the point formula, and silences sources not yet arrived", () => {
  const { pos } = settle(PLACES, { width: 400, height: 300 });
  const src = sources(PLACES, pos, { width: 400, height: 300 });
  const cell = 10, cols = 40, rows = 30;
  const grid = prepareGrid(src, cols, rows, cell, { d0: 30 });
  const out = sampleGrid(grid, src, 1.234, new Float32Array(cols * rows));
  const q = 17 * cols + 23;
  assert.ok(Math.abs(out[q] - fieldAt(23.5 * cell, 17.5 * cell, 1.234, src, { d0: 30 })) < 1e-4);
  const quiet = sampleGrid(grid, src, 1.234, new Float32Array(cols * rows), { arrive: () => 0 });
  assert.ok(quiet.every((v) => v === 0));
});

test("isolines trace a sign change and nothing else", () => {
  const cols = 4, rows = 3;
  const v = Float32Array.from({ length: cols * rows }, (_, k) => (k % cols) - 1.5);
  const seg = isolines(v, cols, rows, 0);
  assert.equal(seg.length, 4 * (rows - 1), "one vertical segment per row of cells");
  for (let q = 0; q < seg.length; q += 4) { assert.ok(Math.abs(seg[q] - 2) < 1e-6); assert.ok(Math.abs(seg[q + 2] - 2) < 1e-6); }
  assert.equal(isolines(new Float32Array(12).fill(1), cols, rows, 0).length, 0);
  const still = Float32Array.from({ length: cols * rows }, (_, k) => ((k % cols) - 1.5) * 0.001);
  assert.ok(isolines(still, cols, rows, 0).length > 0, "noise crosses zero");
  assert.equal(isolines(still, cols, rows, 0, 0.05).length, 0, "but still water draws no node");
});

test("a press lands on the nearest source within reach", () => {
  const pos = [{ x: 10, y: 10 }, { x: 100, y: 10 }];
  assert.equal(nearestSource(pos, [20, 20], 14, 12), 0);
  assert.equal(nearestSource(pos, [20, 20], 96, 8), 1);
  assert.equal(nearestSource(pos, [20, 20], 55, 60), -1);
});
