// The tide palette contrast audit (#24): the results file must match a fresh
// run of scripts/contrast-audit.mjs over the live site.css, and the headline
// counts must stay as recorded until someone regenerates the file on purpose.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAudit, BAR, FOREGROUNDS, BACKGROUNDS } from "../scripts/contrast-audit.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = path.join(repo, "site", "assets", "site.css");
const resultsPath = path.join(repo, "test", "contrast-results.json");

test("contrast results match a fresh audit of the live palette", () => {
  const cssText = fs.readFileSync(cssPath, "utf8");
  const recorded = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  const fresh = runAudit(cssText);
  assert.deepEqual(fresh, recorded);
});

test("headline counts: dark clean, light fails at the default hue", () => {
  const recorded = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  const dark = recorded.themes.dark;
  const light = recorded.themes.light;
  assert.equal(dark.pairings, FOREGROUNDS.length * BACKGROUNDS.length);
  assert.equal(light.pairings, FOREGROUNDS.length * BACKGROUNDS.length);
  assert.equal(dark.failuresAtDefaultHue, 0);
  assert.equal(light.failuresAtDefaultHue, 24);
  // Dark stays above the bar at every hue; light does not.
  assert.equal(dark.huesBelowBar, 0);
  assert.ok(light.huesBelowBar > 0);
  // The worst light pairing at the default hue is accent-2 on wash.
  assert.equal(light.atDefaultHue["accent-2"].wash, 3.4);
  // The weakest dark pairing at the default hue is muted on wash.
  assert.equal(dark.atDefaultHue.muted.wash, 4.99);
  // accent-2 falls below the bar at every hue on every background in light.
  for (const bg of BACKGROUNDS) {
    assert.equal(light.worstOverHues["accent-2"][bg].below45, 360);
  }
  // The chip puts bg text on an accent field; it fails in light, passes in dark.
  assert.ok(light.reversePairings["bg-on-accent"].atDefaultHue < BAR);
  assert.ok(dark.reversePairings["bg-on-accent"].atDefaultHue >= BAR);
});
