# `weft-eido` // Sovereign Mathematical Web Engine

`weft-eido` is a zero-DOM, hardware-accelerated web design framework where every pixel is defined by real-time mathematical equations driven by **user kinematics**, **behavioral telemetry**, **geolocation/IP/solar context**, **Barycentric aesthetic chromosomes**, and **System-1 decision models** ([TypeSafe AI's Jev](https://typesafe.ai/), [OpenAI's Decisions API](https://developers.openai.com/api/docs/guides/decisions), and [Laya (`@r4ai/laya-web`)](https://github.com/r4ai/laya-web)).

## Which Model / API Should You Use? (Recommendation)

* **Best Primary Choice — [TypeSafe AI's Jev (`jev-latest`)](https://docs.typesafe.ai/api/system-one):** Purpose-built as a non-autoregressive System-1 model trained via Reinforcement Learning for Calibrated Decisions (RLCD). It evaluates `choice`, `score`, and `noul` primitives in a single parallel forward pass in **~70–114ms** at **$0.042 per 1M input tokens ($0 output tokens)** with a 0% schema error rate. In `weft-eido`, Jev ingests your rolling 5-second behavioral telemetry + geo/IP/solar state and outputs calibrated probabilities that smoothly morph the WebGPU shader uniforms.
* **Best Secondary / Visual Choice — [OpenAI Decisions API (`gpt-6-luna`)](https://developers.openai.com/api/docs/guides/decisions):** Ideal when you also want to pass **canvas visual snapshots (images)** alongside telemetry using `choice`, `score`, and `predicate` questions (~10x faster than standard chat completions at $0.10 per 1M input tokens).
* **Built-In Frame Interpolator — Local Analytical Reflex (`System1TelemetryEngine`):** Runs every single frame (<1ms at 60–120 FPS) so pointer ripples, scroll phase, and foveated relaxation respond instantaneously between 1.8-second Jev / OpenAI Decisions API ticks.

### How to Connect Your Jev or OpenAI API Key
1. Open the running `weft-eido` canvas in your browser and press **`K`** on your keyboard.
2. Paste your **TypeSafe Jev API key** directly (or prefix with `openai:` for an OpenAI API key). The key is stored only in your local browser `localStorage` (`WEFT_JEV_API_KEY` / `WEFT_OPENAI_API_KEY`) and never committed to git.

## Repository Structure

```text
weft-eido/
├── MANIFESTO.md                  # Full architectural thesis, multi-variate pixel equations & System-1 theory
├── CORPUS_AUDIT.md               # Complete 28-file deep-read audit mapping every corpus note to code
├── README.md                     # Repository overview, Jev/OpenAI configuration & module specification
├── index.html                    # Pure Zero-DOM viewport anchor (passes Alkindus Falsifier Gate with 0 divs)
├── scripts/
│   ├── alkindus_gate.py          # Fail-closed static analysis gate rejecting any Web2 DOM tags in index.html
│   └── synbios_harvest.py        # Serverless GitHub telemetry harvester, Gini calculator & SYM-2P emitter
└── src/
    ├── main.js                   # 96-byte WebGPU pipeline orchestrator, UV HUD hit-testing & Canvas2D fallback
    ├── shaders/
    │   └── eido_core.wgsl        # Unified 2D SDF Grid + 3D Morphogenetic Fractal Ray-Marcher + 5x7 Bitmask Font
    ├── mixer/
    │   └── barycentric.js        # Normalized Weight Vector Matrix & unit-circle S^1 angular hue blender
    ├── telemetry/
    │   ├── system1.js            # Rolling 5s kinematic telemetry stream & Alpha/Beta lineage homeostasis
    │   └── jev_bridge.js         # TypeSafe Jev (/v1/systemone), OpenAI Decisions (/v1/decisions) & Geo/IP/Solar sensor
    └── vm/
        └── combinator_vm.js      # Zero-allocation 32-byte Lafont Interaction Combinator VM (C3) & 85/15 Valve
```

## Quickstart & Verification

```bash
# 1. Verify Zero-DOM architectural purity via the Alkindus Falsifier Gate
python3 scripts/alkindus_gate.py index.html

# 2. Generate a fresh SYM-2P telemetry & Gini concentration packet
python3 scripts/synbios_harvest.py

# 3. Serve the sovereign static package locally
python3 -m http.server 8080
```

## Interactive Controls (Zero-DOM Canvas)

* **Bottom-Left Shader Sliders (Drag directly on canvas):**
  1. `TENSION`: Modulates high-frequency sine distortion, `smin` cell bridging, and procedural background grain (`randomNoise2D`).
  2. `GINI-RSK`: Modulates repository card border stroke weight from razor-thin (`0.0`) to brutalist block (`1.0`).
  3. `MITHRAX` / `AIRYNEON` / `SAGECALM`: Barycentric Aesthetic Chromosome weights (automatically normalized to `1.0` with circular hue blending).
  4. `FRACTAL3`: Cross-fades the background vacuum into the **3D Ray-Marched Morphogenetic Fractal Crystal** (`deFractalOrganism`), whose rotation planes tilt with your real-world latitude ($\phi$) and IP entropy seed.
* **Keyboard Shortcuts:**
  - `K`: Configure your **TypeSafe Jev** (`jev-latest`) or **OpenAI Decisions** (`gpt-6-luna`) API key.
  - `Space`: Toggle autonomous System-1 behavioral adaptation.
  - `1` / `2` / `3`: Solo individual Barycentric aesthetic chromosomes.
  - `Scroll / Wheel`: Advances the 3D fractal phase and triggers **Lafont Interaction Combinator (`CON`/`DUP`/`ERA`/`VLV`)** graph reductions.
