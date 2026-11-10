/**
 * Reading weave (Eido module D6).
 *
 * A page that rewards reading and resists skimming. The reader's behaviour is
 * a signal, and the page answers inside stated bounds.
 *
 * A restlessness score (0..1) rises when the visitor skims: scrolling past
 * paragraphs they saw but did not give time to, sustained fast scrolling,
 * frantic changes of scroll direction, long jumps, and jerky cursor movement.
 * It falls mostly by reading. The score drives waves that pass through the
 * page as a medium: words bob as crests pass, fade in the troughs and blur,
 * and at the top end links drift and slide away from a hurried cursor.
 * Paragraphs that were actually read get a gold thread beside them.
 *
 * Guardrails: the focused element never moves, text stays text for assistive
 * technology, displacement is capped, a cursor held still on a link settles
 * it, nothing moves under prefers-reduced-motion, and the reader can switch
 * the whole thing off (the choice is remembered).
 *
 * The top half of this file is pure maths with no DOM, so Node can test it.
 * `setupReadingWeave` mounts the behaviour. Nothing starts by itself.
 * Docs: docs/reading-weave.md. Styles: css/reading-weave.css.
 */

/* ------------------------------------------------------------------ */
/* Pure maths                                                          */
/* ------------------------------------------------------------------ */

/** Clamp to [0, 1]. */
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Smoothstep: 0 below `a`, 1 above `b`, an S-curve between. */
export const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Every number the score and the motion use, in one place. */
export const WEAVE = Object.freeze({
  /** Words a second a reader is credited with (lenient: about 600 words a minute). */
  wordsPerSecond: 10,
  /** A passage needs at least this long on screen, whatever its length (seconds). */
  minDwell: 1.2,
  /** Passages shorter than this many words are not tracked. */
  minWords: 4,
  /** The module does nothing unless the page has this many tracked passages. */
  minBlocks: 3,
  /** Scrolling slower than this (px/s) and a cursor calmer than `steadyJolt` counts as steady. */
  steadyScroll: 350,
  steadyJolt: 0.3,
  /** A skipped passage is one left with less than this share of its dwell time. */
  skipShare: 0.35,
  /** A long, quick jump past content adds this much. */
  jumpBump: 0.05,
  /** Biggest push of a single wave field value, so crests overlapping cannot add up past it. */
  fieldLimit: 1,
  /** Most a link can be displaced from rest, in px, however hard it is chased. */
  linkMax: 40,
  /** Largest word displacement (px) and tilt (degrees) at full restlessness. */
  wordAmp: 7,
  wordTilt: 5,
});

/** Words in a piece of text. */
export const countWords = (text) => (String(text).match(/\S+/g) || []).length;

/** Is a passage with this many words worth tracking? */
export const isReadable = (words) => words >= WEAVE.minWords;

/** Seconds on screen a passage needs before it counts as read. */
export const dwellNeeded = (words, wordsPerSecond = WEAVE.wordsPerSecond) =>
  Math.max(WEAVE.minDwell, words / wordsPerSecond);

/** Drop in the score when a passage is read. Longer passages earn more. */
export const readReward = (words) => 0.06 + words / 1500;

/** Rise in the score when a passage is skipped. `again` is true on a second skip of the same passage. */
export const skipPenalty = (words, again = false) => Math.min(0.2, 0.03 + words / 500) * (again ? 0.6 : 1);

/**
 * One scroll event. `prev` is the previous speed estimate (px/s), `dy` the
 * scroll distance since the last event, `dtMs` the time since then, `viewH`
 * the viewport height, `prevDir` the last non-zero direction (-1, 0, 1).
 * Returns the new speed estimate, whether this was a long jump, whether the
 * direction flipped at speed, and the direction to remember.
 */
export function scrollSample(prev, dy, dtMs, viewH, prevDir = 0) {
  const dt = Math.max(8, dtMs) / 1000;
  const v = Math.abs(dy) / dt;
  const dir = Math.sign(dy);
  return {
    v: Math.max(prev * 0.6, v),
    jump: Math.abs(dy) > viewH * 1.5 && dt < 0.25,
    flip: !!dir && !!prevDir && dir !== prevDir && v > 300,
    dir: dir || prevDir,
  };
}

/**
 * One cursor sample. `cur` holds x, y, t, heading, omega, speed, jolt, still,
 * has. It is updated in place and returned. Speed is how fast the cursor
 * moves, jolt is how abruptly its turning changes while it moves.
 */
