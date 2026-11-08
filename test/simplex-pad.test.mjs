import assert from "node:assert/strict";
import test from "node:test";
import { barycentric, pointFromWeights, projectToSimplex, weightsAt } from "../src/simplex-pad.js";

const A = [110, 18];
const B = [16, 186];
const C = [204, 186];
const close = (a, b, eps = 1e-9) => a.every((x, i) => Math.abs(x - b[i]) < eps);

test("vertices have unit barycentric coordinates", () => {
  assert.ok(close(barycentric(A, A, B, C), [1, 0, 0]));
  assert.ok(close(barycentric(B, A, B, C), [0, 1, 0]));
  assert.ok(close(barycentric(C, A, B, C), [0, 0, 1]));
});

test("the centroid is the equal blend", () => {
  const g = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
  assert.ok(close(barycentric(g, A, B, C), [1 / 3, 1 / 3, 1 / 3]));
});

test("weights -> point -> weights round-trips anywhere on the simplex", () => {
  for (const w of [[0.2, 0.3, 0.5], [0.5, 0, 0.5], [0.35, 0.35, 0.3], [0, 1, 0]]) {
    assert.ok(close(barycentric(pointFromWeights(w, A, B, C), A, B, C), w));
  }
});

test("points outside the triangle snap to a valid blend (non-negative, sums to 1)", () => {
  for (const p of [[0, 0], [300, 300], [110, 400], [-50, 120]]) {
    const w = weightsAt(p, A, B, C);
    assert.ok(w.every((x) => x >= 0));
    assert.ok(Math.abs(w.reduce((s, x) => s + x, 0) - 1) < 1e-12);
  }
});

test("projectToSimplex normalises and falls back to the first preset for all-zero input", () => {
  assert.deepEqual(projectToSimplex([2, 2, 0]), [0.5, 0.5, 0]);
  assert.deepEqual(projectToSimplex([0, 0, 0]), [1, 0, 0]);
  assert.deepEqual(projectToSimplex([-1, 1, 0]), [0, 1, 0]);
});
