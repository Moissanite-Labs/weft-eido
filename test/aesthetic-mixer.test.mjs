import assert from "node:assert/strict";
import test from "node:test";
import { AestheticMixer, mixAestheticPresets } from "../src/aesthetic-mixer.js";

test("circular mean hue wraps across 0.0/1.0 boundary (0.95 and 0.05 -> 0.0 red, not 0.50 cyan)", () => {
  const presets = {
    crimson_left: { rounding: 0.2, density: 0.4, hue: 0.95, contrast: 0.1 },
    crimson_right: { rounding: 0.6, density: 0.8, hue: 0.05, contrast: 0.3 },
  };
  const out = mixAestheticPresets(presets, { crimson_left: 0.5, crimson_right: 0.5 });
  assert.ok(out.hue < 1e-6 || out.hue > 1.0 - 1e-6, `Expected circular hue ~0.0, got ${out.hue}`);
  assert.ok(Math.abs(out.rounding - 0.4) < 1e-6);
  assert.ok(Math.abs(out.density - 0.6) < 1e-6);
  assert.ok(Math.abs(out.contrast - 0.2) < 1e-6);
});

test("AestheticMixer class uses circular mean hue and normalizes weights", () => {
  const mixer = new AestheticMixer();
  mixer.activeSlices = [
    { id: "a", weight: 2.0, rounding: 0.1, density: 0.2, hue_shift: 0.90, contrast: 0.05 },
    { id: "b", weight: 2.0, rounding: 0.3, density: 0.4, hue_shift: 0.10, contrast: 0.15 },
  ];
  const vec = mixer.calculateUnifiedAestheticVector();
  assert.ok(vec.hue < 1e-6 || vec.hue > 1.0 - 1e-6, `Expected hue ~0.0, got ${vec.hue}`);
  assert.ok(Math.abs(vec.rounding - 0.2) < 1e-6);
});
