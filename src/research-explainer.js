/**
 * Research explainer primitives.
 *
 * These functions are for small, inspectable models that let a reader poke the
 * mechanism instead of trusting a picture. The toy-cell loop is deliberately
 * illustrative. It is not a benchmark, a forecast, or evidence for the Weft
 * experimental record.
 */

const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  if (!Number.isFinite(value)) throw new TypeError("value must be finite");
  if (!(min <= max)) throw new RangeError("min must be <= max");
  return Math.min(max, Math.max(min, value));
}

/** A small deterministic PRNG. Returns values in [0, 1). */
export function seededRandom(seed) {
  let state = Number(seed) >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return function random() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function rangeProgress(value, min, max) {
  if (!(min < max)) throw new RangeError("min must be < max");
  const v = clamp(Number(value), min, max);
  return ((v - min) / (max - min)) * 100;
}

export function formatMetric(value, options = {}) {
  const { precision = 3, signed = false, suffix = "" } = options;
  if (!Number.isFinite(value)) return "n/a";
  const normalized = Math.abs(value) < 10 ** -(precision + 1) ? 0 : value;
  const text = Math.abs(normalized).toFixed(precision);
  if (normalized < 0) return `-${text}${suffix}`;
  return `${signed ? "+" : ""}${text}${suffix}`;
}

function copyMatrix(matrix) {
  return matrix.map((row) => row.slice());
}

export function matrixDisplacement(before, after) {
  if (before.length !== after.length) throw new RangeError("matrices must have the same row count");
  let sum = 0;
  for (let i = 0; i < before.length; i += 1) {
    if (before[i].length !== after[i].length) throw new RangeError("matrices must have the same column count");
    for (let j = 0; j < before[i].length; j += 1) {
      const d = after[i][j] - before[i][j];
      sum += d * d;
    }
  }
  return Math.sqrt(sum);
}

export function coreDrift(before, after, coreRows) {
  const rows = clamp(Math.trunc(coreRows), 0, before.length);
  let sum = 0;
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < before[i].length; j += 1) {
      const d = after[i][j] - before[i][j];
      sum += d * d;
    }
  }
  return Math.sqrt(sum);
}

/**
 * Build a deterministic 8x8 toy matrix with a frozen-looking core.
 * Rows before `coreRows` follow one scale, plastic rows follow a tenth of it.
 */
export function makeToyCell(seed = 20261112, options = {}) {
  const { size = 8, coreRows = 2 } = options;
  if (!Number.isInteger(size) || size < 4) throw new RangeError("size must be an integer >= 4");
  if (!Number.isInteger(coreRows) || coreRows < 1 || coreRows >= size) {
    throw new RangeError("coreRows must be an integer in [1, size - 1]");
  }
  const random = seededRandom(seed);
  const matrix = [];
  for (let i = 0; i < size; i += 1) {
    const row = [];
    const scale = i < coreRows ? 0.32 : 0.035;
    for (let j = 0; j < size; j += 1) row.push((random() * 2 - 1) * scale);
    matrix.push(row);
  }
  return Object.freeze({
    seed: Number(seed) >>> 0,
    size,
    coreRows,
    matrix: Object.freeze(matrix.map((row) => Object.freeze(row))),
    accepted: 0,
    rejected: 0,
    displacement: 0,
    illustrative: true,
  });
}

/** One deterministic A/B perturbation. The core rows stay untouched by construction. */
export function stepToyCell(cell, options = {}) {
  const radius = clamp(Number(options.radius ?? 1.2), 0.05, 3);
  const novelty = clamp(Number(options.novelty ?? 0.35), 0, 1);
  const after = copyMatrix(cell.matrix);
  const marker = (cell.seed ^ Math.imul(cell.accepted + 1, 2654435761) ^ Math.imul(cell.rejected + 1, 1597334677)) >>> 0;
  const random = seededRandom(marker);
  const plasticRows = cell.size - cell.coreRows;
  const touched = Math.max(1, Math.round(novelty * plasticRows));
  for (let k = 0; k < touched; k += 1) {
    const i = cell.coreRows + Math.floor(random() * plasticRows);
    const j = Math.floor(random() * cell.size);
    after[i][j] = clamp(after[i][j] + (random() * 2 - 1) * 0.09, -1.5, 1.5);
  }
  const displacement = matrixDisplacement(cell.matrix, after);
  if (displacement > radius) {
    return Object.freeze({
      ...cell,
      rejected: cell.rejected + 1,
      accepted: cell.accepted,
      displacement,
    });
  }
  return Object.freeze({
    ...cell,
    matrix: Object.freeze(after.map((row) => Object.freeze(row))),
    accepted: cell.accepted + 1,
    displacement,
  });
}