export function cursorSample(cur, x, y, ts) {
  if (!cur.has || ts - cur.t > 250) {
    Object.assign(cur, { x, y, t: ts, omega: 0, has: true });
    return cur;
  }
  const dx = x - cur.x, dy = y - cur.y, dist = Math.hypot(dx, dy);
  if (dist < 10) return cur;
  const dt = Math.max(0.008, (ts - cur.t) / 1000);
  const v = dist / dt;
  const heading = Math.atan2(dy, dx);
  const dTheta = Math.atan2(Math.sin(heading - cur.heading), Math.cos(heading - cur.heading));
  const omega = cur.omega * 0.5 + (dTheta / dt) * 0.5;
  const alpha = Math.abs(omega - cur.omega) / dt;
  const moving = clamp01(v / 350);
  cur.speed = Math.max(cur.speed, clamp01(v / 1800));
  cur.jolt = Math.max(cur.jolt, clamp01(alpha / 1400) * moving);
  Object.assign(cur, { x, y, t: ts, heading, omega, still: 0 });
  return cur;
}

/** Scroll speed estimate after `dt` seconds with no event for `idleMs`. */
export const decayScrollSpeed = (v, dt, idleMs) =>
  v * Math.exp(-dt / 0.15) * (idleMs > 120 ? Math.exp(-dt / 0.05) : 1);

/** Cursor speed or jolt after `dt` seconds. */
export const decayCursor = (v, dt) => v * Math.exp(-dt / 0.3);

/** Is the reader steady enough for time on screen to count as reading? */
export const isSteady = (scrollSpeed, jolt) => scrollSpeed < WEAVE.steadyScroll && jolt < WEAVE.steadyJolt;

/**
 * The continuous part of the score update over `dt` seconds, in the order
 * Weft applies it: fast scrolling, frantic direction changes, a jerky cursor,
 * then recovery (faster while reading). Returns the new score in [0, 1].
 * `s`: { scrollSpeed (px/s), flips (recent direction flips), sinceScrollMs, jolt (0..1), reading }.
 */
export function scoreStep(restless, s, dt) {
  let r = clamp01(restless);
  r = clamp01(r + dt * 0.14 * smoothstep(500, 2600, s.scrollSpeed));
  if (s.flips >= 3 && s.sinceScrollMs < 300) r = clamp01(r + dt * 0.2);
  r = clamp01(r + dt * 0.06 * s.jolt);
  r = clamp01(r - dt * (s.reading ? 0.05 : 0.006));
  return r;
}

/** Panel status line for a score. */
export function statusFor(restless, reading, off = false) {
  if (off) return "Effects are off. The page stays still.";
  if (restless > 0.6) return "Rushing. The page is pushing back.";
  if (restless > 0.3) return "Skimming detected.";
  if (reading) return "Reading steadily.";
  return "Calm.";
}

/** Should the "why is the page hard to read?" button show? Hysteresis: appears above 0.4, stays until 0.25. */
export const shouldWarn = (restless, shown, off = false) => !off && (shown ? restless > 0.25 : restless > 0.4);

/** How many waves may exist at once for a score. */
export const waveCap = (r) => 4 + Math.round(10 * r);

/** A new wave packet at (x, y) in content coordinates. `rand` is injectable for tests. */
export function makeWave(x, y, amp, r, rand = Math.random) {
  const lambda = 220 - 150 * r + rand() * 40;
  return { x, y, amp, r0: 0, c: 70 + 260 * r, lambda, len: lambda * (1.5 + rand()), phase: rand() * 6.28, age: 0, life: 5 + rand() * 3, fade: 0 };
}

/** Advance a wave by `dt` seconds (in place). Returns false once it has died. */
export function advanceWave(v, dt) {
  v.age += dt;
  v.r0 += v.c * dt;
  v.fade = Math.min(1, v.age * 2) * Math.max(0, 1 - v.age / v.life) / Math.sqrt(1 + v.r0 / 300);
  return v.age <= v.life;
}

/**
 * The wave field at a point: interfering plane waves ("churn", scaled by the
 * score) plus the packets in `waves`. Clamped to [-fieldLimit, fieldLimit],
 * so however many crests overlap, the push on any word or link stays bounded.
 */
export function waveField(x, y, waves, churn = 0, clock = 0) {
  let f = churn
    ? churn * (0.6 * Math.sin(x * 0.013 + clock * 1.9) * Math.cos(y * 0.009 - clock * 1.4) + 0.4 * Math.sin((x - y) * 0.021 + clock * 3.1))
    : 0;
  for (const v of waves) {
    const dx = x - v.x, dy = y - v.y;
    const u = v.r0 - Math.sqrt(dx * dx + dy * dy);
    if (u < 0 || u > v.len) continue;
    f += v.amp * v.fade * Math.sin((Math.PI * u) / v.len) * Math.cos((6.2832 * u) / v.lambda + v.phase);
  }
  const L = WEAVE.fieldLimit;
  return f < -L ? -L : f > L ? L : f;
}

