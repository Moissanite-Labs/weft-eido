# Eido

The design language of [ML Weft](https://github.com/Moissanite-Labs/weft). A [Moissanite Labs](https://w3ft.org) project.

*Developed under the internal name **Aywa**.*

Eido treats an interface the way Weft treats a model: as something that moves through a continuous space within
bounds you can state. A style is a point you can drag, not a fixed theme. A layout gives each visual channel exactly
one quantity to encode. Text drawn on the GPU comes from a font table the CPU can check.

This repository holds the philosophy and the parts of it that are generic, as small dependency-free ES modules with
tests. Weft's telemetry field (WebGPU shader, SYM-2P worker, loom renderer) is built on these modules and lives in
[Moissanite-Labs/weft](https://github.com/Moissanite-Labs/weft/tree/main/weft/runtime/aywa).

## Modules

| Module | What it does |
|---|---|
| [`src/aesthetic-mixer.js`](src/aesthetic-mixer.js) | Blends style presets with barycentric weights. Linear tokens average linearly, and hue averages on the circle, so red at 0.95 and red at 0.05 doesn't turn into cyan. |
| [`src/simplex-pad.js`](src/simplex-pad.js) | An SVG triangle control whose point *is* the weight vector. It supports pointer and keyboard input and announces its value to screen readers. |
| [`src/cell-layout.js`](src/cell-layout.js) | Value-encoded cell layout: area proportional to value, golden-angle packing fitted to any aspect, plus spanning-tree threads per group and hit testing. |
| [`src/glyph-font.js`](src/glyph-font.js) | A 5×7 bitmask font, two `u32` words per glyph, shared by WebGPU and Canvas2D renderers. |

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

## Philosophy

[`docs/philosophy.md`](docs/philosophy.md) covers the five modules (D1–D5): style as a point in space, analytical
geometry and reading cadence, compact verified state, surfaces that show strain, and places instead of pages. It says
which parts are implemented here, which live in Weft, and which are still design. The design sessions it draws on are
preserved in [Moissanite-Labs/weft-corpus](https://github.com/Moissanite-Labs/weft-corpus).

## Development

Node 20 or newer, with no dependencies:

```bash
npm test
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Every commit needs a DCO sign-off (`git commit -s`), and please follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

Code is under [Apache-2.0](LICENSE) and documentation under [CC BY 4.0](LICENSE-docs). See [NOTICE](NOTICE).
