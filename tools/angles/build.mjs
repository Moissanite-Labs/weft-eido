// Writes site/angles/*.html from the content in angles.mjs. Run from the repository root:
//   node tools/angles/build.mjs .
// The output is committed, so the site itself still has no build step.
import fs from "node:fs";
import path from "node:path";
import { angles } from "./angles.mjs";
import { shell, hubCard, anglePage } from "./lib.mjs";

const repo = process.argv[2];
const out = path.join(repo, "site", "angles");
fs.mkdirSync(out, { recursive: true });

// The research explainer demo is lifted from its component page so the two cannot drift apart at build time.
const comp = fs.readFileSync(path.join(repo, "site/components/research-explainer.html"), "utf8");
const demo = comp.match(/<div class="panel research-demo" id="research-demo">[\s\S]*?\n        <\/div>\n/)[0].replace('class="panel research-demo"', 'class="research-demo"');
const css = comp.match(/<style>([\s\S]*?)<\/style>/)[1];
const js = comp.match(/<script type="module">\s*\n(\s*import \{ clamp[\s\S]*?)<\/script>/)[1];
const ex = angles.find((a) => a.slug === "research-explainer");
ex.exhibit.live = demo;
ex.head = `\n  <style>${css.split("\n").filter((l) => /^\s*(\.research|\.segmented|\.kpi|\.stage|\.range-row|@media \(max-width: 700px\))/.test(l)).join("\n")}\n  </style>`;
ex.scripts = `\n  <script type="module">\n${js}</script>`;

angles.forEach((a, i) => fs.writeFileSync(path.join(out, `${a.slug}.html`), anglePage(a, i, angles)));

const rows = [
  ["Design modules", "SVG, Canvas2D", "Computed live", "None"],
  ["Reading systems", "DOM text, CSS", "Computed live", "None"],
  ["Eido rebuild", "WebGPU shader", "Computed live", "ipwho.is at load"],
  ["Research explainer", "Canvas2D", "Computed live, toy model", "None"],
  ["Original research graphics", "Canvas2D", "Part live, part fixed tables", "Google Fonts"],
  ["Session simulations", "Canvas2D, SVG", "Mostly recorded results", "None"],
  ["Identifiability explorer", "SVG", "Computed live", "Google Fonts"],
  ["Causal Harmonic Computing", "Canvas2D, Web Audio", "Live sound and charts", "CDN scripts, Google Fonts"],
];
const hub = `    <section class="hero compact" aria-labelledby="t"><div class="wrap">
      <p class="kicker"><span class="dot"></span>Angles</p>
      <h1 id="t">Eight ways into one idea</h1>
      <p class="lede">Eido started as a design language: an interface that changes itself inside limits you can see. Since then the same idea has been tried as components, as a GPU rewrite, as research explainers, as simulations and as sound. Each angle below has its own page with a live example, the concepts behind it, the techniques it uses and its visual style.</p>
      <div class="hero-meta"><span>Three angles are on the main branch</span><span>Five are open pull requests, shown here as proposed</span></div>
    </div></section>
    <section class="block" aria-labelledby="all-h"><div class="wrap">
      <div class="section-head"><span class="eyebrow">All angles</span><h2 id="all-h">Pick one</h2></div>
      <div class="angle-grid">
${angles.map(hubCard).join("\n")}
      </div>
    </div></section>
    <section class="block alt" aria-labelledby="cmp-h"><div class="wrap">
      <div class="section-head"><span class="eyebrow">Side by side</span><h2 id="cmp-h">How they differ</h2>
        <p>What each angle is drawn with, whether its numbers are worked out as you watch or are recorded results drawn as a picture, and what it asks of the network.</p>
      </div>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Comparison of the eight angles"><table class="spec-table">
        <thead><tr><th scope="col">Angle</th><th scope="col">Drawn with</th><th scope="col">Numbers</th><th scope="col">Network</th></tr></thead>
        <tbody>
${rows.map((r, i) => `          <tr><th scope="row"><a href="${angles[i].slug}.html">${r[0]}</a></th><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join("\n")}
        </tbody>
      </table></div>
    </div></section>
    <section class="block" aria-labelledby="read-h"><div class="wrap">
      <div class="section-head"><span class="eyebrow">Reading the claims</span><h2 id="read-h">What is checked and what is not</h2>
        <p>The design modules, the reading systems and the research explainer have tests in this repository. The identifiability explorer's exact fractions were recomputed independently, as its README records. Everything else that shows a result (the original graphics, the simulations, the harmonic paper) shows its authors' numbers. This repository has not verified them, and each page says so.</p>
      </div>
    </div></section>`;
fs.writeFileSync(path.join(out, "index.html"), shell({
  title: "Angles · Eido",
  description: "Every angle explored in the Eido repository, with a page for each: design modules, reading systems, a GPU rebuild, research explainers, simulations and sound.",
  body: hub,
}));
console.log("wrote", fs.readdirSync(out).join(" "));