/** What the score drives, level by level. */
export function motionLevels(r) {
  return {
    /** Words are split into spans once the score passes this. */
    split: r > 0.12,
    /** Word bob in px at the top of a crest. */
    amp: WEAVE.wordAmp * smoothstep(0.12, 1, r),
    /** Word tilt in degrees. */
    tilt: WEAVE.wordTilt * smoothstep(0.45, 1, r),
    /** How far a word fades in a trough (0..1). */
    dim: 0.6 * smoothstep(0.4, 1, r),
    /** Blur in px. */
    blur: 1.4 * smoothstep(0.65, 1, r),
    /** Link drift in px. */
    drift: 14 * smoothstep(0.5, 1, r),
    /** Link flight from a hurried cursor in px. */
    evade: 26 * smoothstep(0.75, 1, r),
    /** Strength of the page-wide churn. */
    churn: 0.9 * smoothstep(0.22, 1, r),
    /** How visible the wave rings are. */
    overlay: smoothstep(0.35, 1, r),
    /** Wave packets seeded per second. */
    seedRate: r > 0.08 ? 0.1 + 1.6 * r : 0,
  };
}

/** Transform and opacity for a word where the field is `f`. Bounded by the levels. */
export function wordDisplacement(f, levels) {
  const c = f < -1 ? -1 : f > 1 ? 1 : f;
  return { dy: c * levels.amp, rot: c * levels.tilt, opacity: 1 - levels.dim * Math.max(0, -c) };
}

/**
 * Offset of a link from rest. `fx`, `fy` are two field samples near the
 * link, `dx`, `dy` the vector from the cursor to the link, `dist` its length,
 * `still` seconds the cursor has been still, `speed` cursor speed (0..1).
 * A hurried cursor pushes the link away. A cursor held still (patience)
 * lets it settle. The result is never longer than `linkMax`.
 */
export function linkOffset({ fx, fy, dx, dy, dist, still, speed }, levels) {
  const { drift, evade } = levels;
  if (drift <= 0.1) return [0, 0];
  let tx = fx * drift, ty = fy * drift;
  const patience = smoothstep(0.25, 0.9, still);
  if (evade > 0.1 && dist < 110 && dist > 0.1) {
    const push = evade * (1 - dist / 110) * (1 - patience) * (0.4 + speed);
    tx += (dx / dist) * push;
    ty += (dy / dist) * push;
  }
  tx *= 1 - patience * 0.85;
  ty *= 1 - patience * 0.85;
  const len = Math.hypot(tx, ty);
  if (len > WEAVE.linkMax) {
    tx *= WEAVE.linkMax / len;
    ty *= WEAVE.linkMax / len;
  }
  return [tx, ty];
}

/* ------------------------------------------------------------------ */
/* Browser behaviour                                                   */
/* ------------------------------------------------------------------ */

/** Shared live state. Other visuals (a hero canvas, condensing prose) may read it. */
export const attention = { restless: 0, reading: false };

const DEFAULTS = {
  root: null,
  scroller: null,
  blocks: "main :is(p, li)",
  // Never read or rippled: code, forms, figures, tables, navigation and anything marked data-eido-skip.
  skip: "pre, code, button, label, form, figure, table, nav, aside, [data-eido-skip]",
  // Things that drift and slide away from a hurried cursor.
  drift: "header a, nav a, footer a, .btn, [data-eido-drift]",
  motion: true,
  panel: true,
  storage: "eido-weave",
  wordsPerSecond: WEAVE.wordsPerSecond,
  params: true,
  pin: null, // a number in [0, 1] holds the score there (for demos and review); null measures the reader
  onChange: null,
};

let active = null; // only one weave runs at a time: they share `attention`
let uid = 0;

const ICON = {
  help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6"/><circle cx="12" cy="16.9" r=".6" fill="currentColor"/></svg>',
  min: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  mark: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/><g fill="none" stroke-width="3.2" stroke-linecap="round"><path d="M11 6v20M21 6v20" stroke="currentColor"/><path d="M6 11h3.2M12.8 11h6.4M22.8 11H26" style="stroke: var(--eido-accent, #b8923a)"/><path d="M6 21h16M24.4 21H26" stroke="currentColor"/></g></svg>',
};

const HELP = (id) => `
  <h2 id="${id}">The reading weave</h2>
  <p>This page notices how you read it.</p>
  <h3>How it works</h3>
  <p>Each passage needs a little time on screen, about as long as a quick reader would take. The page watches how you scroll and move the cursor. It is all measured in your browser, nothing is sent anywhere, and it is forgotten when you leave.</p>
  <h3>Rewarded</h3>
  <p>Reading at a steady pace. Each passage you read gets a thread woven beside it, and the page settles.</p>
  <h3>Punished</h3>
  <p>Skimming: scrolling past passages without reading them, scrolling fast, jumping around, and frantic cursor movement. The page grows restless: the text ripples, fades and blurs, and the links start to drift away from a hurried cursor.</p>
  <p class="attn-pop-foot">To calm it, slow down and read. To switch it off, press <span class="attn-kbd" aria-label="the close button">×</span> on this panel.</p>`;
const WARN = (id) => `
  <h2 id="${id}">Why is the page getting hard to read?</h2>
  <p>It looks like you are skimming: passages are going past faster than they can be read. This page is built to resist that, so the more you rush, the more the text ripples, fades and blurs, and the more the links drift.</p>
  <p>Slow down and read a passage or two, and it will settle.</p>
  <p class="attn-pop-foot">Or stop the effects altogether with the <span class="attn-kbd" aria-label="close button">×</span> on the reading panel.</p>`;

