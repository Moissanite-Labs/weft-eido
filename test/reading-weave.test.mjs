import assert from "node:assert/strict";
import test from "node:test";
import {
  WEAVE, clamp01, smoothstep, countWords, isReadable, dwellNeeded, readReward, skipPenalty,
  scrollSample, cursorSample, scoreStep, decayScrollSpeed, decayCursor, isSteady, statusFor, shouldWarn,
  makeWave, advanceWave, waveField, waveCap, motionLevels, wordDisplacement, linkOffset, attention,
  setupReadingWeave,
} from "../src/reading-weave.js";

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const quiet = { scrollSpeed: 0, flips: 0, sinceScrollMs: 1e4, jolt: 0, reading: false };

test("importing and calling setup in Node does nothing and does not throw", () => {
  assert.deepEqual(attention, { restless: 0, reading: false });
  assert.equal(setupReadingWeave(), null);
});

test("clamp01 and smoothstep stay in range", () => {
  assert.equal(clamp01(-3), 0);
  assert.equal(clamp01(7), 1);
  assert.equal(smoothstep(0.2, 0.8, 0), 0);
  assert.equal(smoothstep(0.2, 0.8, 1), 1);
  assert.ok(Math.abs(smoothstep(0, 1, 0.5) - 0.5) < 1e-12);
});

test("short blocks are ineligible; reading time has a floor", () => {
  assert.equal(countWords("  one two\nthree  "), 3);
  assert.equal(isReadable(3), false);
  assert.equal(isReadable(4), true);
  assert.equal(dwellNeeded(5), 1.2);
  assert.equal(dwellNeeded(100), 10);
  assert.equal(dwellNeeded(100, 5), 20);
});

test("skipping raises the score, more for more words, less the second time, capped", () => {
  assert.ok(skipPenalty(40) > 0);
  assert.ok(skipPenalty(80) > skipPenalty(40));
  assert.ok(skipPenalty(60, true) < skipPenalty(60, false));
  assert.equal(skipPenalty(5000), 0.2);
  assert.ok(skipPenalty(60) > 0 && skipPenalty(60) <= 0.2);
});

test("reading lowers the score more for longer passages", () => {
  assert.ok(readReward(150) > readReward(30));
  assert.ok(readReward(30) > 0.06);
});

test("a fast scroll sample is a long jump; a quick reversal is a flip", () => {
  const jump = scrollSample(0, 3000, 100, 800, 0);
  assert.ok(jump.jump);
  assert.ok(jump.v > 2000);
  const flip = scrollSample(0, -50, 100, 800, 1);
  assert.ok(flip.flip);
  assert.equal(flip.dir, -1);
  const slow = scrollSample(0, 10, 100, 800, 1);
  assert.ok(!slow.jump && !slow.flip);
});

test("a jerky cursor builds jolt; a steady one does not", () => {
  const mk = () => ({ x: 0, y: 0, t: 0, heading: 0, omega: 0, speed: 0, jolt: 0, still: 0, has: false });
  const steady = mk();
  for (let i = 0; i <= 20; i++) cursorSample(steady, i * 12, 0, i * 16);
  const jerky = mk();
  for (let i = 0; i <= 20; i++) cursorSample(jerky, i * 40, (i % 2 ? 1 : -1) * 40, i * 16);
  assert.ok(jerky.jolt > steady.jolt);
  assert.ok(jerky.speed > steady.speed);
});

test("score rises with fast scrolling, flips and a jerky cursor", () => {
  const base = 0.2;
  assert.ok(scoreStep(base, { ...quiet, scrollSpeed: 3000 }, 0.1) > base);
  assert.ok(scoreStep(base, { ...quiet, flips: 3, sinceScrollMs: 100 }, 0.1) > base);
  assert.ok(scoreStep(base, { ...quiet, jolt: 1 }, 0.1) > base);
  // flips that are over (scroll stopped long ago) do not count
  assert.ok(scoreStep(base, { ...quiet, flips: 3, sinceScrollMs: 900 }, 0.1) < base);
});

test("score decays toward calm, faster while reading", () => {
  let idle = 0.8, reading = 0.8;
  for (let i = 0; i < 200; i++) {
    idle = scoreStep(idle, quiet, 0.05);
    reading = scoreStep(reading, { ...quiet, reading: true }, 0.05);
  }
  assert.ok(reading < idle && idle < 0.8);
  assert.ok(Math.abs(reading - 0.3) < 1e-6, "reading recovers 0.05 a second, so ten seconds is half the scale");
});

