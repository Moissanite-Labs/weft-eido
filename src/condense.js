/**
 * Condensing prose (Eido module D2, reading).
 *
 * On a long page, skimming squeezes the writing. The reading score from
 * `reading-weave.js` decides; this module only acts on it. Read at a steady pace
 * and the page stays as written. Skim and the prose condenses, one level at a
 * time: concise prose, terse notes, caveman, and finally one line per section
 * (TL;DR). Only passages the reader has not read condense, so the page ends up
 * a map of how it was read. A floating ELI5 button offers a simple explanation
 * when skimming continues at TL;DR.
 *
 * It never loosens by itself. The reader brings the words back from the panel.
 * Condensed passages end with a ≈ marker, and pressing and holding one shows it
 * as written. Every level is written ahead of time (`condensed.json` beside the
 * page), so condensing is editing, not generation, and the full text stays the
 * one that counts: printing always prints it.
 *
 * Pure functions (hashing, word diff, the ratchet decision, validation,
 * skeletons) are exported and tested in Node. The DOM code runs only when
 * `setupCondense` is called, so importing this file touches no globals.
 */

/** Names of the levels, in order. Level 5 (ELI5) is reached only by its button or the panel. */
export const LEVELS = ["Full prose", "Concise", "Terse", "Caveman", "TL;DR", "ELI5"];
const SHORT = ["Full", "Concise", "Terse", "Caveman", "TL;DR", "ELI5"];
const TLDR = 4;
const ELI5 = 5;

/**
 * Ratchet thresholds. `STEP_AT[level]` is the restlessness at which the next squeeze
 * happens. Each squeeze spends the pressure that caused it, down to `SPENT`, so every
 * level is earned by more skimming. `WANDER_AT` is the pressure at which, still skimming
 * at TL;DR, the ELI5 button comes looking. `STEP_GAP` (ms) allows one squeeze at a time.
 */
export const THRESHOLDS = Object.freeze({
  STEP_AT: Object.freeze([0.3, 0.5, 0.5, 0.55]),
  SPENT: 0.2,
  WANDER_AT: 0.4,
  STEP_GAP: 1500,
});
const { STEP_AT, SPENT, WANDER_AT, STEP_GAP } = THRESHOLDS;
const PEEK_HOLD = 350; // ms
const WPM = 230;
const ELI5_TIP = "I still don’t get it, please explain wewwy simple";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* ---------------------------------------------------------------- pure */

/** Collapse runs of whitespace to one space and trim: what is hashed. */
export function normalizeText(s) {
  return String(s).replace(/\s+/g, " ").trim();
}

/**
 * FNV-1a, 32 bits, of the whitespace-normalised text, as eight lowercase hex digits.
 * Hashing is over UTF-16 code units, so it matches `String.prototype.charCodeAt`.
 */
export function hashText(s) {
  const t = normalizeText(s);
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Count whitespace-separated words in plain text. */
export function countWords(text) {
  return (String(text).match(/\S+/g) || []).length;
}

/**
 * The key two words are compared by: lower case, punctuation dropped. A word that is all
 * punctuation keeps its own text so it can still match itself.
 */
export function wordKey(word) {
  const t = String(word).trim().toLowerCase();
  return t.replace(/[^\p{L}\p{N}]/gu, "") || t;
}

/**
 * Longest common subsequence of two word-key arrays. Returns [keptInA, keptInB], two Sets of
 * indices. These words stay put while the rest are struck out or written in.
 */
export function keepers(a, b) {
  const n = a.length, m = b.length, w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i * w + j] = a[i] === b[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
  const ka = new Set(), kb = new Set();
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[i] === b[j]) { ka.add(i++); kb.add(j++); }
    else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) i++;
    else j++;
  }
  return [ka, kb];
}

/**
 * The squeeze decision. Given the reading score (restlessness, 0 to 1), the current level and
 * the time since the last squeeze, return the level to squeeze to, or null to stay. Squeezing
 * is automatic only up to Concise, Terse and Caveman, and on to TL;DR when the page has
 * sections to fold (`canFold`). ELI5 is never reached this way.
 */
export function nextLevel(restless, level, sinceMs = Infinity, { canFold = true } = {}) {
  const max = canFold ? TLDR : 3;
  if (level < max && restless >= STEP_AT[level] && sinceMs > STEP_GAP) return level + 1;
  return null;
}

/** True when the floating ELI5 button should come looking: still skimming at TL;DR. */
export function shouldWander(restless, level) {
  return level === TLDR && restless >= WANDER_AT;
}

/**
 * How full the panel meter is, 0 to 1: progress toward the next squeeze, or at TL;DR toward the
 * ELI5 button coming to find you.
 */
export function meterFill(restless, level, { canFold = true, off = false, wandering = false, eli5 = true } = {}) {
  if (off) return 0;
  if (level < 3 || (canFold && level < TLDR)) {
    const base = level ? SPENT : 0;
    return clamp((restless - base) / (STEP_AT[level] - base), 0, 1);
  }
  if (level === TLDR && eli5) return wandering ? 1 : clamp((restless - SPENT) / (WANDER_AT - SPENT), 0, 1);
  return 1;
}

const HEX8 = /^[0-9a-f]{8}$/;
const UNSAFE = /<\s*(script|iframe|object|embed)\b|\son[a-z]+\s*=|javascript:/i;
const plain = (html) => String(html).replace(/<[^>]*>/g, "");

