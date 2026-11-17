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
  try { hue = parseInt(localStorage.getItem("eido-tide-hue") || "", 10); } catch (e) {}
  if (hue != null && isFinite(hue)) root.style.setProperty("--eco-hue", String(((hue % 360) + 360) % 360));
  root.setAttribute("data-theme", light ? "light" : "dark");
  root.setAttribute("data-pref", pref);
  // A page reached by pressing something opens as an iris from that point. The radius
  // is the distance to the farthest corner, so the circle closes over the page exactly.
  if (!still) {
    try {
      var o = JSON.parse(sessionStorage.getItem("eido-origin") || "null");
      if (o && isFinite(o.x) && isFinite(o.y)) {
        var fx = Math.max(o.x, 1 - o.x) * window.innerWidth, fy = Math.max(o.y, 1 - o.y) * window.innerHeight;
        root.style.setProperty("--vt-x", (o.x * 100).toFixed(2) + "%");
        root.style.setProperty("--vt-y", (o.y * 100).toFixed(2) + "%");
        root.style.setProperty("--vt-r", Math.ceil(Math.sqrt(fx * fx + fy * fy)) + "px");
        root.classList.add("vt-iris");
      }
    } catch (e) {}
  }
  if (!still && "IntersectionObserver" in window) {
    root.classList.add("loom-pending");
    setTimeout(function () {
      if (!root.classList.contains("loom")) root.classList.remove("loom-pending", "loom-unfold");
    }, 2600);
  }
})();
