// Shared behaviour for every page: theme toggle, copy buttons, live source blocks.

const THEMES = ["system", "light", "dark"];
const root = document.documentElement;

function resolve(pref) {
  if (pref === "light" || pref === "dark") return pref;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(pref) {
  root.setAttribute("data-pref", pref);
  root.setAttribute("data-theme", resolve(pref));
  const btn = document.querySelector("[data-theme-toggle]");
  if (btn) {
    btn.textContent = `Theme: ${pref}`;
    btn.setAttribute("aria-label", `Theme: ${pref}. Activate to change.`);
  }
}

function initTheme() {
  let pref = root.getAttribute("data-pref") || "system";
  applyTheme(pref);
  document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
    pref = THEMES[(THEMES.indexOf(pref) + 1) % THEMES.length];
    try { localStorage.setItem("eido-theme", pref); } catch (e) { /* storage may be blocked */ }
    applyTheme(pref);
  });
  window.matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => {
    if (pref === "system") applyTheme(pref);
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
    ta.remove();
    return ok;
  }
}

function initCopy() {
  const status = document.createElement("div");
  status.className = "copy-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  document.body.appendChild(status);
  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest?.("button.copy");
    if (!btn) return;
    const target = btn.dataset.copyTarget && document.querySelector(btn.dataset.copyTarget);
    const text = btn.dataset.copyText ?? target?.textContent ?? "";
    const ok = await copyText(text);
    const label = btn.dataset.label || btn.textContent;
    btn.dataset.label = label;
    btn.textContent = ok ? "Copied" : "Copy failed";
    btn.dataset.state = ok ? "copied" : "failed";
    status.textContent = ok ? "Copied to clipboard" : "Copy failed";
    clearTimeout(btn._t);
    btn._t = setTimeout(() => {
      btn.textContent = label;
      delete btn.dataset.state;
      status.textContent = "";
    }, 1800);
  });
}

/** Fetch a repo file and show it in a <code data-src="..."> element. */
async function initSources() {
  for (const code of document.querySelectorAll("code[data-src]")) {
    try {
      const res = await fetch(code.dataset.src);
      if (!res.ok) throw new Error(`${res.status}`);
      const text = await res.text();
      code.textContent = text;
      const lines = text.split("\n").length;
      const cap = code.closest("figure")?.querySelector("[data-lines]");
      if (cap) cap.textContent = ` · ${lines} lines`;
    } catch (e) {
      code.textContent = `Could not load ${code.dataset.src} (${e.message}). Open it on GitHub instead.`;
    }
  }
}

initTheme();
initCopy();
initSources();
