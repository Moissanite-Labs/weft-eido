// The weave's data: every place on the site, the concepts they are made of,
// and the threads between them. No DOM, so Node can check that every page is
// woven in and every thread lands somewhere real.
//
// A node is a place you can stand on in the weave:
//   kind "page"      a page of this site
//   kind "original"  an uploaded original, kept untouched under examples/
//   kind "external"  work that lives elsewhere (linked, never run here)
//   kind "concept"   an idea, with the equation that states it
// href is relative to the site root (site/). Concept equations are the ones
// the linked page computes or the philosophy states, written as printed there.
//
// Threads are undirected. Three kinds:
//   leads     a page links on to another place
//   embodies  a page is built on, or computes, a concept
//   relates   one concept rests on another

export const KINDS = Object.freeze({
  page: { label: "Page", go: "Go to the page" },
  original: { label: "Original", go: "Open the original" },
  external: { label: "Elsewhere", go: "Open it" },
  concept: { label: "Concept", go: "Read where it lives" },
});

/** Frequency ratio of each family's threads, sharing the home map's: related work rings together. */
export const RATIOS = Object.freeze({ home: 1, modules: 1, research: 4 / 3, rebuild: 7 / 4, concept: 3 / 2 });

const GH = "https://github.com/Moissanite-Labs/weft-eido/blob/main/";

