// Every number the substrate simulations page (site/research/index.html)
// prints, checked without a browser. The expected strings were produced by
// running the original's own script, examples/simulations/index.html, in Node.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as M from "../site/assets/suite-math.js";

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} expected ${b} ± ${tol}, got ${a}`);

/** The uniform stream used to run the original: an LCG over 2³¹, from 0. */
function originalStream() {
  let k = 0;
  return () => { k = (k * 1103515245 + 12345) % 2147483648; return k / 2147483648; };
}

test("the statistical cell starts where the original does", () => {
  const W0 = M.genotypeW0();
  assert.equal(W0.length, 64);
  assert.equal(W0[0], Math.fround(Math.sin(2.31) * 0.6));
  assert.equal(W0[63], Math.fround(Math.sin(64 * 2.31) * 0.6));
  const walk = M.cellWalk(M.rng(1));
  assert.equal(M.displacement(walk.W, walk.W0).toFixed(3), "0.000", "the original shows 0.000 ≤ 1.20");
  assert.equal(walk.commits, 0);
  assert.equal(walk.fit.toFixed(2), "0.82", "and 0 · fit 0.82");
});

test("the Frobenius gate reproduces the original under the same noise", () => {
  // The original, fed this stream, shows "1.190 ≤ 1.20" and "84 · fit 0.98" after 120 presses.
  const walk = M.cellWalk(originalStream());
  for (let i = 0; i < 120; i += 1) walk.step(1.2);
  assert.equal(walk.commits, 84);
  assert.equal(M.displacement(walk.W, walk.W0).toFixed(3), "1.190");
  assert.equal(walk.fit.toFixed(2), "0.98");
});

test("the gate never lets W leave the ball, and the core never moves", () => {
  for (const R of [0.25, 0.6, 1.2, 2.5]) {
    const walk = M.runCell(7, R, 300);
    assert.equal(M.coreDrift(walk.W, walk.W0), 0, "frozen rows are untouched, exactly");
    for (const p of walk.history) {
      assert.ok(p.displacement <= R, `displacement ${p.displacement} exceeds R = ${R}`);
      assert.equal(p.accepted, p.candidate <= R);
      if (p.accepted) assert.equal(p.displacement, p.candidate);
    }
    assert.equal(walk.commits, walk.history.filter((p) => p.accepted).length);
    close(walk.fit, Math.min(M.CELL.FIT_MAX, M.CELL.FIT0 + walk.commits * M.CELL.FIT_STEP), 1e-9, "fit is only a counter");
  }
  // Replaying a seed is deterministic; a wider gate accepts at least as much early on.
  const a = M.runCell(3, 1.2, 50), b = M.runCell(3, 1.2, 50);
  assert.deepEqual([...a.W], [...b.W]);
  assert.ok(M.runCell(3, 2.5, 50).commits >= M.runCell(3, 0.25, 50).commits);
});

test("E11 wire sizes match the original's text for every arm and scale", () => {
  const expected = {
    morph: ["492 B · 33.3×", "492 B · 133.2×", "492 B · 532.8×", "492 B · 2131.3×"],
    scrambled: ["492 B · 33.3×", "492 B · 133.2×", "492 B · 532.8×", "492 B · 2131.3×"],
    direct: ["16 KB · 1.0×", "64 KB · 1.0×", "256 KB · 1.0×", "1024 KB · 1.0×"],
  };
  for (const [arm, labels] of Object.entries(expected)) {
    labels.forEach((label, i) => assert.equal(M.compressionLabel(arm, 6 + i), label, `${arm} at D = ${6 + i}`));
  }
  assert.equal(M.plasmBytes(9), 1048576);
  close(M.compression("morph", 9), 2131.252, 0.001);
  assert.equal(M.compression("direct", 9), 1);
  close(M.invSqrtP(9), 1 / 512, 1e-12);
});

test("E11 returns are the original's table, verbatim", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(M.E11_RETURN)), {
    morph: { 6: "+33.48", 7: "+35.10", 8: "+36.68", 9: "+39.51" },
    scrambled: { 6: "+5.39", 7: "+4.10", 8: "+2.87", 9: "-0.95" },
    direct: { 6: "+17.44", 7: "+10.20", 8: "+4.02", 9: "-0.82" },
  });
  assert.ok(Object.isFrozen(M.E11_RETURN) && Object.isFrozen(M.E11_RETURN.morph), "reported data cannot be edited at run time");
  assert.equal(M.e11Return("scrambled", 9), -0.95);
  assert.equal(M.E11_CORE_DRIFT, "0.0000");
  // The illustration is the original's closed form, bounded like it.
  assert.equal(M.phenotypeValue("morph", 0.1, 0.2, 9), Math.sin(0.1 * 30 + 0.2 * 20) * 0.4);
  assert.equal(M.phenotypeValue("morph", 0.5, 0.2, 9), Math.cos((0.5 - 0.2) * 6.28 + 1));
  assert.equal(M.phenotypeValue("direct", 0.5, 0.2, 9), Math.sin((0.5 * 311 + 0.2 * 293) * 9));
});

test("E12 retention follows the original's formula and is labelled for what it is", () => {
  const expected = {
    nullgate: ["+86.59 (0.00 drop)", "+71.66 (0.00 drop)", "+56.73 (0.00 drop)", "+48.20 (0.00 drop)"],
    ungated: ["-20.75 (collision)", "-54.31 (collision)", "-87.88 (collision)", "-107.06 (collision)"],
    raw: ["+84.01 (-4.37 drop)", "+68.19 (-4.37 drop)", "+52.36 (-4.37 drop)", "+43.32 (-4.37 drop)"],
  };
  for (const [arm, labels] of Object.entries(expected)) {
    [1.0, 1.7, 2.4, 2.8].forEach((s, i) => assert.equal(M.retentionLabel(arm, s), labels[i], `${arm} at ${s}×`));
  }
  assert.equal(M.shiftKind(1.0), "anchor");
  assert.equal(M.shiftKind(2.4), "anchor");
  assert.equal(M.shiftKind(Number("1.7")), "interpolated");
  assert.equal(M.shiftKind(Number("2.5")), "extrapolated");
  // The fixed labels the original prints at every shift.
  assert.equal(M.E12_REPORTED.nullgate.transfer, "+39.32");
  assert.equal(M.E12_REPORTED.nullgate.pass, "10/12 pass");
  assert.equal(M.E12_REPORTED.ungated.residual, "1.3086");
  assert.equal(M.E12_REPORTED.raw.residual, "0.1376");
  assert.ok(Object.isFrozen(M.E12_REPORTED.raw));
  // The raw arm's fixed "-4.37 drop" equals G2 − C1 only at 2.4×.
  close(M.retention("nullgate", 2.4) - M.retention("raw", 2.4), 4.37, 1e-9);
});

test("the null-space gate removes exactly what the kept directions would see", () => {
  const donor = M.makeDonor();
  // Q is orthonormal and the skill direction is orthogonal to it.
  for (let a = 0; a < donor.k; a += 1) {
    for (let b = 0; b < donor.k; b += 1) {
      let dot = 0;
      for (let j = 0; j < donor.d; j += 1) dot += donor.Q[a][j] * donor.Q[b][j];
      close(dot, a === b ? 1 : 0, 1e-12, "QᵀQ = I");
    }
    let sq = 0;
    for (let j = 0; j < donor.d; j += 1) sq += donor.s[j] * donor.Q[a][j];
    close(sq, 0, 1e-12, "s ⟂ Q");
  }
  for (const sibling of [0, 1, 2, 5]) {
    const g = M.graft(donor, sibling);
    assert.deepEqual([...g.perm].sort((x, y) => x - y), Array.from({ length: donor.d }, (_, i) => i), "a permutation");
    assert.ok(g.nullgate.keep < 1e-12, `gated residual ${g.nullgate.keep} is floating-point dust`);
    close(g.nullgate.skill, 1, 1e-12, "the gated skill arrives intact");
    close(g.ungated.skill, 1, 1e-12, "aligned but ungated, the skill also arrives");
    assert.ok(g.ungated.keep > 0.1, "ungated, the kept directions see the update");
    close(g.ungated.keep, M.frob(M.timesBasis(donor.dW, donor.Q)), 1e-12, "aligned, the collision does not depend on the sibling's basis");
    for (const arm of M.E12_ARMS) {
      const x = g[arm];
      close(x.total ** 2, x.keep ** 2 + x.free ** 2, 1e-9, `${arm}: ‖ΔW‖² = keep² + free²`);
    }
    close(g.raw.total, g.ungated.total, 1e-12, "a permutation keeps the Frobenius norm");
    close(g.nullgate.free, g.ungated.free, 1e-12, "the gate leaves the free part alone");
  }
  // With no permutation, a raw copy is the aligned copy; with one, it scrambles the skill.
  const same = M.graft(donor, 0);
  close(same.raw.keep, same.ungated.keep, 1e-12);
  assert.ok(M.graft(donor, 1).raw.skill < 0.5, "a permuted raw copy does not carry the skill");
});
