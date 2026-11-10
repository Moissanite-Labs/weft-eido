# Reading weave

A page that rewards reading and resists skimming. The module is [`src/reading-weave.js`](../src/reading-weave.js).
Its styles are in [`css/reading-weave.css`](../css/reading-weave.css). A working page is in
[`examples/reading-weave.html`](../examples/reading-weave.html).

*Status: implemented here. It runs on [w3ft.org](https://w3ft.org). This is the Eido principle "feedback that stays
inside stated bounds" (see [philosophy](philosophy.md)) applied to the reader.*

## What it does

The page watches how a visitor reads and keeps one number, a **restlessness score** from 0 to 1. Skimming raises it.
Reading lowers it. The score drives a few visible effects:

- Words bob, fade and blur as waves pass through the text.
- Links drift, and slide away from a cursor that is in a hurry.
- Each passage that was actually read gets a thin gold thread beside it.

A small panel shows the score, explains the rule, and has an off switch.

The idea is that the reader's behaviour is a signal, and the page answers it within limits that are stated in advance.
The page never blocks anything. It never hides text. It makes skimming feel as rushed as it is, and makes reading feel
settled. Everything is measured in the browser. Nothing is sent anywhere.

## Install

The module has no dependencies and no build step. Either copy two files:

```
src/reading-weave.js
css/reading-weave.css
```

or import them from the package:

```js
import { setupReadingWeave } from "@moissanite-labs/eido/reading-weave";
```

```html
<link rel="stylesheet" href="reading-weave.css">
<script type="module">
  import { setupReadingWeave } from "./reading-weave.js";
  setupReadingWeave();
</script>
```

With no options it looks for `main :is(p, li)` and shows the panel at the bottom right. It does not start itself.
You call `setupReadingWeave()` when you want it.

It returns `null` and does nothing when the page has fewer than three readable blocks, or when a weave is already
running. Only one runs at a time, because they share the `attention` object.

## The signals

A **block** is a paragraph or list item that matches `blocks`, is not inside `skip`, does not contain another
paragraph or list item, and has at least 4 words. Each block has a **dwell time** it needs:

> needed seconds = max(1.2, words / wordsPerSecond), with `wordsPerSecond` = 10

Ten words a second is about 600 words a minute, so a quick reader passes.

| Signal | What counts | Effect on the score |
|---|---|---|
| Read a block | The first unread block on screen gets time while the reader is *steady* (scrolling slower than 350 px/s and cursor jolt under 0.3). When its time is up it is read. | Down by 0.06 + words / 1500 |
| Skip a block | A block that was *seen* (over 60% on screen, or filling over 40% of the view) leaves the top of the view having had under 35% of its time. | Up by min(0.2, 0.03 + words / 500). Times 0.6 if it was skipped before. |
| Fast scrolling | Scroll speed above 500 px/s, building to full effect at 2600 px/s (smoothstep). | Up by 0.14 per second at full effect |
| Frantic scrolling | Three or more direction changes at over 300 px/s within 2 seconds, while still scrolling. | Up by 0.2 per second |
| Long jump | One scroll of more than 1.5 screens in under 250 ms. | Up by 0.05, once |
| Jerky cursor | Jolt: how abruptly the cursor's turning changes, while it is moving. 0 to 1. | Up by 0.06 per second times jolt |
| Recovery | Every frame. | Down by 0.05 per second while reading, 0.006 per second otherwise |

Coming back to a skipped block gives it a fresh chance. The score is always clamped to 0..1.
Scroll speed and cursor signals fade on their own within a fraction of a second once the reader stops.

## What the score drives

| Score | What the reader sees |
|---|---|
| 0 to 0.08 | Nothing. |
| above 0.08 | Waves start to be seeded across the visible page, a few a second at most. |
| above 0.12 | Words are split into spans (once) and begin to bob. Up to 7 px at a score of 1. |
| above 0.22 | A page-wide churn is mixed into the waves. |
| above 0.25 | A hurried cursor leaves wakes. |
| 0.3 to 0.6 | Panel says "Skimming detected." Above 0.6: "Rushing. The page is pushing back." |
| above 0.35 | The wave rings start to show faintly on a canvas overlay. |
| above 0.4 | Words fade in the troughs of a wave, down to 60% opacity at the top. The warning button appears (it stays until the score falls below 0.25). Words tilt from 0.45, up to 5 degrees. |
| above 0.5 | Links drift with the waves, up to 14 px. |
| above 0.65 | Text blurs, up to 1.4 px. |
| above 0.75 | Links also flee a hurried cursor, up to 26 px more. |

`motionLevels(score)` returns all of these numbers.

## Guardrails

These are fixed. They do not depend on options.

- **The focused element never moves.** A link with keyboard focus is held still.
- **Text stays text.** Each word goes into a `span`, so screen readers still read the paragraph, and `destroy()`
  puts the original text nodes back. Code, `kbd`, buttons, maths, SVG and sub or superscripts are left whole.
- **Displacement is capped.** The wave field is clamped to ±1 however many waves overlap. A word moves at most 7 px and
  tilts at most 5 degrees. A link moves at most 40 px from rest.
- **A still cursor settles a link.** After about a second without movement, drift fades to 15% and flight stops.
- **Reduced motion.** Under `prefers-reduced-motion: reduce` nothing moves. The score and the gold threads still work.
- **An off switch that persists.** The × on the panel stops all effects at once and resets the score. The choice is
  stored under `<storage>-off`. The panel can also be minimised to a small button, stored under `<storage>-min`.
- **Print.** The panel, the overlay and every effect are hidden when printing.

## API

```js
import { setupReadingWeave, attention } from "./reading-weave.js";

const weave = setupReadingWeave({ /* options */ });
```

### Options

Defaults reproduce w3ft.org, apart from the three selectors, which are generic.

| Option | Default | Meaning |
|---|---|---|
| `root` | `document` | Element or document searched for blocks and links. |
| `scroller` | window | An element whose scroll drives the score, for a page area that scrolls by itself. The intersection observer, scroll listener and pointer listener attach to it, and waves are drawn over its box. |
| `blocks` | `"main :is(p, li)"` | Selector for the passages to read. |
| `skip` | `"pre, code, button, label, form, figure, table, nav, aside, [data-eido-skip]"` | Anything inside a match is never read or rippled. |
| `drift` | `"header a, nav a, footer a, .btn, [data-eido-drift]"` | Elements that drift and slide away from a hurried cursor. Only used when `motion` is true. |
| `motion` | `true` | Move words and links and draw the waves. `false` keeps the score and the threads only. |
| `panel` | `true` | `true` mounts the panel on `<body>`, fixed to the viewport. An element mounts it inside that element, positioned within it (the class `attn-ui--contained` is added, and the element is made `position: relative` if it was static). `false` shows no panel. |
| `storage` | `"eido-weave"` | Prefix for the `localStorage` keys. `false` keeps nothing. |
| `wordsPerSecond` | `10` | Reading speed that sets how long a block needs. |
| `params` | `true` | Honour the review parameters below. |
| `pin` | `null` | A number in [0, 1] holds the score there, for demos and review. `null` measures the reader. |
| `onChange(score)` | none | Called when the score has changed by more than 0.004. |

### Handle

| Member | Meaning |
|---|---|
| `blocks` | The tracked block elements. |
| `stats` | Live `{ skippedWords, readWords, jumps, flips }`. |
| `calm(to = 0)` | Lower the score to at most `to`. It never raises it. Use it when the reader undoes what the score caused. |
| `recount(el)` | Re-count a block's words after you changed its text, so the time it needs stays fair. |
| `pin(value)` | Hold the score at a value in [0, 1], or pass `null` to measure the reader again. |
| `restless` | The current score (a getter). |
| `destroy()` | Stops the loop. Removes listeners, observers, overlay, panel, classes and inline styles, and restores split words. Safe to call twice. A new weave can start afterwards. |

### Shared state

`attention` is `{ restless, reading }`, updated every frame while a weave runs and reset by `destroy()`. A hero
animation or another module can read it to share the page's mood.

### Pure functions

These need no DOM and are covered by `test/reading-weave.test.mjs`:

- `clamp01`, `smoothstep`, and the `WEAVE` table of constants.
- `countWords`, `isReadable`, `dwellNeeded`, `readReward`, `skipPenalty`.
- `scrollSample`, `cursorSample`, `decayScrollSpeed`, `decayCursor`, `isSteady`.
- `scoreStep(score, signals, dt)`, the continuous part of the score update.
- `statusFor`, `shouldWarn`.
- `waveCap`, `makeWave`, `advanceWave`, `waveField`, `motionLevels`, `wordDisplacement`, `linkOffset`.

## Reuse only the score

Another effect can run on the score alone. Condensing prose does this: it starts the weave with no motion and no panel,
and reads `attention.restless`.

```js
const reading = setupReadingWeave({ motion: false, panel: false, storage: false });
// attention.restless now follows the reader. reading.calm(0.2) settles it.
```

## Theme it

Set these custom properties on `:root`, or any ancestor of the page. Dark values apply with
`prefers-color-scheme: dark`, or when `<html data-theme="dark">` is set. `data-theme="light"` forces light.

| Property | Light default | Used for |
|---|---|---|
| `--eido-ink` | `#1d1b16` | Titles and values in the panel, tooltip background |
| `--eido-muted` | `#6b665a` | Panel body text, labels, icons |
| `--eido-paper` | `#fbf9f4` | Panel and pop-up background (at 94% opacity) |
| `--eido-line` | `#d9d4c6` | Panel borders |
| `--eido-accent` | `#b8923a` | The gold thread, meter, warning button, wave rings |
| `--eido-strike` | `#c0553d` | The hot end of the meter, the × when pointed at |
| `--eido-font-ui` | system sans | Panel text |
| `--eido-radius` | `10px` | Panel corners |

## Class hooks

| Class | Element |
|---|---|
| `attn-block` | Each tracked block. |
| `attn-read` | A block that was read. Draws the thread. |
| `attn-w` | A word span. Added once the page first gets restless. |
| `attn-nav` | A drifting link. |
| `attn-overlay` | The wave canvas. |
| `attn-ui` | Panel root. `attn-ui--contained` when mounted inside an element. |
| `attn-panel`, `attn-head`, `attn-title`, `attn-icon`, `attn-help`, `attn-min`, `attn-x`, `attn-x-wrap`, `attn-tip` | Panel and its controls. |
| `attn-status`, `attn-meter`, `attn-stats`, `attn-on`, `attn-debug` | Panel contents. `attn-on` turns the effects back on. |
| `attn-dock` | The small button shown when the panel is minimised. |
| `attn-warn` | The "why is the page hard to read?" button. |
| `attn-pop`, `attn-pop-body`, `attn-pop-close`, `attn-pop-foot`, `attn-kbd` | The help pop-up. |
| `attn-point-x` | On `attn-ui` while the warning points at the ×. |

On `<html>`: `attn-off` when the reader has switched effects off, `attn-blurry` while text is blurred, and the property
`--attn-blur`. The panel root also carries `--attn-level` (the score), which you can use in your own styles.

## Review parameters

With `params: true`, add these to the page URL:

- `?attn` shows raw numbers in the panel.
- `?restless=0.7` pins the score at 0.7 and turns off all rises and falls.

Turn `params` off on a page where visitors should not be able to do this.

## Tuning

- **Too jumpy on short pages.** Narrow `blocks` and widen `skip` so that captions, quotes and list scraps do not
  count. Blocks under four words are already ignored.
- **Fair to fast readers.** `wordsPerSecond: 14` shortens the time every block needs.
- **A page that is mostly lists.** Keep `li` in `blocks` only if the items are sentences. Otherwise use `"main p"`.
- **Links should not move.** Set `drift: "[data-eido-drift]"` and mark only the links you want to move. Or set
  `motion: false` to stop all movement.
- **A demo box.** Pass `scroller` and `root` as the same element, and `panel` as a positioned container, then call
  `destroy()` when the demo closes.
- **Thresholds.** The numbers in this guide are in `WEAVE` and the functions above. Change them there. Keep the tests
  in step, because they assert the bounds.
- **Test with `?restless=`** at 0.2, 0.5 and 0.9 before shipping a page.
