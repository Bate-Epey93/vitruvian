/* ═══════════════════════════════════════════════════════════════
   FIELD STUDY — page shell
   ───────────────────────────────────────────────────────────────
   Everything a field study needs that is not the machine: the layer
   walkthrough (the app's timeline and four-step card), the demo transport, the three stage toggles, camera
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
    function buildThemeIcon(kind) {
      var NS = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 20 20");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("class", "ico");
      if (kind === "sun") {
        var c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", "10"); c.setAttribute("cy", "10"); c.setAttribute("r", "3.2");
        var p = document.createElementNS(NS, "path");
        p.setAttribute("d", "M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3L6 14M14 6l1.3-1.3");
        svg.append(c, p);
      } else {
        var m = document.createElementNS(NS, "path");
        m.setAttribute("d", "M16.2 12.4A6.6 6.6 0 0 1 7.6 3.8a6.6 6.6 0 1 0 8.6 8.6z");
        svg.appendChild(m);
      }
      return svg;
    }
    function paintThemeBtn() {
      var b = $("themeBtn"), dark = currentTheme() === "dark";
      b.textContent = "";
      b.appendChild(buildThemeIcon(dark ? "sun" : "moon"));
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

    /* ═══ walkthrough ═══
       The same shape as a Deconstruct in the app: one timeline for your
       place, then each layer in four steps (the problem, your guess, the
       solution, the tradeoff) with the next move in a footer that stays
       in reach. The demo sits with the problem and again with the
       solution, where watching it means something. */
    var STEPS = [
      { label: "The problem", short: "Problem", tone: "red" },
      { label: "Your guess", short: "Guess", tone: "vio" },
      { label: "The solution", short: "Solution", tone: "teal" },
      { label: "The tradeoff", short: "Tradeoff", tone: "amber" }
    ];
    var step = 1;
    var seen = {};                       // layers you've reached the solution of, this visit
    var guessKey = function (i) { return "vitruvian_lab_guess_" + location.pathname.split("/").pop() + "_" + L[i].id; };
    function loadGuess(i) { try { return localStorage.getItem(guessKey(i)) || ""; } catch (e) { return ""; } }
    function saveGuess(i, v) { try { localStorage.setItem(guessKey(i), v); } catch (e) {} }

    function buildDoc(root) {
      root.appendChild(h("div", "kicker", C.kicker));
      root.appendChild(h("h1", "title", C.title));
      root.appendChild(h("p", "subtitle", C.subtitle));
      root.appendChild(h("p", "lab-intro", C.intro));
      els.timeline = h("nav", "scrub-wrap timeline lab-timeline");
      els.timeline.setAttribute("aria-label", "Layers");
      root.appendChild(els.timeline);
      els.card = h("div", "layer-card step-body");
      root.appendChild(els.card);
      root.appendChild(h("p", "fine lab-footer", C.footer));
      buildDemo();
    }

    function renderTimeline() {
      var row = h("div", "tl-row");
      L.forEach(function (cfg, i) {
        var state = i === layerIndex ? "on" : seen[i] ? "done" : "todo";
        var b = h("button", "tl-seg tl-" + state, i === layerIndex ? i + "  " + C.layers[i].name : String(i));
        b.setAttribute("aria-label", "Layer " + i + ": " + C.layers[i].name);
        if (i === layerIndex) b.setAttribute("aria-current", "step");
        b.addEventListener("click", function () { goto(i, seen[i] ? 3 : 1); });
        row.appendChild(b);
      });
      els.timeline.textContent = "";
      els.timeline.appendChild(row);
      var cur = row.querySelector(".tl-on");
      if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest", inline: "center" });
    }

    function band(cls, label, text) {
      var b = h("div", "lc-band " + cls);
      b.appendChild(h("div", "mono-label", label));
      b.appendChild(h("p", null, text));
      return b;
    }

    /* the demo transport lives across steps, so the scene's events always
       have somewhere to report to */
    function buildDemo() {
      var demo = h("div", "demo-box");
      var drow = h("div", "demo-row");
      els.play = h("button", "big-btn demo-play", RM ? C.controls.restart : C.controls.play);
      els.play.addEventListener("click", onPlay);
      drow.appendChild(els.play);
      els.demoLabel = h("span", "demo-label", "");
      drow.appendChild(els.demoLabel);
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
      els.cutNote = C.cutawayNote ? h("p", "fine", C.cutawayNote) : null;
      if (els.cutNote) demo.appendChild(els.cutNote);
      els.demo = demo;
    }

    function footer(primary, secondary) {
      var f = h("div", "step-foot");
      if (secondary) {
        var s2 = h("button", "gbtn ghost step-back", secondary.label);
        s2.addEventListener("click", secondary.fn);
        f.appendChild(s2);
      }
      var p = primary.href ? h("a", "big-btn step-next", primary.label) : h("button", "big-btn step-next", primary.label);
      if (primary.href) p.href = primary.href; else p.addEventListener("click", primary.fn);
      f.appendChild(p);
      return f;
    }

    function renderCard(focus) {
      var t = C.layers[layerIndex], cfg = L[layerIndex], card = els.card, last = layerIndex === L.length - 1;
      card.textContent = "";

      var head = h("div", "step-head");
      var where = h("div", "step-where");
      where.appendChild(h("span", null, "Layer " + layerIndex + " of " + (L.length - 1) + " · "));
      where.appendChild(h("span", "lab-era", t.era));
      head.appendChild(where);
      var tabs = h("div", "step-tabs");
      tabs.setAttribute("role", "tablist");
      STEPS.forEach(function (st, i) {
        var b = h("button", "step-tab tone-" + st.tone + (i + 1 === step ? " on" : i + 1 < step ? " past" : ""), st.short);
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", String(i + 1 === step));
        b.addEventListener("click", function () { goto(layerIndex, i + 1); });
        tabs.appendChild(b);
      });
      head.appendChild(tabs);
      card.appendChild(head);
      var st = STEPS[step - 1];
      var kick = h("div", "step-kick tone-" + st.tone, st.label);
      kick.tabIndex = -1;
      card.appendChild(kick);
      card.appendChild(h("h2", "lc-name", t.name));

      els.demoLabel.textContent = t.demoLabel;
      if (els.cutNote) els.cutNote.hidden = !cfg.cutaway;

      if (step === 1) {
        var prob = h("div", "problem-card");
        prob.appendChild(h("p", null, t.problem));
        prob.appendChild(h("p", "lc-beginner", t.beginner));
        card.appendChild(prob);
        card.appendChild(h("p", "lc-analogy", "Like " + t.analogy));
        card.appendChild(els.demo);
        card.appendChild(footer({ label: "What would you do?", fn: function () { goto(layerIndex, 2); } },
          { label: "Skip to the solution", fn: function () { goto(layerIndex, 3); } }));
      } else if (step === 2) {
        card.appendChild(h("p", "step-text", t.problem));
        card.appendChild(h("h3", "move-q", "How would you stop this from happening?"));
        var ta = document.createElement("textarea");
        ta.className = "move-sketch";
        ta.rows = 4;
        ta.placeholder = "A sentence or two is plenty. Nobody grades it.";
        ta.setAttribute("aria-label", "Your guess");
        ta.value = loadGuess(layerIndex);
        ta.addEventListener("input", function () { saveGuess(layerIndex, ta.value); });
        card.appendChild(ta);
        card.appendChild(footer({ label: "Show me the solution", fn: function () { goto(layerIndex, 3); } },
          { label: "Back to the problem", fn: function () { goto(layerIndex, 1); } }));
      } else if (step === 3) {
        var g = loadGuess(layerIndex).trim();
        if (g) {
          var mine = h("div", "lc-band guess");
          mine.appendChild(h("div", "mono-label", "Your guess"));
          mine.appendChild(h("p", null, g));
          card.appendChild(mine);
        }
        card.appendChild(band("solution", C.bands.solution, t.solution));
        card.appendChild(els.demo);
        if (cfg.free && C.freeNote) {
          var free = h("div", "free-note");
          free.appendChild(h("div", "mono-label", C.freeNote.label));
          free.appendChild(h("p", null, C.freeNote.text));
          card.appendChild(free);
        }
        card.appendChild(footer({ label: "What's the tradeoff?", fn: function () { goto(layerIndex, 4); } },
          { label: "Your guess", fn: function () { goto(layerIndex, 2); } }));
      } else {
        card.appendChild(band("tradeoff", C.bands.tradeoff, t.tradeoff));
        card.appendChild(band("scale", C.bands.atScale, t.atScale));
        card.appendChild(footer(last ? { label: "Back to Vitruvian", href: "../" } : { label: "Next layer", fn: function () { goto(layerIndex + 1, 1); } },
          { label: "Back to the solution", fn: function () { goto(layerIndex, 3); } }));
      }

      if (step >= 3) seen[layerIndex] = true;
      renderTimeline();

      /* the scene owns these; the buttons only report them */
      setToggle(els.cutBtn, !!ctl.scene.clip);
      setToggle(els.expBtn, ctl.scene.explodeAmount > 0);
      if (els.altBtn) setToggle(els.altBtn, ctl.state.mode === C.altMode.on);
      canvas.setAttribute("aria-label", C.a11y.canvas + ": " + t.name);
      if (focus) {
        kick.focus({ preventScroll: true });
        live.textContent = "Layer " + layerIndex + ", " + t.name + ". " + st.label + ".";
        var doc = $("docInner").parentElement;
        if (doc && doc.scrollTo) doc.scrollTo({ top: Math.max(0, els.timeline.offsetTop - 12) });
      }
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

    var inertiaRaf = 0, camRaf = 0;
    function stopCameraMotion() {
      if (inertiaRaf) { cancelAnimationFrame(inertiaRaf); inertiaRaf = 0; }
      if (camRaf) { cancelAnimationFrame(camRaf); camRaf = 0; }
    }
    function snapshotCam(cam) {
      if (!cam) return null;
      return {
        yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist,
        target: cam.target ? [cam.target[0], cam.target[1], cam.target[2]] : [0, 0, 0]
      };
    }
    function smoothCameraChange(fn) {
      stopCameraMotion();
      var cam = ctl.scene && ctl.scene.camera;
      var from = snapshotCam(cam);
      fn();
      var to = snapshotCam(cam);
      if (RM || !from || !to) return;
      var dyaw = ((to.yaw - from.yaw + Math.PI) % (2 * Math.PI)) - Math.PI;
      if (dyaw < -Math.PI) dyaw += 2 * Math.PI;
      var dpitch = to.pitch - from.pitch;
      var ddist = to.dist - from.dist;
      var dtx = to.target[0] - from.target[0], dty = to.target[1] - from.target[1], dtz = to.target[2] - from.target[2];
      if (Math.hypot(dyaw, dpitch) < 0.005 && Math.abs(ddist) < 1 && Math.hypot(dtx, dty, dtz) < 0.5) return;
      var t0 = performance.now(), dur = 380;
      function tick(now) {
        var p = Math.min(1, (now - t0) / dur);
        var e = 1 - Math.pow(1 - p, 3);
        cam.yaw = from.yaw + dyaw * e;
        cam.pitch = from.pitch + dpitch * e;
        cam.dist = from.dist + ddist * e;
        if (cam.target) {
          cam.target[0] = from.target[0] + dtx * e;
          cam.target[1] = from.target[1] + dty * e;
          cam.target[2] = from.target[2] + dtz * e;
        }
        ctl.scene.dirty = true;
        if (p < 1) camRaf = requestAnimationFrame(tick);
        else camRaf = 0;
      }
      camRaf = requestAnimationFrame(tick);
    }

    function goto(i, s) {
      if (i < 0 || i >= L.length) return;
      var newLayer = i !== layerIndex;
      layerIndex = i;
      step = Math.max(1, Math.min(4, s || 1));
      if (newLayer) {
        smoothCameraChange(function () { ctl.applyLayer(L[i]); });
        els.scrub.value = "0";
        if (location.hash !== "#" + L[i].id) history.replaceState(null, "", "#" + L[i].id);
        if (!RM && step === 1) setTimeout(startDemo, 420);
      }
      renderCard(true);
    }

    /* ← and → walk the steps; Shift with an arrow jumps a layer */
    document.addEventListener("keydown", function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      var fwd = e.key === "ArrowRight";
      if (e.shiftKey) goto(layerIndex + (fwd ? 1 : -1), 1);
      else if (fwd) { if (step < 4) goto(layerIndex, step + 1); else goto(layerIndex + 1, 1); }
      else { if (step > 1) goto(layerIndex, step - 1); else goto(layerIndex - 1, 4); }
    });

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
    var drag = null, pointers = {}, pinch = 0, orbitSamples = [];
    canvas.addEventListener("pointerdown", function (e) {
      stopCameraMotion();
      pointers[e.pointerId] = [e.clientX, e.clientY];
      canvas.setPointerCapture(e.pointerId);
      drag = [e.clientX, e.clientY];
      orbitSamples = [{ t: performance.now(), x: e.clientX, y: e.clientY }];
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
        orbitSamples = [];
        return;
      }
      if (drag) {
        ctl.orbit(e.clientX - drag[0], e.clientY - drag[1]);
        drag = [e.clientX, e.clientY];
        var now = performance.now();
        orbitSamples.push({ t: now, x: e.clientX, y: e.clientY });
        while (orbitSamples.length > 2 && now - orbitSamples[0].t > 85) orbitSamples.shift();
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
      if (!Object.keys(pointers).length) {
        var hadDrag = !!drag;
        drag = null; pinch = 0;
        if (hadDrag && !RM && orbitSamples.length >= 2) {
          var now = performance.now();
          while (orbitSamples.length > 2 && now - orbitSamples[0].t > 95) orbitSamples.shift();
          if (orbitSamples.length >= 2) {
            var s0 = orbitSamples[0], s1 = orbitSamples[orbitSamples.length - 1];
            var dt0 = (s1.t - s0.t) / 1000;
            if (dt0 > 0.008) {
              var vx = (s1.x - s0.x) / dt0, vy = (s1.y - s0.y) / dt0;
              if (Math.hypot(vx, vy) > 25) {
                var lastT = now;
                var coast = function (t) {
                  var dt = Math.min(0.032, Math.max(0.001, (t - lastT) / 1000));
                  lastT = t;
                  var decay = Math.pow(0.035, dt);
                  vx *= decay; vy *= decay;
                  ctl.orbit(vx * dt, vy * dt);
                  if (Math.hypot(vx, vy) > 8) inertiaRaf = requestAnimationFrame(coast);
                  else inertiaRaf = 0;
                };
                inertiaRaf = requestAnimationFrame(coast);
              }
            }
          }
        }
        orbitSamples = [];
      }
    }
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);
    canvas.addEventListener("pointerleave", function () { $("tip").classList.remove("on"); });
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      stopCameraMotion();
      ctl.dolly(e.deltaY > 0 ? 1.09 : 0.92);
    }, { passive: false });
    canvas.addEventListener("dblclick", function () { smoothCameraChange(function () { ctl.resetCamera(); }); });

    /* ═══ layout ═══ */
    function fit() {
      var cam = ctl.scene && ctl.scene.camera;
      var yaw = cam ? cam.yaw : null, pitch = cam ? cam.pitch : null;
      var oldFit = ctl.scene && ctl.scene._w ? ctl.scene.fitDistance(1) : 0;
      var distRatio = (cam && oldFit > 0) ? (cam.dist / oldFit) : 0;
      ctl.scene.resize();
      if (yaw != null && oldFit > 0) {
        ctl.resetCamera();
        cam.yaw = yaw;
        cam.pitch = pitch;
        var newFit = ctl.scene.fitDistance(1);
        if (distRatio > 0 && newFit > 0) cam.dist = newFit * distRatio;
        ctl.scene.dirty = true;
      } else {
        ctl.resetCamera();
      }
    }
    if (window.ResizeObserver) new ResizeObserver(fit).observe($("stageWrap"));
    else window.addEventListener("resize", fit);

    /* ═══ boot ═══ */
    if (C.hint) $("hint").textContent = C.hint;
    if (opts.instruments) opts.instruments.build($("stageWrap"), api);
    buildStageControls($("stageWrap"));
    buildDoc($("docInner"));

    var dbg = null;
    if (DEBUG) { dbg = h("div", "dbg"); $("stageWrap").appendChild(dbg); }

    var start = L.map(function (c) { return c.id; }).indexOf(location.hash.replace("#", ""));
    layerIndex = start >= 0 ? start : 0;
    ctl.applyLayer(L[layerIndex]);
    renderCard(false);
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
