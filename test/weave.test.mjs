// The weave: hyperbolic geometry, its layout, plucked threads, and the graph of the site.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cx, abs, arg, apply, compose, invert, toCentre, fromCentre, rotation, distance, geoLerp, geodesic, moveToward,
  alongFromCentre, layout, bfs, circularMean, pluckAmps, stringAt, weftThread, ease, pickDirection, ringRadius, WEAVE, TAU,
} from "../site/assets/weave-math.js";
import { NODES, EDGES, KINDS, RATIOS, weaveGraph, connections } from "../site/assets/weave-graph.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(repo, "site");
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const near = (z, w, eps = 1e-9) => abs({ x: z.x - w.x, y: z.y - w.y }) <= eps;

/* Seeded points inside the disk, so a failure can be replayed. */
function points(n, seed = 7) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  return Array.from({ length: n }, () => { const r = 0.95 * Math.sqrt(rnd()), t = TAU * rnd(); return cx(r * Math.cos(t), r * Math.sin(t)); });
}

test("τₐ takes a to the centre, and its inverse brings it back", () => {
  for (const a of points(20)) {
    assert.ok(near(apply(toCentre(a), a), cx(0, 0), 1e-12));
    assert.ok(near(apply(fromCentre(a), cx(0, 0)), a, 1e-12));
    for (const z of points(5, 3)) assert.ok(near(apply(invert(toCentre(a)), apply(toCentre(a), z)), z, 1e-9));
  }
});

test("every move is an isometry: hyperbolic distance is kept exactly", () => {
  const P = points(12, 11);
  const moves = [toCentre(P[0]), fromCentre(P[1]), rotation(1.1), compose(toCentre(P[2]), rotation(-0.4)), moveToward(P[3], 0.37)];
  for (const M of moves) {
    for (let i = 0; i < P.length; i += 1) for (let j = i + 1; j < P.length; j += 1) {
      assert.ok(close(distance(apply(M, P[i]), apply(M, P[j])), distance(P[i], P[j]), 1e-7));
    }
    for (const z of P) assert.ok(abs(apply(M, z)) < 1, "the disk maps into itself");
  }
});

test("composition is the matrix product: (M ∘ N)(z) = M(N(z))", () => {
  const [a, b, z] = points(3, 5);
  const M = compose(toCentre(a), rotation(0.7)), N = fromCentre(b);
  assert.ok(near(apply(compose(M, N), z), apply(M, apply(N, z)), 1e-10));
});

test("distance from the centre is 2·artanh r, so one thread of length L sits at tanh(L/2)", () => {
  for (const d of [0.5, 1, WEAVE.STEP, 2.6, 3.9]) assert.ok(close(distance(cx(0, 0), cx(ringRadius(d), 0)), d, 1e-9));
});

test("geodesics are hyperbolic straight lines: lengths add along them", () => {
  const [p, q] = points(2, 21);
  const whole = distance(p, q);
  for (const s of [0.1, 0.25, 0.5, 0.9]) {
    const m = geoLerp(p, q, s);
    assert.ok(close(distance(p, m), s * whole, 1e-7), "the point is a fraction s of the way");
    assert.ok(close(distance(p, m) + distance(m, q), whole, 1e-7), "and it lies on the shortest path");
  }
  const g = geodesic(p, q, 10);
  assert.ok(near(g[0], p, 1e-12) && near(g[10], q, 1e-12));
  assert.ok(close(distance(g[3], g[4]), whole / 10, 1e-7), "samples are evenly spaced in hyperbolic length");
});

test("a move toward a place carries it to the centre along one geodesic", () => {
  const [a] = points(1, 31);
  assert.ok(near(apply(moveToward(a, 1), a), cx(0, 0), 1e-12));
  assert.ok(near(apply(moveToward(a, 0), a), a, 1e-12));
  const half = apply(moveToward(a, 0.5), a);
  assert.ok(close(distance(cx(0, 0), half), distance(cx(0, 0), a) / 2, 1e-9), "halfway in time is halfway in distance");
  assert.ok(close(Math.cos(arg(half) - arg(a)), 1, 1e-9), "it never swerves");
  assert.ok(near(alongFromCentre(a, 1), a, 1e-12));
});

