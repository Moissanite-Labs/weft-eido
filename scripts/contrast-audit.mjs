// Contrast audit for the eido tide palette (#24).
//
// Reads the palette roles from site/assets/site.css, converts the OKLCH
// values to sRGB, and computes the WCAG contrast ratio for every text colour
// on every background in both themes. It checks the default hue (196) and
// sweeps the hue knob across all 360 degrees, since a visitor can set any
// hue and the claim in #24 is that no pairing drops below the limit.
//
// Run: node scripts/contrast-audit.mjs
// Writes: test/contrast-results.json
// The test in test/contrast.test.mjs re-runs this audit and checks the
// results file matches, so a palette change that moves a ratio fails the
// test until the results file is regenerated.
//
// Limits, stated plainly:
// - Colours outside the sRGB gamut are clamped per channel. Browsers map
//   out-of-gamut OKLCH colours differently, so ratios for saturated roles
//   are approximate. A second method was checked against this one: reducing
//   chroma to the gamut edge instead of clamping. It gives the same failure
//   set in both themes, with ratios differing by at most 0.06 in light and
//   0.88 in dark, and no verdict changes.
// - Roles with an alpha value are blended over the theme background, which
//   is what sits under them on the page. The page body also carries two faint
//   radial gradients over the background; those are not modelled.
// - The bar is 4.5 to 1 for normal text (WCAG AA). Large text needs 3 to 1;
//   the results file records how many hues fall below each bar.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = path.join(repo, "site", "assets", "site.css");
const outPath = path.join(repo, "test", "contrast-results.json");

export const DEFAULT_HUE = 196;
export const BAR = 4.5;
export const LARGE_TEXT_BAR = 3.0;
export const FOREGROUNDS = [
  "ink", "ink-2", "muted", "accent", "accent-strong", "accent-2",
  "accent-3", "link", "code-ink", "ok", "alert", "gold-flat",
];
export const BACKGROUNDS = [
  "bg", "bg-2", "surface", "surface-2", "code-bg", "wash", "alert-soft",
];
// One real reverse pairing: .preview .chip puts bg text on an accent field.
export const REVERSE_PAIRINGS = [{ foreground: "bg", background: "accent" }];

function hueOf(expr, hue) {
  let s = expr.trim();
  if (s.startsWith("calc(") && s.endsWith(")")) s = s.slice(5, -1);
  s = s
    .replaceAll("var(--eco-hue)", String(hue))
    .replaceAll("var(--h-crest)", String(hue))
    .replaceAll("var(--h-trough)", String(((hue + 190) % 360 + 360) % 360))
    .replaceAll("var(--h-node)", String(((hue - 112) % 360 + 360) % 360))
    .replaceAll("var(--h-ink)", String(((hue + 58) % 360 + 360) % 360));
  const m = s.match(/^(-?[\d.]+)\s*([+-])\s*(-?[\d.]+)$/);
  if (m) {
    const v = Number(m[1]) + (m[2] === "+" ? Number(m[3]) : -Number(m[3]));
    return ((v % 360) + 360) % 360;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`cannot read hue from ${expr}`);
  return ((n % 360) + 360) % 360;
}

function parseRoles(block) {
  const roles = {};
  for (const m of block.matchAll(/--([\w-]+):\s*oklch\((.+?)\);\s*$/gm)) {
    let vals = m[2].trim();
    let alpha = 1;
    const slash = vals.lastIndexOf("/");
    if (slash !== -1) {
      alpha = Number(vals.slice(slash + 1).trim());
      vals = vals.slice(0, slash).trim();
    }
    const parts = vals.split(/\s+/, 3);
    // The hue part may be a calc() with spaces, so rejoin what is left.
    const rest = vals.split(/\s+/).slice(2).join(" ");
    roles[m[1]] = {
      lightness: Number(parts[0]),
      chroma: Number(parts[1]),
      hueExpr: rest,
      alpha,
    };
  }
  return roles;
}

function parseThemes(css) {
  const dark = css.match(/:root \{([\s\S]*?)\n\}/);
  const light = css.match(/:root\[data-theme="light"\] \{([\s\S]*?)\n\}/);
  if (!dark || !light) throw new Error("could not find both theme blocks in site.css");
  return { dark: parseRoles(dark[1]), light: parseRoles(light[1]) };
}

// OKLCH to sRGB, after Bjorn Ottosson. Channels outside [0, 1] are clamped;
// the overshoot is returned so callers can say how far out a colour was.
function oklchToSrgb(l, c, hueDeg) {
  const a = c * Math.cos((hueDeg * Math.PI) / 180);
  const b = c * Math.sin((hueDeg * Math.PI) / 180);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;
  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;
  const x =
    0.8190224432 * l3 + 0.3619062562 * m3 - 0.1288737815 * s3;
  const y =
    0.0329836672 * l3 + 0.9292868463 * m3 + 0.0361446682 * s3;
  const z =
    0.0692642107 * l3 - 0.1109658122 * m3 + 1.3881173767 * s3;
  const r =
    4.0767416621 * x - 3.3077115913 * y + 0.2309699292 * z;
  const g =
    -1.2684380046 * x + 2.6097574011 * y - 0.3413193965 * z;
  const bl =
    -0.0041960863 * x - 0.7034186147 * y + 1.7076147010 * z;
  let overshoot = 0;
  const gamma = (x) => {
    overshoot = Math.max(overshoot, -Math.min(x, 0), Math.max(x - 1, 0));
    const v = Math.min(1, Math.max(0, x));
    return v > 0.0031308 ? 1.055 * v ** (1 / 2.4) - 0.055 : 12.92 * v;
  };
  return { rgb: [gamma(r), gamma(g), gamma(bl)], overshoot };
}