/**
 * Check a parsed `condensed.json`. Returns a list of problems, empty when it is sound.
 * Options: `against` is `{ passages: [{hash, text}], sectionIds: [string] }` from the page
 * (see `extractPassages`); stale keys are reported, and with `strict` so are missing ones and
 * the writing rules (each level shorter than the one before; TL;DR at most 15 words,
 * ELI5 at most 40).
 */
export function validateCondensed(data, { against = null, strict = false } = {}) {
  const out = [];
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  if (!isObj(data)) return ["condensed data must be a JSON object"];
  if (data.version !== undefined && data.version !== 1) out.push(`version must be 1 (got ${JSON.stringify(data.version)})`);
  if (data.levels !== undefined && !(Array.isArray(data.levels) && data.levels.every((x) => typeof x === "string")))
    out.push("levels, when present, must be an array of strings");
  const text = (where, v) => {
    if (typeof v !== "string") return out.push(`${where}: must be a string`);
    if (!v.trim()) return out.push(`${where}: is empty`);
    if (UNSAFE.test(v)) out.push(`${where}: contains a script, an event handler or a javascript: URL`);
  };

  if (!isObj(data.blocks)) out.push("blocks must be an object keyed by passage hash");
  else {
    for (const [hash, v] of Object.entries(data.blocks)) {
      if (!HEX8.test(hash)) out.push(`blocks.${hash}: key must be eight lowercase hex digits`);
      if (!Array.isArray(v) || v.length !== 3) out.push(`blocks.${hash}: must be an array of 3 strings (Concise, Terse, Caveman)`);
      else v.forEach((s, i) => text(`blocks.${hash}[${i}] (${LEVELS[i + 1]})`, s));
    }
  }
  for (const key of ["headings", "tldr", "eli5"]) {
    if (data[key] !== undefined && !isObj(data[key])) out.push(`${key} must be an object keyed by section id`);
  }
  const heads = isObj(data.headings) ? data.headings : {};
  const tldr = isObj(data.tldr) ? data.tldr : {};
  const eli5 = isObj(data.eli5) ? data.eli5 : {};
  for (const [id, v] of Object.entries(heads)) {
    if (!Array.isArray(v) || v.length !== 5) out.push(`headings.${id}: must be an array of 5 strings (levels 1 to 5)`);
    else v.forEach((s, i) => text(`headings.${id}[${i}] (${LEVELS[i + 1]})`, s));
  }
  for (const [id, v] of Object.entries(tldr)) text(`tldr.${id}`, v);
  for (const [id, v] of Object.entries(eli5)) text(`eli5.${id}`, v);
  for (const id of new Set([...Object.keys(heads), ...Object.keys(tldr), ...Object.keys(eli5)])) {
    const have = [["headings", heads], ["tldr", tldr], ["eli5", eli5]].filter(([, o]) => id in o).map(([k]) => k);
    if (have.length < 3) out.push(`section ${id}: has ${have.join(", ")} but needs headings, tldr and eli5 to fold`);
  }

  if (strict) {
    for (const [id, v] of Object.entries(tldr))
      if (typeof v === "string" && countWords(plain(v)) > 15) out.push(`tldr.${id}: ${countWords(plain(v))} words, the limit is 15`);
    for (const [id, v] of Object.entries(eli5))
      if (typeof v === "string" && countWords(plain(v)) > 40) out.push(`eli5.${id}: ${countWords(plain(v))} words, the limit is 40`);
  }
  if (against) {
    const passages = new Map((against.passages || []).map((p) => [p.hash, p]));
    const ids = new Set(against.sectionIds || []);
    if (isObj(data.blocks)) {
      for (const hash of Object.keys(data.blocks)) {
        if (!passages.has(hash)) out.push(`blocks.${hash}: no passage on the page has this hash (text edited since?)`);
      }
      if (strict) {
        for (const hash of passages.keys()) if (!(hash in data.blocks)) out.push(`passage ${hash}: no variants (it will stay as written)`);
        for (const [hash, v] of Object.entries(data.blocks)) {
          const p = passages.get(hash);
          if (!p || !Array.isArray(v) || v.length !== 3) continue;
          const counts = [countWords(p.text), ...v.map((s) => countWords(plain(s)))];
          for (let i = 1; i < 4; i++)
            if (counts[i] > counts[i - 1]) out.push(`blocks.${hash}: ${LEVELS[i]} (${counts[i]} words) is longer than ${LEVELS[i - 1]} (${counts[i - 1]} words)`);
        }
      }
    }
    for (const id of new Set([...Object.keys(heads), ...Object.keys(tldr), ...Object.keys(eli5)])) {
      if (!ids.has(id)) out.push(`section ${id}: no section on the page has this id`);
    }
    if (strict) for (const id of ids) if (!(id in tldr)) out.push(`section ${id}: no summary (it will not fold)`);
  }
  return out;
}

/**
 * Build a `condensed.json` skeleton with empty variant slots, ready to fill in.
 * `passages` are `{hash, text}` (from `extractPassages`); `sections` are `{id, title}`
 * (from `extractSections`). With `source` (default true) a `source` object carries each
 * passage's text and each section's title so a writer or an LLM can see what to condense.
 * The runtime ignores `source`; delete it before publishing if size matters.
 */
export function skeleton(passages, sections = [], { source = true } = {}) {
  const data = { version: 1, levels: LEVELS.slice(0, 4), blocks: {}, headings: {}, tldr: {}, eli5: {} };
  const src = { blocks: {}, sections: {} };
  for (const p of passages) {
    data.blocks[p.hash] = ["", "", ""];
    src.blocks[p.hash] = p.text;
  }
  for (const s of sections) {
    data.headings[s.id] = ["", "", "", "", ""];
    data.tldr[s.id] = "";
    data.eli5[s.id] = "";
    src.sections[s.id] = s.title;
  }
  if (source) data.source = src;
  return data;
}

