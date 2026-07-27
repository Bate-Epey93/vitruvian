/* ═══════════════════════════════════════════════════════════════
   FIELD STUDY — page shell
   ───────────────────────────────────────────────────────────────
   Everything a field study needs that is not the machine: the layer
   walkthrough, the demo transport, the three stage toggles, camera
   handling, theme, and the accessibility plumbing.

   Knows nothing about any particular mechanism. A study supplies a
   copy object and a scene module; whatever readouts that mechanism
   needs — dials, gauges, a selector gate — it supplies as its own
   instruments and this shell just gives them a place to live and a
   frame to paint on.

   Everything is createElement/textContent — never innerHTML.
   ═══════════════════════════════════════════════════════════════ */

var LabPage = (function () {
  "use strict";

  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function $(id) { return document.getElementById(id); }

  /* opts.copy   — the study's prose (see the copy contract in the skill)
     opts.scene  — module exposing create(canvas) and LAYERS
     opts.instruments — optional { build(root, api), paint(api) } */
  function mount(opts) {
    var C = opts.copy, L = opts.scene.LAYERS;
    var DEBUG = /(^|[?&])debug=1/.test(location.search);

    var canvas = $("stage");
    var ctl = opts.scene.create(canvas);
    var RM = ctl.scene.reducedMotion;
    if (DEBUG) window.__lab = window.__tx = ctl;
    var layerIndex = 0;
    var live = $("live");
    var els = {};

    /* what an instrument pack is allowed to see */
    var api = {
      ctl: ctl,
      copy: C,
      reducedMotion: RM,
      layer: function () { return L[layerIndex]; },
      layerIndex: function () { return layerIndex; },
      h: h,
      /* an instrument that starts a demo of its own tells the transport */
      demoStarted: function () {
        els.play.textContent = RM ? C.controls.restart : C.controls.pause;
        if (RM) els.scrub.value = "0";
      }
    };

    /* ═══ theme ═══
       Session-only: the app keeps the real preference in IndexedDB and
       mirrors it to localStorage for its own splash. Writing it here
       would desync that mirror, so a study just flips the attribute. */
    function currentTheme() { return document.documentElement.dataset.theme === "dark" ? "dark" : "light"; }
    function paintThemeBtn() {
      var b = $("themeBtn"), dark = currentTheme() === "dark";
      b.textContent = dark ? "☀" : "☾";
      b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    }
    $("themeBtn").addEventListener("click", function () {
      document.documentElement.dataset.theme = currentTheme() === "dark" ? "light" : "dark";
      paintThemeBtn();
      ctl.scene.readTokens();
    });
    paintThemeBtn();

    /* ═══ stage controls ═══
       A toggle reads its own next state off aria-pressed, so anything
       that changes the scene behind its back has to say so here —
       otherwise the button stays lit over state that was quietly reset,
       and the next click is a no-op. */
    function setToggle(b, on) {
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.classList.toggle("on", on);
    }

    function buildStageControls(root) {
      var bar = h("div", "stage-ctrls");
      function toggle(label, fn) {
        var b = h("button", "st-btn", label);
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", function () {
          var on = b.getAttribute("aria-pressed") !== "true";
          setToggle(b, on);
          fn(on);
        });
        return b;
      }
      els.expBtn = toggle(C.controls.explode, function (on) { ctl.setExplode(on ? 1 : 0); });
      bar.appendChild(els.expBtn);
      els.cutBtn = toggle(C.controls.cutaway, function (on) { ctl.setCutaway(on); });
      bar.appendChild(els.cutBtn);
      /* the optional third toggle: a study names it and names the two
         states it switches the scene between */
      if (C.altMode && ctl.setMode) {
        els.altBtn = toggle(C.altMode.label, function (on) { ctl.setMode(on ? C.altMode.on : C.altMode.off); });
        bar.appendChild(els.altBtn);
      }
      var reset = h("button", "st-btn", C.controls.reset);
      reset.addEventListener("click", function () { ctl.resetCamera(); });
      bar.appendChild(reset);
      root.appendChild(bar);
    }

    /* ═══ walkthrough ═══ */
    function buildDoc(root) {
      root.appendChild(h("div", "kicker", C.kicker));
      root.appendChild(h("h1", "title", C.title));
      root.appendChild(h("p", "subtitle", C.subtitle));
      root.appendChild(h("p", "lab-intro", C.intro));

      var st = h("div", "stepper");
      els.prev = h("button", "step-btn", "‹ Prev");
      els.prev.addEventListener("click", function () { goto(layerIndex - 1); });
      st.appendChild(els.prev);
      var rail = h("div", "step-rail");
      els.dots = L.map(function (cfg, i) {
        var d = h("button", "step-dot", String(i));
        d.setAttribute("aria-label", "Layer " + i + ": " + C.layers[i].name);
        d.addEventListener("click", function () { goto(i); });
        rail.appendChild(d);
        return d;
      });
      st.appendChild(rail);
      els.next = h("button", "step-btn", "Next ›");
      els.next.addEventListener("click", function () { goto(layerIndex + 1); });
      st.appendChild(els.next);
      root.appendChild(st);

      els.card = h("div", "layer-card");
      root.appendChild(els.card);
      root.appendChild(h("p", "fine lab-footer", C.footer));
    }

    function band(cls, label, text) {
      var b = h("div", "lc-band " + cls);
      b.appendChild(h("div", "mono-label", label));
      b.appendChild(h("p", null, text));
      return b;
    }

    function renderCard() {
      var t = C.layers[layerIndex], cfg = L[layerIndex], card = els.card;
      card.textContent = "";

      var head = h("div", "lc-head");
      head.appendChild(h("span", "layer-num", "Layer " + layerIndex));
      head.appendChild(h("span", "chip", t.era));
      card.appendChild(head);
      card.appendChild(h("h2", "lc-name", t.name));

      var prob = h("div", "problem-card");
      prob.appendChild(h("div", "mono-label", C.bands.problem));
      prob.appendChild(h("p", null, t.problem));
      prob.appendChild(h("p", "lc-beginner", t.beginner));
      card.appendChild(prob);

      card.appendChild(h("p", "lc-analogy", "Like " + t.analogy));

      /* demo transport */
      var demo = h("div", "demo-box");
      var drow = h("div", "demo-row");
      els.play = h("button", "big-btn demo-play", RM ? C.controls.restart : C.controls.play);
      els.play.addEventListener("click", onPlay);
      drow.appendChild(els.play);
      drow.appendChild(h("span", "demo-label", t.demoLabel));
      demo.appendChild(drow);

      els.scrub = document.createElement("input");
      els.scrub.type = "range";
      els.scrub.min = "0"; els.scrub.max = "1000"; els.scrub.value = "0";
      els.scrub.className = "scrub";
      els.scrub.setAttribute("aria-label", C.controls.scrubLabel);
      els.scrub.addEventListener("input", function () {
        ctl.seek(parseInt(els.scrub.value, 10) / 1000);
        els.play.textContent = RM ? C.controls.restart : C.controls.play;
      });
      demo.appendChild(els.scrub);
      els.phase = h("div", "demo-phase mono-label", C.phases.idle);
      demo.appendChild(els.phase);
      if (RM) demo.appendChild(h("p", "fine", C.a11y.rmNote));
      if (cfg.cutaway && C.cutawayNote) demo.appendChild(h("p", "fine", C.cutawayNote));
      card.appendChild(demo);

      card.appendChild(band("solution", C.bands.solution, t.solution));
      card.appendChild(band("tradeoff", C.bands.tradeoff, t.tradeoff));
      card.appendChild(band("scale", C.bands.atScale, t.atScale));

      if (cfg.free && C.freeNote) {
        var free = h("div", "free-note");
        free.appendChild(h("div", "mono-label", C.freeNote.label));
        free.appendChild(h("p", null, C.freeNote.text));
        card.appendChild(free);
      }

      els.dots.forEach(function (d, i) {
        d.classList.toggle("on", i === layerIndex);
        d.classList.toggle("done", i < layerIndex);
      });
      els.prev.disabled = layerIndex === 0;
      els.next.disabled = layerIndex === L.length - 1;

      /* the scene owns these; the buttons only report them */
      setToggle(els.cutBtn, !!ctl.scene.clip);
      setToggle(els.expBtn, ctl.scene.explodeAmount > 0);
      if (els.altBtn) setToggle(els.altBtn, ctl.state.mode === C.altMode.on);
      canvas.setAttribute("aria-label", C.a11y.canvas + " — " + t.name);
      if (opts.instruments && opts.instruments.layerChanged) opts.instruments.layerChanged(api);
    }

    function onPlay() {
      var S = ctl.state;
      if (RM) { ctl.seek(0); els.scrub.value = "0"; return; }
      if (S.playing) { ctl.pause(); els.play.textContent = C.controls.play; return; }
      if (S.t >= 1 || S.phase === "idle") startDemo();
      else { ctl.play(); els.play.textContent = C.controls.pause; }
    }

    /* Hand the scene the layer's own demo, never a resolved one — the
       scene is the only thing that knows what its modes do to it. */
    function startDemo() {
      var cfg = L[layerIndex];
      if (!cfg.demo) return;
      ctl.beginDemo(cfg.demo);
      els.play.textContent = RM ? C.controls.restart : C.controls.pause;
    }

    function goto(i) {
      if (i < 0 || i >= L.length) return;
      layerIndex = i;
      ctl.applyLayer(L[i]);
      renderCard();
      els.scrub.value = "0";
      if (location.hash !== "#" + L[i].id) history.replaceState(null, "", "#" + L[i].id);
      if (!RM) setTimeout(startDemo, 420);
    }

    ctl.on(function (kind, payload) {
      if (kind === "phase") {
        var txt = C.phases[payload] || "";
        els.phase.textContent = txt;
        els.phase.classList.toggle("bad", C.badPhases.indexOf(payload) >= 0);
        live.textContent = txt;
      } else if (kind === "done") {
        els.play.textContent = C.controls.replay;
      }
    });

    /* ═══ pointer: orbit on the canvas, page scroll everywhere else ═══ */
    var drag = null, pointers = {}, pinch = 0;
    canvas.addEventListener("pointerdown", function (e) {
      pointers[e.pointerId] = [e.clientX, e.clientY];
      canvas.setPointerCapture(e.pointerId);
      drag = [e.clientX, e.clientY];
      $("hint").classList.add("gone");
    });
    canvas.addEventListener("pointermove", function (e) {
      var ids = Object.keys(pointers);
      if (pointers[e.pointerId]) pointers[e.pointerId] = [e.clientX, e.clientY];
      if (ids.length >= 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch) ctl.dolly(pinch / d);
        pinch = d;
        return;
      }
      if (drag) {
        ctl.orbit(e.clientX - drag[0], e.clientY - drag[1]);
        drag = [e.clientX, e.clientY];
        return;
      }
      var r = canvas.getBoundingClientRect();
      var lbl = ctl.hoverLabel(e.clientX - r.left, e.clientY - r.top);
      var tip = $("tip");
      if (lbl) {
        tip.textContent = lbl;
        tip.style.left = (e.clientX - r.left) + "px";
        tip.style.top = (e.clientY - r.top) + "px";
        tip.classList.add("on");
      } else tip.classList.remove("on");
    });
    function endPointer(e) {
      delete pointers[e.pointerId];
      if (!Object.keys(pointers).length) { drag = null; pinch = 0; }
    }
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("pointerleave", function () { $("tip").classList.remove("on"); });
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      ctl.dolly(e.deltaY > 0 ? 1.09 : 0.92);
    }, { passive: false });
    canvas.addEventListener("dblclick", function () { ctl.resetCamera(); });

    /* ═══ layout ═══ */
    function fit() {
      ctl.scene.resize();
      ctl.resetCamera();
    }
    if (window.ResizeObserver) new ResizeObserver(fit).observe($("stageWrap"));
    else window.addEventListener("resize", fit);

    /* ═══ boot ═══ */
    if (opts.instruments) opts.instruments.build($("stageWrap"), api);
    buildStageControls($("stageWrap"));
    buildDoc($("docInner"));

    var dbg = null;
    if (DEBUG) { dbg = h("div", "dbg"); $("stageWrap").appendChild(dbg); }

    var start = L.map(function (c) { return c.id; }).indexOf(location.hash.replace("#", ""));
    layerIndex = start >= 0 ? start : 0;
    ctl.applyLayer(L[layerIndex]);
    renderCard();
    ctl.scene.resize();
    ctl.resetCamera();
    ctl.start();

    (function paintLoop() {
      requestAnimationFrame(paintLoop);
      if (opts.instruments && opts.instruments.paint) opts.instruments.paint(api);
      var S = ctl.state;
      if (S.playing) els.scrub.value = Math.round(S.t * 1000) + "";
      if (S.shake > 0.01 && !RM) {
        canvas.style.transform = "translate(" + (Math.random() - 0.5) * S.shake * 3 + "px," + (Math.random() - 0.5) * S.shake * 3 + "px)";
      } else if (canvas.style.transform) canvas.style.transform = "";
      $("stageWrap").classList.toggle("crashing", !!S.crashed);
      if (dbg) dbg.textContent = ctl.scene.stats.ms.toFixed(1) + " ms · " + ctl.scene.stats.faces + " items · lod " + ctl.scene.lod;
    })();

    if (!RM) setTimeout(startDemo, 700);
    return api;
  }

  return { mount: mount, h: h, byId: $ };
})();
