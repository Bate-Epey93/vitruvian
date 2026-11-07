/* ═══════════════════════════════════════════════════════════════
   SYSTEM DECONSTRUCTOR — PWA LAYER (§2, inherited from Studio)
   ───────────────────────────────────────────────────────────────
   Service-worker registration + user-controlled update flow,
   installing (one offer after the first finished layer, and the
   state Settings shows), and launcher shortcut routing. Loads last;
   talks to the engine through globals and the "sdc:" events.
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

/* ── Install ──
   One offer, made once, after the reader has finished a layer and so has
   seen what the app is for (offerInstall, called by the reader in
   engine.js). It used to be an accent Install button that joined the top
   bar the moment the browser allowed it, before a single study was open,
   and iOS got its hint on a second visit, read or not. Settings keeps a
   permanent row (installState, promptInstall). */
let deferredPrompt = null;
let installedHere = false;   // a tab that just installed is still a tab, but Settings should say it is done
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  window.dispatchEvent(new Event("sdc:installchange"));
});
window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  installedHere = true;
  closeInstallOffer();
  window.dispatchEvent(new Event("sdc:installchange"));
});
function isIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && /mac/i.test(navigator.platform));
}
/* "installed": running as the app. "prompt": the browser installs on a tap.
   "ios": Safari installs by hand, through Share. "other": nothing this page
   can start; the browser's own menu may still offer it. */
function installState(){
  if(isStandalone() || installedHere) return "installed";
  if(deferredPrompt) return "prompt";
  if(isIOS()) return "ios";
  return "other";
}
async function promptInstall(){
  if(!deferredPrompt) return false;
  const p = deferredPrompt;
  deferredPrompt = null;   // a prompt can be shown once; the browser sends a fresh one later
  closeInstallOffer();
  p.prompt();
  const choice = await p.userChoice.catch(() => null);
  window.dispatchEvent(new Event("sdc:installchange"));
  return !!choice && choice.outcome === "accepted";
}
function closeInstallOffer(){
  const sheet = document.getElementById("installSheet");
  if(!sheet || sheet.hidden) return;
  sheet.hidden = true;
  sheet.textContent = "";
}
let installOfferMade = false;
async function offerInstall(){
  const state = installState();
  if(installOfferMade || (state !== "prompt" && state !== "ios")) return;
  /* one card at a time: a tip or the key sheet showing wins, and the next
     layer finished offers again */
  if(document.querySelector(".tip-card, .key-sheet")) return;
  installOfferMade = true;
  const m = await Store.getMeta();
  if(m.installOffered || m.iosHintDismissed) return;   // iosHintDismissed: the old iOS hint, already seen
  await Store.saveMeta({ installOffered: true });
  const I = COPY.install;
  const sheet = document.getElementById("installSheet");
  sheet.textContent = "";
  const label = h("div", "ih-label", I.label);
  label.id = "installSheetLabel";
  const text = h("p");
  if(state === "ios") text.append(I.iosLede + " ", h("b", null, I.iosHow), ".");
  else text.textContent = I.lede;
  const close = h("button", "ih-close", "\u00d7");
  close.type = "button";
  close.setAttribute("aria-label", I.close);
  close.onclick = closeInstallOffer;
  sheet.append(label, text);
  if(state === "prompt"){
    const go = h("button", "gbtn primary ih-go", I.btn);
    go.type = "button";
    go.onclick = () => promptInstall();
    sheet.appendChild(go);
  }
  sheet.appendChild(close);
  sheet.hidden = false;
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
});
