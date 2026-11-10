/**
 * Cell layout for value-encoded fields (Eido; Moissanite-Labs/weft#37).
 *
 * The previous shader tiled clip space with a fixed 16:10 aspect and a 5-column
 * index, so cells stretched on any other viewport and grid indices aliased.
 * Layout now happens here, on the CPU, in CSS pixels, and the shader receives
 * exact cell rectangles. The rules:
 *
 * 1. Area encodes the value. A cell's side is s * sqrt(w), so its area is
 *    s^2 * w and the area ratio of any two cells equals their value ratio,
 *    at every viewport size. (Scaling side or radius linearly by value would
 *    exaggerate large values quadratically.)
 * 2. Golden-angle packing (Vogel's phyllotaxis model). Cells are placed in
 *    descending value; cell i is pushed outward along the ray at angle
 *    i * 137.508 deg until its footprint (cell plus label) touches nothing.
 *    Ray directions are stretched by the region's aspect ratio so the cluster
 *    takes the shape of the space it is given.
 * 3. Fit by bisection. Labels are a fixed pixel size, so the cluster's extent
 *    is not linear in s. We bisect on s for the largest scale whose packing
 *    fits inside the region, then centre it.
 * 4. Threads. Cells in the same layer are joined by the minimum spanning tree
 *    of their centres (Prim's algorithm): the shortest set of threads that
 *    connects every cell of a layer.
 *
 * Everything here is pure and deterministic; tests live in
 * test/cell-layout.test.mjs.
 */

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const DEFAULTS = {
  padding: 16, // clear margin inside the region (CSS px)
  gap: 12, // minimum clearance between footprints
  labelGap: 6, // space between a cell and its label
  labelHeight: 10, // label cap height (CSS px)
  charWidth: 8.4, // label advance per character (CSS px)
  maxSideFraction: 0.3, // largest cell side as a fraction of min(region w, h)
  iterations: 28,
};

function footprintOf(x, y, side, labelW, o) {
  const halfW = Math.max(side, labelW) / 2;
  return {
    x0: x - halfW,
    y0: y - side / 2,
    x1: x + halfW,
    y1: y + side / 2 + o.labelGap + o.labelHeight,
  };
}

function overlaps(a, b, gap) {
  return a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap;
}

/** Pack all cells at side scale `s`; returns placed cells (in input order) and bounds. */
function packAtScale(items, order, s, aspect, o) {
  const ax = Math.sqrt(aspect);
  const ay = 1 / ax;
  const placed = [];
  const out = new Array(items.length);
  let minSide = Infinity;
  for (const it of items) minSide = Math.min(minSide, s * Math.sqrt(Math.max(it.weight, 0)));
  const step = Math.max(1, Math.min(minSide, 24) * 0.25);

  order.forEach((idx, rank) => {
    const it = items[idx];
    const side = s * Math.sqrt(Math.max(it.weight, 0));
    const labelW = it.labelLength * o.charWidth;
    const theta = rank * GOLDEN_ANGLE;
    let dx = Math.cos(theta) * ax;
    let dy = Math.sin(theta) * ay;
    const n = Math.hypot(dx, dy) || 1;
    dx /= n;
    dy /= n;
    let r = 0;
    let fp = footprintOf(0, 0, side, labelW, o);
    // Footprints are offset downward by the label; centre the footprint on the ray.
    const yBias = (o.labelGap + o.labelHeight) / 2;
    for (let guard = 0; guard < 20000; guard++) {
      const x = dx * r;
      const y = dy * r - yBias;
      fp = footprintOf(x, y, side, labelW, o);
      if (!placed.some((p) => overlaps(fp, p.fp, o.gap))) {
        const cell = { index: idx, x, y, side, half: side / 2, labelW, fp };
        placed.push(cell);
        out[idx] = cell;
        return;
      }
      r += step;
    }
    throw new Error("cell placement did not converge");
  });

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of placed) {
    x0 = Math.min(x0, p.fp.x0);
    y0 = Math.min(y0, p.fp.y0);
    x1 = Math.max(x1, p.fp.x1);
    y1 = Math.max(y1, p.fp.y1);
  }
  return { cells: out, bounds: { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 } };
}

