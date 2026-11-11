# Condensing prose

On a long page, the writing gets shorter as the reader skims. A reader who goes slowly sees the full text. A reader who scrolls past paragraphs sees notes, then fragments, then one line per section. The words they did read stay as written.

*Status: implemented here in [`src/condense.js`](../src/condense.js) and [`css/condense.css`](../css/condense.css). It runs on w3ft.org. It depends on the reading score from [`src/reading-weave.js`](../src/reading-weave.js) (see [reading-weave.md](reading-weave.md)), which decides when the reader is skimming.*

## 1. What it does and why

Long pages are written once, for a careful reader. Most visitors skim. Skimmers still want the gist, and they usually get it by scrolling past what they do not read.

This module gives them a shorter page without asking. It watches the reading score. When the score says "skimming", it swaps passages the reader has not read for shorter versions. It never makes up text. Every shorter version was written by the author ahead of time and sits in a file beside the page, `condensed.json`.

Three rules keep it honest:

1. **The full text stays the one that counts.** Print always shows it. Press and hold any condensed passage to see it as written.
2. **Condensed text says so.** Every condensed passage ends with a ≈ marker.
3. **Only the reader can loosen it.** Calm reading does not bring words back. The reader does, from a panel at the bottom right.

## 2. The levels

| Level | Name | What changes |
| --- | --- | --- |
| 0 | Full prose | As written. |
| 1 | Concise | Same sentences, trimmed. Grammar intact. |
| 2 | Terse | Notes. Grammar is dropped where meaning survives. |
| 3 | Caveman | Short, flat words. Grammar is gone. |
| 4 | TL;DR | Each section folds to a short heading and one line. |
| 5 | ELI5 | Each section gets a simple explanation. Reached only by clicking an ELI5 button. |

One passage, from section 1 of the overview paper on w3ft.org, at every level:

**0 · Full prose**
> Continual adaptation without limits is a safety problem as much as an engineering one. A model that can rewrite itself can also drift away from the behaviour it was approved for. Today, the limits on that drift are usually procedural: reviews, evaluations, and policies on who may run training. They are rarely *executable*: a predicate that runs on every update and refuses the ones that cross a line.

**1 · Concise**
> Adaptation without limits is a safety problem. A self-rewriting model can drift from approved behaviour. Today’s limits are mostly procedural: reviews, evaluations, policies. Rarely *executable*: a predicate run on every update that refuses those crossing a line.

**2 · Terse**
> Unlimited adaptation = safety problem. Self-rewriting model can drift from approved behaviour. Limits today procedural (reviews, evals, policy), rarely *executable*: predicate on every update, refuses line-crossers.

**3 · Caveman**
> Model change self, may go bad. Rule only talk. Want rule in code, say no.

**4 · TL;DR** (the whole section 1)
> Heading: *Problem*
> Self-adapting models need limits that code enforces, not just policies.

**5 · ELI5** (the whole section 1)
> Heading: *What’s the problem?*
> Most programs that learn stop once they are built. Soon some will keep changing by themselves, with nobody watching. Rules on paper are easy to ignore, so Weft wants rules the computer checks on every change.

Levels 1 to 3 apply to single passages. Levels 4 and 5 apply to whole sections, so they use the section data (`headings`, `tldr`, `eli5`) and hide the passages.

## 3. The ratchet and the per-passage rule

The page tightens one level at a time, and never loosens on its own. When the restlessness score (0 to 1) reaches a threshold, the page squeezes one level:

| From level | Squeezes when restlessness reaches |
| --- | --- |
| 0 Full | 0.30 |
| 1 Concise | 0.50 |
| 2 Terse | 0.50 |
| 3 Caveman | 0.55 |

Each squeeze spends the pressure that caused it: the score drops to 0.20 (`SPENT`). The next level has to be earned with more skimming. Squeezes are at least 1.5 seconds apart (`STEP_GAP`) so each one can be seen. The pure decision is `nextLevel(restless, level, sinceMs, { canFold })`. Automatic squeezing stops at TL;DR. Without sections to fold (`canFold` false), it stops at Caveman.

The **per-passage rule**: an automatic squeeze only affects passages that do not carry the `attn-read` class (the reading score adds it when a passage was read). A passage the reader read keeps the level it had. The page ends up as a map of how it was read, and the panel says how many passages stayed as they were.

The reader moves the ladder by hand from the panel: picking a level sets every passage to that level (at most Caveman for passages), and "Back to full prose" resets. Each manual change also calms the score so the page does not jump again at once.

## 4. Peek and the ≈ marker