export const NODES = [
  /* ---------- Pages ---------- */
  { id: "home", kind: "page", family: "home", weight: 10, href: "index.html", name: "Eido", code: "HOME",
    eq: "y(x, t) = Σ aₙ · sin(nπx / W) · cos(2π·n·f₁·t + n·φᵢ)",
    line: "An interface that changes, inside limits you can see. Two waves, the field of every line of work, and the style point that colours the site." },
  { id: "philosophy", kind: "page", family: "modules", weight: 9, href: "philosophy.html", name: "Philosophy", code: "D1–D6",
    eq: "D1 style · D2 geometry · D3 state · D4 strain · D5 places · D6 reading",
    line: "Six modules, and plainly which are built here, which live in Weft, and which are still design." },
  { id: "components", kind: "page", family: "modules", weight: 8, href: "components/index.html", name: "Components", code: "7 MODS",
    eq: "7 modules · 0 dependencies · 0 build steps",
    line: "Seven small ES modules, each with a live demo, the files to copy and its full source." },
  { id: "aesthetic-mixer", kind: "page", family: "modules", weight: 6, href: "components/aesthetic-mixer.html", name: "Aesthetic mixer", code: "D1 MIX",
    eq: "a = Σ ŵₖ·Pₖ,   h̄ = atan2(Σ ŵₖ sin θₖ, Σ ŵₖ cos θₖ) / 2π",
    line: "Blend style presets by weight. Hue averages on the circle, so two reds never make cyan." },
  { id: "simplex-pad", kind: "page", family: "modules", weight: 5, href: "components/simplex-pad.html", name: "Simplex pad", code: "D1 PAD",
    eq: "p = w₁·A + w₂·B + w₃·C,   Σ wₖ = 1",
    line: "A triangle you drag. The point is the weight vector, by pointer, finger or arrow keys." },
  { id: "cell-layout", kind: "page", family: "modules", weight: 5, href: "components/cell-layout.html", name: "Cell layout", code: "D2 CEL",
    eq: "area ∝ value,   θₙ = n · π(3 − √5)",
    line: "Area follows value. Golden-angle packing fitted to any region, with a thread through each group." },
  { id: "glyph-font", kind: "page", family: "modules", weight: 5, href: "components/glyph-font.html", name: "Glyph font", code: "5X7 BIT",
    eq: "35 bits a glyph: 20 in word₀, 15 in word₁",
    line: "Letters from a table of bits. Every title on this site is first assembled from them." },
  { id: "reading-weave", kind: "page", family: "modules", weight: 6, href: "components/reading-weave.html", name: "Reading weave", code: "D6 RW",
    eq: "r ← clamp₀¹(r + Δt·(0.14·skim + 0.06·jolt − 0.05·reading))",
    line: "Text ripples when you skim and settles when you read, with a switch to stop it." },
  { id: "condense", kind: "page", family: "modules", weight: 5, href: "components/condense.html", name: "Condensing prose", code: "D6 CON",
    eq: "full → concise → terse → caveman → TL;DR",
    line: "An article rewrites itself shorter as it is skimmed. What you already read stays as written." },
  { id: "research-explainer", kind: "page", family: "research", weight: 5, href: "components/research-explainer.html", name: "Research explainer", code: "TOY MOD",
    eq: "same seed → same run → same printed metrics",
    line: "A deterministic toy model you can step, with its numbers in plain sight. It claims no evidence." },
  { id: "harmonic", kind: "page", family: "research", weight: 8, href: "causal-harmonic/index.html", name: "Compute by resonance", code: "CHORDS",
    eq: "dθᵢ/dt = ωᵢ + K·r·sin(ψ − θᵢ)",
    line: "Coupled oscillators settle into whole-number ratios: chords. Healthy, it is consonant; straining, it beats." },
  { id: "strata", kind: "page", family: "research", weight: 6, href: "causal-harmonic/weft.html", name: "Three strata", code: "MAC MES MIC",
    eq: "rule · attractor · plate · W·x = y",
    line: "Local rules shape structure, an attractor wanders, a plate radiates, and provenance cannot drift." },
  { id: "paper", kind: "page", family: "research", weight: 5, href: "causal-harmonic/paper.html", name: "The paper", code: "PAPER",
    eq: "mechanism → chord → wavelength",
    line: "Causal Algorithmic Symphonic Synthesis, in full, condensing as you skim." },
  { id: "soundtrack", kind: "page", family: "research", weight: 5, href: "causal-harmonic/soundtrack.html", name: "The Paracausal Loom", code: "SONG",
    eq: "aₙ ← the song's energy in band n,   n = 1 … 7",
    line: "The song, its lyrics lit as they are sung, and five seconds the kernel rendered itself." },
  { id: "originals", kind: "page", family: "research", weight: 4, href: "causal-harmonic/originals.html", name: "Originals", code: "ARCHIVE",
    eq: "uploaded = served, byte for byte",
    line: "Every upload behind the harmonic pages, untouched." },
  { id: "simulations", kind: "page", family: "research", weight: 7, href: "research/index.html", name: "Substrate simulations", code: "E08–E12",
    eq: "‖W − W₀‖_F ≤ R",
    line: "A cell that wanders only inside a ball, a genotype that unfolds, a graft that cannot touch what its host keeps." },
  { id: "chebyshev", kind: "page", family: "research", weight: 6, href: "research/chebyshev.html", name: "Two measures, four worlds", code: "CHEB ID",
    eq: "worlds apart ⇔ ‖p − q‖∞ > 2ε",
    line: "Chebyshev identifiability: how much bounded noise a design survives. Synthetic worlds only." },

  /* ---------- Originals and elsewhere ---------- */
  { id: "e13", kind: "original", family: "research", weight: 3, href: "../examples/simulations/e13_transitive_cascade.html", name: "E13: the transitive cascade", code: "E13",
    eq: "", line: "The original explorer, untouched: not yet rebuilt on the loom." },
  { id: "asma", kind: "original", family: "research", weight: 3, href: "../examples/simulations/asma_subspace_paraneoplastic.html", name: "Project Asma: five paths", code: "ASMA",
    eq: "", line: "The five-path explorer, untouched: not yet rebuilt on the loom." },
  { id: "suite", kind: "original", family: "research", weight: 3, href: "../examples/simulations/index.html", name: "The original suite", code: "SUITE",
    eq: "", line: "The tabbed simulation suite as uploaded, untouched." },
  { id: "cheb-original", kind: "original", family: "research", weight: 3, href: "../examples/visualizations/project-asma-chebyshev-identifiability-explorer.html", name: "The original explorer", code: "CHEB 0",
    eq: "", line: "The Chebyshev explorer as archived on 13 November 2026, untouched." },
  { id: "field-pr", kind: "external", family: "rebuild", weight: 4, href: "https://github.com/Moissanite-Labs/weft-eido/pull/6", name: "GPU field", code: "GPU FLD", blocked: true,
    eq: "", line: "Pull request 6: the WebGPU rebuild. Blocked, with its blockers named. No code from it runs here." },

  /* ---------- Concepts ---------- */
  { id: "d1", kind: "concept", family: "concept", weight: 5, href: "philosophy.html#d1", name: "Style as a point", code: "D1",
    eq: "a = Σ ŵₖ·Pₖ,   ŵₖ = wₖ / Σ wⱼ",
    line: "A style is a point in a continuous space, not a theme from a list. Drag it, and every page turns with it." },
  { id: "d2", kind: "concept", family: "concept", weight: 4, href: "philosophy.html#d2", name: "Analytical geometry", code: "D2",
    eq: "shape = { p : d(p) ≤ 0 }",
    line: "Cells, borders and glyphs are computed from exact geometry, so they stay sharp at any zoom." },
  { id: "d3", kind: "concept", family: "concept", weight: 4, href: "philosophy.html#d3", name: "Compact, verified state", code: "D3",
    eq: "16 × float32 = 64 B,  SHA-256 checked before display",
    line: "Everything the renderer needs in one cache line, verified before any value reaches the screen. Lives in Weft." },
  { id: "d4", kind: "concept", family: "concept", weight: 4, href: "philosophy.html#d4", name: "Surfaces that show strain", code: "D4",
    eq: "tension = clamp₀¹(0.55·rest + 0.45·jerk)",
    line: "Strain shows in the surface, not in a modal. On the home map, thread width is this tension." },
  { id: "d5", kind: "concept", family: "concept", weight: 5, href: "philosophy.html#d5", name: "Places, not pages", code: "D5",
    eq: "z ↦ (z − a) / (1 − ā·z)",
    line: "People remember where a thing lives. This weave keeps every place in view while you move between them." },
  { id: "d6", kind: "concept", family: "concept", weight: 5, href: "philosophy.html#d6", name: "Text that answers reading", code: "D6",
    eq: "rest ∈ [0, 1],  every effect can be switched off",
    line: "A page notices how it is being read and answers, inside bounds the reader can see and stop." },
  { id: "fields", kind: "concept", family: "concept", weight: 4, href: "philosophy.html#fields", name: "One channel, one quantity", code: "FIELDS",
    eq: "area ∝ value,  hue ← style,  width ← tension",
    line: "Each visual channel carries exactly one quantity, and the page says which." },
  { id: "circular-mean", kind: "concept", family: "concept", weight: 3, href: "components/aesthetic-mixer.html#what", name: "Circular mean", code: "atan2",
    eq: "h̄ = atan2(Σ wₖ sin θₖ, Σ wₖ cos θₖ)",
    line: "Angles average on the circle. The mixer blends hue this way, and this weave turns to meet your last view the same way." },
  { id: "simplex", kind: "concept", family: "concept", weight: 3, href: "components/simplex-pad.html#what", name: "The simplex", code: "Δ²",
    eq: "Σ wₖ = 1,   wₖ ≥ 0",
    line: "Weights that must add to one live on a triangle, and every point inside it is exactly one choice." },
  { id: "golden-angle", kind: "concept", family: "concept", weight: 3, href: "components/cell-layout.html#what", name: "Golden angle", code: "137.5°",
    eq: "θₙ = n · π(3 − √5) ≈ n · 137.508°",
    line: "Turn each new cell by the golden angle and no two ever line up: Vogel's sunflower." },
  { id: "bitmask", kind: "concept", family: "concept", weight: 3, href: "components/glyph-font.html#what", name: "Bitmask glyphs", code: "u32 × 2",
    eq: "b = 5r + c,   bit = (b < 20 ? w₀ : w₁) >> (b mod 20) & 1",
    line: "A letter is 35 bits. They do not fit one 32-bit word, so each glyph takes two, read the same way by GPU and canvas." },
  { id: "restlessness", kind: "concept", family: "concept", weight: 3, href: "components/reading-weave.html#what", name: "Restlessness", code: "rest",
    eq: "r ← clamp₀¹(r + Δt·(0.14·skim + 0.06·jolt − 0.05·reading))",
    line: "A score that rises when a reader skims and falls when they read. It never leaves the page." },
  { id: "condensing", kind: "concept", family: "concept", weight: 3, href: "components/condense.html#what", name: "Condensing", code: "TL;DR",
    eq: "full → concise → terse → caveman → TL;DR",
    line: "Prose rewrites itself shorter, level by level, on the same score. Passages already read stay put." },
  { id: "weft", kind: "concept", family: "concept", weight: 5, href: "index.html", name: "The weft", code: "WEFT",
    eq: "d(x, i, t) = Σ aₙ(t) · sin(nπx / W) · cos(2π·n·f₁·t + n·i·φ)",
    line: "The threads behind every page: strings pinned at both ends, moving only in whole-number partials." },
  { id: "superposition", kind: "concept", family: "concept", weight: 4, href: "index.html#two", name: "Superposition", code: "x : y",
    eq: "x = sin(2πt + δ),   y = sin(2π·r·t)",
    line: "Two waves in a ratio make one figure. A whole-number ratio closes it; any other turns forever." },
  { id: "interference", kind: "concept", family: "concept", weight: 4, href: "index.html#field-h", name: "Interference", code: "ψ",
    eq: "ψ = Σᵢ Aᵢ · e^(−dᵢ/ℓᵢ) · cos(k·dᵢ − ω·t + φᵢ)",
    line: "Sources of one frequency make fringes that stand still; between frequencies, the fringes drift at the beat." },
  { id: "wavefront", kind: "concept", family: "concept", weight: 4, href: GH + "site/assets/loom-core.js", name: "Wavefront", code: "r = ct",
    eq: "r(t) = c · (t − t₀)",
    line: "Every block on this site is revealed exactly where a front reaches it, and the front is drawn in the weft." },
  { id: "hyperbolic", kind: "concept", family: "concept", weight: 5, href: GH + "site/assets/weave-math.js", name: "The hyperbolic weave", code: "τₐ",
    eq: "d(z, w) = 2·artanh |z − w| / |1 − z̄·w|",
    line: "This map. Every move is a Möbius transformation, an isometry, so the length of every thread is kept." },
  { id: "locking", kind: "concept", family: "concept", weight: 4, href: "causal-harmonic/index.html#lock", name: "Locking", code: "K꜀ = 2γ",
    eq: "dθᵢ/dt = ωᵢ + K·r·sin(ψ − θᵢ)",
    line: "Oscillators each nudged toward the crowd. Below a critical coupling they drift; above it they fall into step." },
  { id: "roughness", kind: "concept", family: "concept", weight: 3, href: "causal-harmonic/index.html#rough", name: "Consonance", code: "D(α)",
    eq: "D(α) = Σᵢⱼ aᵢaⱼ · (e^(−3.51·s·Δf) − e^(−5.75·s·Δf))",
    line: "Overtones rub. The rubbing falls away where they coincide, and those places are the simple ratios." },
  { id: "tongues", kind: "concept", family: "concept", weight: 3, href: "causal-harmonic/index.html#tongues", name: "Arnold tongues", code: "W = p/q",
    eq: "θₙ₊₁ = θₙ + Ω − (K / 2π)·sin(2πθₙ)",
    line: "Kick an oscillator once a turn. Where its winding number holds at a ratio, it is locked." },
  { id: "automata", kind: "concept", family: "concept", weight: 3, href: "causal-harmonic/weft.html#macro", name: "Local rules", code: "rule 110",
    eq: "cᵢ′ = bit (4·cᵢ₋₁ + 2·cᵢ + cᵢ₊₁) of the rule",
    line: "Each cell reads itself and two neighbours. The structure is not drawn; it happens." },
  { id: "attractor", kind: "concept", family: "concept", weight: 3, href: "causal-harmonic/weft.html#meso", name: "Halvorsen attractor", code: "ẋ ẏ ż",
    eq: "ẋ = −a·x − 4y − 4z − y²   (and cyclically)",
    line: "Three coupled equations, symmetric under x → y → z. The path never closes and never leaves." },
  { id: "plate", kind: "concept", family: "concept", weight: 3, href: "causal-harmonic/weft.html#micro", name: "Nodal lines", code: "ωₘₙ",
    eq: "ω²ₘₙ = (T₀·γ² + D·γ⁴) / (ρh)",
    line: "Sand settles where a driven plate is still, so the plate draws its own modes." },
  { id: "null-space", kind: "concept", family: "concept", weight: 4, href: "causal-harmonic/weft.html#prov", name: "Null-space gate", code: "I − xxᵀ",
    eq: "W ← W + ΔW·(I − x·xᵀ)   keeps W·x = y exactly",
    line: "Project an update away from what must be kept, and it is kept exactly while everything else learns." },
  { id: "bounded", kind: "concept", family: "concept", weight: 5, href: "research/index.html#statistical-title", name: "Bounds you can check", code: "‖·‖ ≤ R",
    eq: "‖W − W₀‖_F ≤ R",
    line: "Weft's idea: a model may change itself, but only inside a bound anyone can check. Eido does the same for a page." },
  { id: "morphogenesis", kind: "concept", family: "concept", weight: 3, href: "research/index.html#morphogenesis-title", name: "Morphogenesis", code: "492 B",
    eq: "492 B packet → 64² … 512² floats",
    line: "A packet of combinator nodes reduces into a weight matrix thousands of times its size." },
  { id: "identifiability", kind: "concept", family: "concept", weight: 3, href: "research/chebyshev.html#boxes", name: "Identifiability", code: "L∞",
    eq: "‖p − q‖∞ = max(|Δx|, |Δy|) > 2ε",
    line: "Two worlds stay apart while their noise boxes do not touch." },
];

