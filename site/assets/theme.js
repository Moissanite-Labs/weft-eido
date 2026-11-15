// Runs in <head> before first paint so the page never flashes the wrong theme.
(function () {
  var pref = "system";
  try { pref = localStorage.getItem("eido-theme") || "system"; } catch (e) {}
  if (pref !== "light" && pref !== "dark") pref = "system";
  var light = pref === "light" || (pref === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches);
  var root = document.documentElement;
  var hue = null;
  try { hue = parseInt(localStorage.getItem("eido-hue") || "", 10); } catch (e) {}
  if (hue != null && isFinite(hue)) root.style.setProperty("--eco-hue", String(((hue % 360) + 360) % 360));
  root.setAttribute("data-theme", light ? "light" : "dark");
  root.setAttribute("data-pref", pref);
})();