A condensed passage ends with ≈. Press and hold it for 350 ms and a card appears with the passage as written, labelled "As written". Release to close it. Moving more than 8 pixels, scrolling, or pressing Escape cancels. Links and buttons inside a passage are not affected. The card is pointer-driven; the panel and the full-prose button are the keyboard route to the original text.

## 5. TL;DR, ELI5 and the wandering button

At TL;DR each section folds to its short heading and one line. An ELI5 button sits at the end of the page. If the reader keeps skimming at TL;DR and restlessness reaches 0.40 (`WANDER_AT`), a floating copy of the button follows the cursor, lazily, with a wobble. It stops when the cursor stops or comes within 70 pixels, so it can be clicked. On touch screens it appears above the panel and does not move. Under reduced motion it does not appear; the button at the end of the page and the panel rung still work.

Clicking either button goes to level 5. ELI5 is never reached by skimming alone.

## 6. The morph

Level changes animate on the passages that are on screen:

1. Both versions are split into words. A longest-common-subsequence diff (`keepers`) finds the words they share.
2. Words that go are struck through in red (0 ms), then collapse to zero width (380 ms).
3. The new text replaces the old (900 ms). New words grow in with a gold tint, then settle to the text colour (1.5 s).
4. The final markup is set at 2.6 s.

Words compare lower-case with punctuation removed (`wordKey`). Passages off screen, or inside folded sections, switch without animation. Folding to TL;DR fades the new layout in over 0.6 s. The module also keeps what is at the top of the screen in place while text above changes length.

## 7. Accessibility and print

- Under `prefers-reduced-motion: reduce`, nothing animates: text swaps at once and the wandering button does not start.
- The panel is a labelled region. Rungs are buttons with `aria-pressed`. Status changes go to an `aria-live="polite"` line.
- The ELI5 tip is a tooltip tied to the button with `aria-describedby`, and shows on focus as well as hover.
- The ✕ on the panel switches condensing off for the page ("Turn condensing back on" appears). Off is remembered.
- Print, and "Save as PDF", always show the full text. The module restores it on `beforeprint` and condenses again on `afterprint`. The panel, peek card and buttons are hidden in print CSS.
- Reading is measured in the browser. Nothing is sent anywhere.

## 8. `condensed.json`

```json
{
  "version": 1,
  "levels": ["Full prose", "Concise", "Terse", "Caveman"],
  "blocks":   { "aea4f4ae": ["concise…", "terse…", "caveman…"] },
  "headings": { "the-problem": ["l1", "l2", "l3", "l4 TL;DR", "l5 ELI5"] },
  "tldr":     { "the-problem": "one line" },
  "eli5":     { "the-problem": "a simple explanation" }
}
```

| Field | Shape | Notes |
| --- | --- | --- |
| `version` | `1` | Optional. |
| `levels` | array of names | Optional, informational. |
| `blocks` | hash → exactly 3 strings | Concise, Terse, Caveman. A passage without an entry stays as written. |
| `headings` | section id → exactly 5 strings | The heading at levels 1 to 5. |
| `tldr` | section id → string | The line shown at level 4. |
| `eli5` | section id → string | The text shown at level 5. |
| `source` | any | Ignored at runtime. `skeleton` fills it so a writer can see the original text. Remove it before publishing if size matters. |

A section folds only if it has all three of `headings`, `tldr` and `eli5` (with `eli5: false`, `eli5` is not needed). The strings are HTML and go in through `innerHTML`. Keep them to inline tags (`em`, `strong`, `code`, `a`) and serve the file from your own origin. `validateCondensed` rejects script tags and event handlers.

### The hashing rule

A passage's key is the FNV-1a 32-bit hash of its `textContent` with whitespace runs collapsed to one space and trimmed, written as eight lowercase hex digits (`hashText`). Because the hash comes from the text, editing a passage's words orphans its variants. The passage then stays as written and `validateCondensed` with `against` reports the stale key. Changing markup without changing the text does not change the hash.

### Which elements are passages

The ones the reading score tracks: elements matching `blocks` (default `main :is(p, li)`), outside the `skip` selector (default `pre, code, button, label, form, figure, table, nav, aside, [data-eido-skip]`), with no `p` or `li` inside them, and at least four words. `setupCondense` takes them from `reading.blocks`, so pass the same `blocks` and `skip` to `extractPassages` as you gave `setupReadingWeave`.

A section is an element matching `sections` inside `article`, with a heading matching `heading`, and an id (`sectionId`, by default its `id`, or `"abstract"` when it has the class `abstract`).

## 9. Authoring workflow

