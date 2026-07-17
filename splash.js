/* Pre-paint theme hook for the splash screen. The theme's source of truth
   is IndexedDB (engine.js applies it at boot and mirrors it here); this
   tiny blocking script exists because CSP bars inline scripts, and the
   splash must paint in the right theme before the deferred app boots. */
try {
  var t = localStorage.getItem("vitruvian_theme");
  if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
} catch (e) { /* private mode etc. — splash falls back to light theme */ }
