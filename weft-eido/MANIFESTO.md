# WEFT-EIDO // The Sovereign Mathematical Web Manifesto

> **Thesis:** Modern web design is trapped in an artificial, 1990s document prison—the Document Object Model (DOM). By replacing nested rectangular `<div>` trees and static CSS stylesheets with hardware-accelerated **Signed Distance Fields (SDFs)**, **3D Morphogenetic Fractal Raymarching**, **Barycentric Aesthetic Vectors**, **Procedural GPU Typography**, **Lafont Interaction Combinators**, and **System-1 Decision Models** ([TypeSafe AI's Jev](https://typesafe.ai/), [OpenAI's Decisions API](https://developers.openai.com/api/docs/guides/decisions), and [Laya (`@r4ai/laya-web`)](https://github.com/r4ai/laya-web)), a webpage ceases to be a static document and becomes a self-organizing mathematical organism running natively on client silicon.

## 1. The Multi-Variate Pixel Equation

In `weft-eido`, no pixel is painted by a static layout engine or pre-rendered image asset. Every pixel color $\mathbf{C}(x, y, t)$ is evaluated 60–120 times per second as a continuous function of six real-time variable domains packed into a 96-byte (24-float) WebGPU uniform bus:

$$\mathbf{C}(\mathbf{p}, t) = \mathcal{F}\Big(\mathbf{p}, \ \mathbf{I}_{\text{kinematics}}, \ \mathbf{B}_{\text{barycentric}}, \ \mathbf{G}_{\text{geo/IP/solar}}, \ \mathbf{S}_1(\text{Jev}), \ \mathbf{O}_{\text{telemetry}}\Big)$$

| Variable Domain | Real-Time Signals Ingested | Mathematical Role in the Fragment Shader (`eido_core.wgsl`) |
| :--- | :--- | :--- |
| **1. Spatial Field ($\mathbf{p}$)** | Zero-input full-screen triangle UV $\in [-1, 1]^2$, aspect-corrected NDC | Evaluates 2D SDF cells (`sdRoundedBox`), polynomial smooth union (`smin`), and 3D raymarching rays |
| **2. User Kinematics ($\mathbf{I}$)** | Pointer coordinates $(p_x, p_y)$, velocity $(v_x, v_y)$, acceleration variance ($\sigma^2_a$), click ripples, scroll phase ($\phi_s$) | Drives radial standing-wave ripples, magnetic button stretching toward the cursor, and Lafont combinator graph reductions |
| **3. Barycentric DNA ($\mathbf{B}$)** | Normalized weight vector $\hat{\mathbf{w}}$ across $N$ style chromosomes (`rounding`, `density`, `hue_shift`, `contrast`) | Interpolates corner radii, grid domain spacing, background luma, and shortest-arc circular hue ($\text{atan2}(\sum \hat{w}_i \sin\theta_i, \sum \hat{w}_i \cos\theta_i)$) |
| **4. Geo / IP / Solar ($\mathbf{G}$)** | Visitor Latitude ($\phi$), Longitude ($\lambda$), IP entropy seed ($H_{\text{ip}}$), local solar zenith ($\theta_{\text{sun}}$), network RTT | Modulates 3D fractal Coriolis rotation planes (`rotate2D`), watermark carrier frequency, and diurnal background luminance |
| **5. System-1 Judgment ($\mathbf{S}_1$)** | Calibrated probabilities from [TypeSafe Jev (`jev-latest`)](https://docs.typesafe.ai/api/system-one), [OpenAI Decisions (`gpt-6-luna`)](https://developers.openai.com/api/docs/guides/decisions), or local reflex | Controls **Foveated Typographic Relaxation**, localized sage Focus Field reading glows, tension jitter, and 2D-to-3D fractal morphing |
| **6. Org & Ledger Telemetry ($\mathbf{O}$)** | Active nodes, tension ($\tau$), Gini concentration ($G$), maintainer ownership ratio, contributor capture gravity | Controls SDF border stroke weight ($G$), node width-to-height ratio (`owner_ratio`), gravitational field sag (`capture`), and digital grain (`randomNoise2D`) |

## 2. Core Mathematical Primitives

### A. Zero-Input Viewport Topology
Instead of uploading vertex buffers from JavaScript, `vertex_main` generates a single full-screen triangle covering `[-1, 1]` UV space via bitwise shifts on `@builtin(vertex_index)`:
$$x = \text{f32}((\text{vertex\_id} \ll 1) \ \& \ 2) - 1.0, \quad y = \text{f32}(\text{vertex\_id} \ \& \ 2) - 1.0$$

### B. Signed Distance Fields & Smooth Minimum (`smin`)
UI nodes exist as implicit surfaces $f(\mathbf{p}) = d$. Adjacent cells merge organically under high organizational tension via polynomial smooth minimum:
$$h = \frac{\max(k - |a - b|, 0)}{k}, \quad \text{smin}(a, b, k) = \min(a, b) - \frac{1}{6}h^3 k$$

### C. 3D Morphogenetic Fractal Ray-Marching (`deFractalOrganism`)
Synthesized from [`attempt/demo.md`](file:///Users/kethuda/Documents/exo/weft/corpus/design/attempt/demo.md), the background vacuum can continuously morph into a 3D ray-marched crystal lattice using iterative space folding, 2D plane rotations driven by the visitor's latitude $\phi$, and spherical inversion:
$$\mathbf{p}_{k+1} = \frac{1.35}{\text{clamp}(\mathbf{p}_k \cdot \mathbf{p}_k, \ 0.03, \ 1.0)} \cdot R_{yz}(\theta_z) R_{xy}(\theta_x) \big(|\mathbf{p}_k| - \mathbf{c}\big)$$

### D. Algebraic Bitmask Typography (`5x7` Integer Glyph Matrices)
All text labels and live decimal readouts bypass the browser's DOM font engine. Characters are packed as 32-bit unsigned integer bitmasks inside GPU storage buffers (`@group(0) @binding(1)`) and evaluated per-pixel via bitwise shifts:
$$\text{bit}(\mathbf{p}) = \big(\text{mask}(\text{ascii}) \gg (34 - (5 \cdot \text{row} + \text{col}))\big) \ \& \ 1$$

### E. Economic Gini Concentration & 5D Org Telemetry
Synthesized from [`feeed.md`](file:///Users/kethuda/Documents/exo/weft/corpus/design/feeed.md) and [`build.md`](file:///Users/kethuda/Documents/exo/weft/corpus/design/build.md), repository contributor inequality is measured via the Gini Coefficient:
$$G = \frac{\sum_{i=1}^{n} \sum_{j=1}^{n} |x_i - x_j|}{2 n \sum_{i=1}^{n} x_i} \in [0, 1]$$
and mapped directly to the SDF border stroke thickness (`mix(0.002, 0.013, gini_concentration)`), while `owner_ratio` shapes aspect ratio and `contributor_capture` induces gravitational coordinate sag.

## 3. System-1 Decision Architecture: Jev vs. OpenAI Decisions vs. Local Reflex

Autoregressive chat LLMs (System 2) generate tokens sequentially, introducing multi-second latency and schema fragility that stall 60–120 FPS animation loops. `weft-eido` separates deep offline synthesis from real-time **System-1 judgments**:

| Engine Tier | Endpoint & Model | Question Primitives | Latency & Cost Profile | Role in `weft-eido` |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1 (Primary): [TypeSafe AI Jev](https://typesafe.ai/)** | `POST https://api.typesafe.ai/v1/systemone` (`jev-latest`) | `choice`, `score`, `noul` (trained via RLCD) | **~70–114ms**, $0.042 / 1M input tokens, **$0 output tokens**, 0% schema error | Evaluates telemetry + geo/IP state in a single parallel pass to output calibrated probabilities for `cognitive_mode`, `structural_tension`, `visual_topology`, and `foveated_relaxation` |
| **Tier 2 (Multimodal): [OpenAI Decisions API](https://developers.openai.com/api/docs/guides/decisions)** | `POST https://api.openai.com/v1/decisions` (`gpt-6-luna`) | `choice`, `score`, `predicate` (text + image inputs) | **~10x faster than Responses API**, $0.10 / 1M input tokens, $0 output tokens | Evaluates telemetry state or canvas visual snapshots against bounded rubrics |
| **Tier 3 (Zero-Latency Local): Kinematic + [Laya](https://github.com/r4ai/laya-web)** | In-browser JS / WebGPU (`System1TelemetryEngine`) | Continuous rolling-window kinematics + `@r4ai/laya-web` | **< 1ms (analytical) / 30ms (WASM)**, $0 cost, 100% offline privacy | Runs every frame (60–120 FPS) and smoothly interpolates between asynchronous Jev / OpenAI Decisions updates |

## 4. Symbolic Interaction Combinators (`C3`), Frobenius Gate & Stigmergic Ecology

Synthesized from [`attempt/again/story.md`](file:///Users/kethuda/Documents/exo/weft/corpus/design/attempt/again/story.md), [`attempt/realization.md`](file:///Users/kethuda/Documents/exo/weft/corpus/design/attempt/realization.md), and [`attempt/gate.md`](file:///Users/kethuda/Documents/exo/weft/corpus/design/attempt/gate.md):

1. **Zero-Allocation Lafont Interaction Combinator VM (`src/vm/combinator_vm.js`):** Pre-allocates a contiguous 32-byte-per-node `ArrayBuffer` arena executing Lafont graph reductions (`ERA`, `CON`, `DUP`) alongside Weft constitutional opcodes (`VLV` 85% Weaver / 15% Burn Metabolic Excision Valve, `FRC` 85% Tension Fracture Halt, and `SUP` Speculative Mitosis).
2. **Frobenius Invariant Gate ($\|W\|_F \le R_{\text{gate}}$):** Audits speculative $\alpha/\beta$ lineage drift before promoting mutations into the active uniform frame.
3. **Alkindus Architectural Falsifier Gate (`scripts/alkindus_gate.py`):** A fail-closed static analysis immune gate that scans `index.html` and aborts deployment if any legacy Web2 DOM tags (`<div>`, `<span>`, `<section>`, `<table>`, `<ul>`, `display: flex|grid`, `tailwind`) or multiple `<canvas>` elements are detected.
4. **Stigmergic Bi-Directional Write-Back (`SYM-2P`):** Visitors can export their Barycentric vector as a canonical `SYM-2P` strand (`:02:04:0001[s-exp ...]sha256`) and commit it back to the repository via the serverless GitHub Device Flow, mutating the shared visual DNA for all connected peers.
