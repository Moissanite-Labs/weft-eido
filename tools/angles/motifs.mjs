// Small line drawings for the hub cards, one per angle. 100 x 100 units.
const f = (n) => Number(n.toFixed(1));

export const triangle = `<path d="M50 14 88 82H12z" class="soft"/><path class="dim" d="M50 14v68M31 48h38M21.5 65h57"/><path d="M50 56 50 14M50 56 12 82M50 56 88 82" class="dim"/><circle cx="50" cy="56" r="6" class="gold" stroke-width="2.5"/><circle cx="50" cy="14" r="2.5" class="fill"/><circle cx="12" cy="82" r="2.5" class="fill"/><circle cx="88" cy="82" r="2.5" class="fill"/>`;

export const reading = (() => {
  let s = `<path class="gold" stroke-width="2.5" d="M14 18v26"/>`;
  const rows = [[18, 0], [26, 0], [34, 0], [42, 0], [54, 3], [62, 5], [70, 7], [78, 5], [86, 3]];
  for (const [y, amp] of rows) {
    let d = "";
    for (let x = 22; x <= 86; x += 4) d += `${x === 22 ? "M" : "L"}${x} ${f(y + amp * Math.sin((x + y * 2) / 9))}`;
    s += `<path d="${d}"${amp ? "" : ' class="dim"'}/>`;
  }
  return s;
})();

export const shader = (() => {
  let s = "";
  for (const r of [10, 19, 28, 37]) s += `<circle cx="50" cy="50" r="${r}" class="${r === 19 ? "gold" : "dim"}"/>`;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + 0.4;
    s += `<rect x="${f(50 + 28 * Math.cos(a) - 5)}" y="${f(50 + 28 * Math.sin(a) - 5)}" width="10" height="10" rx="2" class="soft"/>`;
  }
  return s + `<circle cx="50" cy="50" r="3" class="fill"/>`;
})();

export const explainer = (() => {
  let s = `<rect x="14" y="14" width="46" height="46" rx="4" class="dim"/>`;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 9; i++) s += `<circle cx="${f(20 + rnd() * 34)}" cy="${f(20 + rnd() * 34)}" r="${f(1.5 + rnd() * 3)}" class="fill" opacity="${f(0.35 + rnd() * 0.6)}"/>`;
  s += `<circle cx="37" cy="37" r="9" class="gold"/>`;
  [[18, 30], [28, 22], [38, 16]].forEach(([y, w], i) => { s += `<path d="M68 ${y}h${w * 0.6}" stroke-width="3"${i === 1 ? ' class="gold"' : ""}/>`; });
  return s + `<path class="dim" d="M14 72h72M14 80h52M14 88h62"/>`;
})();

export const matrix = (() => {
  let s = "";
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const v = Math.sin(r * 1.7 + c * 0.9) * Math.cos(c * 1.3 - r * 0.4);
    s += `<rect x="${14 + c * 9}" y="${14 + r * 9}" width="7.5" height="7.5" rx="1.5" stroke="none" class="${v < -0.25 ? "gold-fill" : "fill"}" opacity="${f(0.15 + Math.abs(v) * 0.8)}"/>`;
  }
  return s + `<rect x="11.5" y="11.5" width="77" height="19.5" rx="3" stroke-dasharray="4 3" class="gold"/>`;
})();

export const cascade = `<rect x="8" y="38" width="22" height="24" rx="12" class="soft"/><rect x="39" y="38" width="22" height="24" rx="12" class="soft"/><rect x="70" y="38" width="22" height="24" rx="12" class="soft"/><path d="M30 50h9M61 50h9"/><path d="M35 46l4 4-4 4M66 46l4 4-4 4"/><circle cx="19" cy="50" r="3" class="fill"/><circle cx="47" cy="50" r="3" class="fill"/><circle cx="54" cy="50" r="3" class="gold-fill" stroke="none"/><circle cx="75" cy="50" r="3" class="fill"/><circle cx="81" cy="50" r="3" class="gold-fill" stroke="none"/><circle cx="87" cy="50" r="3" class="fill" opacity=".5"/><path class="dim" d="M12 76h76M12 84h50"/><path class="gold" stroke-width="3" d="M12 22h40"/><path class="dim" stroke-width="3" d="M12 28h64"/>`;

export const curves = (() => {
  const q = (p, r, c) => (r * p + c * (1 - p)) / (r * p + (1 - p));
  let s = `<path class="dim" d="M12 88h78M12 88V12"/>`;
  for (const [r, c, cls] of [[16, 0, ""], [11, 0.25, ""], [6, 0.5, ""], [1, 0.75, ' class="gold"']]) {
    let d = "";
    for (let i = 0; i <= 40; i++) { const p = i / 40; d += `${i ? "L" : "M"}${f(12 + p * 78)} ${f(88 - q(p, r, c) * 72)}`; }
    s += `<path d="${d}"${cls}/>`;
  }
  return s + `<path class="dim" stroke-dasharray="3 3" d="M16 88V14M41 88V14"/><circle cx="27.6" cy="30.4" r="3.5" class="gold"/>`;
})();

export const harmonic = (() => {
  let d = "";
  for (let i = 0; i <= 240; i++) { const t = (i / 240) * Math.PI * 2; d += `${i ? "L" : "M"}${f(50 + 36 * Math.sin(3 * t + Math.PI / 2))} ${f(50 + 36 * Math.sin(2 * t))}`; }
  return `<rect x="12" y="12" width="76" height="76" rx="6" class="dim"/><path d="${d}"/><circle cx="86" cy="50" r="3" class="gold-fill" stroke="none"/>`;
})();