1. **Extract.** Open the page with no `condensed.json` yet (or at `?condense=0`). The hash is of the text as it stands, so the page must not be condensed. In the console:

   ```js
   const m = await import("/src/condense.js");
   const passages = m.extractPassages(document);   // [{ el, hash, text, words, section }]
   const sections = m.extractSections(document);   // [{ el, id, title }]
   copy(JSON.stringify(m.skeleton(passages, sections), null, 2));
   ```

   Save the result as `condensed.json`. Every variant slot is an empty string.
2. **Write.** Fill each slot by hand or with the prompt below. Use the `source` object for the original text of each passage and heading.
3. **Validate.** In Node or the console:

   ```js
   const problems = m.validateCondensed(data, {
     against: { passages, sectionIds: sections.map((s) => s.id) },
     strict: true,
   });
   ```

   An empty list means: the structure is right, every key exists on the page, no passage or section is missing, each level is no longer than the one before, TL;DR is at most 15 words and ELI5 at most 40.
4. **Look.** Open the page at `?condense=1` through `?condense=5` and read each level.

### A prompt for drafting the variants

Give an LLM the `source` object and the prompt below. It returns the filled-in `blocks`, `headings`, `tldr` and `eli5`. Read every line before you keep it. The variants must not say anything the page does not say.

```text
You are editing a web page into shorter versions of itself. I give you JSON:
"blocks" (hash -> original passage text) and "sections" (id -> heading).
Return JSON with the same keys, in this shape:
  blocks:   { hash: [concise, terse, caveman] }
  headings: { id: [l1, l2, l3, l4, l5] }
  tldr:     { id: "..." }
  eli5:     { id: "..." }

Rules for every output string:
- Say only what the original says. No new facts, numbers or claims. Keep every
  hedge and status label (for example "simulated", "not proven").
- Keep inline tags such as <em>, <strong>, <code> around the same words. No other
  HTML. Use plain quotes and apostrophes as the original does.
- Keep names, numbers, code and terms of art exactly.

Per level:
- Concise: same sentences, trimmed. Proper grammar. Roughly two thirds of the original.
- Terse: notes. Drop articles and linking words. Use "=", ":" and brackets. Roughly
  half of the original.
- Caveman: very short, flat sentences of common words. No grammar. Say only the main
  point, in at most 50 words (usually 10 to 25).
- headings: l1 is the original heading with at most a small trim, l2 a shorter form
  (keep the section number), l3 a short label, l4 (TL;DR) a label of one to three
  words, l5 (ELI5) a question a child could ask, at most five words.
- tldr: one sentence, at most 15 words, the single thing a skimmer should take away.
- eli5: a plain explanation, at most 40 words, with one everyday comparison if it
  helps. No jargon. A reader with no background should follow it.

Each level must be no longer than the one before it. Return only JSON.
```

## 10. Install

No build step and no dependencies. Copy `src/condense.js` and `css/condense.css` (and the reading score files) or import them from the package.

```html
<link rel="stylesheet" href="css/reading-weave.css">
<link rel="stylesheet" href="css/condense.css">
<script type="module">
  import { setupReadingWeave } from "./src/reading-weave.js";
  import { loadCondensed, setupCondense } from "./src/condense.js";

  loadCondensed().then((data) => {
    if (!data) return setupReadingWeave();                 // no variants: the plain reading score
    const reading = setupReadingWeave({ motion: false, panel: false });
    if (reading) setupCondense(data, reading);
  });
</script>
```

Pass `motion: false, panel: false` to the reading score: condensing replaces its word motion and its panel. Put `condensed.json` beside the page. Set the `--eido-*` tokens on `:root`; see [`examples/condense/index.html`](../examples/condense/index.html) for a full page.

A browser logs a failed request itself, so a page that may lack the file can inline it instead:

```html
<script type="application/json" id="condensed">{ … }</script>
```

and call `loadCondensed(document.getElementById("condensed"))`.

## 11. Reference

### `loadCondensed(source?, { optional = true })`

Returns a promise for the parsed data. `source` is a URL (default `condensed.json` beside the page) or a `<script type="application/json">` element. It resolves to `null` on a 404, a network error or bad JSON. With `optional: false` it rejects instead.

### `setupCondense(data, reading, options)`

`reading` is the handle from `setupReadingWeave`. It needs `blocks`, a `restless` getter and `calm(to)`; `recount(el)` is used when present. Returns `{ level, setLevel(n), reset(), destroy() }`, or `null` if no passage on the page has variants.

