# Weft Interactive Research Simulations (`Eido` Field Modules)

Dependency-free, standalone HTML5 Canvas interactive simulations accompanying the zero-lexicon, morphogenetic, and plasmid-splicing experiments in `Moissanite-Labs/weft`:

1. **Statistical Cell & Harness Decoder (`?sim=statistical`, `weft` #141 / #147):**
   - Pointer-interactive `8x8` tensor genotype (`Plasm` frozen core rows `0..1` + plastic periphery rows `2..7`) decoded in real time across **Naked Matrix $W$**, **Parametric $(\mu, \Sigma)$**, and **Causal SCM $\mathrm{do}(X)$** regimes under Frobenius / KL safety bounds.
2. **Morphogenetic `IC-to-Plasm` Unfolding (`?sim=morphogenesis`, `weft` #153 / #155 `E11`):**
   - Interactive `492-byte` 24-node `WEFT` Binary Combinator Packet (`CON`, `DUP`, `FRC`, `SUP`, `VLV`, `ERA`) reducing step-by-step and unfolding across `64^2` to `512^2` `Plasm` weight matrices (`2,131x` wire compression) and metachronal ciliary propulsion rings.
3. **Horizontal `BCP` Plasmid Grafting & Jacobian Null-Space Gate (`?sim=plasmid`, `weft` #157 / #159 `E12`):**
   - Live `172-byte` auxiliary-port `SUP(5)` combinator plasmid splicing onto channel-permuted sibling organisms, contrasting **Jacobian Null-Space Projection** ($\Delta W(I - Q_{\text{keep}} Q_{\text{keep}}^\top)$, `10/12` shifted-retention pass) against **Ungated Splicing** and **Permuted Raw Copy** across `1.0x-2.8x` distribution shift.
4. **3-Cell Transitive `BCP` Plasmid Cascade & `WFSK` Subspace Flag Explorer (`e13_transitive_cascade.html`, `E13` companion to `Moissanite-Labs/weft#174`):**
   - Interactive 3-cell transitive BCP plasmid cascade simulation detailing 2-hop (A→B→C) and 1-hop (B→C) subspace flag retention across G1–G4 gating arms.
5. **Project Asma 5-Path Subspace, Epitope-Core & Trial Power Explorer (`asma_subspace_paraneoplastic.html`, linked to `Foundation-0/project-asma` PR #92):**
   - Project Asma 5-path subspace-flag, `CDR2L`/`CDR2` 9-mer MHC-II core bifurcation, `3/40` seed supremum, `Soko` 3-assay 0-1 ILP + adjoint Purkinje null-space gate, and `C22` `N=1` trial power explorer linked to `Foundation-0/project-asma` PR #92.

## On the Eido site

These files are kept here untouched, as the archive. The site rebuilds them on its own runtime:

- Items 1–3 are rebuilt as one page, [`site/research/index.html`](../../site/research/index.html) ("Substrate
  simulations"). Where the original computes something (the Frobenius gate), the page computes it live; experiment
  results are the original's reported numbers, labelled reported; anything drawn only for look is labelled
  illustrative. Old `?sim=statistical|morphogenesis|plasmid` links still land on the right section.
- Items 4 and 5 are not rebuilt yet. The site links to these files as they are.
- The Chebyshev identifiability explorer in [`../visualizations/`](../visualizations/) is rebuilt as
  [`site/research/chebyshev.html`](../../site/research/chebyshev.html).

Rebuilding items 1–3 found gaps between these files and the descriptions above. They are recorded here, not fixed in
the files:

- The statistical cell's regime buttons only reset `W`. The file has no parametric or causal decoder and no KL bound.
- The plasmid slider runs to 2.8×, but the reported values stop at 2.4×; past that the file extrapolates. The raw
  arm's "(-4.37 drop)" label is fixed at every shift although it holds only at 2.4×.
- The morphogenesis node ring draws 14–19 nodes, not 24, and its matrix is drawn at 24–36 cells, not at `2^D`.

## Running Locally

Open `examples/simulations/index.html` directly in any modern browser, or serve from the repo root:

```bash
python3 -m http.server 8080
# Open http://localhost:8080/examples/simulations/index.html
```

## Ongoing Team Convention

Whenever a new `weft` experiment (`E13+`) introduces a substrate mechanism, add its standalone interactive simulation panel here so visual intuition and executable research records stay synchronized across `weft` and `weft-eido`.