/**
 * Start the reading weave. Returns a handle, or null when the page has fewer
 * than three readable blocks (or a weave is already running).
 *
 * Options: root, scroller, blocks, skip, drift, motion, panel, storage,
 * wordsPerSecond, params, pin, onChange. See docs/reading-weave.md.
 *
 * Handle: { blocks, stats, calm(to), recount(el), pin(value), restless, destroy() }.
 */
export function setupReadingWeave(options = {}) {
  if (active || typeof document === "undefined") return null;
  const o = { ...DEFAULTS, ...options };
  const doc = document;
  const rootEl = o.root || doc;
  const scroller = o.scroller instanceof Element ? o.scroller : null;
  const host = o.panel instanceof Element ? o.panel : null;
  const motion = !!o.motion;
  const ownerWin = doc.defaultView || window;
  const params = o.params ? new URLSearchParams(ownerWin.location.search) : new URLSearchParams();
  let pinned = typeof o.pin === "number" ? clamp01(o.pin)
    : params.has("restless") ? clamp01(parseFloat(params.get("restless")) || 0) : null;
  const debug = params.has("attn");
  const reducedMotion = ownerWin.matchMedia("(prefers-reduced-motion: reduce)");
  const wps = o.wordsPerSecond;
  const html = doc.documentElement;

  /* ---- The viewport the score is measured against ---- */
  const view = {
    sx: () => (scroller ? scroller.scrollLeft : ownerWin.scrollX),
    sy: () => (scroller ? scroller.scrollTop : ownerWin.scrollY),
    w: () => (scroller ? scroller.clientWidth : ownerWin.innerWidth),
    h: () => (scroller ? scroller.clientHeight : ownerWin.innerHeight),
    rect: () => (scroller ? scroller.getBoundingClientRect() : { left: 0, top: 0 }),
  };
  const scrollTarget = scroller || ownerWin;

  /* ---- Reading blocks ---- */
  const blocks = [...rootEl.querySelectorAll(o.blocks)]
    .filter((el) => !el.closest(o.skip) && !el.querySelector("p, li"))
    .map((el, order) => {
      const words = countWords(el.textContent);
      return { el, order, words, need: dwellNeeded(words, wps), dwell: 0, seen: false, read: false, skipped: false, visible: false, again: false, spans: null };
    })
    .filter((b) => isReadable(b.words));
  if (blocks.length < WEAVE.minBlocks) return null;

  const cleanups = [];
  const listen = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  active = true;
  blocks.forEach((b) => b.el.classList.add("attn-block"));
  const byEl = new Map(blocks.map((b) => [b.el, b]));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const b = byEl.get(e.target);
      b.visible = e.isIntersecting;
      // Coming back to a skipped passage gives it a fresh chance, and skipping it again counts again.
      if (b.visible && b.skipped && !b.read) { b.skipped = false; b.seen = false; b.dwell = 0; b.again = true; }
      // Seen: most of it was on screen (or, for a tall block, it filled a good part of the screen).
      if (e.intersectionRatio > 0.6 || e.intersectionRect.height > view.h() * 0.4) b.seen = true;
    }
  }, { root: scroller, threshold: [0, 0.3, 0.6, 1] });
  blocks.forEach((b) => io.observe(b.el));

  /* ---- Signals ---- */
  let restless = pinned ?? 0;
  const stats = { skippedWords: 0, readWords: 0, jumps: 0, flips: 0 };
  const scroll = { y: view.sy(), t: performance.now(), v: 0, dir: 0, flips: [] };
  const bump = (v) => { if (pinned === null) restless = clamp01(restless + v); };
  listen(scrollTarget, "scroll", () => {
    const now = performance.now();
    const y = view.sy();
    const s = scrollSample(scroll.v, y - scroll.y, now - scroll.t, view.h(), scroll.dir);
    scroll.v = s.v;
    if (s.jump) { bump(WEAVE.jumpBump); stats.jumps++; }
    if (s.flip) { scroll.flips.push(now); stats.flips++; }
    scroll.dir = s.dir;
    scroll.y = y;
    scroll.t = now;
  }, { passive: true });

  const cur = { x: -1e4, y: -1e4, t: 0, heading: 0, omega: 0, speed: 0, jolt: 0, still: 0, has: false };
  listen(scroller || ownerWin, "pointermove", (ev) => {
    const samples = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [];
    for (const e of samples.length ? samples : [ev]) cursorSample(cur, e.clientX, e.clientY, e.timeStamp);
  }, { passive: true });

  /* ---- Waves through the page (content coordinates, so they travel with the content) ---- */
  const waves = [];
  let seedDebt = 0, clock = 0, churn = 0;
  const launch = (x, y, amp, r) => {
    if (waves.length >= waveCap(r)) return;
    waves.push(makeWave(x, y, amp, r));
  };
  const field = (x, y) => waveField(x, y, waves, churn, clock);

  /* ---- Text: split words lazily, the first time the page gets restless ---- */
  let split = false;
  const words = []; // { el, block, x, y } in content coordinates
  const navs = (motion ? [...rootEl.querySelectorAll(o.drift)] : [])
    .map((el) => ({ el, x: 0, y: 0, ox: 0, oy: 0, hover: 0, fixed: false }));
  const pinnedToViewport = (el) => {
    for (let n = el; n && n !== doc.body && n !== html; n = n.parentElement) {
      const p = ownerWin.getComputedStyle(n).position;
      if (p === "fixed" || p === "sticky") return true;
      if (n === scroller) break;
    }
    return false;
  };
  function splitWords() {
    split = true;
    for (const b of blocks) {
      const walker = doc.createTreeWalker(b.el, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      b.spans = [];
      for (const node of nodes) {
        if (!node.textContent.trim() || node.parentElement.closest("code, kbd, button, math, svg, sup, sub")) continue;
        const frag = doc.createDocumentFragment();
        for (const part of node.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            frag.append(part);
          } else {
            const s = doc.createElement("span");
            s.className = "attn-w";
            s.textContent = part;
            frag.append(s);
            b.spans.push(s);
          }
        }
        node.replaceWith(frag);
      }
    }
    measure();
  }
  function measure() {
    const vr = view.rect(), sx = view.sx(), sy = view.sy();
    words.length = 0;
    for (const b of blocks) {
      if (!b.spans) continue;
      for (const el of b.spans) {
        const r = el.getBoundingClientRect();
        words.push({ el, block: b, x: r.left - vr.left + r.width / 2 + sx, y: r.top - vr.top + r.height / 2 + sy, moved: false });
      }
    }
    for (const n of navs) {
      const r = n.el.getBoundingClientRect();
      n.x = r.left - vr.left + r.width / 2;
      n.y = r.top - vr.top + r.height / 2;
      n.fixed = pinnedToViewport(n.el);
      if (!n.fixed) { n.x += sx; n.y += sy; }
    }
  }
  let measureTimer = 0;
  const remeasure = () => {
    clearTimeout(measureTimer);
    measureTimer = setTimeout(() => {
      // Clear transforms first so measurements are of the resting layout.
      words.forEach((w) => (w.el.style.transform = ""));
      navs.forEach((n) => (n.el.style.transform = ""));
      if (split) measure();
    }, 150);
  };
  listen(ownerWin, "resize", remeasure);
  let ro = null;
  if (scroller && typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(remeasure);
    ro.observe(scroller);
  }

  /* ---- Links ---- */
  navs.forEach((n) => {
    n.el.classList.add("attn-nav");
    const enter = () => (n.hover = 0.0001), leave = () => (n.hover = 0);
    listen(n.el, "pointerenter", enter);
    listen(n.el, "pointerleave", leave);
  });

  /* ---- Overlay: the waves themselves, faintly visible at higher levels ---- */
  const overlay = doc.createElement("canvas");
  overlay.className = "attn-overlay";
  overlay.setAttribute("aria-hidden", "true");
  if (motion) {
    doc.body.append(overlay);
    if (scroller) overlay.style.position = "fixed";
  }
  const octx = overlay.getContext && overlay.getContext("2d");
  let ow = 0, oh = 0, odpr = 1, overlayOn = false, tint = "#b8923a", tintAt = 0;
  const sizeOverlay = () => {
    const vr = view.rect();
    odpr = Math.min(ownerWin.devicePixelRatio || 1, 2);
    const w = view.w(), h = view.h();
    if (scroller) {
      Object.assign(overlay.style, { inset: "auto", left: `${vr.left}px`, top: `${vr.top}px`, width: `${w}px`, height: `${h}px` });
    }
    if (w !== ow || h !== oh || overlay.width !== Math.round(w * odpr)) {
      ow = w; oh = h;
      overlay.width = Math.round(w * odpr);
      overlay.height = Math.round(h * odpr);
    }
  };
  sizeOverlay();
  listen(ownerWin, "resize", sizeOverlay);

  /* ---- The reading panel ---- */
  const store = {
    get: (k) => { if (o.storage === false) return null; try { return ownerWin.localStorage.getItem(`${o.storage}-${k}`); } catch { return null; } },
    set: (k, v) => { if (o.storage === false) return; try { v === null ? ownerWin.localStorage.removeItem(`${o.storage}-${k}`) : ownerWin.localStorage.setItem(`${o.storage}-${k}`, v); } catch { /* not kept */ } },
  };
  let off = !!o.panel && store.get("off") === "1";
  let hostStyled = false;
  let panelRoot = null;
  const ui = !o.panel ? { update() {} } : (() => {
    const n = ++uid;
    const popTitle = `attn-pop-title-${n}`, tipId = `attn-x-tip-${n}`;
    const root = doc.createElement("div");
    panelRoot = root;
    root.className = "attn-ui" + (host ? " attn-ui--contained" : "");
    root.innerHTML = `
      <div class="attn-pop" role="dialog" aria-modal="false" aria-labelledby="${popTitle}" hidden>
        <button class="attn-icon attn-pop-close" type="button" aria-label="Close">${ICON.close}</button>
        <div class="attn-pop-body"></div>
      </div>
      <button class="attn-warn" type="button" aria-label="Why is the page getting hard to read?" hidden>?</button>
      <section class="attn-panel" aria-label="Reading weave">
        <div class="attn-head">
          <span class="attn-title">Reading weave</span>
          <button class="attn-icon attn-help" type="button" aria-label="What is this?">${ICON.help}</button>
          <button class="attn-icon attn-min" type="button" aria-label="Minimise">${ICON.min}</button>
          <span class="attn-x-wrap">
            <button class="attn-icon attn-x" type="button" aria-describedby="${tipId}">${ICON.close}</button>
            <span class="attn-tip" id="${tipId}" role="tooltip">Stops the dynamic effects</span>
          </span>
        </div>
        <p class="attn-status" aria-live="polite"></p>
        <div class="attn-meter" aria-hidden="true"><span></span></div>
        <dl class="attn-stats">
          <div><dt>Read</dt><dd class="attn-read-n"></dd></div>
          <div><dt>Skipped</dt><dd class="attn-skip-n"></dd></div>
        </dl>
        <button class="attn-on" type="button" hidden>Turn the effects back on</button>
        <pre class="attn-debug" ${debug ? "" : "hidden"}></pre>
      </section>
      <button class="attn-dock" type="button" aria-label="Show the reading weave panel" hidden>${ICON.mark}</button>`;
    if (host) {
      if (ownerWin.getComputedStyle(host).position === "static") { host.style.position = "relative"; hostStyled = true; }
      host.append(root);
    } else {
      doc.body.append(root);
    }
    const $ = (s) => root.querySelector(s);
    const panelEl = $(".attn-panel"), dock = $(".attn-dock"), warn = $(".attn-warn"), pop = $(".attn-pop"), popBody = $(".attn-pop-body");
    const xBtn = $(".attn-x");
    let minimised = store.get("min") === "1";
    let popKind = null, warnShown = false;

    const openPop = (kind) => {
      if (popKind === kind) return closePop();
      popKind = kind;
      popBody.innerHTML = kind === "help" ? HELP(popTitle) : WARN(popTitle);
      pop.hidden = false;
      root.classList.toggle("attn-point-x", kind === "warn");
      if (kind === "warn" && minimised) setMin(false);
      $(".attn-pop-close").focus({ preventScroll: true });
    };
    const closePop = () => {
      popKind = null;
      pop.hidden = true;
      root.classList.remove("attn-point-x");
    };
    const setMin = (m) => {
      minimised = m;
      store.set("min", m ? "1" : null);
      panelEl.hidden = m;
      dock.hidden = !m;
      if (m && popKind === "help") closePop();
    };
    const setOff = (v) => {
      off = v;
      store.set("off", v ? "1" : null);
      html.classList.toggle("attn-off", v);
      $(".attn-on").hidden = !v;
      xBtn.hidden = v;
      if (v) {
        restless = 0;
        attention.restless = 0;
        waves.length = 0;
        still();
        closePop();
      }
      update();
    };

    $(".attn-help").addEventListener("click", () => openPop("help"));
    $(".attn-min").addEventListener("click", () => setMin(true));
    dock.addEventListener("click", () => { setMin(false); $(".attn-min").focus({ preventScroll: true }); });
    xBtn.addEventListener("click", () => { setOff(true); setMin(true); dock.focus({ preventScroll: true }); });
    $(".attn-on").addEventListener("click", () => setOff(false));
    warn.addEventListener("click", () => openPop("warn"));
    $(".attn-pop-close").addEventListener("click", closePop);
    listen(ownerWin, "keydown", (ev) => { if (ev.key === "Escape" && popKind) closePop(); });

    const status = $(".attn-status"), fill = $(".attn-meter span"), readN = $(".attn-read-n"), skipN = $(".attn-skip-n"), dbg = $(".attn-debug");
    let lastStatus = "";
    function update() {
      const read = blocks.filter((b) => b.read).length;
      const s = statusFor(restless, attention.reading, off);
      if (s !== lastStatus) { status.textContent = s; lastStatus = s; }
      fill.style.transform = `scaleX(${off ? 0 : restless.toFixed(3)})`;
      root.style.setProperty("--attn-level", off ? 0 : restless.toFixed(3));
      readN.textContent = `${read} of ${blocks.length} passages`;
      skipN.textContent = `${stats.skippedWords} words`;
      const want = shouldWarn(restless, warnShown, off);
      if (want !== warnShown) {
        warnShown = want;
        warn.hidden = !want;
        if (!want && popKind === "warn") closePop();
      }
      if (debug) {
        dbg.textContent = [
          `restless ${restless.toFixed(2)}${pinned !== null ? " (pinned)" : ""}`,
          `scroll   ${Math.round(scroll.v)} px/s`,
          `cursor   speed ${cur.speed.toFixed(2)} jolt ${cur.jolt.toFixed(2)}`,
          `words    read ${stats.readWords}, skipped ${stats.skippedWords}`,
          `jumps ${stats.jumps}, flips ${stats.flips}, waves ${waves.length}`,
        ].join("\n");
      }
    }
    setMin(minimised);
    setOff(off);
    return { update };
  })();

  /* ---- The loop ---- */
  let last = 0, raf = 0, dead = false, reported = -1;
  function frame(t) {
    if (dead) return;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    if (dt) step(dt);
    raf = requestAnimationFrame(frame);
  }

  function step(dt) {
    if (off) return;
    const now = performance.now();
    scroll.v = decayScrollSpeed(scroll.v, dt, now - scroll.t);
    cur.speed = decayCursor(cur.speed, dt);
    cur.jolt = decayCursor(cur.jolt, dt);
    cur.still += dt;
    scroll.flips = scroll.flips.filter((f) => now - f < 2000);

    // Reading: credit time to the first unread block on screen, top-down, while the page is steady.
    let current = null;
    for (const b of blocks) {
      if (b.visible && !b.read) { current = b; break; }
    }
    attention.reading = !!current && isSteady(scroll.v, cur.jolt);
    if (attention.reading) {
      current.dwell += dt;
      if (current.dwell >= current.need) {
        current.read = true;
        current.el.classList.add("attn-read");
        stats.readWords += current.words;
        if (pinned === null) restless = clamp01(restless - readReward(current.words));
      }
    }
    // Skipping: a block that was seen and has now left the top of the view without being read.
    const topEdge = view.rect().top;
    for (const b of blocks) {
      if (b.read || b.skipped || !b.seen || b.visible) continue;
      if (b.el.getBoundingClientRect().bottom < topEdge && b.dwell < b.need * WEAVE.skipShare) {
        b.skipped = true;
        stats.skippedWords += b.words;
        bump(skipPenalty(b.words, b.again));
      }
    }
    // Fast scrolling, frantic direction changes, a jerky cursor, and recovery.
    if (pinned === null) {
      restless = scoreStep(restless, { scrollSpeed: scroll.v, flips: scroll.flips.length, sinceScrollMs: now - scroll.t, jolt: cur.jolt, reading: attention.reading }, dt);
    }
    attention.restless = restless;
    ui.update();
    if (o.onChange && Math.abs(restless - reported) > 0.004) {
      reported = restless;
      try { o.onChange(restless); } catch { /* a listener's error must not stop the loop */ }
    }

    if (!motion || reducedMotion.matches) return;
    const r = restless;
    const lv = motionLevels(r);
    clock += dt * (0.6 + 0.8 * r);
    churn = lv.churn;

    // Waves: sources across the visible page, plus wakes from a hurried cursor.
    const sx = view.sx(), sy = view.sy(), vr = view.rect();
    seedDebt += dt * lv.seedRate;
    while (seedDebt >= 1) {
      seedDebt -= 1;
      launch(sx + Math.random() * view.w(), sy + Math.random() * view.h(), 0.5 + 0.5 * r, r);
    }
    if (r > 0.25 && cur.x > -1000 && Math.random() < dt * 6 * cur.speed) launch(cur.x - vr.left + sx, cur.y - vr.top + sy, 0.7, r);
    for (let n = waves.length - 1; n >= 0; n--) {
      if (!advanceWave(waves[n], dt)) waves.splice(n, 1);
    }

    if (lv.split && !split) splitWords();
    if (split) moveWords(lv);
    moveNavs(lv, dt);
    drawOverlay(lv);
  }

  function moveWords(lv) {
    html.style.setProperty("--attn-blur", `${lv.blur.toFixed(2)}px`);
    html.classList.toggle("attn-blurry", lv.blur > 0.02);
    const top = view.sy() - 80, bottom = view.sy() + view.h() + 80;
    const activeMotion = lv.amp > 0.05;
    for (const w of words) {
      if (w.y < top || w.y > bottom || !w.block.visible) continue;
      if (!activeMotion) {
        if (w.moved) { w.el.style.transform = ""; w.el.style.opacity = ""; w.moved = false; }
        continue;
      }
      const d = wordDisplacement(field(w.x, w.y), lv);
      w.el.style.transform = `translate3d(0, ${d.dy.toFixed(2)}px, 0) rotate(${d.rot.toFixed(2)}deg)`;
      w.el.style.opacity = d.opacity.toFixed(3);
      w.moved = true;
    }
  }

  function moveNavs(lv, dt) {
    const sx = view.sx(), sy = view.sy(), vr = view.rect();
    const k = 1 - Math.exp(-dt / 0.12);
    for (const n of navs) {
      if (n.el === doc.activeElement && n.el.matches(":focus-visible")) {
        n.el.style.transform = "";
        continue; // keyboard users are never chased
      }
      let tx = 0, ty = 0;
      if (lv.drift > 0.1) {
        const x = n.fixed ? n.x + sx : n.x, y = n.fixed ? n.y + sy : n.y;
        const px = n.fixed ? n.x : n.x - sx, py = n.fixed ? n.y : n.y - sy;
        const dx = px - (cur.x - vr.left), dy = py - (cur.y - vr.top);
        [tx, ty] = linkOffset({ fx: field(x, y - 20), fy: field(x + 20, y), dx, dy, dist: Math.hypot(dx, dy), still: cur.still, speed: cur.speed }, lv);
      }
      n.ox += (tx - n.ox) * k;
      n.oy += (ty - n.oy) * k;
      n.el.style.transform = Math.abs(n.ox) + Math.abs(n.oy) > 0.05 ? `translate(${n.ox.toFixed(1)}px, ${n.oy.toFixed(1)}px)` : "";
    }
  }

  function drawOverlay(lv) {
    if (!octx) return;
    const vis = lv.overlay;
    if (vis <= 0.01) {
      if (overlayOn) { octx.clearRect(0, 0, overlay.width, overlay.height); overlayOn = false; }
      return;
    }
    overlayOn = true;
    if (scroller) sizeOverlay();
    const nowMs = performance.now();
    if (nowMs - tintAt > 500) {
      tintAt = nowMs;
      tint = ownerWin.getComputedStyle(html).getPropertyValue("--eido-accent").trim() || "#b8923a";
    }
    const sx = view.sx(), sy = view.sy();
    octx.setTransform(odpr, 0, 0, odpr, 0, 0);
    octx.clearRect(0, 0, ow, oh);
    octx.strokeStyle = tint;
    for (const v of waves) {
      const cx = v.x - sx, cy = v.y - sy;
      // Draw each crest as a ring; the packet's envelope sets its strength.
      for (let u = v.lambda * 0.25; u < v.len; u += v.lambda) {
        const rad = v.r0 - u;
        if (rad <= 0) continue;
        const a = v.amp * v.fade * Math.sin((Math.PI * u) / v.len) * vis * 0.09;
        if (a < 0.004) continue;
        octx.globalAlpha = a;
        octx.lineWidth = v.lambda * 0.22;
        octx.beginPath();
        octx.arc(cx, cy, rad, 0, Math.PI * 2);
        octx.stroke();
      }
    }
    octx.globalAlpha = 1;
  }

  // Put everything back at rest: used when the effects are switched off, and under reduced motion.
  function still() {
    words.forEach((w) => { w.el.style.transform = ""; w.el.style.opacity = ""; w.moved = false; });
    navs.forEach((n) => { n.el.style.transform = ""; n.ox = n.oy = 0; });
    if (octx) octx.clearRect(0, 0, overlay.width, overlay.height);
    overlayOn = false;
    html.classList.remove("attn-blurry");
  }
  // Keep the woven threads, but skip all motion under reduced motion.
  const onReduced = () => { if (reducedMotion.matches) still(); };
  reducedMotion.addEventListener("change", onReduced);
  cleanups.push(() => reducedMotion.removeEventListener("change", onReduced));
  raf = requestAnimationFrame(frame);

  const handle = {
    blocks: blocks.map((b) => b.el),
    stats,
    /** Settle the score (never raise it), e.g. when the visitor undoes what the score has done. */
    calm(to = 0) {
      if (pinned === null) restless = attention.restless = Math.min(restless, clamp01(to));
    },
    /** A block's text changed: re-count its words so the time it needs stays fair. */
    recount(el) {
      const b = byEl.get(el);
      if (!b) return;
      b.words = countWords(el.textContent);
      b.need = dwellNeeded(b.words, wps);
    },
    /** Hold the score at a value in [0, 1], or pass null to measure the reader again. */
    pin(value) {
      pinned = typeof value === "number" ? clamp01(value) : null;
      if (pinned !== null) restless = attention.restless = pinned;
    },
    get restless() { return restless; },
    /** Remove everything the weave added and stop its loop. */
    destroy() {
      if (dead) return;
      dead = true;
      cancelAnimationFrame(raf);
      clearTimeout(measureTimer);
      cleanups.forEach((fn) => fn());
      io.disconnect();
      if (ro) ro.disconnect();
      still();
      // Put the words back as plain text.
      for (const b of blocks) {
        if (b.spans) {
          b.spans.forEach((s) => s.replaceWith(doc.createTextNode(s.textContent)));
          b.el.normalize();
        }
        b.el.classList.remove("attn-block", "attn-read");
      }
      navs.forEach((n) => { n.el.classList.remove("attn-nav"); n.el.style.transform = ""; });
      overlay.remove();
      if (panelRoot) panelRoot.remove();
      if (hostStyled) host.style.position = "";
      html.classList.remove("attn-off", "attn-blurry");
      html.style.removeProperty("--attn-blur");
      attention.restless = 0;
      attention.reading = false;
      active = null;
    },
  };
  active = handle;
  return handle;
}
