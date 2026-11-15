// Ecosystem home page guards: one data source for places and the record,
// a panel for every place, and none of the blocked patterns from review.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(repo, "site", "index.html"), "utf8");
const js = fs.readFileSync(path.join(repo, "site", "assets", "ecosystem.js"), "utf8");

const placeIds = [...js.matchAll(/\{ id: "([a-z-]+)", code:/g)].map((m) => m[1]);

test("eight places are declared once", () => {
  assert.equal(placeIds.length, 8, `expected 8 places, got ${placeIds.join(",")}`);
  assert.equal(new Set(placeIds).size, 8, "place ids must be unique");
});

test("every place has a panel on the home page", () => {
  for (const id of placeIds) {
    assert.ok(html.includes(`data-place="${id}"`), `site/index.html has no panel for ${id}`);
  }
});

test("the record derives from the places, not a parallel list", () => {
  assert.match(js, /PLACES\.map\(/, "RECORD must be built from PLACES");
  assert.doesNotMatch(html, /Three angles are on|Five are open/, "status counts must not be hardcoded in HTML");
});

test("blocked patterns stay out of the ecosystem script", () => {
  assert.doesNotMatch(js, /ipwho\.is/, "no third-party address lookup");
  assert.doesNotMatch(js, /localStorage\.setItem\([^)]*[Kk]ey/, "no service keys in localStorage");
  assert.doesNotMatch(js, /<iframe/, "places run natively, not in iframes");
  assert.doesNotMatch(html, /<iframe/, "places run natively, not in iframes");
});

test("the rebuild link is gated, not live on load", () => {
  assert.doesNotMatch(html, /href="[^"]*weft-eido\/index\.html"/, "full rebuild link must arm behind the gate button");
  assert.match(html, /id="eco-gate-arm"/, "gate button is present");
  assert.match(js, /pull\/6/, "the gate opens pull request 6, not a local rebuild page");
});

test("recorded audio carries its non-commercial licence", () => {
  const licence = path.join(repo, "examples", "research", "causal-harmonic", "originals", "LICENSE.md");
  assert.ok(fs.existsSync(licence), "originals/LICENSE.md is missing");
  assert.match(fs.readFileSync(licence, "utf8"), /CC BY-NC 4\.0/);
  assert.match(fs.readFileSync(path.join(repo, "NOTICE"), "utf8"), /CC BY-NC 4\.0/);
});
