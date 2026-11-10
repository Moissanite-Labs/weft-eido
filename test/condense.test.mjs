import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  THRESHOLDS, hashText, keepers, meterFill, nextLevel, normalizeText, shouldWander, skeleton, validateCondensed, wordKey,
} from "../src/condense.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const data = JSON.parse(read("./fixtures/overview-condensed.json"));

// The passages of the overview article, as plain text: tags stripped, entities decoded.
// Paragraphs and list items that contain MathML are skipped (their text content needs a DOM).
const decode = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
function overviewPassages() {
  const html = read("../examples/condense/index.html");
  const article = html.slice(html.indexOf("<article"), html.indexOf("</article>"));
  const out = [];
  for (const [, body] of article.matchAll(/<(?:p|li)[^>]*>((?:(?!<\/(?:p|li)>)[\s\S])*)<\/(?:p|li)>/g)) {
    if (/<math|<table|<li|<p/.test(body)) continue;
    const text = decode(body.replace(/<[^>]+>/g, ""));
    out.push(text);
  }
  return out;
}

test("normalizeText collapses whitespace and trims", () => {
  assert.equal(normalizeText("  a \n\t b   c "), "a b c");
  assert.equal(normalizeText(""), "");
});

test("hashText is FNV-1a 32-bit of the normalised text", () => {
  assert.equal(hashText(""), "811c9dc5");
  assert.equal(hashText("a"), "e40c292c");
  assert.equal(hashText("foobar"), "bf9cf968");
  assert.equal(hashText("  foo \n bar "), hashText("foo bar"));
  assert.match(hashText("x"), /^[0-9a-f]{8}$/);
});

test("hashText reproduces the hashes in Weft's overview condensed.json", () => {
  const abstract =
    "ML Weft is an open research program from Moissanite Labs. It studies models that keep adapting after deployment, under limits that a program can verify. " +
    "It treats each model as a cell: a bounded piece of memory with a frozen core, a resource budget, and a rule that commits a change only if the change stays within a measured distance of a saved baseline. " +
    "Around that core idea, Weft builds compact verifiable formats (hashed message packets and a serialised graph language with committed execution records) and a design language, Eido, for interfaces that show live state honestly. " +
    "Further out, it asks how such systems could run on purpose-built hardware and how people could govern them. " +
    "This paper describes the whole program and is strict about evidence: it labels every component as running and tested, simulated, or design only. " +
    "It also explains what Weft is not. It is not a product, it has no token, and its biological vocabulary describes aims, not achievements. " +
    "Companion papers cover each part in depth: Paper 1, Models as Cells, and Paper 2, Checkable Computation, are published alongside this one.";
  assert.equal(hashText(abstract), "8c6dcb82");
  const problem1 =
    "Machine-learning models are mostly built once and then frozen. When they change, it is through a retraining or fine-tuning run that someone starts, watches and accepts. " +
    "That has worked because change was rare and deliberate. It works less well as models move onto personal devices, adapt to individual users, and act as agents in long-running systems. " +
    "These are settings where small, continual changes are useful, and nobody is watching each one.";
  assert.equal(hashText(problem1), "629e3fdd");
});

test("most passages of the article hash to keys in the data", () => {
  const texts = overviewPassages();
  const hits = texts.filter((t) => hashText(t) in data.blocks);
  assert.ok(texts.length > 30, `found ${texts.length} passages`);
  assert.ok(hits.length >= texts.length - 12, `${hits.length} of ${texts.length} matched`);
  assert.ok(hits.length >= 25);
});

test("keepers: the longest common subsequence of word keys", () => {
  const [ka, kb] = keepers(["a", "b", "c", "d"], ["a", "c", "x", "d"]);
  assert.deepEqual([...ka], [0, 2, 3]);
  assert.deepEqual([...kb], [0, 1, 3]);
  const [ea, eb] = keepers([], ["a"]);
  assert.equal(ea.size + eb.size, 0);
  const [sa, sb] = keepers(["x", "y"], ["x", "y"]);
  assert.equal(sa.size, 2);
  assert.equal(sb.size, 2);
  // Disjoint words keep nothing.
  assert.equal(keepers(["a"], ["b"])[0].size, 0);
});

test("wordKey ignores case and punctuation but keeps punctuation-only words", () => {
  assert.equal(wordKey("Model,"), "model");
  assert.equal(wordKey(" Don’t "), "dont");
  assert.equal(wordKey("→"), "→");
  assert.equal(wordKey("≈ "), "≈");
});

test("nextLevel: the ratchet squeezes one level when the score reaches the step", () => {
  const { STEP_AT, STEP_GAP } = THRESHOLDS;
  assert.equal(nextLevel(STEP_AT[0] - 0.01, 0, Infinity), null);
  assert.equal(nextLevel(STEP_AT[0], 0, Infinity), 1);
  assert.equal(nextLevel(STEP_AT[1], 1, Infinity), 2);
  assert.equal(nextLevel(STEP_AT[2], 2, Infinity), 3);
  assert.equal(nextLevel(STEP_AT[3], 3, Infinity), 4);
  assert.equal(nextLevel(1, 3, STEP_GAP + 1), 4);
});

test("nextLevel: one squeeze at a time, never past TL;DR, never without sections to fold", () => {
  const { STEP_GAP } = THRESHOLDS;
  assert.equal(nextLevel(1, 0, STEP_GAP), null, "too soon after the last squeeze");
  assert.equal(nextLevel(1, 0, 0), null);
  assert.equal(nextLevel(1, 4, Infinity), null, "ELI5 is reached only by its button");
  assert.equal(nextLevel(1, 5, Infinity), null);
  assert.equal(nextLevel(1, 3, Infinity, { canFold: false }), null, "no sections: stop at caveman");
  assert.equal(nextLevel(1, 2, Infinity, { canFold: false }), 3);
});

