// A small Node-side stand-in for extractPassages / extractSections in src/condense.js.
// It reads well-formed static HTML (no DOM) and applies the same rule: elements matching
// `blocks`, inside <main>, outside the skip elements, with no paragraph or list item
// inside them, and at least `minWords` words. Text is whitespace-normalised and hashed
// with the module's own hashText, so keys match what a browser computes.
import { hashText, normalizeText, countWords } from "../../src/condense.js";

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const SKIP = new Set(["pre", "code", "button", "label", "form", "figure", "table", "nav", "aside", "script", "style"]);
const BLOCKS = new Set(["p", "li"]);
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", middot: "·", times: "×", sup2: "²" };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return e.toLowerCase() in NAMED ? NAMED[e.toLowerCase()] : m;
  });
}

const TOKEN = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>|([^<]+)/g;

/**
 * @returns {{ passages: {hash:string, text:string, words:number, section:string|null}[], sections: {id:string, title:string}[] }}
 */
export function parseHtml(html, { headings = ["h2"], minWords = 4 } = {}) {
  const stack = [];
  const passages = [];
  const sections = [];
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(html))) {
    if (m[4] !== undefined) {
      const text = decodeEntities(m[4]);
      for (const f of stack) {
        if (f.collect) f.text += text;
      }
      continue;
    }
    if (!m[2]) continue; // comment
    const name = m[2].toLowerCase();
    if (m[1]) {
      // closing tag: pop to the matching frame
      let i = stack.length - 1;
      while (i >= 0 && stack[i].name !== name) i--;
      if (i < 0) continue;
      const closed = stack.splice(i);
      for (const f of closed.reverse()) {
        if (f.block && !f.nested && !f.skipped && f.inMain && f.words !== null) {
          const text = normalizeText(f.text);
          const words = countWords(text);
          if (words >= minWords) passages.push({ hash: hashText(text), text, words, section: f.section });
        }
        if (f.heading && f.sectionFrame) f.sectionFrame.title = normalizeText(f.text);
      }
      continue;
    }
    const attrs = m[3];
    const selfClose = VOID.has(name) || /\/\s*$/.test(attrs);
    const parent = stack[stack.length - 1];
    const id = /\bid\s*=\s*"([^"]*)"/.exec(attrs)?.[1] ?? /\bid\s*=\s*'([^']*)'/.exec(attrs)?.[1];
    const cls = /\bclass\s*=\s*"([^"]*)"/.exec(attrs)?.[1] ?? "";
    const frame = {
      name, text: "", collect: false, block: false, nested: false, id, cls,
      skipped: stack.some((f) => f.skipEl) || SKIP.has(name) || /\bdata-eido-skip\b/.test(attrs),
      skipEl: SKIP.has(name) || /\bdata-eido-skip\b/.test(attrs),
      inMain: stack.some((f) => f.name === "main") || name === "main",
      section: null,
    };
    // Nearest section inside article.paper
    const art = stack.some((f) => f.name === "article" && /\bpaper\b/.test(f.cls));
    for (let i = stack.length - 1; i >= 0 && art; i--) {
      if (stack[i].name === "section") { frame.section = stack[i].id || (/\babstract\b/.test(stack[i].cls) ? "abstract" : null); break; }
    }
    if (BLOCKS.has(name)) {
      for (const f of stack) if (f.block) f.nested = true;
      frame.block = true;
      frame.collect = true;
      frame.words = 0;
    }
    if (name === "section" && art) {
      const sec = { id: id || (/\babstract\b/.test(cls) ? "abstract" : ""), title: "" };
      frame.sectionRec = sec;
      sections.push(sec);
    }
    if (headings.includes(name) && parent?.name === "section" && parent.sectionRec) {
      frame.heading = true;
      frame.sectionFrame = parent.sectionRec;
      frame.collect = true;
    }
    // text of any element is gathered by every open collecting ancestor (handled above)
    if (!selfClose) stack.push(frame);
  }
  return { passages, sections: sections.filter((s) => s.id && s.title) };
}
