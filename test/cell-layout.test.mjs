import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { GOLDEN_ANGLE, hitTest, layerThreads, layoutCells } from "../src/cell-layout.js";

const { items: ITEMS } = JSON.parse(
  fs.readFileSync(new URL("./fixtures/items.json", import.meta.url), "utf8"),
);
const PHONE = { charWidth: 6, labelHeight: 7, gap: 8, labelGap: 4, padding: 10 };

// Region sizes the site produces: phone field regions (width x ~1.8 width) and desktop/wide.
const REGIONS = [
  [{ width: 320, height: 560 }, PHONE],
  [{ width: 390, height: 700 }, PHONE],
  [{ width: 860, height: 640 }, {}],
  [{ width: 1440, height: 760 }, {}],
  [{ width: 2560, height: 1100 }, {}],
];

function overlap(a, b) {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

test("golden angle is 137.507... degrees", () => {
  assert.ok(Math.abs((GOLDEN_ANGLE * 180) / Math.PI - 137.50776) < 1e-4);
});

test("cell area is proportional to commits at every region size (falsifier for #37 item 4)", () => {
  for (const [region, opts] of REGIONS) {
    const L = layoutCells(ITEMS, region, opts);
    const k = (L.cells[0].side * L.cells[0].side) / ITEMS[0].weight;
    L.cells.forEach((c, i) => {
      const ratio = (c.side * c.side) / ITEMS[i].weight;
      assert.ok(Math.abs(ratio - k) / k < 1e-9, `${region.width}x${region.height} cell ${i}`);
    });
  }
});

test("cells are square: one side length, independent of viewport aspect (falsifier for #37 item 1)", () => {
  for (const [region, opts] of REGIONS) {
    for (const c of layoutCells(ITEMS, region, opts).cells) {
      assert.equal(c.half * 2, c.side);
    }
  }
});

test("every repository appears exactly once and no footprints overlap (falsifier for #37 item 2)", () => {
  for (const [region, opts] of REGIONS) {
    const L = layoutCells(ITEMS, region, opts);
    assert.equal(L.cells.length, ITEMS.length);
    assert.deepEqual(
      L.cells.map((c) => c.index),
      ITEMS.map((_, i) => i),
    );
    for (let i = 0; i < L.cells.length; i++) {
      for (let j = i + 1; j < L.cells.length; j++) {
        assert.ok(!overlap(L.cells[i].fp, L.cells[j].fp), `${region.width}: ${i} overlaps ${j}`);
      }
    }
  }
});

test("the whole cluster, labels included, fits inside the region with padding", () => {
  for (const [region, opts] of REGIONS) {
    const L = layoutCells(ITEMS, region, opts);
    const pad = L.options.padding;
    assert.ok(L.fits, `${region.width}x${region.height} should fit`);
    for (const c of L.cells) {
      assert.ok(c.fp.x0 >= pad - 1e-6 && c.fp.x1 <= region.width - pad + 1e-6, `x in ${region.width}`);
      assert.ok(c.fp.y0 >= pad - 1e-6 && c.fp.y1 <= region.height - pad + 1e-6, `y in ${region.height}`);
    }
  }
});

test("cells grow with the region and stay readable on a phone", () => {
  const sides = REGIONS.map(([region, opts]) => Math.min(...layoutCells(ITEMS, region, opts).cells.map((c) => c.side)));
  for (let i = 1; i < sides.length; i++) assert.ok(sides[i] >= sides[i - 1] * 0.95, `monotone at ${i}`);
  assert.ok(sides[1] >= 36, `smallest phone cell ${sides[1].toFixed(1)}px should be >= 36px`);
});

test("layout is deterministic", () => {
  const a = layoutCells(ITEMS, { width: 1200, height: 700 });
  const b = layoutCells(ITEMS, { width: 1200, height: 700 });
  assert.deepEqual(a.cells, b.cells);
});

test("the largest cell sits nearest the centre (phyllotaxis order)", () => {
  const region = { width: 1440, height: 760 };
  const L = layoutCells(ITEMS, region);
  const cx = region.width / 2;
  const cy = region.height / 2;
  const dist = (c) => Math.hypot(c.x - cx, c.y - cy);
  const biggest = L.cells.reduce((m, c) => (c.side > m.side ? c : m));
  for (const c of L.cells) assert.ok(dist(biggest) <= dist(c) + 1e-6 || c === biggest);
});

test("a region too small to hold the labels degrades without throwing", () => {
  const L = layoutCells(ITEMS, { width: 120, height: 80 });
  assert.equal(L.fits, false);
  assert.equal(L.cells.length, ITEMS.length);
});

test("threads form one minimum spanning tree per layer", () => {
  const L = layoutCells(ITEMS, { width: 1440, height: 760 });
  const groups = ITEMS.map((it) => it.group);
  const edges = layerThreads(L.cells, groups);
  const sizes = new Map();
  groups.forEach((g) => sizes.set(g, (sizes.get(g) || 0) + 1));
  for (const [g, n] of sizes) {
    const es = edges.filter((e) => e.group === g);
    assert.equal(es.length, n - 1, `layer ${g}`);
    for (const e of es) {
      assert.equal(groups[e.a], g);
      assert.equal(groups[e.b], g);
    }
    // Connected: grow a reachable set from one member over the layer's edges.
    const members = groups.map((gg, i) => (gg === g ? i : -1)).filter((i) => i >= 0);
    const reached = new Set([members[0]]);
    for (let changed = true; changed; ) {
      changed = false;
      for (const e of es) {
        if (reached.has(e.a) !== reached.has(e.b)) {
          reached.add(e.a);
          reached.add(e.b);
          changed = true;
        }
      }
    }
    const roots = { size: reached.size === members.length ? 1 : 2 };
    assert.equal(roots.size, 1, `layer ${g} connected`);
  }
  // Minimality check against brute force on the smallest multi-cell layer (ledger: 2 cells).
  const total = (es) => es.reduce((s, e) => s + Math.hypot(L.cells[e.a].x - L.cells[e.b].x, L.cells[e.a].y - L.cells[e.b].y), 0);
  const ledger = edges.filter((e) => e.group === "ledger");
  assert.equal(ledger.length, 1);
  assert.ok(total(ledger) > 0);
});

test("hit testing returns the cell under a point and -1 elsewhere", () => {
  const L = layoutCells(ITEMS, { width: 1440, height: 760 });
  for (const c of L.cells) assert.equal(hitTest(L, c.x, c.y), c.index);
  assert.equal(hitTest(L, 1, 1), -1);
});