test("smootherstep starts and ends at rest", () => {
  assert.equal(ease(0), 0); assert.equal(ease(1), 1); assert.equal(ease(-3), 0); assert.equal(ease(4), 1);
  assert.ok(close(ease(0.5), 0.5));
  const h = 1e-5;
  assert.ok(Math.abs(ease(h) - ease(0)) / h < 1e-6 && Math.abs(ease(1) - ease(1 - h)) / h < 1e-6, "zero velocity at both ends");
});

test("a plucked string starts in exactly the finger's triangle", () => {
  const p = 0.27, amps = pluckAmps(p, 400);
  for (const s of [0.05, 0.15, 0.27, 0.5, 0.8, 0.95]) {
    const tri = s <= p ? s / p : (1 - s) / (1 - p);
    assert.ok(Math.abs(stringAt(s, 0, 1, amps, Infinity) - tri) < 0.01, `shape at s = ${s}`);
  }
  assert.ok(close(stringAt(0, 0.3, 1, amps), 0) && close(stringAt(1, 0.3, 1, amps), 0, 1e-9), "pinned at both ends");
  const few = pluckAmps();
  assert.equal(few.length, WEAVE.HARMONICS);
  assert.ok(Math.abs(stringAt(0.4, 30, 1, few)) < 1e-6, "and it rings down");
});

test("the circular mean averages angles on the circle, not the line", () => {
  assert.ok(close(circularMean([0.1, -0.1]), 0, 1e-12));
  assert.ok(close(Math.abs(circularMean([Math.PI - 0.1, -Math.PI + 0.1])), Math.PI, 1e-12), "two angles near π average to π, not 0");
  assert.ok(Number.isNaN(circularMean([0, Math.PI])), "opposed angles have no mean");
});

test("the weft threads cross the vertical diameter at right angles, evenly spaced", () => {
  for (const j of [-3, -1, 0, 2]) {
    const pts = weftThread(j, 0.6, 40);
    const mid = pts[20];
    assert.ok(close(mid.x, 0, 1e-12) && close(distance(cx(0, 0), mid), Math.abs(j) * 0.6, 1e-9));
    assert.ok(close(pts[19].y, pts[21].y, 1e-12), "symmetric about the diameter, so perpendicular to it");
    for (const z of pts) assert.ok(abs(z) < 1);
  }
});

test("arrow keys follow the thread that points their way", () => {
  const c = [{ id: "east", x: 100, y: 2 }, { id: "north", x: 3, y: -90 }, { id: "far-east", x: 400, y: -30 }];
  assert.equal(pickDirection(0, 0, c, 0), "east");
  assert.equal(pickDirection(0, 0, c, -Math.PI / 2), "north");
  assert.equal(pickDirection(0, 0, c, Math.PI), null);
});

/* ---------- The graph ---------- */

const G = weaveGraph();

test("every node is well formed and every thread joins two real nodes", () => {
  const ids = new Set();
  for (const n of NODES) {
    assert.ok(!ids.has(n.id), `${n.id} is declared twice`);
    ids.add(n.id);
    assert.ok(n.kind in KINDS, `${n.id} has kind ${n.kind}`);
    assert.ok(n.family in RATIOS, `${n.id} has family ${n.family}`);
    assert.ok(n.name && n.code && n.line, `${n.id} needs a name, a code and a line`);
    if (n.kind === "concept") assert.ok(n.eq, `concept ${n.id} needs its equation`);
  }
  for (const e of EDGES) {
    assert.ok(ids.has(e.a) && ids.has(e.b), `thread ${e.a}–${e.b} is loose`);
    assert.notEqual(e.a, e.b);
    assert.ok(["leads", "embodies", "relates"].includes(e.kind));
  }
  assert.equal(new Set(EDGES.map((e) => `${e.a}|${e.b}`)).size, EDGES.length, "each thread once");
});

