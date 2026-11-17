# Weft Visualizations

A collection of visualizations that come out of Weft work. Each entry is an archived page, kept with original bytes and a provenance note.

These are reference material. They are not project results. Nothing here claims Weft's findings, and no page in this folder is implementation source for anything in `src/`.

## Rules for adding one

- Original bytes intact. No rewrites, no reformats.
- Add an entry below with what it shows, where it came from, what it claims, and whether the claims were checked and by whom.
- No study data, patient data or personal data, ever.
- Note every network dependency (fonts, CDNs, APIs) plainly.
- Synthetic-world results stay labeled synthetic. Clinical claims do not belong here.

## Entries

### project-asma-chebyshev-identifiability-explorer.html (2026-11-13)

- What it shows: an interactive explainer of the Chebyshev `L-infinity` identifiability results for Project Asma compartment worlds. The repository is [Foundation-0/project-asma](https://github.com/Foundation-0/project-asma).
- Figures shown: the `1.88x` noise-box bound (`eps*_inf = 19/560` against `10179/563920`), the `16.1%` paralog cross-reactivity collision where pure World S mimics C25 on the two-point contrast, and the snapshot pivot at `p = 1/5` that breaks the collision exactly.
- Where it came from: peer agent session output, 2026-11-13. A generated page (lumi-runtime widget). Bytes preserved from the supplied file.
- Claim status: synthetic-world mathematics only. The rational identities behind its figures were recomputed independently on 2026-11-13 and match exactly.
- Verification and its limits: [comment on the tracking issue](https://github.com/Foundation-0/project-asma/issues/82#issuecomment-6846151693).
- The collision bound is model-dependent (box geometry, no shared channel-offset budget), and the underlying `(1/20, 3/8)` design is not a mechanized proof.
- Not verified: anything about patients, spectra assays or clinical performance. None of those are shown.
- Dependencies: loads Google Fonts from the network. No other external calls. No data is sent anywhere.
- SHA-256: `fef24fcaccb1077260e519ce0fd307f093ee1aeb93881aedecb55308a2b449af`

Open it locally with `python3 -m http.server 8000` from the repository root and visit `/examples/visualizations/project-asma-chebyshev-identifiability-explorer.html`.

On the Eido site it is rebuilt as [`site/research/chebyshev.html`](../../site/research/chebyshev.html), with no
network calls. The page ports the file's arithmetic and checks it, in Node, against the functions read out of this
file (`test/chebyshev-math.test.mjs`); the file itself is unchanged. The rebuild found these limits on the figures
above, which the page states and does not hide:

- The "breaks the collision exactly" pivot holds without noise. Under the same box-noise rule, at the 16.1% trap a
  lone pivot reading separates only while the noise half-width is below 0.0161, which is under 1/60.
- The `1.88x` lift holds at zero paralog bleed. On the `(1/20, 3/8)` design the `L-infinity` ceiling falls below
  1/60 for bleed between about 0.064 and 0.186.
- "16.1%" is the exact blind spot 783/4864 ≈ 0.160979, rounded. The Deep Seed preset is labelled 3/7 but sets
  0.430, because the slider steps by 0.005.