function roleRgb(roles, name, hue, baseRgb) {
  const role = roles[name];
  if (!role) throw new Error(`no palette role named ${name}`);
  const { rgb, overshoot } = oklchToSrgb(
    role.lightness,
    role.chroma,
    hueOf(role.hueExpr, hue),
  );
  if (role.alpha >= 1 || !baseRgb) return { rgb, overshoot };
  const blended = rgb.map((v, i) => role.alpha * v + (1 - role.alpha) * baseRgb[i]);
  return { rgb: blended, overshoot };
}

function luminance(rgb) {
  const f = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = rgb.map(f);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(rgb1, rgb2) {
  const hi = Math.max(luminance(rgb1), luminance(rgb2));
  const lo = Math.min(luminance(rgb1), luminance(rgb2));
  return (hi + 0.05) / (lo + 0.05);
}

const round2 = (n) => Math.round(n * 100) / 100;

export function runAudit(cssText) {
  const themes = parseThemes(cssText);
  const result = {
    generatedBy: "scripts/contrast-audit.mjs",
    source: "site/assets/site.css",
    cssSha256: crypto.createHash("sha256").update(cssText).digest("hex"),
    defaultHue: DEFAULT_HUE,
    bar: BAR,
    largeTextBar: LARGE_TEXT_BAR,
    foregrounds: FOREGROUNDS,
    backgrounds: BACKGROUNDS,
    reversePairings: REVERSE_PAIRINGS,
    themes: {},
  };
  for (const theme of ["dark", "light"]) {
    const roles = themes[theme];
    const atDefault = {};
    const worst = {};
    const reverse = {};
    let failuresAtDefault = 0;
    let huesBelowBar = 0;
    for (const fg of FOREGROUNDS) {
      atDefault[fg] = {};
      worst[fg] = {};
      for (const bg of BACKGROUNDS) {
        const base = roleRgb(roles, "bg", DEFAULT_HUE).rgb;
        const f = roleRgb(roles, fg, DEFAULT_HUE).rgb;
        const b = roleRgb(roles, bg, DEFAULT_HUE, base).rgb;
        const ratio = round2(contrastRatio(f, b));
        atDefault[fg][bg] = ratio;
        if (ratio < BAR) failuresAtDefault += 1;
        let min = Infinity;
        let minHue = null;
        let below45 = 0;
        let below30 = 0;
        for (let hue = 0; hue < 360; hue += 1) {
          const baseH = roleRgb(roles, "bg", hue).rgb;
          const fh = roleRgb(roles, fg, hue).rgb;
          const bh = roleRgb(roles, bg, hue, baseH).rgb;
          const r = contrastRatio(fh, bh);
          if (r < min) {
            min = r;
            minHue = hue;
          }
          if (r < BAR) below45 += 1;
          if (r < LARGE_TEXT_BAR) below30 += 1;
        }
        worst[fg][bg] = {
          ratio: round2(min),
          hue: minHue,
          below45: below45,
          below30: below30,
        };
        huesBelowBar += below45;
      }
    }
    for (const { foreground, background } of REVERSE_PAIRINGS) {
      const base = roleRgb(roles, "bg", DEFAULT_HUE).rgb;
      const f = roleRgb(roles, foreground, DEFAULT_HUE).rgb;
      const b = roleRgb(roles, background, DEFAULT_HUE, base).rgb;
      const ratio = round2(contrastRatio(f, b));
      let min = Infinity;
      let minHue = null;
      let below45 = 0;
      for (let hue = 0; hue < 360; hue += 1) {
        const baseH = roleRgb(roles, "bg", hue).rgb;
        const fh = roleRgb(roles, foreground, hue).rgb;
        const bh = roleRgb(roles, background, hue, baseH).rgb;
        const r = contrastRatio(fh, bh);
        if (r < min) {
          min = r;
          minHue = hue;
        }
        if (r < BAR) below45 += 1;
      }
      reverse[`${foreground}-on-${background}`] = {
        atDefaultHue: ratio,
        worstRatio: round2(min),
        worstHue: minHue,
        huesBelowBar: below45,
      };
      if (ratio < BAR) failuresAtDefault += 1;
    }
    // How far outside the sRGB gamut the most saturated role sits, per theme.
    let maxOvershoot = 0;
    for (const name of [...FOREGROUNDS, ...BACKGROUNDS]) {
      for (let hue = 0; hue < 360; hue += 1) {
        maxOvershoot = Math.max(
          maxOvershoot,
          roleRgb(roles, name, hue).overshoot,
        );
      }
    }
    result.themes[theme] = {
      pairings: FOREGROUNDS.length * BACKGROUNDS.length,
      failuresAtDefaultHue: failuresAtDefault,
      atDefaultHue: atDefault,
      worstOverHues: worst,
      huesBelowBar,
      reversePairings: reverse,
      maxGamutOvershoot: round2(maxOvershoot),
    };
  }
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cssText = fs.readFileSync(cssPath, "utf8");
  const result = runAudit(cssText);
  fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  for (const theme of ["dark", "light"]) {
    const t = result.themes[theme];
    console.log(
      `${theme}: ${t.pairings} pairings, ${t.failuresAtDefaultHue} below ${BAR} to 1 at hue ${DEFAULT_HUE}, ${t.huesBelowBar} hue-steps below the bar across the sweep, max gamut overshoot ${t.maxGamutOvershoot}`,
    );
  }
  console.log(`wrote ${path.relative(repo, outPath)}`);
}