test("every page of the site is woven in, and each holds a concept", () => {
  const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (p.endsWith(".html")) out.push(p); } return out; };
  const hrefs = new Set(NODES.filter((n) => n.kind === "page").map((n) => n.href));
  for (const page of walk(siteDir)) {
    const rel = path.relative(siteDir, page).split(path.sep).join("/");
    assert.ok(hrefs.has(rel), `${rel} is not in the weave`);
  }
  for (const n of NODES.filter((m) => m.kind === "page" && m.id !== "components" && m.id !== "originals")) {
    assert.ok(connections(G, n.id).concepts.length > 0, `${n.id} embodies no concept`);
  }
});

test("every local href in the weave resolves, anchors included", () => {
  for (const n of NODES) {
    if (!n.href || /^https:/.test(n.href)) continue;
    const [file, hash] = n.href.split("#");
    const target = path.resolve(siteDir, file);
    assert.ok(fs.existsSync(target), `${n.id}: ${n.href} does not exist`);
    if (hash) assert.match(fs.readFileSync(target, "utf8"), new RegExp(`id="${hash}"`), `${n.id}: #${hash} is not on ${file}`);
  }
});

test("the weave is one piece, and nothing is more than three threads from home", () => {
  const { depth } = bfs(G.adj, "home");
  for (const id of G.ids) assert.ok(depth.has(id), `${id} cannot be reached`);
  assert.ok(Math.max(...depth.values()) <= 3);
  for (const id of G.ids) assert.ok(G.adj[id].length >= 1, `${id} holds no thread`);
});

test("layout: the focus at the centre, each ring one thread further out, the same every time", () => {
  for (const focus of ["home", "chebyshev", "locking", "field-pr"]) {
    const a = layout(G.adj, focus), b = layout(G.adj, focus);
    assert.deepEqual([...a.pos], [...b.pos], "deterministic");
    assert.ok(near(a.pos.get(focus), cx(0, 0)));
    for (const id of G.ids) {
      const z = a.pos.get(id), d = a.depth.get(id);
      assert.ok(abs(z) < 1, `${id} is inside the disk`);
      assert.ok(close(distance(cx(0, 0), z), d * WEAVE.STEP, 1e-6), `${id} sits ${d} threads out`);
    }
    // Neighbours of the focus share the first ring without touching.
    const ring = G.adj[focus].map((id) => a.pos.get(id));
    for (let i = 0; i < ring.length; i += 1) for (let j = i + 1; j < ring.length; j += 1) assert.ok(distance(ring[i], ring[j]) > 0.12);
  }
});

test("a move turns the new layout to meet the old view, so the map never spins", () => {
  const from = layout(G.adj, "home").pos;
  const a = from.get("harmonic");
  const T = toCentre(a);
  const seen = new Map([...from].map(([k, z]) => [k, apply(T, z)]));
  const to = layout(G.adj, "harmonic", { prev: seen });
  const ring = G.adj.harmonic.filter((id) => seen.has(id));
  const swing = ring.map((id) => Math.abs(Math.atan2(Math.sin(arg(to.pos.get(id)) - arg(seen.get(id))), Math.cos(arg(to.pos.get(id)) - arg(seen.get(id))))));
  const mean = swing.reduce((s, x) => s + x, 0) / swing.length;
  assert.ok(mean < Math.PI / 3, `first-ring places swing ${mean.toFixed(2)} rad on average`);
  // Home, where we came from, stays roughly opposite the way we went.
  const back = arg(to.pos.get("home")), went = arg(a);
  assert.ok(Math.cos(back - went) < 0, "the place you left trails behind you");
});
