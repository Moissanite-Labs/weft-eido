// The loom's pure rules: the weft field, ripples, and the geometry that
// decides when a wavefront has revealed a block.
import { test } from "node:test";
import assert from "node:assert/strict";
import { LOOM, partialAmps, restAmp, threadDisplacement, rippleAt, rectReach, unfoldProgress, frontOrigin, frontSpeed, palette, voiceHue, threadGap } from "../site/assets/loom-core.js";

test("threads are pinned at both selvedges", () => {
  const amps = partialAmps(12.3, 0.4);
  for (const i of [0, 3, 17]) {
    assert.ok(Math.abs(threadDisplacement(0, i, 5.5, amps)) < 1e-12);
    assert.ok(Math.abs(threadDisplacement(1, i, 5.5, amps)) < 1e-12);
  }
  assert.ok(Math.abs(threadDisplacement(0.37, 2, 5.5, amps)) > 1e-3, "and free in between");
});

test("partials follow a bounded harmonic rolloff, and energy lifts the upper ones", () => {
  const calm = partialAmps(7, 0), restless = partialAmps(7, 1);
  assert.equal(calm.length, LOOM.HARMONICS);
  calm.forEach((a, k) => {
    assert.ok(a <= restAmp(k + 1) * (1 + LOOM.BREATH) + 1e-12);
    assert.ok(a >= restAmp(k + 1) * (1 - LOOM.BREATH) - 1e-12);
  });
  assert.ok(restless[6] / calm[6] > restless[0] / calm[0], "restlessness brightens the top of the series");
});

test("a ripple is zero before it starts, after it dies, and far from its front", () => {
  assert.equal(rippleAt(10, -0.1, 500), 0);
  assert.equal(rippleAt(10, LOOM.RIPPLE_LIFE + 0.01, 500), 0);
  assert.equal(rippleAt(5000, 0.5, 500, 1, 40), 0);
  assert.ok(Math.abs(rippleAt(250, 0.5, 500, 1, 40)) > 0.3, "and strong on its front");
});

test("rectReach gives the nearest and farthest distance to a block", () => {
  const r = { left: 100, top: 100, width: 200, height: 100 };
  assert.deepEqual(rectReach(150, 150, r).near, 0);
  assert.equal(rectReach(0, 150, r).near, 100);
  assert.equal(rectReach(100, 100, r).far, Math.hypot(200, 100));
});

test("unfolding is monotonic, bounded, and complete only after the far corner", () => {
  const reach = { near: 100, far: 400 };
  let last = -1;
  for (let r = 0; r <= 600; r += 25) {
    const p = unfoldProgress(r, reach, 50);
    assert.ok(p >= last && p >= 0 && p <= 1);
    last = p;
  }
  assert.equal(unfoldProgress(100, reach, 50), 0);
  assert.ok(unfoldProgress(440, reach, 50) < 1);
  assert.equal(unfoldProgress(450, reach, 50), 1);
});

test("a front starts at a recent pointer, otherwise at the edge the block came from", () => {
  const vw = 1000, vh = 800;
  assert.equal(frontOrigin({ pointer: { x: 300, y: 200, t: 1000 }, now: 2000, vw, vh, scrollDir: 1 }).cause, "pointer");
  const stale = frontOrigin({ pointer: { x: 300, y: 200, t: 0 }, now: 9000, vw, vh, scrollDir: 1 });
  assert.equal(stale.cause, "edge");
  assert.equal(stale.y, vh, "scrolling down: from the bottom edge");
  assert.equal(frontOrigin({ pointer: null, now: 0, vw, vh, scrollDir: -1 }).y, 0, "scrolling up: from the top edge");
  assert.ok(Math.abs(frontSpeed(vw, vh) * LOOM.FRONT_SECONDS - Math.hypot(vw, vh)) < 1e-9);
});

test("colour comes from one hue in both themes", () => {
  for (const light of [false, true]) {
    const p = palette(400, light);
    assert.equal(p.hue, 40);
    assert.match(p.voice(0, 0.5), /^hsl\(40\.0 /);
    assert.match(p.thread(0.1), /^hsl\(40 /);
  }
  assert.ok(voiceHue(10, 1) >= 0 && voiceHue(10, 1) < 360);
  assert.ok(threadGap(200) >= 14);
});