export function toyCellMetrics(cell) {
  return {
    displacement: cell.displacement,
    coreRows: cell.coreRows,
    accepted: cell.accepted,
    rejected: cell.rejected,
    frozenCore: cell.coreRows > 0,
  };
}

/** Fit a canvas to its CSS size and device pixel ratio. Returns the drawing size. */
export function fitCanvasToDisplaySize(canvas, options = {}) {
  const maxPixelRatio = clamp(Number(options.maxPixelRatio ?? 2), 1, 4);
  const ratio = clamp(window.devicePixelRatio || 1, 1, maxPixelRatio);
  const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  return { width, height, ratio };
}

/** Mount actions, segmented buttons and live values inside `root`. */
export function mountResearchExplainer(root, config) {
  const canvas = root.querySelector("[data-stage]");
  if (!canvas) throw new Error("research explainer needs a [data-stage] canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("could not acquire a 2D canvas context");
  let state = config.initialState;
  const disposers = [];
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const frames = [];

  const render = () => {
    const { width, height, ratio } = fitCanvasToDisplaySize(canvas, config.canvasOptions);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    config.render?.(ctx, state, { width, height, ratio });
    for (const [name, value] of Object.entries(config.kpis?.(state) ?? {})) {
      const target = root.querySelector(`[data-kpi="${name}"]`);
      if (target) target.textContent = String(value);
    }
  };

  for (const button of root.querySelectorAll("[data-action]")) {
    const action = config.actions?.[button.dataset.action];
    if (!action) continue;
    const onClick = () => {
      state = action(state, root) ?? state;
      render();
    };
    button.addEventListener("click", onClick);
    disposers.push(() => button.removeEventListener("click", onClick));
  }

  for (const group of root.querySelectorAll("[data-segment-group]")) {
    const name = group.dataset.segmentGroup;
    for (const button of group.querySelectorAll("button[data-segment]")) {
      const onClick = () => {
        state = config.segment?.(state, name, button.dataset.segment, root) ?? state;
        for (const sibling of group.querySelectorAll("button[data-segment]")) {
          sibling.classList.toggle("is-active", sibling === button);
          sibling.setAttribute("aria-pressed", sibling === button ? "true" : "false");
        }
        render();
      };
      button.addEventListener("click", onClick);
      disposers.push(() => button.removeEventListener("click", onClick));
    }
  }

  for (const input of root.querySelectorAll("input[data-range]")) {
    const name = input.dataset.range;
    const output = root.querySelector(`[data-range-output="${name}"]`);
    const sync = () => {
      const min = Number(input.min);
      const max = Number(input.max);
      input.style.setProperty("--progress", `${rangeProgress(input.value, min, max).toFixed(1)}%`);
      if (output) output.textContent = input.value;
    };
    const onInput = () => {
      state = config.range?.(state, name, Number(input.value), root) ?? state;
      sync();
      render();
    };
    input.addEventListener("input", onInput);
    sync();
    disposers.push(() => input.removeEventListener("input", onInput));
  }

  let resizeObserver;
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => render());
    resizeObserver.observe(canvas);
  } else {
    window.addEventListener("resize", render);
    disposers.push(() => window.removeEventListener("resize", render));
  }

  const start = () => {
    if (reduced?.matches || !config.tick) return;
    const tick = () => {
      state = config.tick(state, root) ?? state;
      render();
      frames.push(window.requestAnimationFrame(tick));
    };
    frames.push(window.requestAnimationFrame(tick));
  };
  start();
  render();

  return {
    getState: () => state,
    render,
    destroy() {
      for (const frame of frames) window.cancelAnimationFrame(frame);
      for (const dispose of disposers) dispose();
      resizeObserver?.disconnect();
    },
  };
}
