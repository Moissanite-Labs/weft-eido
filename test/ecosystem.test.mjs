// Causal field guards: standalone links, one data source, and the bans.
// Site styles must stay free of absolute units, breakpoints and fixed
// geometry. The shipped library styles in css/ are exempt and unstated here.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(repo, "site");
const html = fs.readFileSync(path.join(siteDir, "index.html"), "utf8");
const js = fs.readFileSync(path.join(siteDir, "assets", "ecosystem.js"), "utf8");
const ecoCss = fs.readFileSync(path.join(siteDir, "assets", "ecosystem.css"), "utf8");
const siteCss = fs.readFileSync(path.join(siteDir, "assets", "site.css"), "utf8");

const places = [...js.matchAll(/\{ id: "([a-z-]+)", code: "[^"]+", name: "[^"]+", href: "([^"]+)"/g)]
  .map((m) => ({ id: m[1], href: m[2] }));

test("eight places are declared once, each with a standalone target", () => {
  assert.equal(places.length, 8, `expected 8 places, got ${places.map((p) => p.id).join(",")}`);
  assert.equal(new Set(places.map((p) => p.id)).size, 8, "place ids must be unique");
  for (const place of places) {
    assert.ok(html.includes(`data-place-link="${place.id}"`), `home page has no link for ${place.id}`);
    assert.ok(html.includes(`href="${place.href}"`), `home link for ${place.id} does not match its data href`);
    if (/^https:/.test(place.href)) continue;
    const target = path.resolve(siteDir, place.href.split("#")[0]);
    assert.ok(fs.existsSync(target), `${place.id} target ${place.href} does not exist`);
  }
});

test("no nested rooms or demos remain on the landing", () => {
  assert.doesNotMatch(html, /data-place=|eco-room|eco-stage/, "places must not nest inside the landing");
  assert.doesNotMatch(js, /E13_ARMS|EPS_BENCH|mountResearchExplainer|AudioContext/, "standalone engines must not be copied into the landing");
  assert.doesNotMatch(html, /<iframe|<audio/, "media and frames live on standalone pages");
});

test("the record derives from the places, not a parallel list", () => {
  assert.match(js, /PLACES\.map\(/, "RECORD must be built from PLACES");
  assert.doesNotMatch(html, /8 places:|Three angles|Five are open/, "status counts must not be hardcoded in HTML");
});

test("site styles obey the causal bans", () => {
  for (const [name, css] of [["site.css", siteCss], ["ecosystem.css", ecoCss]]) {
    assert.doesNotMatch(css, /\d(?:\.\d+)?px/, `${name} uses absolute units`);
    assert.doesNotMatch(css, /@media/, `${name} uses a breakpoint`);
    assert.doesNotMatch(css, /position:\s*(fixed|absolute|sticky)/, `${name} uses fixed geometry`);
  }
  assert.match(ecoCss, /aspect-ratio:\s*var\(--ar-w\)/, "field aspect comes from the projection");
  assert.match(js, /ResizeObserver/, "projection is observer-driven");
  assert.match(js, /BOUNDS = Object\.freeze/, "state bounds are stated once");
});

test("state channels are named and bounded", () => {
  for (const needle of ["TENSION_REST", "TENSION_JERK", "JERK_MAX", "SCROLL_MAX"]) {
    assert.match(js, new RegExp(needle), `${needle} bound is present`);
  }
  assert.match(js, /mixAestheticPresets\(PRESETS/, "style derives from barycentric weights");
  assert.match(js, /layoutCells\(items/, "packing is algorithmic");
});

test("every page is woven from one runtime and one thread of navigation", () => {
  const pages = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith(".html")) pages.push(p); } };
  walk(siteDir);
  assert.ok(pages.length >= 14, "expected the full site");
  for (const page of pages) {
    const rel = path.relative(repo, page);
    const text = fs.readFileSync(page, "utf8");
    assert.match(text, /<script src="[^"]*assets\/theme\.js"><\/script>/, `${rel} must load theme.js in <head>`);
    assert.match(text, /<script type="module" src="[^"]*assets\/loom\.js"><\/script>/, `${rel} must load the loom`);
    assert.match(text, /<nav class="weft-nav" aria-label="Main">/, `${rel} must use the shared thread nav`);
    for (const label of ["Philosophy", "Components", "Harmonic", "Source"]) assert.match(text, new RegExp(`>${label}</a>`), `${rel} nav lacks ${label}`);
    assert.match(text, /<footer class="coda">/, `${rel} must end with the shared coda`);
    assert.doesNotMatch(text, /class="(?:site-header|site-footer|hero|card|panel)\b/, `${rel} still uses the old boxed chrome`);
  }
  assert.doesNotMatch(siteCss, /Same visual family as ML Weft/, "shared theme no longer mirrors w3ft.org");
});

test("no page nests another page in a frame", () => {
  const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (p.endsWith(".html")) out.push(p); } return out; };
  for (const page of walk(siteDir)) {
    assert.doesNotMatch(fs.readFileSync(page, "utf8"), /<iframe|<frame|<object|<embed/i, `${path.relative(repo, page)} frames another page; rebuild it on the loom instead`);
  }
  for (const gone of ["explorer.html", "infographic.html"]) {
    assert.ok(!fs.existsSync(path.join(siteDir, "causal-harmonic", gone)), `causal-harmonic/${gone} was an iframe wrapper and should stay folded into the native pages`);
  }
});

test("the medium is the only fixed layer, and loom.js owns it", () => {
  const loom = fs.readFileSync(path.join(siteDir, "assets", "loom.js"), "utf8");
  assert.equal((loom.match(/position:\s*fixed/g) || []).length, 1, "exactly one fixed layer");
  assert.match(loom, /medium\.setAttribute\("aria-hidden", "true"\)/, "the medium is hidden from assistive technology");
  assert.match(loom, /pointer-events:none/, "the medium never takes a pointer event");
  assert.match(loom, /beforeprint/, "print shows every block");
  assert.match(loom, /reduced\(\)/, "unfolding respects reduced motion");
  const theme = fs.readFileSync(path.join(siteDir, "assets", "theme.js"), "utf8");
  assert.match(theme, /setTimeout\(/, "theme.js reveals the page if the loom never arrives");
});

test("recorded audio carries its non-commercial licence", () => {
  const licence = path.join(repo, "examples", "research", "causal-harmonic", "originals", "LICENSE.md");
  assert.ok(fs.existsSync(licence), "originals/LICENSE.md is missing");
  assert.match(fs.readFileSync(licence, "utf8"), /CC BY-NC 4\.0/);
  assert.match(fs.readFileSync(path.join(repo, "NOTICE"), "utf8"), /CC BY-NC 4\.0/);
});