test("shouldWander: only at TL;DR and only while still skimming", () => {
  const { WANDER_AT } = THRESHOLDS;
  assert.equal(shouldWander(WANDER_AT, 4), true);
  assert.equal(shouldWander(WANDER_AT - 0.01, 4), false);
  assert.equal(shouldWander(1, 3), false);
  assert.equal(shouldWander(1, 5), false);
});

test("meterFill rises toward the next squeeze and toward the wandering button", () => {
  const { STEP_AT, SPENT, WANDER_AT } = THRESHOLDS;
  assert.equal(meterFill(0, 0), 0);
  assert.equal(meterFill(STEP_AT[0] / 2, 0), 0.5);
  assert.equal(meterFill(1, 0), 1);
  assert.equal(meterFill(SPENT, 1), 0);
  assert.ok(Math.abs(meterFill((SPENT + STEP_AT[1]) / 2, 1) - 0.5) < 1e-9);
  assert.equal(meterFill(SPENT, 4), 0);
  assert.equal(meterFill(WANDER_AT, 4), 1);
  assert.equal(meterFill(0, 4, { wandering: true }), 1);
  assert.equal(meterFill(0.9, 1, { off: true }), 0);
  assert.equal(meterFill(0, 5), 1);
  assert.equal(meterFill(0, 3, { canFold: false }), 1);
});

test("validateCondensed accepts the real overview data, strictly", () => {
  assert.deepEqual(validateCondensed(data), []);
  assert.deepEqual(validateCondensed(data, { strict: true }), []);
});

test("validateCondensed reports structural problems", () => {
  assert.deepEqual(validateCondensed(null), ["condensed data must be a JSON object"]);
  assert.ok(validateCondensed({}).some((p) => p.startsWith("blocks must be")));
  const bad = {
    version: 2,
    blocks: { nothex: ["a", "b", "c"], "8c6dcb82": ["a", "b"], "629e3fdd": ["a", "", "<script>x</script>"] },
    headings: { s1: ["1", "2", "3"], s2: ["1", "2", "3", "4", "5"] },
    tldr: { s2: "short" },
    eli5: {},
  };
  const problems = validateCondensed(bad);
  const has = (s) => assert.ok(problems.some((p) => p.includes(s)), `expected a problem mentioning "${s}" in:\n${problems.join("\n")}`);
  has("version must be 1");
  has("blocks.nothex: key must be eight lowercase hex digits");
  has("blocks.8c6dcb82: must be an array of 3 strings");
  has("blocks.629e3fdd[1] (Terse): is empty");
  has("blocks.629e3fdd[2] (Caveman): contains a script");
  has("headings.s1: must be an array of 5 strings");
  has("section s2: has headings, tldr but needs headings, tldr and eli5 to fold");
});

test("validateCondensed strict mode enforces the writing limits", () => {
  const long = Array.from({ length: 16 }, (_, i) => `w${i}`).join(" ");
  const d = { blocks: {}, headings: { s: ["a", "b", "c", "d", "e"] }, tldr: { s: long }, eli5: { s: `${long} ${long} ${long}` } };
  assert.deepEqual(validateCondensed(d), []);
  const strict = validateCondensed(d, { strict: true });
  assert.ok(strict.some((p) => p.startsWith("tldr.s: 16 words")));
  assert.ok(strict.some((p) => p.startsWith("eli5.s: 48 words")));
});

test("validateCondensed checks the data against the page", () => {
  const passages = [
    { hash: "629e3fdd", text: "one two three four five six" },
    { hash: "aaaaaaaa", text: "alpha beta gamma delta" },
  ];
  const d = { blocks: { "629e3fdd": ["one two three four five six seven", "one two", "one"], bbbbbbbb: ["a", "b", "c"] }, headings: {}, tldr: {}, eli5: {} };
  const loose = validateCondensed(d, { against: { passages, sectionIds: [] } });
  assert.deepEqual(loose, ["blocks.bbbbbbbb: no passage on the page has this hash (text edited since?)"]);
  const strict = validateCondensed(d, { against: { passages, sectionIds: [] }, strict: true });
  assert.ok(strict.some((p) => p.includes("passage aaaaaaaa: no variants")));
  assert.ok(strict.some((p) => p.includes("Concise (7 words) is longer than Full prose (6 words)")));
});

test("skeleton has an empty slot for every passage and section, and validates as unfinished", () => {
  const sk = skeleton([{ hash: "629e3fdd", text: "Some text here." }], [{ id: "intro", title: "Introduction" }]);
  assert.equal(sk.version, 1);
  assert.deepEqual(sk.blocks["629e3fdd"], ["", "", ""]);
  assert.deepEqual(sk.headings.intro, ["", "", "", "", ""]);
  assert.equal(sk.tldr.intro, "");
  assert.equal(sk.eli5.intro, "");
  assert.equal(sk.source.blocks["629e3fdd"], "Some text here.");
  assert.equal(sk.source.sections.intro, "Introduction");
  assert.ok(validateCondensed(sk).length > 0, "empty slots are problems until filled");
  assert.equal("source" in skeleton([], [], { source: false }), false);
  // Filled in, it passes.
  sk.blocks["629e3fdd"] = ["a b c d", "a b", "a"];
  sk.headings.intro = ["Intro", "Intro", "Start", "Start", "Start?"];
  sk.tldr.intro = "A short line.";
  sk.eli5.intro = "A simple line.";
  assert.deepEqual(validateCondensed(sk), []);
});

test("importing the module touches no browser globals", async () => {
  assert.equal(typeof window, "undefined");
  assert.equal(typeof document, "undefined");
});
