/* ═══════════════════════════════════════════════════════════════
   SYSTEM DECONSTRUCTOR — PWA LAYER (§2, inherited from Studio)
   ───────────────────────────────────────────────────────────────
   Service-worker registration + user-controlled update flow,
   install affordances (Chromium button-less: uses shortcuts + iOS
   hint), and launcher shortcut routing. Loads last; talks to the
   engine through globals and the "sdc:ready" event.
   ═══════════════════════════════════════════════════════════════ */

function isStandalone(){
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}
if(isStandalone()) document.body.classList.add("standalone");

/* ── Service worker: register + update flow ── */
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("./sw.js").then(reg => {
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      nw.addEventListener("statechange", () => {
        if(nw.state === "installed" && navigator.serviceWorker.controller){
          showUpdateToast(() => nw.postMessage("SKIP_WAITING"));
        }
      });
    });
  }).catch(e => console.warn("sw registration failed", e));
  let refreshed = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if(!refreshed){ refreshed = true; location.reload(); }
  });
}
function showUpdateToast(activate){
  const toast = document.getElementById("updateToast");
  toast.hidden = false;
  document.getElementById("updateReload").onclick = async () => {
    if(typeof flushSaves === "function") await flushSaves();   // pending attempt writes flush first
    activate();
  };
}

/* ── Install: Chromium beforeinstallprompt (offer via a transient button) ── */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  if(isStandalone()) return;
  const settingsBtn = document.getElementById("settingsBtn");
  if(document.getElementById("installBtn")) return;
  const btn = document.createElement("button");
  btn.id = "installBtn";
  btn.className = "tbtn accent";
  btn.innerHTML = '<span class="tbtn-label">Install</span><span class="tbtn-ico">⤓</span>';
  btn.setAttribute("aria-label", "Install app");
  btn.onclick = async () => {
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btn.remove();
  };
  settingsBtn.parentNode.insertBefore(btn, settingsBtn);
});
window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  const b = document.getElementById("installBtn");
  if(b) b.remove();
});

/* ── Install: iOS hint (second visit, one-time) ── */
function isIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && /mac/i.test(navigator.platform));
}
async function maybeShowIosHint(){
  if(isStandalone() || !isIOS()) return;
  const m = await Store.getMeta();
  const visits = (m.visits || 0) + 1;
  await Store.saveMeta({ visits });
  if(visits < 2 || m.iosHintDismissed) return;
  const hint = document.getElementById("iosHint");
  hint.hidden = false;
  document.getElementById("iosHintClose").onclick = async () => {
    hint.hidden = true;
    await Store.saveMeta({ iosHintDismissed: true });
  };
}

/* ── Launcher shortcut routing (?action=…) ── */
function handleLaunchAction(){
  const action = new URLSearchParams(location.search).get("action");
  if(!action) return;
  history.replaceState(null, "", location.pathname);
  if(action === "new" && typeof launchNew === "function") launchNew();
  else if(action === "resume" && typeof launchResume === "function") launchResume();
}

window.addEventListener("sdc:ready", () => {
  handleLaunchAction();
  maybeShowIosHint();
});
