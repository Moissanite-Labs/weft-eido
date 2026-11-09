# Contributing to Eido

Thanks for helping. Eido is small on purpose: a philosophy and a few modules that do one thing each.

## Rules of thumb

- **No dependencies, no build step.** Modules are plain ES modules that run in the browser and in Node 20+.
- **Every module is testable without a browser.** DOM-mounting helpers (like `mountSimplexPad`) sit beside pure
  functions, and the pure functions carry the tests.
- **One channel, one quantity.** If a change makes a visual channel encode two things, or none, explain why.
- **Accessible by default.** Controls work with pointer and keyboard, expose their value to assistive technology, and
  respect `prefers-reduced-motion`.
- **Show it on the site.** Every module in `src/` has a page in `site/components/` with an isolated demo, a snippet
  that works when pasted, and its source. `npm test` checks this, along with every link on the site and the
  `condensed.json` for the philosophy page. If you change a passage on `site/philosophy.html`, update its entry in
  `site/condensed.json` (see [docs/condensing-prose.md](docs/condensing-prose.md)).
- **Say what is implemented.** `docs/philosophy.md` marks each idea as implemented here, implemented in Weft, or
  design. Keep those labels honest when you change things.

## Changes that affect ML Weft

w3ft.org and Weft's telemetry field vendor these modules. If you change an exported function's behaviour, note it in
the PR. A maintainer will update the vendored copy in
[Moissanite-Labs/weft](https://github.com/Moissanite-Labs/weft) (`python3 scripts/vendor.py --eido ../weft-eido`).

## Workflow

1. Fork, branch from `main`, and keep each PR to one concern.
2. Run `npm test`.
3. Sign off every commit with `git commit -s` ([Developer Certificate of Origin](https://developercertificate.org/)).
4. `main` needs one approving review, passing `test` and `dco` checks, and linear history.

Contributions are accepted under the licenses in [NOTICE](NOTICE): code under Apache-2.0 and docs under CC BY 4.0.
Report security issues as described in [SECURITY.md](SECURITY.md).