| Option | Default | Meaning |
| --- | --- | --- |
| `root` | `document` | Where to look for the article and sections. |
| `article` | `"article.paper"` | Selector for the article. Use `""` for the whole root. |
| `sections` | `"section"` | Foldable sections, inside `article`. |
| `heading` | `":scope > h2"` | A section's heading, inside the section. |
| `sectionId` | its `id`, or `"abstract"` for class `abstract` | Function from a section element to its key in the data. |
| `panel` | `true` | `true`: panel fixed at the bottom right. `false`: no panel. An element: the panel is mounted inside it, positioned absolutely (give that element `position: relative`). |
| `storage` | `"eido-condense"` | Prefix for what is kept in `localStorage`. State is kept per pathname. `false` keeps nothing. |
| `eli5` | `true` | `false` removes level 5, its buttons and the wandering button. |
| `params` | `true` | Reads `?condense=N` and `?attn` from the URL. A `URLSearchParams` uses yours; `false` ignores the URL. |
| `header` | `".site-header"` | A fixed header to keep content clear of. |
| `scroller` | `window` | The scrolling element, if the page does not scroll the window. |
| `noun` | `"paper"` | What the panel calls the page. |

The handle: `level` is the current level (0 to 5); `setLevel(n)` does what picking a rung does; `reset()` goes to full prose; `destroy()` stops everything, removes what the module added and restores the original text.

What is kept in `localStorage` (with the default prefix): `eido-condense:<pathname>` (level and per-passage levels), `eido-condense-off` and `eido-condense-min`.

### Pure functions

| Function | Does |
| --- | --- |
| `normalizeText(s)` | Collapses whitespace and trims. |
| `hashText(s)` | FNV-1a 32-bit of the normalised text, eight hex digits. |
| `wordKey(w)`, `countWords(s)` | Word comparison key; word count. |
| `keepers(a, b)` | LCS of two word-key arrays; returns two `Set`s of kept indices. |
| `nextLevel(restless, level, sinceMs, { canFold })` | The level to squeeze to, or `null`. |
| `shouldWander(restless, level)` | Whether the floating ELI5 button should start. |
| `meterFill(restless, level, opts)` | The panel meter, 0 to 1. |
| `validateCondensed(data, { against, strict })` | List of problems; empty when sound. |
| `skeleton(passages, sections, { source })` | A `condensed.json` with empty slots. |
| `THRESHOLDS`, `LEVELS` | The numbers above; the level names. |

### DOM helpers

`extractPassages(root, { blocks, skip, minWords, article, sections, sectionId })` returns `[{ el, hash, text, words, section }]`. `extractSections(root, { article, sections, heading, sectionId })` returns `[{ el, id, title }]`.

## 12. CSS hooks

| Selector | What |
| --- | --- |
| `html[data-condense="0"…"5"]` | The level the page shows. |
| `html.cx-folded` | Sections are folded (levels 4 and 5). |
| `html.cx-off` | The reader switched condensing off. |
| `html.cx-wandering` | The floating ELI5 button is actively wandering. |
| `.cx-condensed` | A condensed passage (carries the ≈ marker). `data-cx` holds the level name. |
| `.cx-editing` | A passage is actively morphing words between levels. |
| `.cx-section`, `.cx-head`, `.cx-sum` | A foldable section, its heading, its summary line. |
| `.cx-w`, `.cx-strike`, `.cx-gone`, `.cx-new`, `.cx-inked` | Morph states of a word. |
| `.cx-peek`, `.cx-peeking` | The "as written" card; the passage being peeked. |
| `.cx-eli5`, `.cx-eli5-f`, `.cx-eli5-slot`, `.cx-eli5-float` | The ELI5 button, the floating copy, and their containers. |
| `.cx-ui`, `.cx-ladder`, `.cx-rung`, `.cx-badge`, `.cx-map` | The panel. Its chrome (`.attn-*`) comes from `reading-weave.css`. |

Tokens: `--eido-ink`, `--eido-muted`, `--eido-paper`, `--eido-line`, `--eido-accent` (the gold tint, the ≈ and the active rung), `--eido-strike` (struck words), `--eido-font-ui`, `--eido-radius`. `condense.css` gives them low-priority defaults and a dark scheme under `prefers-color-scheme`; set them on `:root` to override.

## 13. Review parameters

- `?condense=N` opens the page at level N (0 to 5). Every passage goes to at most level 3.
- `?attn` shows raw numbers in the panel.
- `?restless=0.9` (from the reading score) pins the score so the page squeezes on its own for review.

## 14. It depends on the reading score

Condensing does not measure reading. It reads `reading.restless`, marks which passages were read through the `attn-read` class, and calls `reading.calm()` when it spends pressure or the reader loosens a level. Without `reading-weave.js` there is nothing to squeeze on. You can drive it by hand with `handle.setLevel(n)` if you supply any object with `blocks`, `restless` and `calm`.
