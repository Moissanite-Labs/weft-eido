// Runs in <head> before first paint so the page never flashes the wrong theme,
// and holds <main> back for the loom to unfold. If the loom never arrives,
// the page shows itself after a moment anyway.
(function () {
  var root = document.documentElement;
  var pref = "system";
  try { pref = localStorage.getItem("eido-theme") || "system"; } catch (e) {}
  if (pref !== "light" && pref !== "dark") pref = "system";
  var mm = window.matchMedia;
  var light = pref === "light" || (pref === "system" && mm && mm("(prefers-color-scheme: light)").matches);
  var still = mm && mm("(prefers-reduced-motion: reduce)").matches;
  if (still) root.classList.add("reduced-motion");
  var hue = null;
  try { hue = parseInt(localStorage.getItem("eido-hue") || "", 10); } catch (e) {}
  if (hue != null && isFinite(hue)) root.style.setProperty("--eco-hue", String(((hue % 360) + 360) % 360));
  root.setAttribute("data-theme", light ? "light" : "dark");
  root.setAttribute("data-pref", pref);
  if (!still && "IntersectionObserver" in window) {
    root.classList.add("loom-pending");
    setTimeout(function () {
      if (!root.classList.contains("loom")) root.classList.remove("loom-pending", "loom-unfold");
    }, 2600);
  }
})();
