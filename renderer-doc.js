/* ═══════════════════════════════════════════════════════════════
   SYSTEM DECONSTRUCTOR — DOCUMENT RENDERER (§6, §7, §11.2)
   ───────────────────────────────────────────────────────────────
   Renders one breakdown into the doc pane and keeps the diagram
   in sync. Positions: 0 = overview · 1..N = layers · N+1 = stress
   tests · N+2 = transfer. Challenge gates intercept unrevealed
   layers. Audience modes are VIEW FILTERS over one document —
   switching re-renders instantly, anchored to the same position.
   All content rendered via textContent — never innerHTML (§13).
   ═══════════════════════════════════════════════════════════════ */

var DocView = (() => {

  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function frag(...children) { const f = document.createDocumentFragment(); children.forEach(c => c && f.appendChild(c)); return f; }
  function modelById(id) { return MODEL_LIBRARY.find(m => m.id === id); }

  function mount(opts) {
    const { docPane, diagram, rec, onSave, onCompare, onAsk, canCompare, scrubEl } = opts;
    const doc = rec.doc;
    const N = doc.layers.length;
    let lastShown = 0;           // diagram state currently on screen
    let audience = opts.audience;
    let challenge = opts.challenge;
    let pos = Math.min(rec.progress.position || 0, N + 2);
    let hintTier = 0;            // per-visit hint ladder, not persisted
    let saveTimer = null;

    const invNumber = {};        // inv id → display number
    doc.strip_down.invariants.forEach((iv, i) => { invNumber[iv.id] = i + 1; });

    function attemptFor(idx) {
      if (!rec.attempts[idx]) rec.attempts[idx] = { answer: "", revealed: false, verdict: null, ts: 0 };
      return rec.attempts[idx];
    }

    /* Link a reader card to its diagram parts: tap to spotlight those ids in
       the card's colour (and dim the rest); tap again to clear. One active
       card at a time. Reset every render (cards are rebuilt). */
    let activeSpotCard = null;
    function wireSpot(cardEl, ids, kind) {
      ids = (ids || []).filter(Boolean);
      if (!ids.length) return;                       // nothing to locate (e.g. a layer with no highlights)
      cardEl.classList.add("spot-card");
      cardEl.title = "Tap to locate on the diagram";
      cardEl.addEventListener("click", () => {
        if (activeSpotCard === cardEl) { diagram.spotlight(null); cardEl.classList.remove("spot-on"); activeSpotCard = null; return; }
        if (activeSpotCard) activeSpotCard.classList.remove("spot-on");
        diagram.spotlight(ids, kind);
        cardEl.classList.add("spot-on");
        activeSpotCard = cardEl;
      });
    }
    function diffAddedIds(L) {
      return [...L.diff.add_nodes.map(n => n.id), ...L.diff.add_edges.map(e => e.id)];
    }
    function refreshProgress() {
      rec.progress.gatesAnswered = Object.values(rec.attempts).filter(a => a.answer && a.answer.trim()).length;
      rec.progress.layersRead = Math.max(rec.progress.layersRead || 0,
        ...doc.layers.filter(L => attemptFor(L.index).revealed || !challenge).map(L => L.index), 0);
    }
    function persist() { refreshProgress(); onSave(rec); }

    /* ── diagram sync ── */
    function maxRevealed() {
      let m = 0;
      doc.layers.forEach(L => { if (attemptFor(L.index).revealed) m = Math.max(m, L.index); });
      return m;
    }
    function capText(s) {
      const cap = docPane.parentElement.querySelector(".diagram-cap-state");
      if (cap) cap.textContent = s;
    }
    function syncDiagram(animate) {
      if (pos === 0) { lastShown = 0; diagram.show(0); capText("Layer 0 · the naive baseline"); }
      else if (pos > N) { lastShown = N; diagram.show(N); capText("Final state · all layers"); }
      else {
        const L = doc.layers[pos - 1];
        const gated = challenge && !attemptFor(L.index).revealed;
        if (gated) {
          lastShown = pos - 1;
          diagram.show(pos - 1, { highlight: L.diff.highlight });
          capText(`Before layer ${pos} · red = what breaks`);
        } else {
          lastShown = pos;
          diagram.show(pos, { animate: !!animate });
          capText(`Layer ${pos} of ${N} · ${L.name}`);
        }
      }
      renderScrub();
    }

    /* ── timeline scrubber: sweep the diagram baseline → frontier.
       A peek only — position/navigation re-syncs on next render. In
       challenge mode the frontier stops at the furthest revealed layer,
       so scrubbing can't spoil un-earned strata. ── */
    function renderScrub() {
      if (!scrubEl) return;
      scrubEl.textContent = "";
      const frontier = challenge ? maxRevealed() : N;
      const row = h("div", "scrub-row");
      for (let i = 0; i <= N; i++) {
        const seg = h("button", "scrub-seg" + (i === lastShown ? " on" : (i <= frontier ? " reached" : "")) + (i > frontier ? " locked" : ""), i === 0 ? "0" : String(i));
        seg.setAttribute("aria-label", i === 0 ? "Baseline state" : "State after layer " + i);
        if (i <= frontier) {
          seg.onclick = () => {
            lastShown = i;
            diagram.show(i);                              // clears any diagram spotlight…
            if (activeSpotCard) { activeSpotCard.classList.remove("spot-on"); activeSpotCard = null; }  // …so resync the card too
            capText(i === 0 ? "Peek · the naive baseline" : `Peek · after layer ${i}`);
            renderScrub();
          };
        } else seg.disabled = true;
        row.appendChild(seg);
      }
      // drag to sweep
      row.onpointerdown = row.onpointermove = ev => {
        if (ev.type === "pointermove" && ev.buttons !== 1) return;
        const segs = [...row.children].filter(s => !s.disabled);
        const hit = segs.find(s => { const r = s.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right; });
        if (hit && !hit.classList.contains("on")) hit.click();
      };
      scrubEl.appendChild(row);
    }

    /* ── stepper ── */
    function stepper() {
      const bar = h("div", "stepper");
      const prev = h("button", "step-btn", "‹ Prev");
      prev.disabled = pos === 0;
      prev.onclick = () => goTo(pos - 1);
      const rail = h("div", "step-rail");
      const mk = (p, label, extraCls) => {
        const d = h("button", "step-dot" + (p === pos ? " on" : "") + (extraCls || ""), label);
        d.onclick = () => goTo(p);
        d.setAttribute("aria-label", p === 0 ? "Overview" : p <= N ? `Layer ${p}` : p === N + 1 ? "Stress tests" : "Transfer");
        rail.appendChild(d);
      };
      mk(0, "◦");
      doc.layers.forEach(L => {
        const a = attemptFor(L.index);
        mk(L.index, String(L.index), a.revealed ? " done" : (challenge ? " gated" : ""));
      });
      mk(N + 1, "S");
      mk(N + 2, "T");
      const next = h("button", "step-btn", "Next ›");
      next.disabled = pos === N + 2;
      next.onclick = () => goTo(pos + 1);
      bar.append(prev, rail, next);
      return bar;
    }

    /* ── overview (position 0) ── */
    function renderOverview(root) {
      root.appendChild(h("div", "kicker", "System study · " + doc.meta.history_confidence + " historical confidence"));
      const titleRow = h("h1", "title", doc.meta.system);
      if (doc.layers.every(L => attemptFor(L.index).revealed)) {
        const stamp = h("img", "enso-stamp complete");
        stamp.src = "assets/enso-complete.svg";
        stamp.alt = "Study complete";
        stamp.title = "Every layer rebuilt";
        titleRow.appendChild(stamp);
      }
      root.appendChild(titleRow);
      if (doc.meta.narrowing) {
        const nn = h("div", "narrowing-note");
        nn.appendChild(h("b", null, "Scope: "));
        nn.appendChild(document.createTextNode(doc.meta.narrowing));
        root.appendChild(nn);
      }
      root.appendChild(h("p", "essence", audience === "beginner" ? doc.essence.beginner : doc.essence.text));

      const facts = h("div", "deep-facts");
      doc.essence.deep_facts.forEach(f => facts.appendChild(h("div", "fact", f)));
      root.appendChild(facts);

      const sd = doc.strip_down;
      const block = (title, build) => {
        const b = h("div", "sd-block");
        b.appendChild(h("h3", null, title));
        build(b);
        root.appendChild(b);
      };
      block("The purpose", b => b.appendChild(h("div", "sd-purpose", sd.purpose)));
      block("Who wants what", b => {
        const list = h("div", "sd-list");
        sd.actors.forEach(a => {
          const it = h("div", "sd-item");
          it.appendChild(h("b", null, a.name));
          it.appendChild(document.createTextNode(" — " + a.want));
          list.appendChild(it);
        });
        b.appendChild(list);
      });
      block("What must never be false", b => {
        const list = h("div", "sd-list");
        sd.invariants.forEach(iv => {
          const it = h("div", "sd-item inv");
          it.appendChild(h("span", "inv-badge", "INV " + invNumber[iv.id]));
          it.appendChild(document.createTextNode(iv.text));
          list.appendChild(it);
        });
        b.appendChild(list);
      });
      block("The pieces", b => {
        const list = h("div", "sd-list");
        sd.entities.forEach(en => {
          const it = h("div", "sd-item");
          it.appendChild(h("b", null, en.name));
          it.appendChild(document.createTextNode(" — " + en.note));
          list.appendChild(it);
        });
        b.appendChild(list);
      });
      block("What flows", b => {
        const list = h("div", "sd-list");
        sd.flows.forEach(f => list.appendChild(h("div", "sd-item", f.text)));
        b.appendChild(list);
      });
      block("What cannot be wished away", b => {
        const list = h("div", "sd-list");
        sd.constraints.forEach(c => list.appendChild(h("div", "sd-item", c)));
        b.appendChild(list);
      });

      root.appendChild(h("p", "lib-note", doc.meta.ordering_note));
      const go = h("button", "big-btn", "Begin the rebuild ›");
      go.onclick = () => goTo(1);
      root.appendChild(go);
    }

    /* ── a layer (positions 1..N) ── */
    function renderLayer(root, L) {
      const a = attemptFor(L.index);
      const gated = challenge && !a.revealed;

      const head = h("div", "layer-head");
      head.appendChild(h("span", "layer-num", "LAYER " + String(L.index).padStart(2, "0") + " / " + String(N).padStart(2, "0")));
      if (a.revealed) {
        const stamp = h("img", "enso-stamp");
        stamp.src = "assets/enso-gate.svg";
        stamp.alt = "";
        stamp.title = "Gate earned";
        head.appendChild(stamp);
      }
      // the name can spoil the solution — withhold it at the gate
      head.appendChild(h("div", "layer-name", gated ? "The next failure" : L.name));
      root.appendChild(head);

      const prob = h("div", "problem-card");
      prob.appendChild(h("div", "pc-label", "The problem"));
      prob.appendChild(h("p", null, audience === "beginner" ? L.problem.beginner : L.problem.statement));
      root.appendChild(prob);
      // once revealed, the problem card locates what BREAKS (red) on the diagram
      if (!gated) wireSpot(prob, L.diff.highlight, "problem");

      if (gated) renderGate(root, L, a);
      else renderRevealed(root, L, a);
    }

    function modelCard(L, expanded) {
      const m = modelById(L.problem.model.id);
      const card = h("div", "model-card");
      card.appendChild(h("div", "mc-kick", "Thinking model"));
      card.appendChild(h("div", "mc-name", m ? m.name : L.problem.model.id));
      if (m) card.appendChild(h("p", null, m.one_liner));
      card.appendChild(h("p", null, L.problem.model.application));
      if (expanded && m && audience === "beginner") card.appendChild(h("p", null, m.description));
      return card;
    }

    /* one-tap prediction: which invariant does this failure attack?
       Rendered before the design question; needs ≥2 invariants to be
       a real choice. Persists once — no retries, honesty over score. */
    function renderPredict(root, L, a) {
      const invs = doc.strip_down.invariants;
      if (invs.length < 2) return;
      const box = h("div", "predict-box");
      box.appendChild(h("div", "pb-label", "First, a prediction — which law does this failure attack?"));
      const row = h("div", "predict-row");
      invs.forEach(iv => {
        const chip = h("button", "predict-chip", "INV " + invNumber[iv.id]);
        chip.title = iv.text;
        if (a.predict) {
          chip.disabled = true;
          if (iv.id === a.predict.chosen) chip.classList.add(a.predict.correct ? "hit" : "miss");
          if (!a.predict.correct && L.defends.includes(iv.id)) chip.classList.add("answer");
        } else {
          chip.onclick = () => {
            a.predict = { chosen: iv.id, correct: L.defends.includes(iv.id) };
            a.ts = Date.now();
            persist();
            render();
          };
        }
        row.appendChild(chip);
      });
      box.appendChild(row);
      if (a.predict) {
        box.appendChild(h("p", "pb-result", a.predict.correct
          ? "Called it — this failure attacks " + L.defends.map(d => "INV " + invNumber[d]).join(", ") + "."
          : "It actually attacks " + L.defends.map(d => "INV " + invNumber[d]).join(", ") + " — watch for why."));
      }
      root.appendChild(box);
    }

    function renderGate(root, L, a) {
      renderPredict(root, L, a);
      const card = h("div", "gate-card");
      card.appendChild(h("div", "gate-kick", COPY.gateKicker));
      card.appendChild(h("div", "gate-q", L.gate.question));
      const ta = h("textarea");
      ta.placeholder = "Design it before you see it. Sketch your answer here…";
      ta.value = a.answer || "";
      ta.oninput = () => {
        a.answer = ta.value;
        a.ts = Date.now();
        clearTimeout(saveTimer);
        saveTimer = setTimeout(persist, 600);
      };
      card.appendChild(ta);

      const hints = h("div");
      card.appendChild(hints);
      const actions = h("div", "gate-actions");
      const hint1 = h("button", "gbtn", COPY.gateHint1);
      const hint2 = h("button", "gbtn", COPY.gateHint2);
      hint2.hidden = hintTier < 1;
      hint1.onclick = () => {
        hintTier = 1;
        hints.appendChild(modelCard(L, true));
        hint1.hidden = true;
        hint2.hidden = false;
      };
      hint2.onclick = () => {
        hintTier = 2;
        hints.appendChild(h("div", "gate-hint", L.gate.hint));
        hint2.hidden = true;
      };
      const reveal = h("button", "gbtn primary", COPY.gateReveal);
      reveal.onclick = () => {
        clearTimeout(saveTimer);
        a.revealed = true;
        a.ts = Date.now();
        persist();
        hintTier = 0;
        render(true);       // re-render revealed; diagram animates the additions
      };
      actions.append(hint1, hint2, reveal);
      card.appendChild(actions);
      root.appendChild(card);
    }

    function renderRevealed(root, L, a) {
      if (a.predict) {
        const pr = h("div", "defends-row");
        pr.appendChild(h("span", "mono-label", "Your prediction"));
        pr.appendChild(h("span", "predict-chip static " + (a.predict.correct ? "hit" : "miss"), "INV " + invNumber[a.predict.chosen]));
        pr.appendChild(h("span", "bd-last", a.predict.correct ? "correct" : "it attacks " + L.defends.map(d => "INV " + invNumber[d]).join(", ")));
        root.appendChild(pr);
      }
      root.appendChild(modelCard(L, false));

      if (a.answer && a.answer.trim()) {
        const ya = h("div", "your-answer");
        ya.appendChild(h("div", "ya-label", "Your design"));
        ya.appendChild(h("p", null, a.answer));
        root.appendChild(ya);
      }
      const sol = h("div", "solution-card");
      sol.appendChild(h("div", "sc-label", "What was actually built"));
      sol.appendChild(h("p", null, L.solution));
      root.appendChild(sol);
      // the solution card locates what this layer ADDS (accent) on the diagram
      wireSpot(sol, diffAddedIds(L), "solution");

      if (a.answer && a.answer.trim()) {
        if (a.verdict) root.appendChild(h("div", "verdict-card", a.verdict));
        else {
          const row = h("div", "gate-actions");
          const cmp = h("button", "gbtn", COPY.gateCompare);
          const avail = canCompare();
          if (!avail.ok) {
            cmp.onclick = () => alert(avail.reason || COPY.gateCompareOffline);
          } else {
            cmp.onclick = async () => {
              cmp.disabled = true;
              cmp.textContent = "Comparing…";
              try {
                const verdict = await onCompare(L, a.answer);
                a.verdict = verdict;
                persist();
                render();
              } catch (e) {
                cmp.disabled = false;
                cmp.textContent = COPY.gateCompare;
                alert("Comparison failed: " + e.message);
              }
            };
          }
          row.appendChild(cmp);
          root.appendChild(row);
        }
      }

      const grid = h("div", "lens-grid");
      const ul = h("div", "lens-box");
      ul.appendChild(h("div", "lb-label", "For the people using it"));
      const g1 = h("p"); g1.appendChild(h("b", null, "Gives: ")); g1.appendChild(document.createTextNode(L.user_lens.gives)); ul.appendChild(g1);
      const c1 = h("p"); c1.appendChild(h("b", null, "Costs: ")); c1.appendChild(document.createTextNode(L.user_lens.costs)); ul.appendChild(c1);
      const tl = h("div", "lens-box");
      tl.appendChild(h("div", "lb-label", "Under the hood"));
      const m1 = h("p"); m1.appendChild(h("b", null, "Mechanism: ")); m1.appendChild(document.createTextNode(L.tech_lens.mechanism)); tl.appendChild(m1);
      const p1 = h("p"); p1.appendChild(h("b", null, "Principle: ")); p1.appendChild(document.createTextNode(L.tech_lens.principle)); tl.appendChild(p1);
      grid.append(ul, tl);
      root.appendChild(grid);

      root.appendChild(h("div", "tradeoff-band", L.tradeoff));

      // "Under load" — how this mechanism holds as the system grows (the
      // scaling question the reader most wants answered). Shown in every mode.
      if (L.at_scale) {
        const scale = h("div", "scale-band");
        const sb = h("div", "sb-label", "Under load · how it scales");
        scale.appendChild(sb);
        scale.appendChild(h("p", null, L.at_scale));
        // the load path = the payload flow (what the system exists to move) at
        // this state; tap the band to trace it through the diagram in gold.
        const st = Diagram.stateAt(doc, L.index);
        const loadIds = [];
        st.edges.forEach(e => { if (e.kind === "payload") loadIds.push(e.id, e.from, e.to); });
        if (loadIds.length) sb.appendChild(h("span", "sb-hint", "◎ trace the load path"));
        wireSpot(scale, loadIds, "load");
        root.appendChild(scale);
      }

      const def = h("div", "defends-row");
      def.appendChild(h("span", "mono-label", "Defends"));
      L.defends.forEach(d => def.appendChild(h("span", "inv-badge", "INV " + invNumber[d])));
      const invTexts = L.defends.map(d => {
        const iv = doc.strip_down.invariants.find(x => x.id === d);
        return iv ? iv.text : d;
      });
      def.appendChild(h("span", "bd-last", invTexts.join(" · ")));
      root.appendChild(def);

      if (audience === "beginner") {
        const ab = h("div", "analogy-box");
        ab.appendChild(h("div", "ab-label", "In everyday terms"));
        ab.appendChild(document.createTextNode(L.beginner_analogy));
        root.appendChild(ab);
      } else if (audience === "enthusiast") {
        const fold = h("details", "analogy-fold");
        fold.appendChild(h("summary", null, "analogy"));
        const ab = h("div", "analogy-box");
        ab.appendChild(document.createTextNode(L.beginner_analogy));
        fold.appendChild(ab);
        root.appendChild(fold);
      }

      if (audience !== "beginner") {
        const dev = h("div", "dev-box");
        dev.appendChild(h("div", "db-label", "For engineers"));
        L.developer.mappings.forEach(m => {
          const row = h("div", "dev-map");
          row.appendChild(h("span", "dm-mech", m.mechanism));
          row.appendChild(h("span", "dm-arrow", "→"));
          row.appendChild(h("span", "dm-sw", m.software_concept));
          dev.appendChild(row);
        });
        if (audience === "developer") {
          L.developer.interview_probes.forEach(p => dev.appendChild(h("div", "probe", p)));
        }
        root.appendChild(dev);
      }

      /* Ask this layer — one bounded question, answered from this layer's
         context. Saved Q&As render for every audience and read offline. */
      const qa = h("div", "qa-block");
      qa.appendChild(h("div", "lb-label", COPY.askTitle));
      (a.qa || []).forEach(item => {
        const q = h("div", "qa-q");
        q.appendChild(h("b", null, "Q · "));
        q.appendChild(document.createTextNode(item.q));
        qa.appendChild(q);
        qa.appendChild(h("div", "qa-a", item.a));
      });
      const row = h("div", "qa-row");
      const inp = h("input");
      inp.placeholder = COPY.askPlaceholder;
      inp.maxLength = 220;
      const btn = h("button", "gbtn", COPY.askBtn);
      btn.onclick = async () => {
        const q = inp.value.trim();
        if (!q) return;
        const avail = canCompare();
        if (!avail.ok) { alert(avail.reason || COPY.gateCompareOffline); return; }
        btn.disabled = true;
        btn.textContent = "Thinking…";
        try {
          const answer = await onAsk(L, q);
          (a.qa = a.qa || []).push({ q, a: answer, ts: Date.now() });
          persist();
          render._keepScroll = true;
          render();
        } catch (e) {
          btn.disabled = false;
          btn.textContent = COPY.askBtn;
          alert("Ask failed: " + e.message);
        }
      };
      inp.onkeydown = ev => { if (ev.key === "Enter") btn.click(); };
      row.append(inp, btn);
      qa.appendChild(row);
      root.appendChild(qa);
    }

    /* ── stress tests (position N+1) ── */
    function renderStress(root) {
      root.appendChild(h("div", "kicker", "Push it somewhere nasty"));
      root.appendChild(h("h1", "title", "Trials"));
      doc.stress_tests.forEach(s => {
        const card = h("div", "stress-card");
        card.appendChild(h("div", "st-title", s.title));
        card.appendChild(h("div", "st-scenario", s.scenario));
        const reveal = h("div", "st-reveal", s.reveal);
        reveal.hidden = true;
        const btn = h("button", "gbtn", "How does it cope?");
        btn.onclick = () => { reveal.hidden = false; btn.remove(); };
        card.appendChild(btn);
        card.appendChild(reveal);
        root.appendChild(card);
      });
    }

    /* ── transfer (position N+2) ── */
    function renderTransfer(root) {
      root.appendChild(h("div", "kicker", "Take it with you"));
      root.appendChild(h("h1", "title", "Transfer"));
      const pr = h("div", "principles");
      doc.transfer.principles.forEach(p => pr.appendChild(h("div", "principle", p)));
      root.appendChild(pr);
      if (audience !== "beginner") {
        root.appendChild(h("h2", "section-head", "The same shape, elsewhere"));
        doc.transfer.mappings.forEach(m => {
          const row = h("div", "map-row");
          row.appendChild(h("span", "mr-from", m.mechanism));
          row.appendChild(h("span", "mr-arrow", "→"));
          row.appendChild(h("span", "mr-to", m.elsewhere));
          root.appendChild(row);
        });
      }
    }

    /* ── master render ── */
    function render(animateDiagram) {
      const scroll = docPane.scrollTop;
      activeSpotCard = null;                 // cards are rebuilt; syncDiagram clears the diagram spotlight
      const inner = h("div", "doc-inner rise");
      inner.appendChild(stepper());
      const body = h("div");
      if (pos === 0) renderOverview(body);
      else if (pos <= N) renderLayer(body, doc.layers[pos - 1]);
      else if (pos === N + 1) renderStress(body);
      else renderTransfer(body);
      inner.appendChild(body);
      docPane.textContent = "";
      docPane.appendChild(inner);
      syncDiagram(animateDiagram);
      // audience flips keep the reader anchored; position changes scroll to top
      docPane.scrollTop = render._keepScroll ? scroll : 0;
      render._keepScroll = false;
    }

    function goTo(p) {
      if (p < 0 || p > N + 2) return;
      const forward = p > pos;
      pos = p;
      hintTier = 0;
      rec.progress.position = pos;
      persist();
      render(forward);
    }

    render();

    return {
      setAudience(a) { audience = a; render._keepScroll = true; render(); },
      setChallenge(c) { challenge = c; render(); },
      goToLayer(idx) { goTo(idx); },
      get position() { return pos; },
      // cancel the pending debounce so a late timer can't overwrite a fresher
      // record after this view is torn down / the breakdown is re-opened
      destroy() { clearTimeout(saveTimer); }
    };
  }

  return { mount };
})();
