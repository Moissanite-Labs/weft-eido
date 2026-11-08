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

## 2. Five modules

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
- **[ML Weft](https://github.com/Moissanite-Labs/weft)** builds its telemetry field from D1–D4: `weft-loom.js`, the
  WGSL shader and the SYM-2P worker live there and import these modules.
