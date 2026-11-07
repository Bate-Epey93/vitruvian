/* Pre-paint theme hook for the splash screen. The theme's source of truth
   is IndexedDB (engine.js applies it at boot and mirrors it here); this
   tiny blocking script exists because CSP bars inline scripts, and the
   splash must paint in the right theme before the deferred app boots. */
var t = null;
try { t = localStorage.getItem("vitruvian_theme"); } catch (e) { /* private mode etc. */ }
/* Nothing saved yet (first run, or storage blocked): follow the OS, the same
   fallback boot() uses, so a dark-mode visitor never gets a paper splash that
   then snaps to dark. The lab pages load this file too. */
if (t !== "dark" && t !== "light") {
  t = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
document.documentElement.dataset.theme = t;
/* the browser chrome follows too; the colours mirror applyTheme() in engine.js */
document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
  m.setAttribute("content", t === "dark" ? "#0c0c0e" : "#f6f5f2");
});
