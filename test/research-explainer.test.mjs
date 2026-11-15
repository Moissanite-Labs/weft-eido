import assert from "node:assert/strict";
import test from "node:test";
import {
  clamp,
  coreDrift,
  formatMetric,
  makeToyCell,
  matrixDisplacement,
  rangeProgress,
  seededRandom,
  stepToyCell,
  toyCellMetrics,
} from "../src/research-explainer.js";

test("clamp bounds numbers and rejects bad ranges", () => {
  assert.equal(clamp(2, 0, 1), 1);
  assert.equal(clamp(-2, 0, 1), 0);
  assert.equal(clamp(0.4, 0, 1), 0.4);
  assert.throws(() => clamp(2, 1, 0), /min/);
  assert.throws(() => clamp(Number.NaN, 0, 1), /finite/);
});

test("seededRandom is deterministic and stays in range", () => {
  const a = seededRandom(20261112);
  const b = seededRandom(20261112);
  const valuesA = [a(), a(), a()];
  const valuesB = [b(), b(), b()];
  assert.deepEqual(valuesA, valuesB);
  for (const value of valuesA) assert.ok(value >= 0 && value < 1);
});

test("rangeProgress reports clamped percentages", () => {
  assert.equal(rangeProgress(5, 0, 10), 50);
  assert.equal(rangeProgress(-1, 0, 10), 0);
  assert.equal(rangeProgress(11, 0, 10), 100);
  assert.throws(() => rangeProgress(1, 10, 0), /min/);
});

test("formatMetric keeps fixed precision and optional sign", () => {
  assert.equal(formatMetric(0.123456, { precision: 2 }), "0.12");
  assert.equal(formatMetric(2, { signed: true }), "+2.000");
  assert.equal(formatMetric(-2, { signed: true }), "-2.000");
  assert.equal(formatMetric(Number.NaN), "n/a");
});

test("toy cells are deterministic, sized and keep the core when stepped", () => {
  const a = makeToyCell(20261112);
  const b = makeToyCell(20261112);
  assert.deepEqual(a.matrix, b.matrix);
  assert.equal(a.matrix.length, 8);
  assert.equal(a.matrix.every((row) => row.length === 8), true);

  const stepped = stepToyCell(a, { radius: 2, novelty: 0.75 });
  assert.equal(stepped.accepted, 1);
  assert.equal(coreDrift(a.matrix, stepped.matrix, a.coreRows), 0);
  assert.ok(matrixDisplacement(a.matrix, stepped.matrix) > 0);
  assert.equal(toyCellMetrics(stepped).frozenCore, true);
});

test("a tiny radius rejects the candidate without changing the matrix", () => {
  const cell = makeToyCell(20261112);
  const stepped = stepToyCell(cell, { radius: 0.05, novelty: 1 });
  assert.equal(stepped.rejected, 1);
  assert.equal(stepped.accepted, 0);
  assert.deepEqual(stepped.matrix, cell.matrix);
  assert.ok(stepped.displacement > 0);
});
