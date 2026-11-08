/**
 * 5x7 bitmask font for GPU-drawn text (Eido; Moissanite-Labs/weft#37).
 *
 * `weft-corpus:weft/design/feeed.md` proposes drawing metrics inside the fragment shader
 * from integer bitmasks instead of font files. Its version packs a 5x7 glyph
 * into one u32 and reads `mask >> (34u - bit)`, which cannot work: 35 bits do
 * not fit in 32. Here each glyph is two u32 words:
 *
 *   bit index b = row * 5 + col      (row 0 = top, col 0 = left)
 *   word 0 (lo) holds b = 0..19      (rows 0..3) at bit position b
 *   word 1 (hi) holds b = 20..34     (rows 4..6) at bit position b - 20
 *
 * The same table is uploaded to the GPU (`encodeFontTable`) and used by the
 * Canvas2D fallback, so both renderers draw identical letters.
 */

export const GLYPH_COLS = 5;
export const GLYPH_ROWS = 7;
/** Horizontal advance in glyph pixels (5 columns + 1 column of spacing). */
export const GLYPH_ADVANCE = 6;

// prettier-ignore
const GLYPHS = {
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  0: [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  1: ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  2: [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  3: ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
  4: ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  5: ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  6: ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  7: ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  9: [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  "/": [".....", "....#", "...#.", "..#..", ".#...", "#....", "....."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  _: [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
  "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
  "%": ["##...", "##..#", "...#.", "..#..", ".#...", "#..##", "...##"],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
};

/** Characters the font can draw (lowercase is drawn as uppercase). */
export const CHARSET = Object.keys(GLYPHS).join("");

/** Pack one glyph (7 strings of 5 '#'/'.' cells) into [lo, hi] u32 words. */
export function packGlyph(rows) {
  if (!Array.isArray(rows) || rows.length !== GLYPH_ROWS) throw new Error("glyph needs 7 rows");
  let lo = 0;
  let hi = 0;
  for (let r = 0; r < GLYPH_ROWS; r++) {
    if (rows[r].length !== GLYPH_COLS) throw new Error(`glyph row ${r} needs 5 columns`);
    for (let c = 0; c < GLYPH_COLS; c++) {
      if (rows[r][c] !== "#") continue;
      const b = r * GLYPH_COLS + c;
      if (b < 20) lo |= 1 << b;
      else hi |= 1 << (b - 20);
    }
  }
  return [lo >>> 0, hi >>> 0];
}

/** Read one glyph pixel back from packed words (mirrors `glyphBit` in the shader). */
export function glyphBit(words, col, row) {
  if (col < 0 || col >= GLYPH_COLS || row < 0 || row >= GLYPH_ROWS) return 0;
  const b = row * GLYPH_COLS + col;
  const w = b < 20 ? words[0] : words[1];
  return (w >>> (b % 20)) & 1;
}

/** Map any character to the ASCII code the font draws ('?' for unknown). */
export function fontCode(ch) {
  const up = String(ch).toUpperCase();
  return Object.prototype.hasOwnProperty.call(GLYPHS, up) ? up.charCodeAt(0) : 63;
}

/** 128-entry table of [lo, hi] words indexed by ASCII code, ready for a storage buffer. */
export function encodeFontTable() {
  const table = new Uint32Array(128 * 2);
  for (const [ch, rows] of Object.entries(GLYPHS)) {
    const [lo, hi] = packGlyph(rows);
    const code = ch.charCodeAt(0);
    table[code * 2] = lo;
    table[code * 2 + 1] = hi;
  }
  return table;
}

/** Pack up to 16 characters, 4 per u32, little-endian bytes (char k -> word k>>2, byte k&3). */
export function packLabel(text, maxChars = 16) {
  const out = new Uint32Array(Math.ceil(maxChars / 4));
  const s = String(text).slice(0, maxChars);
  for (let k = 0; k < s.length; k++) {
    out[k >> 2] |= fontCode(s[k]) << (8 * (k & 3));
  }
  return { words: out, length: s.length };
}
