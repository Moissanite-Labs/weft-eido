/**
 * Barycentric Aesthetic Mixer (Eido, formerly Weft codebase C7)
 * ========================================================
 * Implements the continuous design-token interpolation and circular mean hue
 * (`atan2(sum(w_i * sin(theta_i)), sum(w_i * cos(theta_i)))`) specified in
 * `weft-corpus:weft/design/discovery.md:208-259`, `weft-corpus:weft/design/core.md:237-292`, and
 * `weft-corpus:weft/design/baryonic.md`.
 *
 * Fixes Issue #24 (P12): hues wrap continuously across the 0.0 / 1.0 boundary
 * on the unit circle instead of averaging linearly through 0.50 (cyan).
 */

export function mixAestheticPresets(presets, weights) {
  const keys = Object.keys(presets);
  if (keys.length === 0) {
    return { rounding: 0.18, density: 0.55, hue: 0.22, contrast: 0.12 };
  }

  let totalWeight = 0;
  for (const k of keys) {
    const w = Math.max(0, Number(weights?.[k] ?? 0));
    totalWeight += w;
  }

  const norm = {};
  if (totalWeight <= 1e-9) {
    norm[keys[0]] = 1.0;
    for (let i = 1; i < keys.length; i++) norm[keys[i]] = 0.0;
  } else {
    for (const k of keys) {
      norm[k] = Math.max(0, Number(weights?.[k] ?? 0)) / totalWeight;
    }
  }

  let rounding = 0;
  let density = 0;
  let contrast = 0;
  let sinSum = 0;
  let cosSum = 0;

  for (const k of keys) {
    const w = norm[k];
    const p = presets[k];
    const hRaw = Number(p.hue ?? p.hue_shift ?? 0);
    const hUnit = ((hRaw % 1.0) + 1.0) % 1.0;
    const theta = hUnit * Math.PI * 2.0;

    rounding += w * Number(p.rounding ?? 0);
    density += w * Number(p.density ?? 0);
    contrast += w * Number(p.contrast ?? 0);
    sinSum += w * Math.sin(theta);
    cosSum += w * Math.cos(theta);
  }

  let meanHue = 0.0;
  if (Math.hypot(sinSum, cosSum) > 1e-9) {
    meanHue = Math.atan2(sinSum, cosSum) / (Math.PI * 2.0);
    if (meanHue < 0.0) meanHue += 1.0;
    if (meanHue >= 1.0 - 1e-12) meanHue = 0.0;
  }

  return {
    rounding,
    density,
    hue: meanHue,
    contrast,
  };
}

export class AestheticMixer {
  constructor() {
    this.activeSlices = [
      { id: "native_base", weight: 1.0, rounding: 0.85, density: 0.30, hue_shift: 0.12, contrast: 0.05 },
      { id: "neon_terminal", weight: 0.0, rounding: 0.0, density: 0.10, hue_shift: 0.45, contrast: 0.01 },
      { id: "airy_pastel", weight: 0.0, rounding: 1.0, density: 0.85, hue_shift: 0.85, contrast: 0.20 },
    ];
  }

  setSliceWeight(id, weight) {
    const slice = this.activeSlices.find((s) => s.id === id);
    if (slice) slice.weight = Math.max(0, Number(weight) || 0);
  }

  calculateUnifiedAestheticVector() {
    const presets = {};
    const weights = {};
    for (const slice of this.activeSlices) {
      presets[slice.id] = {
        rounding: slice.rounding,
        density: slice.density,
        hue: slice.hue_shift,
        contrast: slice.contrast,
      };
      weights[slice.id] = slice.weight;
    }
    return mixAestheticPresets(presets, weights);
  }
}
