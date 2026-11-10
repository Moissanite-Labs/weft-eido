// Checks for the static site in site/: every module has a page, every local link resolves,
// and the condensed variants match the passages on the pages that use them.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCondensed } from "../src/condense.js";
import { parseHtml } from "./helpers/html-passages.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(repo, "site");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const files = walk(siteDir);
const htmlFiles = files.filter((f) => f.endsWith(".html"));

function resolvesToFile(from, ref) {
  const clean = ref.split("#")[0].split("?")[0];
  if (!clean) return true;
  const target = clean.startsWith("/") ? path.join(repo, clean) : path.resolve(path.dirname(from), clean);
  if (!target.startsWith(repo)) return false;
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return true;
  return fs.existsSync(target) && fs.statSync(target).isDirectory() && fs.existsSync(path.join(target, "index.html"));
}
const isExternal = (r) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(r);

test("every src module has a component page", () => {
  const modules = fs.readdirSync(path.join(repo, "src")).filter((f) => f.endsWith(".js")).map((f) => f.replace(/\.js$/, ""));
  assert.ok(modules.length >= 6, "expected the six modules");
  for (const m of modules) {
    assert.ok(fs.existsSync(path.join(siteDir, "components", `${m}.html`)), `site/components/${m}.html is missing`);
  }
  const index = fs.readFileSync(path.join(siteDir, "components", "index.html"), "utf8");
  for (const m of modules) assert.ok(index.includes(`href="${m}.html"`), `components/index.html does not link ${m}.html`);
});

test("every relative href and src in site/**/*.html resolves to a file", () => {
  const bad = [];
  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, "utf8");
    for (const m of html.matchAll(/\b(?:href|src)\s*=\s*"([^"]*)"/g)) {
      const ref = m[1];
      if (!ref || isExternal(ref)) continue;
      if (!resolvesToFile(f, ref)) bad.push(`${path.relative(repo, f)}: ${ref}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("module imports and fetches in site pages and scripts resolve", () => {
  const bad = [];
  for (const f of files.filter((x) => /\.(html|js)$/.test(x))) {
    const text = fs.readFileSync(f, "utf8");
    const refs = [...text.matchAll(/\bfrom\s+"(\.{1,2}\/[^"]+)"/g), ...text.matchAll(/\b(?:loadCondensed|import)\(\s*"(\.{1,2}\/[^"]+|[\w-]+\.json)"/g)].map((m) => m[1]);
    for (const ref of refs) if (!resolvesToFile(f, ref)) bad.push(`${path.relative(repo, f)}: ${ref}`);
  }
  assert.deepEqual(bad, []);
});

test("every page links the shared theme and loads without a missing asset", () => {
  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, "utf8");
    assert.match(html, /<title>[^<]+<\/title>/, `${f} needs a title`);
    assert.match(html, /<main id="main">/, `${f} needs a main landmark`);
    assert.match(html, /assets\/site\.css/, `${f} needs the site stylesheet`);
  }
});

function checkCondensed(jsonPath, htmlPath, headings) {
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const { passages, sections } = parseHtml(fs.readFileSync(htmlPath, "utf8"), { headings });
  assert.ok(passages.length > 0, "found no passages");
  const problems = validateCondensed(data, { against: { passages, sectionIds: sections.map((s) => s.id) }, strict: true });
  assert.deepEqual(problems, []);
  for (const p of passages) assert.ok(p.hash in data.blocks, `no variants for passage ${p.hash}: ${p.text.slice(0, 50)}`);
}

test("site/condensed.json matches every passage on philosophy.html", () => {
  const json = path.join(siteDir, "condensed.json");
  assert.ok(fs.existsSync(json), "site/condensed.json is missing");
  checkCondensed(json, path.join(siteDir, "philosophy.html"), ["h2", "h3"]);
});

test("links inside condensed variants resolve", () => {
  const json = path.join(siteDir, "condensed.json");
  const text = fs.readFileSync(json, "utf8");
  const bad = [];
  for (const m of text.matchAll(/href=\\"([^"\\]+)\\"/g)) {
    if (!isExternal(m[1]) && !resolvesToFile(path.join(siteDir, "philosophy.html"), m[1])) bad.push(m[1]);
  }
  assert.deepEqual(bad, []);
});

test("the demo data on the condense page is sound", () => {
  const json = path.join(siteDir, "assets", "condense-demo.json");
  const data = JSON.parse(fs.readFileSync(json, "utf8"));
  const { passages, sections } = parseHtml(fs.readFileSync(path.join(siteDir, "components", "condense.html"), "utf8"));
  const demoPassages = passages.filter((p) => p.section);
  const problems = validateCondensed(data, { against: { passages: demoPassages, sectionIds: sections.map((s) => s.id) } });
  assert.deepEqual(problems, []);
  for (const id of Object.keys(data.tldr)) assert.ok(sections.some((s) => s.id === id), `section ${id} is not in the demo article`);
});

test("the Pages workflow pins every action to a commit SHA", () => {
  const wf = fs.readFileSync(path.join(repo, ".github", "workflows", "pages.yml"), "utf8");
  const uses = [...wf.matchAll(/uses:\s*(\S+)\s*(#.*)?/g)];
  assert.ok(uses.length >= 4);
  for (const [, ref, comment] of uses) {
    assert.match(ref, /@[0-9a-f]{40}$/, `${ref} is not pinned to a full SHA`);
    assert.match(comment || "", /# v\d/, `${ref} needs a # vX.Y.Z comment`);
  }
});

test("pages that import a reading module also link its stylesheet", () => {
  const needs = { "reading-weave.js": "reading-weave.css", "condense.js": "condense.css" };
  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, "utf8");
    // Code shown on the page (inside <pre>) is an example, not something the page runs.
    const live = html.replace(/<pre[\s\S]*?<\/pre>/g, "");
    for (const [js, css] of Object.entries(needs)) {
      if (!new RegExp(`import[^;]*src/${js.replace(".", "\\.")}`).test(live)) continue;
      assert.match(live, new RegExp(`<link[^>]+href="[^"]*css/${css.replace(".", "\\.")}"`), `${path.relative(repo, f)} imports ${js} but does not link ${css}`);
    }
  }
});