/**
 * Lay out cells inside a region.
 * @param {{weight:number, labelLength:number}[]} items
 * @param {{width:number, height:number}} region  CSS px
 * @returns {{scale:number, fits:boolean, cells:object[], bounds:object, region:object}}
 *   Each cell has centre (x, y), side, half, labelW and footprint fp, all in
 *   region coordinates (origin at the region's top-left).
 */
export function layoutCells(items, region, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const W = Math.max(1, region.width);
  const H = Math.max(1, region.height);
  if (!items.length) return { scale: 0, fits: true, cells: [], bounds: null, region: { width: W, height: H } };

  const innerW = Math.max(1, W - 2 * o.padding);
  const innerH = Math.max(1, H - 2 * o.padding);
  const aspect = innerW / innerH;
  const order = items
    .map((it, i) => i)
    .sort((a, b) => items[b].weight - items[a].weight || a - b);
  const maxW = Math.max(...items.map((it) => Math.max(it.weight, 0)), 1e-9);

  let lo = 0;
  let hi = (o.maxSideFraction * Math.min(innerW, innerH)) / Math.sqrt(maxW);
  let best = null;
  const top = packAtScale(items, order, hi, aspect, o);
  if (top.bounds.w <= innerW && top.bounds.h <= innerH) {
    best = { s: hi, pack: top };
  } else {
    for (let k = 0; k < o.iterations; k++) {
      const mid = (lo + hi) / 2;
      const pack = packAtScale(items, order, mid, aspect, o);
      if (pack.bounds.w <= innerW && pack.bounds.h <= innerH) {
        best = { s: mid, pack };
        lo = mid;
      } else {
        hi = mid;
      }
    }
  }
  const fits = Boolean(best);
  if (!best) {
    // Region too small even for labels alone: use the smallest scale tried.
    best = { s: lo, pack: packAtScale(items, order, Math.max(lo, 1e-3), aspect, o) };
  }

  // Centre the cluster in the region.
  const b = best.pack.bounds;
  const offX = W / 2 - (b.x0 + b.w / 2);
  const offY = H / 2 - (b.y0 + b.h / 2);
  const cells = best.pack.cells.map((c) => ({
    index: c.index,
    x: c.x + offX,
    y: c.y + offY,
    side: c.side,
    half: c.half,
    labelW: c.labelW,
    fp: { x0: c.fp.x0 + offX, y0: c.fp.y0 + offY, x1: c.fp.x1 + offX, y1: c.fp.y1 + offY },
  }));
  const bounds = { x0: b.x0 + offX, y0: b.y0 + offY, x1: b.x1 + offX, y1: b.y1 + offY, w: b.w, h: b.h };
  return { scale: best.s, fits, cells, bounds, region: { width: W, height: H }, options: o };
}

/**
 * Minimum spanning tree per group (Prim). `groups[i]` is the group key of cell i.
 * Returns edges [{a, b, group}] with a, b cell indices.
 */
export function layerThreads(cells, groups) {
  const byGroup = new Map();
  cells.forEach((c, i) => {
    const g = groups[i];
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(i);
  });
  const edges = [];
  for (const [group, members] of byGroup) {
    if (members.length < 2) continue;
    const inTree = new Set([members[0]]);
    while (inTree.size < members.length) {
      let bestEdge = null;
      for (const a of inTree) {
        for (const b of members) {
          if (inTree.has(b)) continue;
          const d = Math.hypot(cells[a].x - cells[b].x, cells[a].y - cells[b].y);
          if (!bestEdge || d < bestEdge.d - 1e-9 || (Math.abs(d - bestEdge.d) <= 1e-9 && b < bestEdge.b)) {
            bestEdge = { a, b, d };
          }
        }
      }
      inTree.add(bestEdge.b);
      edges.push({ a: bestEdge.a, b: bestEdge.b, group });
    }
  }
  return edges;
}

/** Index of the cell whose footprint contains (x, y) in region coordinates, or -1. */
export function hitTest(layout, x, y) {
  for (const c of layout.cells) {
    if (x >= c.fp.x0 && x <= c.fp.x1 && y >= c.fp.y0 && y <= c.fp.y1) return c.index;
  }
  return -1;
}
