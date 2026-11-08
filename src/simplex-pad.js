/**
 * Barycentric simplex pad (Eido module D1).
 *
 * The mixer blends K = 3 aesthetic presets with weights on the 2-simplex
 * (w_k >= 0, sum w_k = 1). Three independent sliders cannot show that
 * constraint; a triangle can. Every point P inside triangle ABC has unique
 * barycentric coordinates (l_A, l_B, l_C) with P = l_A A + l_B B + l_C C, and
 * those coordinates are exactly the preset weights. Dragging the point is
 * moving through the design space itself.
 */

/** Barycentric coordinates of p with respect to triangle (a, b, c). Points are [x, y]. */
export function barycentric(p, a, b, c) {
  const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(det) < 1e-12) throw new Error("degenerate triangle");
  const la = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / det;
  const lb = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / det;
  return [la, lb, 1 - la - lb];
}

/** Point for weights w (normalised onto the simplex first). */
export function pointFromWeights(w, a, b, c) {
  const [la, lb, lc] = projectToSimplex(w);
  return [la * a[0] + lb * b[0] + lc * c[0], la * a[1] + lb * b[1] + lc * c[1]];
}

/** Clamp negatives to zero and renormalise so the weights sum to 1. */
export function projectToSimplex(w) {
  const v = w.map((x) => Math.max(0, Number(x) || 0));
  const s = v.reduce((acc, x) => acc + x, 0);
  if (s <= 1e-12) return v.map((_, i) => (i === 0 ? 1 : 0));
  return v.map((x) => x / s);
}

/** Weights for an arbitrary pointer position: points outside the triangle snap to its boundary. */
export function weightsAt(p, a, b, c) {
  return projectToSimplex(barycentric(p, a, b, c));
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Mount an SVG simplex pad. `labels` are the three vertex names; `onChange`
 * receives normalised weights [wA, wB, wC]. Keyboard: arrow keys move the
 * point by 2% of the triangle height.
 */
export function mountSimplexPad(container, { labels, weights = [1, 0, 0], hues = [], onChange }) {
  const size = 220;
  const A = [size / 2, 18];
  const B = [16, size - 34];
  const C = [size - 16, size - 34];
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("class", "simplex-pad");
  svg.setAttribute("role", "slider");
  svg.setAttribute("tabindex", "0");
  svg.setAttribute("aria-label", `Aesthetic blend of ${labels.join(", ")}`);

  const el = (name, attrs) => {
    const n = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    svg.appendChild(n);
    return n;
  };

  // Iso-weight guide lines at 1/4, 1/2, 3/4 for each vertex.
  for (const t of [0.25, 0.5, 0.75]) {
    for (const [v, e0, e1] of [[A, B, C], [B, C, A], [C, A, B]]) {
      const p0 = [v[0] * t + e0[0] * (1 - t), v[1] * t + e0[1] * (1 - t)];
      const p1 = [v[0] * t + e1[0] * (1 - t), v[1] * t + e1[1] * (1 - t)];
      el("line", { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1], class: "simplex-guide" });
    }
  }
  el("polygon", { points: [A, B, C].map((p) => p.join(",")).join(" "), class: "simplex-edge" });
  const verts = [A, B, C];
  const anchors = ["middle", "start", "end"];
  verts.forEach((v, i) => {
    el("circle", { cx: v[0], cy: v[1], r: 4, class: "simplex-vertex", style: hues[i] != null ? `fill:hsl(${Math.round(hues[i] * 360)},80%,62%)` : "" });
    const t = el("text", { x: v[0], y: i === 0 ? v[1] - 7 : v[1] + 18, "text-anchor": anchors[i], class: "simplex-label" });
    t.textContent = labels[i];
  });
  const spokes = verts.map(() => el("line", { class: "simplex-spoke" }));
  const knob = el("circle", { r: 7, class: "simplex-knob" });

  let current = projectToSimplex(weights);
  const draw = () => {
    const p = pointFromWeights(current, A, B, C);
    knob.setAttribute("cx", p[0]);
    knob.setAttribute("cy", p[1]);
    spokes.forEach((s, i) => {
      s.setAttribute("x1", p[0]);
      s.setAttribute("y1", p[1]);
      s.setAttribute("x2", verts[i][0]);
      s.setAttribute("y2", verts[i][1]);
      s.style.strokeOpacity = (0.15 + 0.85 * current[i]).toFixed(3);
    });
    svg.setAttribute("aria-valuetext", labels.map((l, i) => `${l} ${Math.round(current[i] * 100)}%`).join(", "));
  };
  const set = (w, emit = true) => {
    current = projectToSimplex(w);
    draw();
    if (emit && onChange) onChange(current.slice());
  };
  const toLocal = (ev) => {
    const r = svg.getBoundingClientRect();
    return [((ev.clientX - r.left) / r.width) * size, ((ev.clientY - r.top) / r.height) * size];
  };
  let dragging = false;
  svg.addEventListener("pointerdown", (ev) => {
    dragging = true;
    svg.setPointerCapture(ev.pointerId);
    set(weightsAt(toLocal(ev), A, B, C));
  });
  svg.addEventListener("pointermove", (ev) => {
    if (dragging) set(weightsAt(toLocal(ev), A, B, C));
  });
  const stop = () => {
    dragging = false;
  };
  svg.addEventListener("pointerup", stop);
  svg.addEventListener("pointercancel", stop);
  svg.addEventListener("keydown", (ev) => {
    const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[ev.key];
    if (!d) return;
    ev.preventDefault();
    const p = pointFromWeights(current, A, B, C);
    const stepPx = (B[1] - A[1]) * 0.02;
    set(weightsAt([p[0] + d[0] * stepPx, p[1] + d[1] * stepPx], A, B, C));
  });
  container.appendChild(svg);
  draw();
  return { set, get: () => current.slice() };
}
