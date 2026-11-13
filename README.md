# Eido

The design language of [ML Weft](https://github.com/Moissanite-Labs/weft). A [Moissanite Labs](https://w3ft.org) project.

*Developed under the internal name **Aywa**.*

Weft studies models that change themselves within bounds you can check. Eido is the first level of putting that
philosophy into practice, in the place people meet it every day: the interface. An Eido interface changes itself in
response to the person using it, and only within bounds that person can see, check and undo.

Concretely: a style is a point you can drag, not a fixed theme. A layout gives each visual channel exactly one
quantity to encode. Text drawn on the GPU comes from a font table the CPU can check. And a page can notice how it is
being read: it ripples when a reader skims, or condenses its own prose into a shorter version, with a panel that says
what it is doing and a switch to stop it.

This repository holds the philosophy and the parts of it that are generic, as small dependency-free ES modules with
tests and guides, so anyone can use them on their own site. Weft's telemetry field (WebGPU shader, SYM-2P worker,
loom renderer) is built on these modules and lives in
[Moissanite-Labs/weft](https://github.com/Moissanite-Labs/weft/tree/main/weft/runtime/aywa).

**See it working:** the [Eido site](https://moissanite-labs.github.io/weft-eido/) runs every module on itself. Each
component has an isolated demo, its options, and its source with a copy button.

## Modules

| Module | What it does |
|---|---|
| [`src/aesthetic-mixer.js`](src/aesthetic-mixer.js) | Blends style presets with barycentric weights. Linear tokens average linearly, and hue averages on the circle, so red at 0.95 and red at 0.05 doesn't turn into cyan. |
| [`src/simplex-pad.js`](src/simplex-pad.js) | An SVG triangle control whose point *is* the weight vector. It supports pointer and keyboard input and announces its value to screen readers. |
| [`src/cell-layout.js`](src/cell-layout.js) | Value-encoded cell layout: area proportional to value, golden-angle packing fitted to any aspect, plus spanning-tree threads per group and hit testing. |
| [`src/glyph-font.js`](src/glyph-font.js) | A 5×7 bitmask font, two `u32` words per glyph, shared by WebGPU and Canvas2D renderers. |
| [`src/reading-weave.js`](src/reading-weave.js) | The reading weave. A restlessness score rises when a reader skims and falls when they read. Waves ripple through the text, links slide away from a hurried cursor, and read paragraphs get a thread beside them. Guide: [`docs/reading-weave.md`](docs/reading-weave.md). |
| [`src/condense.js`](src/condense.js) | Condensing prose. On the same score, an article rewrites itself shorter as it is skimmed: concise, terse, caveman, then a TL;DR per section and an ELI5 on request. Passages already read stay as written. Guide: [`docs/condensing-prose.md`](docs/condensing-prose.md). |
| [`src/research-explainer.js`](src/research-explainer.js) | Research explainer primitives. A deterministic toy model, inspectable controls, fixed metric text and canvas rendering. The shipped example is illustrative and does not claim evidence for any experiment. |

```js
import { mixAestheticPresets } from "./src/aesthetic-mixer.js";

mixAestheticPresets(
  { calm: { rounding: 0.85, density: 0.3, hue: 0.95, contrast: 0.05 },
    sharp: { rounding: 0.0, density: 0.1, hue: 0.05, contrast: 0.01 } },
  { calm: 0.5, sharp: 0.5 },
);
// → { rounding: 0.425, density: 0.2, hue: 0 (red, not cyan), contrast: 0.03 }
```

See it running in the "style as a point in space" demo on [w3ft.org](https://w3ft.org/#mixer), or open
[`examples/mixer.html`](examples/mixer.html) from a local server:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000/examples/mixer.html>.

## Use the reading systems on your site

Copy `src/reading-weave.js` and `css/reading-weave.css` for the ripple. Add `src/condense.js` and `css/condense.css`
for condensing prose. Neither needs a build step or a dependency.

```html
<link rel="stylesheet" href="css/reading-weave.css">
<script type="module">
  import { setupReadingWeave } from "./src/reading-weave.js";
  setupReadingWeave(); // paragraphs and list items in <main> ripple when skimmed
</script>
```

Condensing prose runs on the same score. It needs a `condensed.json` beside the page, with the shorter versions of
each passage written ahead of time:

```html
<link rel="stylesheet" href="css/reading-weave.css">
<link rel="stylesheet" href="css/condense.css">
<script type="module">
  import { setupReadingWeave } from "./src/reading-weave.js";
  import { loadCondensed, setupCondense } from "./src/condense.js";

  loadCondensed().then((data) => {
    if (!data) return setupReadingWeave(); // no condensed versions: ripple instead
    const reading = setupReadingWeave({ motion: false, panel: false });
    if (reading) setupCondense(data, reading, { article: "article" });
  });
</script>
```

The guides cover the signals, the guardrails, every option, theming, and how to write and check `condensed.json`
(including a prompt for drafting the variants with a model):
[reading weave](docs/reading-weave.md) and [condensing prose](docs/condensing-prose.md). Working pages:
[`examples/reading-weave.html`](examples/reading-weave.html) and [`examples/condense/`](examples/condense/).

## Philosophy

[`docs/philosophy.md`](docs/philosophy.md) covers the six modules (D1–D6): style as a point in space, analytical
geometry and reading cadence, compact verified state, surfaces that show strain, places instead of pages, and text
that answers how it is read. It says
which parts are implemented here, which live in Weft, and which are still design. The design sessions it draws on are
preserved in [Moissanite-Labs/weft-corpus](https://github.com/Moissanite-Labs/weft-corpus).

## Development

Node 20 or newer, with no dependencies:

```bash
npm test
```

To work on the site, serve the repository root and open <http://localhost:8000/site/>:

```bash
python3 -m http.server 8000
```

Pushes to `main` publish the site with GitHub Pages ([`.github/workflows/pages.yml`](.github/workflows/pages.yml)).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Every commit needs a DCO sign-off (`git commit -s`), and please follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

Code is under [Apache-2.0](LICENSE) and documentation under [CC BY 4.0](LICENSE-docs). See [NOTICE](NOTICE).