/* ------------------------------------------------------------ DOM helpers */

const DEFAULT_BLOCKS = "main :is(p, li)";
// Never condensed: code, figures, tables, forms and navigation. Matches reading-weave.js.
const DEFAULT_SKIP = "pre, code, button, label, form, figure, table, nav, aside, [data-eido-skip]";
// Added by this module itself; never passages.
const OWN = ".cx-sum, .cx-peek, .cx-ui, .cx-eli5-slot, .cx-eli5-float";
const defaultSectionId = (el) => el.id || (el.classList.contains("abstract") ? "abstract" : "");

/**
 * The passages the module would condense in `root`, with their hash and normalised text.
 * Same rule as the reading score: the elements matching `blocks`, outside `skip`, with no
 * paragraph or list item inside them, and at least `minWords` words. Run it on a page that
 * has not been condensed (no `condensed.json` yet, or at level 0), because the hash is of the
 * text as it stands. Returns `[{ el, hash, text, words, section }]`.
 */
export function extractPassages(root = document, { blocks = DEFAULT_BLOCKS, skip = DEFAULT_SKIP, minWords = 4, article = "article.paper", sections = "section", sectionId = defaultSectionId } = {}) {
  const els = typeof blocks === "string" ? [...root.querySelectorAll(blocks)] : [...blocks];
  return els
    .filter((el) => !(skip && el.closest(skip)) && !el.closest(OWN) && !el.querySelector("p, li"))
    .map((el) => {
      const text = normalizeText(el.textContent);
      const sec = article ? el.closest(`${article} ${sections}`) : el.closest(sections);
      return { el, hash: hashText(text), text, words: countWords(text), section: sec ? sectionId(sec) || null : null };
    })
    .filter((p) => p.words >= minWords);
}

/** The sections that can fold: `[{ el, id, title }]`, for `skeleton`. Same options as `setupCondense`. */
export function extractSections(root = document, { article = "article.paper", sections = "section", heading = ":scope > h2", sectionId = defaultSectionId } = {}) {
  const sel = article ? `${article} ${sections}` : sections;
  return [...root.querySelectorAll(sel)]
    .map((el) => {
      const h = el.querySelector(heading);
      const id = sectionId(el);
      return h && id ? { el, id, title: normalizeText(h.textContent) } : null;
    })
    .filter(Boolean);
}

/**
 * Fetch and parse `condensed.json`. `source` is a URL (default: `condensed.json` beside the page)
 * or a `<script type="application/json">` element holding the data, which avoids a request
 * altogether. Resolves to null when there is nothing usable. A browser still logs a failed
 * request itself, so a page that may lack the file can inline it instead. With
 * `optional: false` the promise rejects instead of resolving to null.
 */
export async function loadCondensed(source, { optional = true } = {}) {
  try {
    let data;
    if (source && typeof source === "object" && "textContent" in source) data = JSON.parse(source.textContent);
    else {
      const r = await fetch(source ?? new URL("condensed.json", location.href));
      if (!r.ok) throw new Error(`condensed data: ${r.status} ${r.statusText}`);
      data = await r.json();
    }
    if (!data || typeof data.blocks !== "object") throw new Error("condensed data has no blocks");
    return data;
  } catch (err) {
    if (optional) return null;
    throw err;
  }
}

/* -------------------------------------------------------------------- DOM */

/**
 * Start condensing. `data` is the parsed `condensed.json`; `reading` is the handle from
 * `setupReadingWeave({ motion: false, panel: false })`. Returns `{ level, setLevel(n), reset(),
 * destroy() }`, or null when no passage on the page has variants.
 *
 * Options (defaults in brackets):
 * - `root` [document]: where to look for the article and its sections.
 * - `article` ["article.paper"]: selector for the article; its sections can fold. "" for the whole root.
 * - `sections` ["section"]: selector for foldable sections, inside `article`.
 * - `heading` [":scope > h2"]: selector for a section's heading, inside the section.
 * - `sectionId` [id, or "abstract" for class abstract]: function from a section element to its key in the data.
 * - `panel` [true]: true mounts the panel fixed bottom right; false mounts none; an Element mounts it
 *   inside that element, absolutely positioned (give the element `position: relative`).
 * - `storage` ["eido-condense"]: key prefix for what is kept in localStorage, per pathname; false keeps nothing.
 * - `eli5` [true]: false drops level 5, its buttons and the wandering button.
 * - `params` [true]: true reads `?condense=N` (open at a level) and `?attn` (debug numbers) from the URL;
 *   pass a URLSearchParams to use your own, or false to ignore the URL.
 * - `header` [".site-header"]: selector for a fixed header the module keeps content clear of.
 * - `scroller` [window]: the scrolling element, if the page does not scroll the window.
 * - `noun` ["paper"]: what the panel calls the page ("this paper notices how you read it").
 */
