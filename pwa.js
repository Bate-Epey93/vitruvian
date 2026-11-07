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
    /* updatefound fires once per worker. One that finished installing
       before this page loaded (the toast ignored, a pull to refresh, a trip
       to a lab page and back) sits in reg.waiting with no event left to
       fire, and the old cache kept being served with no prompt at all. */
    if(reg.waiting && navigator.serviceWorker.controller){
      showUpdateToast(() => reg.waiting && reg.waiting.postMessage("SKIP_WAITING"));
    }
    /* An installed app kept in the background never navigates, so the
       browser never checks for a new sw.js. Check on return to the app,
       at most every 30 minutes; updatefound below takes it from there. */
    let lastCheck = Date.now();
    document.addEventListener("visibilitychange", () => {
      if(document.visibilityState !== "visible" || Date.now() - lastCheck < 30 * 60 * 1000) return;
      lastCheck = Date.now();
      reg.update().catch(() => {});
    });
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      nw.addEventListener("statechange", () => {
        if(nw.state === "installed" && navigator.serviceWorker.controller){
          showUpdateToast(() => nw.postMessage("SKIP_WAITING"));
        }
      });
    });
  }).catch(e => console.warn("sw registration failed", e));
  /* claim() in sw.js activate also fires controllerchange on a first visit,
     when the page had no controller at all, and the reload then threw away
     whatever a new visitor had typed a few seconds in. Only a swap from one
     worker to another means this page is running old code. */
  let prevController = navigator.serviceWorker.controller;
  let refreshed = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    const swapped = !!prevController;
    prevController = navigator.serviceWorker.controller;
    if(swapped && !refreshed){
      refreshed = true;
      /* A reload mid-generation aborts the stream after its tokens are billed
         and saves nothing. Wait for it to settle; old code runs a little
         longer, which costs nothing. */
      if(typeof genInFlight === "function" && genInFlight()){
        window.addEventListener("sdc:gensettled", () => location.reload(), { once: true });
        return;
      }
      location.reload();
    }
  });
}
function showUpdateToast(activate){
  const toast = document.getElementById("updateToast");
  toast.hidden = false;
  document.getElementById("updateReload").onclick = async () => {
    if(typeof flushSaves === "function") await flushSaves();   // pending attempt writes flush first
    /* same reason as controllerchange above: never swap code under a run */
    if(typeof genInFlight === "function" && genInFlight()){
      document.getElementById("updateReload").textContent = "Update after this finishes";
      window.addEventListener("sdc:gensettled", activate, { once: true });
      return;
    }
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
  btn.innerHTML = '<svg class="ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3.5v9M6.2 9l3.8 3.8L13.8 9M4 16.5h12"/></svg><span class="tbtn-label">Install</span>';
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
