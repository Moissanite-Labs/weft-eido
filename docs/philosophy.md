# Eido: a first-principles approach to spatial web design

*Developed inside ML Weft under the internal name **Aywa**. Code paths in Weft still say `aywa`.*

Citations such as `weft/design/anew.md` refer to the design sessions preserved in
[Moissanite-Labs/weft-corpus](https://github.com/Moissanite-Labs/weft-corpus). Those sessions are sources and
hypotheses, not specifications. Each module below says what is implemented today and where.

## 1. Why another foundation

The design sessions start from a complaint about the "document prison" (`weft/design/anew.md`):

1. **Static box trees.** Information is flattened into nested rectangles, and layout is recomputed whenever content
   changes.
2. **Discrete themes.** Style is a handful of fixed classes (light, dark, a few breakpoints) that cannot move smoothly
   with content density, system state or the reader's preference.
3. **Passive scrolling.** Layered systems are forced into one long scroll, which throws away spatial memory and the
   relationships between parts.

Eido applies the same habits Weft uses for models to the screen: continuous spaces instead of switches, exact
geometry instead of approximations, compact verifiable state, and feedback that stays inside stated bounds.

Weft studies models that change themselves within bounds you can check. Eido is the first place that idea is
implemented in something people use every day: an interface that changes itself in response to the person using it,
within bounds that person can see, check and undo.

## 2. Six modules

Each module can be adopted on its own.

### D1 · Style as a point in a continuous space

*Sources: `weft/design/baryonic.md`, `weft/design/discovery.md`, `weft/design/core.md`. Implemented here:
[`src/aesthetic-mixer.js`](../src/aesthetic-mixer.js), [`src/simplex-pad.js`](../src/simplex-pad.js).*

A visual style is a vector **a** = (rounding, density, hue, contrast), computed as a barycentric blend of *K*
reference presets *P₁…P_K* with weights *w_k ≥ 0* normalised onto the simplex (*ŵ_k = w_k / Σ w_j*).

1. **Linear tokens.** Rounding, density and contrast interpolate linearly:
   *r = Σ ŵ_k r_k*, *d = Σ ŵ_k d_k*, *c = Σ ŵ_k c_k*.
2. **Hue on the circle.** Hue is periodic on [0, 1), so a linear average gives false midpoints. Averaging crimson at
   0.95 and scarlet at 0.05 linearly gives cyan at 0.50. Eido maps each hue to an angle θ_k = 2π h_k and takes the
   circular mean:
   *h̄ = atan2(Σ ŵ_k sin θ_k, Σ ŵ_k cos θ_k) / 2π  (mod 1)*.
3. **A triangle, not three sliders.** With *K* = 3 the weights live on a 2-simplex. Three independent sliders cannot
   show the sum-to-one constraint, but a triangle can: every point inside it has unique barycentric coordinates, and
   those coordinates are the weights. `simplex-pad.js` is that control. It supports pointer and keyboard input and
   reports its value to assistive technology.

### D2 · Analytical geometry and reading cadence

*Sources: `weft/design/craft.md`, `weft/design/alive.md`, `weft/design/feeed.md`. Implemented here:
[`src/glyph-font.js`](../src/glyph-font.js). Implemented in Weft: the field shader and the cadence heuristic.*

1. **Signed distance fields.** Cells, borders and glyphs are evaluated per fragment from signed distance functions,
   so they stay sharp at any zoom or pixel ratio and need no textures.
2. **Bitmask glyphs.** `weft/design/feeed.md` proposes drawing text inside the shader from integer bitmasks. Its
   version packs a 5×7 glyph into one `u32`, which cannot work because 35 bits don't fit in 32. `glyph-font.js`
   uses two words per glyph and feeds the same table to WebGPU and Canvas2D, so both renderers draw identical letters.
3. **Reading calm.** A scroll-speed heuristic, not a model, produces a calm value in [0, 1] that softens grain and
   deepens panels while the reader dwells. `weft/design/alive.md` also proposes changing line height with it. Eido
   deliberately does not, because that reflows the paragraph the reader is in the middle of.

### D3 · Compact, verified state

*Sources: `weft/design/craft.md` (field widths at lines 136–145), `weft/design/build.md`. Implemented in Weft:
the SYM-2P codec (Python and JS), the telemetry worker, and the 64-byte frame packer.*

1. **One 64-byte frame.** Everything the renderer needs fits in sixteen `float32`s, which is one cache line.
2. **Verify before display.** Each packet carries the SHA-256 of its payload. The browser checks it with WebCrypto
   before any value reaches the screen, and a line without a hash counts as unverified, not valid.

### D4 · Surfaces that show strain

*Source: `weft/design/bio.md`. Implemented in Weft: the field shader.*

Regions behave like tissue governed by local rules. While a system's tension stays inside its normal band, edges
pulse gently in the chosen hue. As tension rises toward its hard limit, glow and grain change, so strain is visible
without a modal alert. The biological language names what the design aims for. The current implementation is a
shader driven by a few numbers.

### D5 · Places, not pages

*Sources: `weft/design/aywa.md`, `weft/design/converge.md`. Status: design. An earlier version of w3ft.org used
six "loci", and the current site is a single page.*

People remember *where* something lives better than how far down a scroll bar it was. Eido organises a large system
into a few named rooms on a persistent canvas. Choosing a room changes both the written content and the visual field,
so each reinforces the other.

### D6 · Text that answers how it is read

*Builds on D2's reading calm. Implemented here: [`src/reading-weave.js`](../src/reading-weave.js),
[`src/condense.js`](../src/condense.js). Guides: [reading weave](reading-weave.md),
[condensing prose](condensing-prose.md).*

A page usually treats every visitor the same, whether they read it or race past it. Eido treats how someone reads as
a signal the page can answer.

1. **One honest signal.** A restlessness score in [0, 1] rises when the reader skims: passages that were on screen
   but not given time to read, sustained fast scrolling, sudden reversals, long jumps and jerky cursor movement. It
   falls mostly by reading. A passage counts as read at about 600 words a minute, which is lenient on purpose. The
   score is a heuristic, not a model of the reader, and it never leaves the page.
2. **Two answers on the same score.**
   - *The reading weave* resists skimming. Waves pass through the text as a medium: words bob as crests pass, fade in
     the troughs and blur. At the top of the range, links slide away from a hurried cursor. A thread is woven beside
     every paragraph that was actually read. Reading calms the page again.
   - *Condensing prose* meets the skimmer instead. Each time the score crosses a step, the passages still on screen
     are rewritten shorter: full, then concise with proper grammar, then terse, then caveman, then a one-line TL;DR
     per section. An ELI5 button then offers a plain explanation. Words that survive stay in place; the rest strike
     through and collapse.
3. **Bounds the reader can check.** The page may change itself, but only inside limits the reader can see and undo:
   - A panel shows the score, says what is happening and why, and has an off switch that persists.
   - The focused element never moves, text stays text for assistive technology, displacement is capped, a cursor
     held still on a link settles it, and nothing moves under `prefers-reduced-motion`.
   - Condensing is a ratchet that only the reader can turn back. Passages the reader already read stay as written.
     Every condensed passage ends with ≈, and pressing and holding it shows the original. Print shows the full text.
4. **Authored, not generated in the page.** Condensed variants are written ahead of time and shipped as
   `condensed.json`, keyed by a hash of each passage's text. The page never calls a model, so what a reader sees is
   what an author approved.

The two answers suit different pages. A landing page that wants to be read slowly suits the reading weave. A long
paper that a reader may only need the gist of suits condensing prose.

## 3. Value-encoded fields

[`src/cell-layout.js`](../src/cell-layout.js) lays out cells so that each visual channel encodes exactly one
quantity, and the legend can say so:

| Channel | Rule | Code |
|---|---|---|
| Cell area | side = s·√value, so area ratios equal value ratios at every viewport | `layoutCells` |
| Position | rank by value, golden-angle (137.508°) packing stretched to the region's aspect, scale fitted by bisection | `layoutCells` |
| Threads | minimum spanning tree of cell centres within each group (Prim) | `layerThreads` |
| Picking | point-in-footprint test over the computed layout | `hitTest` |
| Text | 5×7 bitmask font, two `u32` per glyph, drawn at whole device pixels | `glyph-font.js` |

Layout happens on the CPU in CSS pixels, and the renderer receives exact rectangles. It never assumes an aspect ratio.

## 4. Eido in use

- **[w3ft.org](https://w3ft.org)** uses D1 directly. Its "style as a point in space" demo runs `simplex-pad.js` and
  `aesthetic-mixer.js` from this repository.
- **w3ft.org** is also where D6 started. The homepage runs the reading weave, and the papers condense as they are
  skimmed.
- **The [Eido site](https://moissanite-labs.github.io/weft-eido/)** runs every module on itself: its home page
  ripples, its philosophy page condenses, and each component has an isolated demo and its source to copy.
- **[ML Weft](https://github.com/Moissanite-Labs/weft)** builds its telemetry field from D1–D4: `weft-loom.js`, the
  WGSL shader and the SYM-2P worker live there and import these modules.
- **Research explainers** are implemented here as
  [`src/research-explainer.js`](../src/research-explainer.js). They put a small deterministic model, its metrics and a
  canvas on one page so a reader can inspect the mechanism. The toy-cell example is illustrative; it is not evidence for any experiment.
