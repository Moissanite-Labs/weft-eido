// Templates for the Angles hub and subpages. Output is plain static HTML committed to site/angles/.
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ICON = `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23090d0f'/%3E%3Cpath d='M16 5 27 26H5z' fill='none' stroke='%23d9c7a0' stroke-width='2'/%3E%3C/svg%3E">`;
const BRAND = `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M16 3 29 27H3z"/><path d="M16 3v24M9.5 15 22.5 15M6.2 21h19.6" opacity=".5"/><circle cx="16" cy="19" r="2.6" fill="currentColor" stroke="none"/></svg>`;

export function shell({ title, description, body, head = "", scripts = "" }) {
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="theme-color" content="#090d0f">
  ${ICON}
  <link rel="stylesheet" href="../assets/site.css">
  <link rel="stylesheet" href="../assets/angles.css">${head}
  <script src="../assets/theme.js"></script>
  <script type="module" src="../assets/site.js"></script>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="wrap">
      <a class="brand" href="../index.html" aria-label="Eido home">${BRAND}<span class="brand-name">Eido</span><span class="brand-org">Moissanite Labs</span></a>
      <nav class="nav" aria-label="Main">
        <a href="../index.html">Home</a>
        <a href="index.html" aria-current="page">Angles</a>
        <a href="../philosophy.html">Philosophy</a>
        <a href="../components/index.html">Components</a>
        <a href="../causal-harmonic/index.html">Harmonic</a>
        <a href="https://github.com/Moissanite-Labs/weft-eido">GitHub</a>
        <button class="icon-btn" type="button" data-theme-toggle aria-label="Theme: system. Activate to change.">Theme: system</button>
      </nav>
    </div>
  </header>
  <main id="main">
${body}
  </main>
  <footer class="site-footer">
    <div class="wrap">
      <span>Eido is a <a href="https://w3ft.org">Moissanite Labs</a> project and the design language of <a href="https://github.com/Moissanite-Labs/weft">ML Weft</a>.</span>
      <span>Code: Apache-2.0. Docs: CC BY 4.0. <a href="https://github.com/Moissanite-Labs/weft-eido">Source on GitHub</a></span>
    </div>
  </footer>${scripts}
</body>
</html>
`;
}

export const motif = (inner, label) =>
  `<svg class="motif" viewBox="0 0 100 100" role="img" aria-label="${esc(label)}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const badge = (a) => `<span class="badge ${a.statusClass}">${esc(a.status)}</span>`;

export function hubCard(a, i) {
  return `      <a class="card angle-card" href="${a.slug}.html">
        ${motif(a.motif, a.motifLabel)}
        <div>
          <div class="tag-row"><span class="id">${String(i + 1).padStart(2, "0")}</span>${badge(a)}</div>
          <h3>${esc(a.name)}</h3>
          <p>${a.card}</p>
          <p class="does">${a.does}</p>
        </div>
      </a>`;
}

function exhibit(a) {
  const x = a.exhibit;
  if (x.live) {
    return `<div class="exhibit"><div class="exhibit-bar"><span class="title">${esc(x.title)}</span></div><div class="live">${x.live}</div></div>`;
  }
  const tabs = x.frames.length > 1
    ? `<div class="exhibit-tabs" role="group" aria-label="Choose what to show">${x.frames.map((f, i) => `<button class="btn small" type="button" data-frame="${f.src}" data-title="${esc(f.title)}" aria-pressed="${i === 0}">${esc(f.label)}</button>`).join("")}</div>`
    : "";
  const f0 = x.frames[0];
  const h = x.height ? ` style="height:${x.height}px"` : "";
  const frame = x.gate
    ? `<div class="exhibit-gate" data-gate><p>${x.gate}</p><button class="btn btn-primary" type="button" data-gate-load>Load it here</button></div>
        <iframe data-src="${f0.src}" title="${esc(f0.title)}" hidden${h}></iframe>`
    : `<iframe src="${f0.src}" title="${esc(f0.title)}" loading="lazy"${x.allow ? ` allow="${x.allow}"` : ""}${h}></iframe>`;
  return `<div class="exhibit" data-exhibit>
        <div class="exhibit-bar"><span class="title" data-exhibit-title>${esc(f0.title)}</span>${tabs}<a class="btn small" data-exhibit-open href="${f0.src}">Open full page</a></div>
        ${frame}
      </div>`;
}

const TAB_SCRIPT = `
  <script type="module">
    // Archived pages that accept a theme message follow this site's theme switch.
    const root = document.documentElement;
    const tell = (frame) => { try { frame.contentWindow?.postMessage({ type: "set-theme", theme: root.getAttribute("data-theme") }, "*"); } catch (e) { /* frame not ready */ } };
    for (const box of document.querySelectorAll("[data-exhibit]")) {
      const frame = box.querySelector("iframe");
      const title = box.querySelector("[data-exhibit-title]");
      const open = box.querySelector("[data-exhibit-open]");
      const tabs = [...box.querySelectorAll("[data-frame]")];
      frame.addEventListener("load", () => tell(frame));
      new MutationObserver(() => tell(frame)).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
      for (const tab of tabs) tab.addEventListener("click", () => {
        frame.src = tab.dataset.frame;
        frame.title = tab.dataset.title;
        title.textContent = tab.dataset.title;
        open.href = tab.dataset.frame;
        for (const t of tabs) t.setAttribute("aria-pressed", String(t === tab));
      });
      box.querySelector("[data-gate-load]")?.addEventListener("click", () => {
        box.querySelector("[data-gate]").remove();
        frame.hidden = false;
        frame.src = frame.dataset.src;
        frame.focus();
      });
    }
  </script>`;

const list = (items) => `<ul>\n${items.map((t) => `          <li>${t}</li>`).join("\n")}\n        </ul>`;

export function anglePage(a, i, all) {
  const prev = all[(i + all.length - 1) % all.length];
  const next = all[(i + 1) % all.length];
  const n = String(i + 1).padStart(2, "0");
  const body = `    <section class="hero compact" aria-labelledby="t"><div class="wrap">
      <p class="kicker"><span class="dot"></span><a href="index.html">Angles</a> · ${n} of ${String(all.length).padStart(2, "0")}</p>
      <h1 id="t">${esc(a.name)}</h1>
      <p class="lede">${a.lede}</p>
      <div class="angle-meta">${badge(a)}${a.meta.map((m) => `<span class="badge">${esc(m)}</span>`).join("")}</div>
    </div></section>
    <section class="block"><div class="wrap angle-body">
      <section aria-labelledby="try-h">
        <h2 id="try-h">Try it</h2>
        ${exhibit(a)}
        ${a.exhibit.note ? `<p class="exhibit-note">${a.exhibit.note}</p>` : ""}
      </section>
      <section aria-labelledby="does-h">
        <h2 id="does-h">What it can do</h2>
        ${list(a.can)}
      </section>
      <section aria-labelledby="concepts-h">
        <h2 id="concepts-h">Concepts</h2>
        ${a.conceptsIntro ? `<p>${a.conceptsIntro}</p>` : ""}
        <div class="concepts">
${a.concepts.map((c) => `          <article class="concept">${c.id ? `<span class="id">${esc(c.id)}</span>` : ""}<h3>${c.h}</h3><p>${c.p}</p></article>`).join("\n")}
        </div>
      </section>
      <section aria-labelledby="tech-h">
        <h2 id="tech-h">Techniques</h2>
        ${list(a.techniques)}
      </section>
      <section aria-labelledby="style-h">
        <h2 id="style-h">Style</h2>
        <p>${a.style.text}</p>
        <ul class="swatches" aria-label="Main colours">
${a.style.swatches.map(([hex, name]) => `          <li><i style="background:${hex}"></i>${esc(hex)}${name ? ` ${esc(name)}` : ""}</li>`).join("\n")}
        </ul>
${a.style.fonts.map(([label, stack, sample]) => `        <p class="type-sample"><span>${esc(label)}</span><b style="font-family:${esc(stack)}">${esc(sample)}</b></p>`).join("\n")}
      </section>
      <section aria-labelledby="files-h">
        <h2 id="files-h">Files and status</h2>
        <p>${a.statusText}</p>
        <ul class="file-list">
${a.files.map(([path, what, href]) => `          <li>${href ? `<a href="${href}"><code>${esc(path)}</code></a>` : `<code>${esc(path)}</code>`}<span>${what}</span></li>`).join("\n")}
        </ul>
      </section>
      <nav class="angle-pager" aria-label="Other angles">
        <a class="btn" href="${prev.slug}.html">← ${esc(prev.name)}</a>
        <a class="btn" href="index.html">All angles</a>
        <a class="btn" href="${next.slug}.html">${esc(next.name)} →</a>
      </nav>
    </div></section>`;
  return shell({
    title: `${a.name} · Angles · Eido`,
    description: a.description,
    body,
    head: a.head || "",
    scripts: (a.exhibit.frames ? TAB_SCRIPT : "") + (a.scripts || ""),
  });
}