/** Threads, written from each place outward. Duplicates and order do not matter. */
const THREADS = {
  home: { leads: ["philosophy", "components", "harmonic", "simulations", "chebyshev", "aesthetic-mixer", "reading-weave", "research-explainer", "glyph-font", "field-pr"],
    embodies: ["weft", "superposition", "interference", "wavefront", "circular-mean", "simplex", "d4", "fields", "d5"] },
  philosophy: { leads: ["components", "simulations", "harmonic"], embodies: ["d1", "d2", "d3", "d4", "d5", "d6", "fields"] },
  components: { leads: ["aesthetic-mixer", "simplex-pad", "cell-layout", "glyph-font", "reading-weave", "condense", "research-explainer"] },
  "aesthetic-mixer": { leads: ["simplex-pad"], embodies: ["d1", "circular-mean"] },
  "simplex-pad": { embodies: ["d1", "simplex"] },
  "cell-layout": { embodies: ["d2", "golden-angle", "fields"] },
  "glyph-font": { embodies: ["d2", "bitmask"] },
  "reading-weave": { leads: ["condense"], embodies: ["d6", "restlessness", "wavefront"] },
  condense: { embodies: ["d6", "restlessness", "condensing"] },
  "research-explainer": { leads: ["simulations"], embodies: ["d3", "d4"] },
  harmonic: { leads: ["strata", "paper", "soundtrack", "originals"], embodies: ["locking", "roughness", "tongues", "superposition"] },
  strata: { leads: ["paper", "soundtrack", "originals"], embodies: ["automata", "attractor", "plate", "null-space"] },
  paper: { leads: ["soundtrack", "originals"], embodies: ["locking", "roughness", "condensing"] },
  soundtrack: { leads: ["originals"], embodies: ["weft"] },
  simulations: { leads: ["chebyshev", "e13", "asma", "suite"], embodies: ["bounded", "morphogenesis", "null-space"] },
  chebyshev: { leads: ["e13", "asma", "cheb-original"], embodies: ["identifiability"] },
  "field-pr": { embodies: ["d3", "d4"] },
  d1: { relates: ["circular-mean", "simplex"] },
  d2: { relates: ["bitmask", "golden-angle"] },
  d4: { relates: ["restlessness"] },
  d5: { relates: ["hyperbolic"] },
  d6: { relates: ["restlessness", "condensing"] },
  fields: { relates: ["golden-angle", "interference"] },
  weft: { relates: ["superposition", "wavefront", "interference"] },
  superposition: { relates: ["locking", "roughness", "plate"] },
  locking: { relates: ["tongues"] },
  hyperbolic: { relates: ["circular-mean", "wavefront"] },
  bounded: { relates: ["null-space", "identifiability", "d6"] },
};