test("score always stays in [0, 1]", () => {
  let r = 0.5;
  for (let i = 0; i < 500; i++) {
    r = scoreStep(r, { scrollSpeed: 9000, flips: 9, sinceScrollMs: 0, jolt: 1, reading: false }, 0.05);
    assert.ok(r >= 0 && r <= 1);
  }
  assert.ok(r > 0.99);
  for (let i = 0; i < 5000; i++) r = scoreStep(r, { ...quiet, reading: true }, 0.05);
  assert.equal(r, 0);
  assert.equal(scoreStep(5, quiet, 0.05) <= 1, true);
});

test("signals decay over time", () => {
  assert.ok(decayScrollSpeed(1000, 0.1, 0) < 1000);
  assert.ok(decayScrollSpeed(1000, 0.1, 500) < decayScrollSpeed(1000, 0.1, 0));
  assert.ok(decayCursor(1, 0.3) < 0.4);
  assert.ok(isSteady(100, 0.1));
  assert.ok(!isSteady(WEAVE.steadyScroll, 0));
  assert.ok(!isSteady(0, WEAVE.steadyJolt));
});

test("panel copy and the warning button follow the score", () => {
  assert.equal(statusFor(0, false), "Calm.");
  assert.equal(statusFor(0, true), "Reading steadily.");
  assert.equal(statusFor(0.4, true), "Skimming detected.");
  assert.equal(statusFor(0.8, true), "Rushing. The page is pushing back.");
  assert.match(statusFor(0.8, true, true), /off/);
  assert.equal(shouldWarn(0.3, false), false);
  assert.equal(shouldWarn(0.3, true), true);
  assert.equal(shouldWarn(0.9, true, true), false);
});

test("what the score drives, range by range", () => {
  const calm = motionLevels(0.05);
  assert.ok(!calm.split && calm.amp === 0 && calm.drift === 0 && calm.blur === 0 && calm.seedRate === 0);
  const mid = motionLevels(0.5);
  assert.ok(mid.split && mid.amp > 0 && mid.dim > 0 && mid.blur === 0 && mid.drift === 0);
  const hot = motionLevels(1);
  assert.equal(hot.amp, WEAVE.wordAmp);
  assert.equal(hot.tilt, WEAVE.wordTilt);
  assert.ok(Math.abs(hot.blur - 1.4) < 1e-12 && hot.drift === 14 && hot.evade === 26);
});

test("a wave grows, fades and dies; its cap grows with the score", () => {
  const v = makeWave(0, 0, 1, 0.5, seq(0.5));
  assert.ok(v.lambda > 0 && v.len > v.lambda);
  let alive = true, n = 0;
  while (alive && n++ < 1000) alive = advanceWave(v, 0.05);
  assert.ok(!alive && v.age > v.life);
  assert.ok(waveCap(1) > waveCap(0));
});

test("wave field and word displacement are capped however many waves overlap", () => {
  const waves = [];
  for (let i = 0; i < 40; i++) {
    const w = makeWave(0, 0, 1, 1, seq(0.3, 0.7, 0.1));
    w.r0 = 400; w.age = 1; w.fade = 1; w.phase = 0;
    waves.push(w);
  }
  let max = 0;
  for (let x = 0; x < 900; x += 7) max = Math.max(max, Math.abs(waveField(x, 0, waves, 0.9, 1.2)));
  assert.ok(max <= WEAVE.fieldLimit);
  const lv = motionLevels(1);
  for (const f of [-50, -1, 0, 0.4, 1, 50]) {
    const d = wordDisplacement(f, lv);
    assert.ok(Math.abs(d.dy) <= WEAVE.wordAmp && Math.abs(d.rot) <= WEAVE.wordTilt);
    assert.ok(d.opacity >= 1 - lv.dim - 1e-12 && d.opacity <= 1);
  }
});

test("links drift only at high scores, are capped, and settle when the cursor is still", () => {
  const input = { fx: 1, fy: 1, dx: 5, dy: 0, dist: 5, still: 0, speed: 1 };
  assert.deepEqual(linkOffset(input, motionLevels(0.3)), [0, 0]);
  const moving = linkOffset(input, motionLevels(1));
  assert.ok(Math.hypot(...moving) <= WEAVE.linkMax + 1e-9);
  assert.ok(moving[0] > 14, "pushed away from the cursor on the right");
  const settled = linkOffset({ ...input, still: 2 }, motionLevels(1));
  assert.ok(Math.hypot(...settled) < Math.hypot(...moving) * 0.3);
});