export function setupCondense(data, reading, options = {}) {
  if (typeof document === "undefined" || !data || typeof data.blocks !== "object" || !reading?.blocks) return null;
  const {
    root = document,
    article = "article.paper",
    sections: sectionSel = "section",
    heading = ":scope > h2",
    sectionId = defaultSectionId,
    panel: panelOpt = true,
    storage = "eido-condense",
    eli5: withEli5 = true,
    params: paramsOpt = true,
    header: headerSel = ".site-header",
    scroller = null,
    noun = "paper",
  } = options;

  const ac = new AbortController();
  const on = (target, type, fn, opts) => target.addEventListener(type, fn, { ...opts, signal: ac.signal });
  const store = {
    get: (k) => { if (storage === false) return null; try { return localStorage.getItem(`${storage}${k}`); } catch { return null; } },
    set: (k, v) => { if (storage === false) return; try { v === null ? localStorage.removeItem(`${storage}${k}`) : localStorage.setItem(`${storage}${k}`, v); } catch { /* not kept */ } },
  };
  const htmlCount = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html;
    return countWords(t.content.textContent);
  };

  /* ---------- What can change ---------- */
  // Passages: four versions each (full, concise, terse, caveman), and their own level.
  const passages = reading.blocks
    .map((el) => {
      const hash = hashText(el.textContent);
      const v = data.blocks[hash];
      if (!Array.isArray(v) || v.length !== 3) return null;
      const html = [el.innerHTML, ...v];
      return { el, hash, html, words: html.map(htmlCount), shown: 0, lv: 0, timers: [], passage: true };
    })
    .filter(Boolean);
  if (!passages.length) return null;
  const byEl = new Map(passages.map((p) => [p.el, p]));

  // Sections: a heading that condenses with the page, and a summary line (TL;DR, then ELI5).
  const scope = article ? [...root.querySelectorAll(article)].flatMap((a) => [...a.querySelectorAll(sectionSel)]) : [...root.querySelectorAll(sectionSel)];
  const sections = scope
    .map((el) => {
      const id = sectionId(el);
      const h = el.querySelector(heading);
      const heads = data.headings?.[id], tldr = data.tldr?.[id], eli5 = data.eli5?.[id];
      if (!id || !h || !Array.isArray(heads) || heads.length !== 5 || !tldr || (withEli5 && !eli5)) return null;
      const sum = document.createElement("p");
      sum.className = "cx-sum";
      sum.innerHTML = tldr;
      h.after(sum);
      el.classList.add("cx-section");
      h.classList.add("cx-head");
      const html = withEli5 ? [tldr, eli5] : [tldr];
      return {
        el, id,
        head: { el: h, html: [h.innerHTML, ...heads], shown: 0, timers: [] },
        sum: { el: sum, html, words: html.map(htmlCount), shown: 0, timers: [] },
      };
    })
    .filter(Boolean);
  const canFold = sections.length > 0;
  const top = canFold ? (withEli5 ? ELI5 : TLDR) : 3;

  const eli5Button = (cls) => `<span class="cx-eli5-wrap"><button type="button" class="${cls}" aria-describedby="${cls}-tip">ELI5</button><span class="cx-eli5-tip" id="${cls}-tip" role="tooltip">${ELI5_TIP}</span></span>`;
  // The ELI5 button at the end of the TL;DR version.
  let eliSlot = null;
  if (canFold && withEli5) {
    eliSlot = document.createElement("div");
    eliSlot.className = "cx-eli5-slot";
    eliSlot.innerHTML = eli5Button("cx-eli5");
    sections[sections.length - 1].el.after(eliSlot);
  }

  /* ---------- State ---------- */
  const params = paramsOpt === false ? new URLSearchParams() : paramsOpt instanceof URLSearchParams ? paramsOpt : new URLSearchParams(location.search);
  const debug = params.has("attn");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const key = `:${location.pathname}`;
  let level = 0;
  try {
    const saved = JSON.parse(store.get(key) ?? "null");
    if (typeof saved === "number") level = saved;
    else if (saved) {
      level = saved.level | 0;
      passages.forEach((p) => (p.lv = clamp(saved.lv?.[p.hash] | 0, 0, 3)));
    }
  } catch { /* start fresh */ }
  if (paramsOpt !== false && params.has("condense")) {
    level = parseInt(params.get("condense"), 10) || 0;
    passages.forEach((p) => (p.lv = clamp(level, 0, 3)));
  }
  level = clamp(level, 0, top);
  let off = store.get("-off") === "1";
  let printing = false, lastStep = -Infinity, destroyed = false;

  const save = () => {
    const lv = {};
    passages.forEach((p) => { if (p.lv) lv[p.hash] = p.lv; });
    store.set(key, level || Object.keys(lv).length ? JSON.stringify({ level, lv }) : null);
  };
  // What the page shows right now: the full text when off or printing.
  const view = () => (off || printing ? 0 : level);
  const passageView = (p) => (off || printing ? 0 : p.lv);

  /* ---------- Geometry ---------- */
  const headerBottom = () => {
    const h = headerSel ? document.querySelector(headerSel) : null;
    const s = scroller ? scroller.getBoundingClientRect().top : 0;
    return Math.max(h ? h.getBoundingClientRect().bottom : 0, s);
  };
  const bottomEdge = () => (scroller ? scroller.getBoundingClientRect().bottom : innerHeight);
  const onScreen = (el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > headerBottom() - 40 && r.top < bottomEdge() + 40;
  };
  const scrollTarget = scroller || window;

  /* ---------- Swapping the text ---------- */
  // Words are wrapped with their trailing space, so a word that shrinks away takes its space with it.
  function wrapWords(rootEl) {
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const spans = [];
    for (const node of nodes) {
      if (!node.textContent.trim() || node.parentElement.closest("math, svg")) continue;
      const frag = document.createDocumentFragment();
      const lead = node.textContent.match(/^\s*/)[0];
      if (lead) frag.append(lead);
      for (const tok of node.textContent.slice(lead.length).match(/\S+\s*/g) || []) {
        const s = document.createElement("span");
        s.className = "cx-w";
        s.textContent = tok;
        frag.append(s);
        spans.push(s);
      }
      node.replaceWith(frag);
    }
    return spans;
  }

  function settle(it, to) {
    it.timers.forEach(clearTimeout);
    it.timers = [];
    it.el.innerHTML = it.html[to];
    it.el.classList.remove("cx-editing");
    it.shown = to;
    if (it.passage) {
      it.el.classList.toggle("cx-condensed", to > 0);
      it.el.dataset.cx = LEVELS[to];
      reading.recount?.(it.el);
    }
  }

  // Like an editor's pen: words that go are struck through and close up, then new words are written in.
  function morph(it, to, delay) {
    settle(it, it.shown);
    const tmp = document.createElement(it.el.tagName);
    tmp.innerHTML = it.html[to];
    const oldW = wrapWords(it.el), newW = wrapWords(tmp);
    const [keepOld, keepNew] = keepers(oldW.map((s) => wordKey(s.textContent)), newW.map((s) => wordKey(s.textContent)));
    const going = oldW.filter((_, i) => !keepOld.has(i));
    const coming = newW.filter((_, i) => !keepNew.has(i));
    it.el.classList.add("cx-editing");
    const at = (ms, fn) => it.timers.push(setTimeout(fn, delay + ms));
    at(0, () => going.forEach((s) => s.classList.add("cx-strike")));
    at(380, () => {
      going.forEach((s) => { s.style.maxWidth = `${s.offsetWidth}px`; s.classList.add("cx-box"); });
      void it.el.offsetWidth;
      going.forEach((s) => s.classList.add("cx-gone"));
    });
    at(900, () => {
      it.el.replaceChildren(...tmp.childNodes);
      coming.forEach((s) => s.classList.add("cx-box"));
      const widths = coming.map((s) => s.offsetWidth);
      coming.forEach((s) => s.classList.add("cx-gone", "cx-new"));
      void it.el.offsetWidth;
      coming.forEach((s, i) => { s.style.maxWidth = `${widths[i]}px`; s.classList.remove("cx-gone"); });
    });
    at(1500, () => coming.forEach((s) => s.classList.add("cx-inked")));
    at(2600, () => settle(it, to));
  }

  const html = document.documentElement;
  let foldTimer = 0, anchorTimer = 0;
  // Bring every passage, heading and summary to what the page should show.
  function render(animate) {
    animate = animate && !reducedMotion.matches && !printing;
    const v = view();
    const fold = v >= TLDR;
    const wasFolded = html.classList.contains("cx-folded");
    // Keep what is at the top of the screen where it is while everything above changes length.
    const hb = headerBottom();
    const anchorList = fold !== wasFolded ? sections.map((s) => s.head.el) : passages.map((p) => p.el);
    const anchor = anchorList.find((el) => el.getBoundingClientRect().bottom > hb);
    const before = anchor?.getBoundingClientRect().top ?? 0;
    html.style.overflowAnchor = "none";

    const jobs = [];
    for (const p of passages) {
      const to = passageView(p);
      if (p.shown !== to || p.timers.length) jobs.push([p, to]);
    }
    for (const s of sections) {
      if (s.head.shown !== v || s.head.timers.length) jobs.push([s.head, v]);
      const to = v === ELI5 ? 1 : 0;
      if (s.sum.shown !== to || s.sum.timers.length) jobs.push([s.sum, to]);
    }
    // Folding to one line per section, or back: a quick fade, then the new layout settles in.
    if (fold !== wasFolded) {
      html.classList.toggle("cx-folded", fold);
      if (animate) {
        html.classList.remove("cx-unfolding");
        void html.offsetWidth;
        html.classList.add("cx-unfolding");
        clearTimeout(foldTimer);
        foldTimer = setTimeout(() => html.classList.remove("cx-unfolding"), 700);
      }
    }
    let n = 0;
    for (const [it, to] of jobs) {
      // Inside folded sections, passages are hidden: no need to animate them.
      const hidden = fold && it.passage;
      if (animate && !hidden && onScreen(it.el)) morph(it, to, 90 * n++);
      else settle(it, to);
    }
    if (anchor) {
      const after = anchor.getBoundingClientRect().top;
      // If the anchor would end up above the screen, bring its heading into view instead.
      const target = before < hb && fold !== wasFolded ? hb + 16 : before;
      scrollTarget.scrollBy({ top: after - target, behavior: "instant" });
    }
    cancelAnimationFrame(anchorTimer);
    anchorTimer = requestAnimationFrame(() => (html.style.overflowAnchor = ""));
    html.dataset.condense = String(v);
  }

  // Squeeze, choose or restore. auto: only passages not yet read condense.
  function setLevel(to, why) {
    to = clamp(to, 0, top);
    if (to === level) return;
    level = to;
    if (why === "auto") {
      if (to <= 3) passages.forEach((p) => { if (!p.el.classList.contains("attn-read")) p.lv = Math.max(p.lv, to); });
    } else {
      passages.forEach((p) => (p.lv = Math.min(to, 3)));
    }
    save();
    render(true);
    if (to !== TLDR) wander.stop();
    ui.announce(why);
  }

  // Printing and saving always use the full text.
  on(window, "beforeprint", () => { printing = true; render(false); });
  on(window, "afterprint", () => { printing = false; render(false); });

  /* ---------- Peek: press and hold a condensed passage to read it in full ---------- */
  const peek = (() => {
    const card = document.createElement("div");
    card.className = "cx-peek";
    card.setAttribute("role", "note");
    card.hidden = true;
    document.body.append(card);
    let hold = null, open = null;
    const close = () => {
      clearTimeout(hold?.timer);
      hold = null;
      if (!open) return;
      open.el.classList.remove("cx-peeking");
      open = null;
      card.hidden = true;
    };
    const show = (p) => {
      open = p;
      p.el.classList.add("cx-peeking");
      getSelection()?.removeAllRanges();
      card.innerHTML = `<span class="cx-peek-label">As written</span>${p.html[0]}`;
      card.hidden = false;
      const r = p.el.getBoundingClientRect();
      const w = Math.min(r.width + 24, innerWidth - 24);
      card.style.width = `${w}px`;
      card.style.left = `${clamp(r.left - 12, 12, innerWidth - w - 12)}px`;
      const h = card.offsetHeight;
      // Above the passage if there is room, otherwise below it.
      const y = r.top - h - 10 > headerBottom() ? r.top - h - 10 : Math.min(r.bottom + 10, innerHeight - h - 12);
      card.style.top = `${Math.max(headerBottom() + 8, y)}px`;
    };
    on(window, "pointerdown", (ev) => {
      if (ev.button !== 0) return;
      const el = ev.target.closest?.(".cx-condensed");
      const p = el && byEl.get(el);
      if (!p || ev.target.closest("a, button") || p.shown === 0) return;
      hold = { p, x: ev.clientX, y: ev.clientY, timer: setTimeout(() => show(p), PEEK_HOLD) };
    });
    on(window, "pointermove", (ev) => {
      if (hold && !open && Math.hypot(ev.clientX - hold.x, ev.clientY - hold.y) > 8) close();
    }, { passive: true });
    on(window, "pointerup", close);
    on(window, "pointercancel", close);
    on(window, "scroll", close, { passive: true });
    if (scroller) on(scroller, "scroll", close, { passive: true });
    on(window, "contextmenu", (ev) => { if (open || hold) ev.preventDefault(); });
    return { close, destroy() { close(); card.remove(); } };
  })();

  /* ---------- The wandering ELI5 button ----------
     At TL;DR, still skimming: a floating copy of the button follows the cursor,
     lazily, and stops when the cursor stops or comes close, so it can be clicked. */
  const wander = (() => {
    if (!withEli5) return { get on() { return false; }, start() {}, stop() {}, destroy() {} };
    const wrap = document.createElement("div");
    wrap.className = "cx-eli5-float";
    wrap.innerHTML = eli5Button("cx-eli5-f");
    wrap.hidden = true;
    document.body.append(wrap);
    const fine = window.matchMedia("(pointer: fine)");
    let running = false, x = 0, y = 0, cx = -1, cy = -1, moved = 0, raf = 0, last = 0;
    on(window, "pointermove", (ev) => {
      if (ev.pointerType !== "mouse") return;
      cx = ev.clientX; cy = ev.clientY; moved = performance.now();
    }, { passive: true });
    function frame(t) {
      raf = 0;
      if (!running) return;
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
      last = t;
      const w = wrap.offsetWidth, h = wrap.offsetHeight;
      if (fine.matches && cx >= 0) {
        const near = Math.hypot(cx - (x + w / 2), cy - (y + h / 2)) < 70;
        const busy = performance.now() - moved < 250;
        if (busy && !near) {
          // Trail the cursor, a little behind and to the side, with a lazy wobble.
          const tx = cx + 26 + Math.sin(t / 340) * 10, ty = cy + 20 + Math.cos(t / 410) * 8;
          const k = 1 - Math.exp(-dt * 3.2);
          x += (tx - x) * k;
          y += (ty - y) * k;
        }
      }
      x = clamp(x, 8, innerWidth - w - 8);
      y = clamp(y, headerBottom() + 8, innerHeight - h - 8);
      wrap.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      raf = requestAnimationFrame(frame);
    }
    return {
      get on() { return running; },
      start() {
        if (running || reducedMotion.matches) return;
        running = true;
        wrap.hidden = false;
        html.classList.add("cx-wandering");
        // Start near the cursor, or above the panel on touch screens.
        x = cx >= 0 && fine.matches ? cx + 40 : innerWidth / 2 - 40;
        y = cy >= 0 && fine.matches ? cy + 30 : innerHeight - 260;
        last = 0;
        if (!raf) raf = requestAnimationFrame(frame);
      },
      stop() {
        running = false;
        wrap.hidden = true;
        html.classList.remove("cx-wandering");
      },
      destroy() { this.stop(); cancelAnimationFrame(raf); wrap.remove(); },
    };
  })();
  on(window, "click", (ev) => {
    if (ev.target.closest?.(".cx-eli5, .cx-eli5-f")) {
      reading.calm?.(0);
      setLevel(ELI5, "eli5");
    }
  });

  /* ---------- The panel ---------- */
  const ui = panelOpt === false ? headless() : buildPanel();

  // Without a panel: no controls, but the same switching on and off.
  function headless() {
    return {
      announce() {},
      update() {},
      setOff(o, show = true) {
        off = o;
        html.classList.toggle("cx-off", o);
        if (o) { wander.stop(); peek.close(); }
        if (show) render(true);
      },
      destroy() {},
    };
  }

  function buildPanel() {
    const icon = {
      help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6"/><circle cx="12" cy="16.9" r=".6" fill="currentColor"/></svg>',
      min: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>',
      close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>',
      mark: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".55"/><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M11 6v20M21 6v20"/><path d="M6 11h3.2M12.8 11h6.4M22.8 11H26" stroke="var(--eido-accent)"/><path d="M6 21h16M24.4 21H26"/></g></svg>',
    };
    const embedded = typeof Element !== "undefined" && panelOpt instanceof Element;
    const box = document.createElement("div");
    box.className = `attn-ui cx-ui${embedded ? " cx-ui-embedded" : ""}`;
    box.innerHTML = `
      <div class="attn-pop" role="dialog" aria-modal="false" aria-labelledby="cx-pop-title" hidden>
        <button class="attn-icon attn-pop-close" type="button" aria-label="Close">${icon.close}</button>
        <div class="attn-pop-body">
          <h2 id="cx-pop-title">Condensing prose</h2>
          <p>This <span class="cx-noun"></span> notices how you read it. Read at a steady pace and it stays as written.</p>
          <p>Skim, scrolling past passages faster than they can be read, and the writing condenses to match: concise prose, then terse notes, then caveman, then one line per section. Only passages you have not read condense; the ones you read stay as they were.${withEli5 ? " Keep skimming even then, and an offer of a simpler explanation comes looking for you." : ""}</p>
          <p>It only ever condenses. Calm reading does not bring the words back; you do, by picking a level on the panel or pressing <em>Back to full prose</em>. Your level is remembered for this <span class="cx-noun"></span> on this device.</p>
          <h3>Reading a condensed passage</h3>
          <p>Condensed passages end with <span class="attn-kbd">≈</span>. Press and hold one to see it as written.</p>
          <p>Every level is written ahead of time and checked against the <span class="cx-noun"></span>. The full text is the one to cite, and it is the one that prints. Reading is measured in your browser and nothing is sent anywhere.</p>
          <p class="attn-pop-foot">To stop it, press <span class="attn-kbd" aria-label="the close button">×</span> on the panel.</p>
        </div>
      </div>
      <section class="attn-panel" aria-label="Condensing prose">
        <div class="attn-head">
          <span class="attn-title">Condensing prose</span>
          <button class="attn-icon attn-help" type="button" aria-label="What is this?">${icon.help}</button>
          <button class="attn-icon attn-min" type="button" aria-label="Minimise">${icon.min}</button>
          <span class="attn-x-wrap">
            <button class="attn-icon attn-x" type="button" aria-describedby="cx-x-tip">${icon.close}</button>
            <span class="attn-tip" id="cx-x-tip" role="tooltip">Stops condensing</span>
          </span>
        </div>
        <div class="cx-ladder" role="group" aria-label="Prose level">
          ${SHORT.slice(0, top + 1).map((s, i) => `<button type="button" class="cx-rung${i === ELI5 ? " cx-rung-eli5" : ""}" data-level="${i}" title="${i === ELI5 ? ELI5_TIP : LEVELS[i]}">${s}</button>`).join("")}
        </div>
        <p class="attn-status cx-status" aria-live="polite"></p>
        <div class="attn-meter cx-meter" aria-hidden="true"><span></span></div>
        <dl class="attn-stats">
          <div><dt>Words</dt><dd class="cx-words"></dd></div>
          <div><dt>Reading</dt><dd class="cx-time"></dd></div>
        </dl>
        <p class="cx-map" hidden></p>
        <button class="attn-on cx-restore" type="button" hidden>Back to full prose</button>
        <button class="attn-on cx-on" type="button" hidden>Turn condensing back on</button>
        <pre class="attn-debug" ${debug ? "" : "hidden"}></pre>
      </section>
      <button class="attn-dock" type="button" aria-label="Show the condensing prose panel" hidden>
        ${icon.mark}
        <span class="cx-badge" aria-hidden="true" hidden></span>
      </button>`;
    // The noun comes from the caller, so it goes in as text, never as HTML.
    box.querySelectorAll(".cx-noun").forEach((el) => { el.textContent = noun; });
    (embedded ? panelOpt : document.body).append(box);
    const $ = (s) => box.querySelector(s);
    const panel = $(".attn-panel"), dock = $(".attn-dock"), pop = $(".attn-pop"), badge = $(".cx-badge");
    const rungs = [...box.querySelectorAll(".cx-rung")];
    const status = $(".cx-status"), fill = $(".cx-meter span"), wordsOut = $(".cx-words"), timeOut = $(".cx-time");
    const restore = $(".cx-restore"), onBtn = $(".cx-on"), xBtn = $(".attn-x"), dbg = $(".attn-debug"), map = $(".cx-map");
    let minimised = store.get("-min") === "1";

    // Each level describes itself in its own voice.
    const VOICE = [
      "As written. Skim, and it condenses.",
      "Concise. You were skimming, so the page trimmed itself.",
      "Terse. Skim more → fewer words. Grammar optional.",
      "Caveman. You skim. Page shrink. Press button, get big words back.",
      withEli5 ? "TL;DR. One line per section. Still lost? There’s help at the end." : "TL;DR. One line per section.",
      `Explained simply. The full ${noun} is one tap away whenever you want it.`,
    ];
    const SQUEEZED = [
      "Back to the full text.",
      "Skimming detected: unread passages condensed to concise prose.",
      "Still skimming: unread passages condensed to terse notes.",
      "Still skim. Now caveman.",
      "Skimmed the caveman. One line per section now.",
      "Explained simply.",
    ];

    const setMin = (m) => {
      minimised = m;
      store.set("-min", m ? "1" : null);
      panel.hidden = m;
      dock.hidden = !m;
      if (m) pop.hidden = true;
    };
    const setOff = (o, show = true) => {
      off = o;
      store.set("-off", o ? "1" : null);
      html.classList.toggle("cx-off", o);
      xBtn.hidden = o;
      onBtn.hidden = !o;
      if (o) { pop.hidden = true; wander.stop(); peek.close(); }
      if (show) render(true);
      update();
    };

    rungs.forEach((b) => on(b, "click", () => choose(+b.dataset.level)));
    on(restore, "click", () => { reading.calm?.(0); setLevel(0, "chosen"); rungs[0].focus({ preventScroll: true }); });
    on($(".attn-help"), "click", () => {
      pop.hidden = !pop.hidden;
      if (!pop.hidden) $(".attn-pop-close").focus({ preventScroll: true });
    });
    on($(".attn-pop-close"), "click", () => (pop.hidden = true));
    on(window, "keydown", (ev) => { if (ev.key === "Escape") { pop.hidden = true; peek.close(); } });
    on($(".attn-min"), "click", () => setMin(true));
    on(dock, "click", () => { setMin(false); $(".attn-min").focus({ preventScroll: true }); });
    on(xBtn, "click", () => { setOff(true); onBtn.focus({ preventScroll: true }); });
    on(onBtn, "click", () => setOff(false));

    const fmt = (n) => n.toLocaleString("en-GB");
    const full = passages.reduce((s, p) => s + p.words[0], 0);
    const shownWords = () => {
      const v = view();
      if (v >= TLDR) return sections.reduce((s, x) => s + x.sum.words[v === ELI5 ? 1 : 0], 0);
      return passages.reduce((s, p) => s + p.words[passageView(p)], 0);
    };
    let lastStatus = "", flash = -Infinity;
    function announce(why) {
      if (why === "auto" || why === "eli5") {
        status.textContent = lastStatus = SQUEEZED[level];
        flash = performance.now();
        box.classList.remove("cx-squeezed");
        void box.offsetWidth;
        box.classList.add("cx-squeezed");
      }
      update();
    }
    function update() {
      const v = view();
      rungs.forEach((b, i) => {
        b.setAttribute("aria-pressed", String(i === v));
        b.classList.toggle("cx-past", i < v);
      });
      const s = off ? "Condensing is off. The page stays as written." : performance.now() - flash < 4000 ? lastStatus : VOICE[level];
      if (s !== lastStatus) { status.textContent = s; lastStatus = s; }
      const r = reading.restless ?? 0;
      fill.style.transform = `scaleX(${meterFill(r, level, { canFold, off, wandering: wander.on, eli5: withEli5 }).toFixed(3)})`;
      const now = shownWords();
      wordsOut.textContent = v ? `${fmt(now)} of ${fmt(full)}` : fmt(full);
      timeOut.textContent = `${Math.max(1, Math.round(now / WPM))} min`;
      // The map of how you read: passages kept as written because you read them.
      const kept = passages.filter((p) => p.lv < level && level <= 3).length;
      map.hidden = !kept || off;
      if (kept) map.textContent = `${kept} passage${kept === 1 ? "" : "s"} you read ${kept === 1 ? "stays" : "stay"} as ${kept === 1 ? "it was" : "they were"}.`;
      restore.hidden = off || !level;
      badge.hidden = !v;
      badge.textContent = v ? ["", "1", "2", "3", "1L", "5"][v] : "";
      if (debug) {
        dbg.textContent = [
          `restless ${r.toFixed(2)}  level ${level}${off ? " (off)" : ""}`,
          `next at  ${level < TLDR ? STEP_AT[level] : level === TLDR ? `wander ${WANDER_AT}` : "-"}`,
          `passages ${passages.length}, sections ${sections.length}, wander ${wander.on}`,
        ].join("\n");
      }
    }
    setMin(minimised);
    return { announce, update, setOff, destroy() { box.remove(); } };
  }

  // A level picked by the reader (a rung, or the handle): turns condensing back on if it was off.
  function choose(to) {
    to = clamp(Math.round(to) || 0, 0, top);
    if (off) ui.setOff(false, false);
    reading.calm?.(to ? SPENT : 0);
    setLevel(to, "chosen");
    if (to === level) render(true); // e.g. turned back on at the same level
  }

  /* ---------- The ratchet ---------- */
  ui.setOff(off, false);
  render(false);
  ui.update();
  const timer = setInterval(() => {
    if (!off) {
      const r = reading.restless ?? 0;
      const to = nextLevel(r, level, performance.now() - lastStep, { canFold });
      if (to !== null) {
        lastStep = performance.now();
        reading.calm?.(SPENT); // the squeeze spends the pressure that caused it
        setLevel(to, "auto");
      } else if (withEli5 && shouldWander(r, level) && !wander.on) {
        wander.start();
      }
    }
    ui.update();
  }, 200);

  return {
    get level() { return level; },
    /** Pick a level as the reader would from the panel. Every passage goes to min(n, 3). */
    setLevel: choose,
    /** Back to the full text; the score is calmed too. */
    reset() { choose(0); },
    /** Stop, remove everything this module added and put the original text back. */
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearInterval(timer);
      clearTimeout(foldTimer);
      cancelAnimationFrame(anchorTimer);
      ac.abort();
      peek.destroy();
      wander.destroy();
      ui.destroy();
      for (const p of passages) {
        p.timers.forEach(clearTimeout);
        p.el.innerHTML = p.html[0];
        p.el.classList.remove("cx-condensed", "cx-editing", "cx-peeking");
        delete p.el.dataset.cx;
        reading.recount?.(p.el);
      }
      for (const s of sections) {
        s.head.timers.forEach(clearTimeout);
        s.head.el.innerHTML = s.head.html[0];
        s.head.el.classList.remove("cx-head");
        s.sum.el.remove();
        s.el.classList.remove("cx-section");
      }
      eliSlot?.remove();
      html.classList.remove("cx-folded", "cx-unfolding", "cx-wandering", "cx-off");
      html.style.overflowAnchor = "";
      delete html.dataset.condense;
    },
  };
}