/** Every thread once: [{ a, b, kind }], with a before b in NODES order. */
export const EDGES = (() => {
  const index = new Map(NODES.map((n, i) => [n.id, i]));
  const seen = new Map();
  for (const [from, groups] of Object.entries(THREADS)) {
    for (const [kind, list] of Object.entries(groups)) {
      for (const to of list) {
        const [a, b] = index.get(from) <= index.get(to) ? [from, to] : [to, from];
        const key = `${a}|${b}`;
        if (!seen.has(key)) seen.set(key, { a, b, kind });
      }
    }
  }
  return [...seen.values()];
})();

/**
 * The weave as a graph: { byId, ids, adj, edges }. Neighbours in adj are
 * ordered pages first, then by weight, so the layout is the same every time.
 */
export function weaveGraph(nodes = NODES, edges = EDGES) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rank = (id) => { const n = byId.get(id); return (n.kind === "concept" ? 1 : 0) * 100 - n.weight; };
  const adj = Object.fromEntries(nodes.map((n) => [n.id, []]));
  for (const e of edges) { adj[e.a].push(e.b); adj[e.b].push(e.a); }
  for (const id of Object.keys(adj)) adj[id].sort((p, q) => rank(p) - rank(q) || nodes.indexOf(byId.get(p)) - nodes.indexOf(byId.get(q)));
  return { byId, ids: nodes.map((n) => n.id), adj, edges };
}

/** The neighbours of a node, split the way the panel lists them. */
export function connections(graph, id) {
  const out = { places: [], concepts: [] };
  for (const u of graph.adj[id] || []) (graph.byId.get(u).kind === "concept" ? out.concepts : out.places).push(u);
  return out;
}
