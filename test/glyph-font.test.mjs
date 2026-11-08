import assert from "node:assert/strict";
import test from "node:test";
import {
  CHARSET,
  GLYPH_COLS,
  GLYPH_ROWS,
  encodeFontTable,
  fontCode,
  glyphBit,
  packGlyph,
  packLabel,
} from "../src/glyph-font.js";

const A_ROWS = [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"];

test("a 5x7 glyph needs 35 bits, so it is packed into two u32 words (corpus single-u32 packing cannot work)", () => {
  assert.equal(GLYPH_COLS * GLYPH_ROWS, 35);
  const [lo, hi] = packGlyph(A_ROWS);
  assert.ok(lo < 2 ** 20 && hi < 2 ** 15);
});

test("packed glyphs decode back to the source bitmap", () => {
  const words = packGlyph(A_ROWS);
  for (let r = 0; r < 7; r++) {
    const row = Array.from({ length: 5 }, (_, c) => (glyphBit(words, c, r) ? "#" : ".")).join("");
    assert.equal(row, A_ROWS[r]);
  }
  assert.equal(glyphBit(words, -1, 0), 0);
  assert.equal(glyphBit(words, 5, 0), 0);
  assert.equal(glyphBit(words, 0, 7), 0);
});

test("every repository-name character has a non-empty glyph; distinct characters have distinct glyphs", () => {
  const table = encodeFontTable();
  const seen = new Map();
  for (const ch of CHARSET) {
    const code = ch.charCodeAt(0);
    const key = `${table[code * 2]}:${table[code * 2 + 1]}`;
    if (ch !== " ") assert.notEqual(key, "0:0", `glyph for ${JSON.stringify(ch)} is empty`);
    assert.ok(!seen.has(key), `${JSON.stringify(ch)} duplicates ${JSON.stringify(seen.get(key))}`);
    seen.set(key, ch);
  }
  for (const name of ["compass", "banu-musa", "moissanite-HQ", "mulla-sadra", "SYM-2P"]) {
    for (const ch of name) assert.notEqual(fontCode(ch), 63, `${ch} in ${name}`);
  }
});

test("labels pack four ASCII codes per u32, little-endian, uppercased", () => {
  const { words, length } = packLabel("aywa-2");
  assert.equal(length, 6);
  const codes = [];
  for (let k = 0; k < length; k++) codes.push((words[k >> 2] >>> (8 * (k & 3))) & 255);
  assert.equal(String.fromCharCode(...codes), "AYWA-2");
  assert.equal(packLabel("x".repeat(40)).length, 16);
});
