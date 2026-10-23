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

  // challenge grade: pull the "GRADE: pass|close|miss" first line out of the AI
  // verdict, return the grade + the feedback body with that line stripped.
  const GRADE_TXT = { pass: "Nailed it", close: "Close", miss: "Not quite" };
  function parseGrade(verdict) {
    if (!verdict || typeof verdict !== "string") return null;
    const m = /^\s*GRADE:\s*(pass|close|miss)\b/i.exec(verdict);
    if (!m) return null;
    return { grade: m[1].toLowerCase(), body: verdict.replace(/^\s*GRADE:\s*(pass|close|miss)\b[^\n]*\n?/i, "").trim() };
  }

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
    // the loop: inside a layer you move through four steps. `challenge` is
    // Strict mode now: the fix stays shut until you've written something.
    let step = Math.min(4, Math.max(1, rec.progress.step || 1));
    let onePage = !!opts.onePage;      // the whole layer on one page, as in v1
    let before = false;                // step 3: diagram flipped to the state before the fix
    const replayed = new Set();        // layers whose failure already replayed by itself this visit
    const RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const STEPS = [
      { label: "The problem", short: "The problem", tone: "red" },
      { label: "Your guess", short: "Your guess", tone: "vio" },
      { label: "The solution", short: "The solution", tone: "teal" },
      { label: "The tradeoff", short: "The tradeoff", tone: "amber" }
    ];
    // "The Read Storm: Cache the Redirect" → the half that names the failure.
    // The half after the colon names the fix, so it waits for step 3.
    function failurePart(L) {
      const i = L.name.indexOf(":");
      return i > 0 ? L.name.slice(0, i).trim() : "The next failure";
    }
    function ruleText(id) {
      const iv = doc.strip_down.invariants.find(x => x.id === id);
      return iv ? iv.text : id;
    }
    function ruleLabel(id) { return "Rule " + (invNumber[id] || "?"); }
    function hasSketch(a) { return !!(a.answer && a.answer.trim().length >= 3); }
    // Strict mode keeps the fix shut until there's a sketch; once a layer has
    // been revealed it stays open
    function locked(L) { const a = attemptFor(L.index); return challenge && !a.revealed && !hasSketch(a); }

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
        diagram.focus(ids);                  // pan the spotlighted parts into view (mobile)
        cardEl.classList.add("spot-on");
        activeSpotCard = cardEl;
      });
    }
    function diffAddedIds(L) {
      return [...L.diff.add_nodes.map(n => n.id), ...L.diff.add_edges.map(e => e.id)];
    }
    function refreshProgress() {
      rec.progress.gatesAnswered = Object.values(rec.attempts).filter(a => a.answer && a.answer.trim()).length;
      rec.progress.layersRead = Math.max(0, ...doc.layers.filter(L => attemptFor(L.index).revealed).map(L => L.index));
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
    function loadPathIds(L) {
      const st = Diagram.stateAt(doc, L.index), ids = [];
      st.edges.forEach(e => { if (e.kind === "payload") ids.push(e.id, e.from, e.to); });
      return ids;
    }
    // The diagram follows the step: steps 1 and 2 show the system before this
    // layer with what breaks in red; step 3 shows the fix arriving in teal (or,
    // with Before held, the state it replaced); step 4 traces the load path.
    function syncDiagram(animate) {
      if (pos === 0) { lastShown = 0; diagram.show(0); capText("Layer 0 · the naive baseline"); diagram.focus(null); }
      else if (pos > N) { lastShown = N; diagram.show(N, { fresh: false }); capText("Final state · all layers"); diagram.focus(null); }
      else {
        const L = doc.layers[pos - 1];
        const a = attemptFor(L.index);
        const preFix = onePage ? (challenge && !a.revealed) : (step <= 2 || before);
        if (preFix && before && !onePage) {
          lastShown = pos - 1;
          diagram.show(pos - 1, { fresh: false });
          capText(`Before layer ${pos} · release B or tap After to see the fix`);
          diagram.focus(L.diff.highlight);
        } else if (preFix) {
          lastShown = pos - 1;
          diagram.show(pos - 1, { highlight: L.diff.highlight });
          capText(`Before layer ${pos} · red = what breaks`);
          diagram.focus(L.diff.highlight);
        } else {
          lastShown = pos;
          diagram.show(pos, { animate: !!animate });
          const added = diffAddedIds(L);
          if (!onePage && step === 4 && L.at_scale && loadPathIds(L).length) {
            diagram.spotlight(loadPathIds(L), "load");
            capText(`Layer ${pos} of ${N} · amber = the load path`);
          } else capText(`Layer ${pos} of ${N} · ${L.name}`);
          diagram.focus(added.length ? added : L.diff.highlight);
        }
      }
      renderTimeline();
      if (opts.onTools) opts.onTools({ pos, N, step: (pos >= 1 && pos <= N && !onePage) ? step : 0, before });
    }

    /* ── The timeline: one control for place. Meet, every layer, Trials,
       Transfer. Finished layers are teal; the current one opens up to show
       its four steps. It replaces the step dots and the old scrubber, which
       moved the picture without moving your place. ── */
    function renderTimeline() {
      if (!scrubEl) return;
      scrubEl.textContent = "";
      scrubEl.className = "scrub-wrap timeline" + (onePage ? " one-page" : "");
      const row = h("div", "tl-row");
      const seg = (p, label, state, aria) => {
        const b = h("button", "tl-seg tl-" + state, label);
        b.setAttribute("aria-label", aria);
        if (p === pos) b.setAttribute("aria-current", "step");
        b.onclick = () => goTo(p, (p >= 1 && p <= N && attemptFor(doc.layers[p - 1].index).revealed) ? 3 : 1);
        row.appendChild(b);
      };
      seg(0, "Meet", pos === 0 ? "on" : "done", "Meet the system");
      doc.layers.forEach(L => {
        const p = L.index, a = attemptFor(L.index);
        const state = p === pos ? "on" : a.revealed ? "done" : "todo";
        const name = a.revealed || (p === pos && step >= 3) ? L.name.split(":")[0] : failurePart(L);
        seg(p, p === pos && !onePage ? `${p}  ${name}` : String(p), state, `Layer ${p}: ${name}`);
      });
      seg(N + 1, "Trials", pos === N + 1 ? "on" : pos > N + 1 ? "done" : "todo", "Trials: stress tests");
      seg(N + 2, "Transfer", pos === N + 2 ? "on" : "todo", "Transfer: what to take with you");
      scrubEl.appendChild(row);
    }

    /* ── The step card's chrome: where you are, the four steps, and one
       sticky footer that always holds the next move. ── */
    function stepHead(root, L) {
      const head = h("div", "step-head");
      head.appendChild(h("div", "step-where", `Layer ${L.index} of ${N}`));
      const tabs = h("div", "step-tabs");
      tabs.setAttribute("role", "tablist");
      STEPS.forEach((st, i) => {
        const t = h("button", `step-tab tone-${st.tone}` + (i + 1 === step ? " on" : i + 1 < step ? " past" : ""), st.short);
        t.setAttribute("role", "tab");
        t.setAttribute("aria-selected", String(i + 1 === step));
        if (i >= 2 && locked(L)) { t.disabled = true; t.title = "Strict mode: write your guess first"; }
        t.onclick = () => goStep(i + 1);
        tabs.appendChild(t);
      });
      head.appendChild(tabs);
      root.appendChild(head);
      const st = STEPS[step - 1];
      root.appendChild(h("div", `step-kick tone-${st.tone}`, st.label));
    }
    function footer(primary, secondary, note) {
      const f = h("div", "step-foot");
      if (secondary) {
        const b = h("button", "gbtn ghost step-back", secondary.label);
        if (secondary.cls) b.classList.add(secondary.cls);
        b.onclick = secondary.fn;
        f.appendChild(b);
      }
      if (note) f.appendChild(h("span", "step-foot-note", note));
      if (primary) {
        const b = typeof ctaButton === "function" ? ctaButton(primary.label) : h("button", "big-btn", primary.label);
        b.classList.add("step-next");
        b.onclick = primary.fn;
        if (primary.disabled) b.disabled = true;
        f.appendChild(b);
      }
      return f;
    }

    /* ── Meet the system (position 0): two short steps instead of one long
       page. Essence first, then the rules it must never break. Who wants
       what, the pieces, the flows and the limits are reference material, so
       they live in the System sheet, one tap away from anywhere. ── */
    const MEET = [{ label: "Essence", tone: "teal" }, { label: "Rules", tone: "vio" }];
    function meetHead(root) {
      const head = h("div", "step-head");
      head.appendChild(h("div", "step-where", "Meet the system"));
      const tabs = h("div", "step-tabs");
      tabs.setAttribute("role", "tablist");
      MEET.forEach((st, i) => {
        const t = h("button", `step-tab tone-${st.tone}` + (i + 1 === step ? " on" : i + 1 < step ? " past" : ""), st.label);
        t.setAttribute("role", "tab");
        t.setAttribute("aria-selected", String(i + 1 === step));
        t.onclick = () => goStep(i + 1);
        tabs.appendChild(t);
      });
      head.appendChild(tabs);
      root.appendChild(head);
    }
    function renderOverview(root) {
      meetHead(root);
      root.appendChild(h("div", "kicker", "Deconstruct · " + doc.meta.history_confidence + " historical confidence"));
      const titleRow = h("h1", "title", doc.meta.system);
      if (doc.layers.every(L => attemptFor(L.index).revealed)) {
        const stamp = h("img", "enso-stamp complete");
        stamp.src = "assets/enso-complete.svg";
        stamp.alt = "Deconstruct complete";
        stamp.title = "Every layer rebuilt";
        titleRow.appendChild(stamp);
      }
      root.appendChild(titleRow);
      if (step === 2) return renderRules(root);

      if (doc.meta.narrowing) {
        const nn = h("div", "narrowing-note");
        nn.appendChild(h("b", null, "Scope: "));
        nn.appendChild(document.createTextNode(doc.meta.narrowing));
        root.appendChild(nn);
      }
      root.appendChild(h("p", "essence", audience === "beginner" ? doc.essence.beginner : doc.essence.text));
      const facts = h("div", "deep-facts");
      doc.essence.deep_facts.slice(0, 3).forEach(f => facts.appendChild(h("div", "fact", f)));
      root.appendChild(facts);

      // Some subjects are not only diagrams. Offered here, after the reader
      // knows what the system is and before the ladder starts, because it is
      // a second way through the same argument rather than a detour out of it.
      const study = fieldStudyFor(doc.meta.system);
      if (study) {
        const box = h("a", "lab-offer");
        box.href = study.href;
        box.appendChild(h("div", "mono-label", COPY.labKicker));
        box.appendChild(h("p", "lab-offer-text", study.blurb));
        box.appendChild(h("span", "lab-offer-cta", COPY.labOpen));
        root.appendChild(box);
      }
      root.appendChild(footer({ label: "The rules it lives by", fn: () => goStep(2) }));
    }
    function ruleCards() {
      const list = h("div", "rule-cards");
      doc.strip_down.invariants.forEach(iv => {
        const it = h("div", "rule-card");
        it.append(h("span", "inv-badge", ruleLabel(iv.id)), h("p", "rule-card-t", iv.text));
        list.appendChild(it);
      });
      return list;
    }
    function renderRules(root) {
      const n = doc.strip_down.invariants.length;
      root.appendChild(h("p", "essence rules-lede", `${n} rule${n === 1 ? "" : "s"} it must never break. Every layer that follows defends at least one, and the guess in each layer asks which one is under attack.`));
      root.appendChild(ruleCards());
      gapsBox(root);
      const more = h("button", "sheet-link");
      more.append(h("span", null, "Who wants what, the pieces, what flows, and the limits"), h("b", null, "Open the System sheet ›"));
      more.onclick = () => openSheet();
      root.appendChild(more);
      root.appendChild(h("p", "lib-note", doc.meta.ordering_note));
      root.appendChild(footer({ label: "Start: the first failure", fn: () => goTo(1, 1) }, { label: "Back to the essence", fn: () => goStep(1) }));
    }
    // Gaps (design reviews only): the concerns the reader's own design hasn't
    // answered yet, named in the profession's vocabulary. A to-do list a
    // reference site can't give, because it requires reading THEIR design.
    function gapsBox(root) {
      if (!Array.isArray(doc.design_gaps) || !doc.design_gaps.length) return;
      const gb = h("div", "gaps-box");
      gb.appendChild(h("div", "gaps-label", "Not yet addressed"));
      gb.appendChild(h("p", "gaps-lede", "Concerns your description doesn't answer yet. Each is a real decision waiting, not a criticism."));
      doc.design_gaps.forEach(g => {
        const v = vocabById(g.vocab);
        const row = h("div", "gap-row");
        const chipWrap = h("div", "gap-chip-wrap");
        if (v) {
          const chip = h("button", "vocab-chip tier-" + v.tier, v.name);
          chip.title = v.one_liner;
          chip.onclick = () => openVocab(v, null);
          chipWrap.appendChild(chip);
        }
        row.appendChild(chipWrap);
        row.appendChild(h("p", "gap-note", g.note));
        gb.appendChild(row);
      });
      root.appendChild(gb);
    }

    /* ── The System sheet: the reference card for this system, as a side
       panel you can open from any step without losing your place. ── */
    let sheetEl = null, sheetReturn = null;
    function closeSheet() {
      if (!sheetEl) return;
      sheetEl.remove();
      sheetEl = null;
      document.removeEventListener("keydown", sheetKey, true);
      if (sheetReturn && sheetReturn.focus) sheetReturn.focus();
    }
    function sheetKey(ev) { if (ev.key === "Escape") { ev.stopPropagation(); closeSheet(); } }
    function openSheet() {
      if (sheetEl) { closeSheet(); return; }
      sheetReturn = document.activeElement;
      const sd = doc.strip_down;
      const scrim = h("div", "sheet-scrim");
      const panel = h("aside", "sheet");
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "true");
      panel.setAttribute("aria-label", "System sheet: " + doc.meta.system);
      const head = h("div", "sheet-head");
      const ttl = h("div");
      ttl.append(h("div", "mono-label", "System sheet"), h("h2", null, doc.meta.system));
      const x = h("button", "modal-close", "×");
      x.setAttribute("aria-label", "Close the System sheet");
      x.onclick = closeSheet;
      head.append(ttl, x);
      const body = h("div", "sheet-body");
      const block = (title, build) => {
        const b = h("div", "sd-block");
        b.appendChild(h("h3", null, title));
        build(b);
        body.appendChild(b);
      };
      const list = (items, fill) => { const l = h("div", "sd-list"); items.forEach(x2 => l.appendChild(fill(x2))); return l; };
      const named = (name, text) => { const it = h("div", "sd-item"); it.appendChild(h("b", null, name)); it.appendChild(document.createTextNode(": " + text)); return it; };
      block("What it's for", b => b.appendChild(h("div", "sd-purpose", sd.purpose)));
      block("Rules it must never break", b => b.appendChild(ruleCards()));
      block("Who wants what", b => b.appendChild(list(sd.actors, a => named(a.name, a.want))));
      block("The pieces", b => b.appendChild(list(sd.entities, en => named(en.name, en.note))));
      block("What flows", b => b.appendChild(list(sd.flows, f => h("div", "sd-item", f.text))));
      block("What cannot be wished away", b => b.appendChild(list(sd.constraints, c => h("div", "sd-item", c))));
      gapsBox(body);
      panel.append(head, body);
      scrim.appendChild(panel);
      scrim.onclick = ev => { if (ev.target === scrim) closeSheet(); };
      document.body.appendChild(scrim);
      sheetEl = scrim;
      document.addEventListener("keydown", sheetKey, true);
      requestAnimationFrame(() => scrim.classList.add("open"));
      x.focus();
    }

    /* ── a layer (positions 1..N) ── */
    function renderLayer(root, L) {
      const a = attemptFor(L.index);
      const gated = challenge && !a.revealed;

      const head = h("div", "layer-head");
      head.appendChild(h("span", "layer-num", "Layer " + L.index + " of " + N));
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
      else { markRead(L); renderRevealed(root, L, a); }
    }

    // reaching a layer's fix counts as reading it: progress, Track and Drill
    function markRead(L) {
      const a = attemptFor(L.index);
      if (a.revealed) return;
      a.revealed = true;
      a.ts = a.ts || Date.now();
      persist();
    }

    function modelCard(L, expanded) {
      const m = modelById(L.problem.model.id);
      const card = h("div", "model-card");
      card.appendChild(h("div", "mc-kick", "Thinking model"));
      card.appendChild(h("div", "mc-name", m ? m.name : L.problem.model.id));
      if (m) card.appendChild(h("p", null, m.one_liner));
      card.appendChild(h("p", null, L.problem.model.application));
      if (expanded && m && audience === "beginner") card.appendChild(h("p", null, m.description));
      // Rosetta: the same force, in each profession's words. Lives on the model
      // card (not the dev box) so every register sees it — a marketer reading a
      // campaign never opens Developer mode. "Called here" comes first; the rest
      // is the transfer, made literal.
      const names = typeof rosettaFor === "function" ? rosettaFor(L.problem.model.id, doc.meta.domain) : [];
      if (names.length) {
        const ros = h("details", "rosetta");
        const here = names.find(n => n.here);
        const sum = h("summary");
        sum.appendChild(h("span", "ro-kick", "Also called"));
        sum.appendChild(h("span", "ro-here", here ? here.term : names[0].term));
        if (here) sum.appendChild(h("span", "ro-dom", "in " + here.label.toLowerCase()));
        ros.appendChild(sum);
        const grid = h("div", "ro-grid");
        names.filter(n => !n.here).forEach(n => {
          const row = h("div", "ro-row");
          row.appendChild(h("span", "ro-row-dom", n.label));
          row.appendChild(h("span", "ro-row-term", n.term));
          grid.appendChild(row);
        });
        ros.appendChild(grid);
        card.appendChild(ros);
      }
      return card;
    }

    /* one-tap prediction: which invariant does this failure attack?
       Rendered before the design question; needs ≥2 invariants to be
       a real choice. Persists once — no retries, honesty over score. */
    /* Which rule is about to break? One tap records the guess, and it can't
       be changed afterwards. Each rule shows its text, not just a number. */
    function rulePicker(L, a) {
      const invs = doc.strip_down.invariants;
      if (invs.length < 2) return null;
      const q = h("section", "move-block");
      q.appendChild(h("h3", "move-q", "Which rule is about to break?"));
      const list = h("div", "rule-list");
      invs.forEach(iv => {
        const opt = h("button", "rule-opt");
        opt.append(h("span", "rule-n", ruleLabel(iv.id)), h("span", "rule-t", iv.text));
        if (a.predict) {
          opt.disabled = true;
          if (iv.id === a.predict.chosen) opt.classList.add(a.predict.correct ? "hit" : "miss");
          if (!a.predict.correct && L.defends.includes(iv.id)) opt.classList.add("answer");
        } else {
          opt.onclick = () => {
            a.predict = { chosen: iv.id, correct: L.defends.includes(iv.id) };
            a.ts = Date.now();
            persist();
            render._keepScroll = true;
            render();
          };
        }
        list.appendChild(opt);
      });
      q.appendChild(list);
      if (a.predict) q.appendChild(h("p", "pb-result", a.predict.correct
        ? "Called it. Watch how the fix protects it."
        : "Not quite. It attacks " + L.defends.map(ruleLabel).join(", ") + ". Watch for why."));
      return q;
    }
    function renderPredict(root, L, a) {
      const q = rulePicker(L, a);
      if (q) root.appendChild(q);
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

    /* ── Building blocks. The step views and the one-page view assemble the
       same pieces in a different order. ── */
    function predictResult(L, a) {
      const pr = h("div", "defends-row predict-result" + (a.predict.correct ? " hit" : " miss"));
      pr.appendChild(h("span", "mono-label", "Your guess"));
      pr.appendChild(h("span", "predict-chip static " + (a.predict.correct ? "hit" : "miss"), ruleLabel(a.predict.chosen)));
      pr.appendChild(h("span", "bd-last", a.predict.correct
        ? "That's the one."
        : "This failure attacks " + L.defends.map(ruleLabel).join(", ") + "."));
      return pr;
    }
    function yourAnswer(a, g) {
      const ya = h("div", "your-answer" + (g ? " grade-" + g.grade : ""));
      const lbl = h("div", "ya-label", "Your design");
      if (g) lbl.appendChild(h("span", "grade-badge", GRADE_TXT[g.grade]));
      ya.appendChild(lbl);
      ya.appendChild(h("p", null, a.answer));
      return ya;
    }
    function verdictOrCompare(L, a, g) {
      if (a.verdict) {
        const vc = h("div", "verdict-card" + (g ? " grade-" + g.grade : ""));
        if (g) vc.appendChild(h("span", "grade-badge", GRADE_TXT[g.grade]));
        vc.appendChild(document.createTextNode(g ? g.body : a.verdict));
        return vc;
      }
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
            render._keepScroll = true;
            render();
          } catch (e) {
            cmp.disabled = false;
            cmp.textContent = COPY.gateCompare;
            alert("Comparison failed: " + e.message);
          }
        };
      }
      row.appendChild(cmp);
      return row;
    }
    function solutionCard(L) {
      const sol = h("div", "solution-card");
      sol.appendChild(h("div", "sc-label", "What was actually built"));
      sol.appendChild(h("p", null, L.solution));
      // the solution card locates what this layer ADDS (accent) on the diagram
      wireSpot(sol, diffAddedIds(L), "solution");
      return sol;
    }
    function lensGrid(L) {
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
      return grid;
    }
    // "Under load": how this mechanism holds as the system grows. Tap the
    // band to trace the load path (the payload flow at this state) in gold.
    function scaleBand(L) {
      if (!L.at_scale) return null;
      const scale = h("div", "scale-band");
      const sb = h("div", "sb-label", "Under load · how it scales");
      scale.appendChild(sb);
      scale.appendChild(h("p", null, L.at_scale));
      const loadIds = loadPathIds(L);
      if (loadIds.length) sb.appendChild(h("span", "sb-hint", "◎ trace the load path"));
      // orders of magnitude, folded away, right where the scaling question is asked
      if (audience === "developer" && typeof NUMBERS_LIBRARY !== "undefined") {
        const nf = h("details", "numbers-fold");
        nf.appendChild(h("summary", null, "numbers to reason with"));
        NUMBERS_LIBRARY.forEach(grp => {
          nf.appendChild(h("div", "nf-group", grp.group));
          grp.rows.forEach(([k, val]) => {
            const r = h("div", "nf-row");
            r.appendChild(h("span", "nf-k", k));
            r.appendChild(h("span", "nf-v", val));
            nf.appendChild(r);
          });
        });
        scale.appendChild(nf);
      }
      wireSpot(scale, loadIds, "load");
      return scale;
    }
    // Defends: each rule chip lights the mechanism this layer added, the
    // structure that keeps that rule true. Rules carry their text, not just a number.
    function defendsRow(L, withText) {
      const def = h("div", "defends-row" + (withText ? " defends-full" : ""));
      def.appendChild(h("span", "mono-label", "Defends"));
      const defended = diffAddedIds(L);
      L.defends.forEach(d => {
        const chip = h("button", "inv-badge inv-tap", ruleLabel(d));
        if (defended.length) {
          chip.title = "Tap to highlight what defends this rule";
          chip.addEventListener("click", () => {
            if (activeSpotCard === chip) { diagram.spotlight(null); chip.classList.remove("spot-on"); activeSpotCard = null; return; }
            if (activeSpotCard) activeSpotCard.classList.remove("spot-on");
            diagram.spotlight(defended, "solution");
            diagram.focus(defended);
            chip.classList.add("spot-on");
            activeSpotCard = chip;
          });
        }
        if (withText) {
          const line = h("div", "defends-line");
          line.append(chip, h("span", "defends-text", ruleText(d)));
          def.appendChild(line);
        } else def.appendChild(chip);
      });
      if (!withText) def.appendChild(h("span", "bd-last", L.defends.map(ruleText).join(" · ")));
      return def;
    }
    function devBox(L) {
      const dev = h("div", "dev-box");
      dev.appendChild(h("div", "db-label", "For engineers"));
      // a concrete coding starting point for this layer's problem (older docs predate the field)
      if (L.developer.approach) {
        const ap = h("div", "dev-approach");
        ap.appendChild(h("span", "da-tag", "Start here"));
        ap.appendChild(h("span", "da-text", L.developer.approach));
        dev.appendChild(ap);
      }
      L.developer.mappings.forEach(m => {
        const row = h("div", "dev-map");
        row.appendChild(h("span", "dm-mech", m.mechanism));
        row.appendChild(h("span", "dm-arrow", "→"));
        row.appendChild(h("span", "dm-sw", m.software_concept));
        dev.appendChild(row);
      });
      // what the profession calls what this layer does; a chip opens the ladder
      const vocab = (L.developer.vocab || []).map(vocabById).filter(Boolean);
      if (vocab.length) {
        const vr = h("div", "vocab-row");
        vr.appendChild(h("span", "vr-label", "Known as"));
        vocab.forEach(v => {
          const chip = h("button", "vocab-chip tier-" + v.tier, v.name);
          chip.title = v.one_liner;
          chip.onclick = () => openVocab(v, L);
          vr.appendChild(chip);
        });
        dev.appendChild(vr);
      }
      if (audience === "developer") L.developer.interview_probes.forEach(p => dev.appendChild(h("div", "probe", p)));
      return dev;
    }
    /* Ask this layer: one bounded question, answered from this layer's
       context. Saved Q&As render for every audience and read offline. */
    function qaBlock(L, a) {
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
      inp.setAttribute("aria-label", COPY.askTitle);
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
      return qa;
    }

    /* ── One-page view: every block of a layer, top to bottom, as in v1 ── */
    function renderRevealed(root, L, a) {
      if (a.predict) root.appendChild(predictResult(L, a));
      root.appendChild(modelCard(L, false));
      const g = parseGrade(a.verdict);
      if (hasSketch(a)) root.appendChild(yourAnswer(a, g));
      root.appendChild(solutionCard(L));
      if (hasSketch(a)) root.appendChild(verdictOrCompare(L, a, g));
      root.appendChild(lensGrid(L));
      root.appendChild(h("div", "tradeoff-band", L.tradeoff));
      const sb = scaleBand(L);
      if (sb) root.appendChild(sb);
      root.appendChild(defendsRow(L, false));
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
      if (audience !== "beginner") root.appendChild(devBox(L));
      root.appendChild(qaBlock(L, a));
    }

    /* ══ The loop: four steps per layer ══ */
    function renderStep(root, L) {
      const a = attemptFor(L.index);
      if (step >= 3) markRead(L);
      stepHead(root, L);
      const title = h("h1", "step-title", step >= 3 ? L.name : failurePart(L));
      if (step >= 3 && a.revealed) {
        const stamp = h("img", "enso-stamp");
        stamp.src = "assets/enso-gate.svg"; stamp.alt = ""; stamp.title = "Layer rebuilt";
        title.appendChild(stamp);
      }
      root.appendChild(title);
      [stepBreak, stepMove, stepFix, stepPrice][step - 1](root, L, a);
    }

    // 1 · It breaks: the problem, with the failure replaying on the diagram
    function stepBreak(root, L, a) {
      root.appendChild(h("p", "step-text", audience === "beginner" ? L.problem.beginner : L.problem.statement));
      const tools = h("div", "step-tools");
      if (opts.canReplay) {
        const rp = h("button", "gbtn");
        if (typeof setFace === "function") setFace(rp, "replay", "Replay the failure"); else rp.textContent = "Replay the failure";
        rp.onclick = () => opts.onReplay && opts.onReplay(pos, false);
        tools.appendChild(rp);
      }
      tools.appendChild(h("span", "step-note", "Red on the diagram is what breaks next."));
      root.appendChild(tools);
      root.appendChild(footer(
        { label: "What would you do?", fn: () => goStep(2) },
        challenge ? null : { label: "Skip to the solution", fn: () => goStep(3) }));
    }

    // 2 · Your move: guess the rule under attack, sketch a fix if you like
    function stepMove(root, L, a) {
      const picker = rulePicker(L, a);
      if (picker) root.appendChild(picker);

      const sk = h("section", "move-block");
      const sh = h("h3", "move-q", "Sketch your fix");
      sh.appendChild(h("span", "move-opt", challenge ? "needed in Strict mode" : "optional"));
      sk.appendChild(sh);
      sk.appendChild(h("p", "move-prompt", L.gate.question));
      const ta = h("textarea", "move-sketch");
      ta.placeholder = "A few lines is plenty. What would you add, and what would it cost?";
      ta.value = a.answer || "";
      ta.setAttribute("aria-label", "Your sketch of the fix");
      sk.appendChild(ta);
      const hints = h("div");
      sk.appendChild(hints);
      const hintRow = h("div", "gate-actions");
      const hint1 = h("button", "gbtn", COPY.gateHint1);
      const hint2 = h("button", "gbtn", COPY.gateHint2);
      hint2.hidden = hintTier < 1;
      hint1.hidden = hintTier >= 1;
      if (hintTier >= 1) hints.appendChild(modelCard(L, true));
      if (hintTier >= 2) { hints.appendChild(h("div", "gate-hint", L.gate.hint)); hint2.hidden = true; }
      hint1.onclick = () => { hintTier = 1; hints.appendChild(modelCard(L, true)); hint1.hidden = true; hint2.hidden = false; };
      hint2.onclick = () => { hintTier = 2; hints.appendChild(h("div", "gate-hint", L.gate.hint)); hint2.hidden = true; };
      hintRow.append(hint1, hint2);
      sk.appendChild(hintRow);
      root.appendChild(sk);

      const foot = footer({ label: "Show me the solution", fn: () => goStep(3), disabled: locked(L) },
        null, challenge && locked(L) ? "Write your fix first: Strict mode is on." : "Guessing first helps it stick, even when the guess is wrong.");
      root.appendChild(foot);
      ta.oninput = () => {
        a.answer = ta.value;
        a.ts = Date.now();
        clearTimeout(saveTimer);
        saveTimer = setTimeout(persist, 600);
        const next = foot.querySelector(".step-next");
        if (next) next.disabled = locked(L);
      };
    }

    // 3 · The fix: what was built, and the idea that cracks it
    function stepFix(root, L, a) {
      root.appendChild(solutionCard(L));
      root.appendChild(modelCard(L, false));
      if (a.predict) root.appendChild(predictResult(L, a));
      if (hasSketch(a)) {
        const g = parseGrade(a.verdict);
        const fold = h("details", "deeper sketch-fold");
        const sum = h("summary", null, "Your sketch");
        if (g) sum.appendChild(h("span", "grade-badge", GRADE_TXT[g.grade]));
        fold.appendChild(sum);
        fold.appendChild(yourAnswer(a, g));
        fold.appendChild(verdictOrCompare(L, a, g));
        root.appendChild(fold);
      }
      root.appendChild(footer(
        { label: "What's the tradeoff?", fn: () => goStep(4) },
        { label: before ? "Show after" : "Compare before and after", fn: () => setBefore(!before), cls: "compare-btn" }));
    }

    // 4 · The price: the tradeoff, how it holds under load, the rules it keeps
    function stepPrice(root, L, a) {
      root.appendChild(h("div", "tradeoff-band", L.tradeoff));
      const sb = scaleBand(L);
      if (sb) root.appendChild(sb);
      root.appendChild(defendsRow(L, true));

      const deeper = h("section", "deeper-group");
      deeper.appendChild(h("h3", "deeper-h", "Go deeper"));
      const fold = (label, build, open) => {
        const d = h("details", "deeper");
        if (open) d.open = true;
        d.appendChild(h("summary", null, label));
        const body = h("div", "deeper-body");
        build(body);
        d.appendChild(body);
        deeper.appendChild(d);
      };
      fold("In everyday terms", b => { const ab = h("div", "analogy-box"); ab.appendChild(document.createTextNode(L.beginner_analogy)); b.appendChild(ab); }, audience === "beginner");
      fold("For the people using it · Under the hood", b => b.appendChild(lensGrid(L)), false);
      fold("For engineers", b => b.appendChild(devBox(L)), audience === "developer");
      fold(COPY.askTitle, b => b.appendChild(qaBlock(L, a)), (a.qa || []).length > 0);
      root.appendChild(deeper);
      root.appendChild(h("p", "done-note", "Layer rebuilt. Practice can quiz you on it whenever you like."));
      const last = L.index === N;
      root.appendChild(footer(
        { label: last ? "Push it: the trials" : `Next failure · Layer ${L.index + 1}`, fn: () => goTo(L.index + 1, 1) },
        { label: "Back to the solution", fn: () => goStep(3) }));
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
    /* The recap: what you rebuilt, layer by layer, with the thinking model
       each one used. Models you hadn't met in any other system are marked new. */
    function renderRecap(root) {
      root.appendChild(h("div", "kicker", "Transfer"));
      root.appendChild(h("h1", "title", "You rebuilt " + doc.meta.system.replace(/^The /, "the ")));
      const list = h("div", "recap-list");
      const models = new Set();
      doc.layers.forEach(L => {
        const m = modelById(L.problem.model.id);
        const read = attemptFor(L.index).revealed;
        if (read) models.add(L.problem.model.id);
        const row = h("button", "recap-row" + (read ? "" : " unread"));
        row.append(h("span", "recap-n", String(L.index)), h("span", "recap-name", read ? L.name.split(":")[0] : failurePart(L)),
          h("span", "chip", m ? m.name : L.problem.model.id));
        row.onclick = () => goTo(L.index, read ? 3 : 1);
        list.appendChild(row);
      });
      root.appendChild(list);
      const read = doc.layers.filter(L => attemptFor(L.index).revealed).length;
      root.appendChild(h("p", "lib-note", read < N
        ? `${read} of ${N} layers rebuilt, using ${models.size} thinking model${models.size === 1 ? "" : "s"}. Tap any layer above to go straight to it.`
        : `All ${N} layers rebuilt, using ${models.size} thinking model${models.size === 1 ? "" : "s"}. Tap any layer above to revisit it.`));
    }

    function renderTransfer(root) {
      renderRecap(root);
      root.appendChild(h("h2", "section-head", "Take it with you"));
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
      const body = h("div", "step-body");
      if (pos === 0) {
        renderOverview(body);
      } else if (pos <= N) {
        const L = doc.layers[pos - 1];
        if (onePage) {
          renderLayer(body, L);
          body.appendChild(footer(
            { label: pos === N ? "Push it: the trials" : "Next layer", fn: () => goTo(pos + 1, 1) },
            { label: "Previous", fn: () => goTo(pos - 1, 1) }));
        } else renderStep(body, L);
      } else if (pos === N + 1) {
        renderStress(body);
        body.appendChild(footer({ label: "Take it with you", fn: () => goTo(N + 2, 1) }, { label: "Back to layer " + N, fn: () => goTo(N, 4) }));
      } else {
        renderTransfer(body);
        body.appendChild(footer(
          opts.onFinish ? { label: "Back home", fn: () => opts.onFinish() } : null,
          { label: "Back to the trials", fn: () => goTo(N + 1, 1) }));
      }
      inner.appendChild(body);
      docPane.textContent = "";
      docPane.appendChild(inner);
      syncDiagram(animateDiagram);
      // step 4 opens with the load path already traced: show the band as the lit card
      if (!onePage && pos >= 1 && pos <= N && step === 4) {
        const band = docPane.querySelector(".scale-band.spot-card");
        if (band) { band.classList.add("spot-on"); activeSpotCard = band; }
      }
      // audience flips keep the reader anchored; moving on starts at the top
      docPane.scrollTop = render._keepScroll ? scroll : 0;
      render._keepScroll = false;
      // the first time a layer's failure is on screen, play it once by itself
      // (it only counts once it has actually played, so passing through doesn't use it up)
      if (!onePage && pos >= 1 && pos <= N && step === 1 && !replayed.has(pos) && opts.canReplay && opts.autoReplay !== false && !RM && opts.onReplay) {
        const at = pos;
        setTimeout(() => {
          if (pos !== at || step !== 1 || replayed.has(at) || !docPane.isConnected) return;
          replayed.add(at);
          opts.onReplay(at, true);
        }, 650);
      }
    }

    function goTo(p, s = 1) {
      if (p < 0 || p > N + 2) return;
      const forward = p > pos || (p === pos && s > step);
      pos = p;
      step = (p >= 1 && p <= N) ? Math.min(4, Math.max(1, s)) : p === 0 ? Math.min(2, Math.max(1, s)) : 1;
      if (p >= 1 && p <= N && step >= 3 && locked(doc.layers[p - 1])) step = 2;   // Strict: earn the fix first
      before = false;
      hintTier = 0;
      rec.progress.position = pos;
      rec.progress.step = step;
      persist();
      render(forward && step >= 3);
    }
    function goStep(s) {
      if (pos === 0) {
        step = Math.min(2, Math.max(1, s));
        rec.progress.step = step;
        persist();
        render();
        return;
      }
      if (pos < 1 || pos > N || onePage) return;
      const L = doc.layers[pos - 1];
      if (s >= 3 && locked(L)) {
        if (step !== 2) goTo(pos, 2);
        const ta = docPane.querySelector(".move-sketch");
        if (ta) { ta.focus(); ta.classList.add("nudge"); setTimeout(() => ta.classList.remove("nudge"), 700); }
        return;
      }
      const forward = s > step;
      step = s;
      before = false;
      rec.progress.step = step;
      persist();
      render(forward && step === 3);
    }
    function setBefore(on) {
      if (pos < 1 || pos > N || onePage || step !== 3 || before === on) return;
      before = on;
      syncDiagram(false);
      const b = docPane.querySelector(".compare-btn");
      if (b) b.textContent = before ? "Show after" : "Compare before and after";
    }

    /* Keyboard: ← and → walk the steps, Shift with an arrow jumps a layer,
       and holding B in the fix step shows the state it replaced. */
    function stops() {
      const out = [[0, 1], [0, 2]];
      doc.layers.forEach(L => { if (onePage) out.push([L.index, 1]); else for (let k = 1; k <= 4; k++) out.push([L.index, k]); });
      out.push([N + 1, 1], [N + 2, 1]);
      return out;
    }
    function move(dir) {
      const list = stops();
      const cur = list.findIndex(([p, k]) => p === pos && (pos > N || (pos >= 1 && onePage) || k === step));
      const next = list[Math.max(0, Math.min(list.length - 1, cur + dir))];
      if (!next || (next[0] === pos && next[1] === step)) return;
      if (next[0] === pos) goStep(next[1]); else goTo(next[0], dir < 0 && next[0] >= 1 && next[0] <= N ? 4 : next[0] === 0 && dir < 0 ? 2 : next[1]);
    }
    function jumpLayer(dir) {
      const p = Math.max(0, Math.min(N + 2, pos + dir));
      if (p === pos) return;
      goTo(p, (p >= 1 && p <= N && attemptFor(doc.layers[p - 1].index).revealed) ? 3 : 1);
    }
    function typing(t) { return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable); }
    function onKey(ev) {
      if (!docPane.isConnected || !docPane.offsetParent || typing(ev.target) || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
        ev.preventDefault();
        const dir = ev.key === "ArrowRight" ? 1 : -1;
        if (ev.shiftKey) jumpLayer(dir); else move(dir);
      } else if ((ev.key === "b" || ev.key === "B") && !ev.repeat) setBefore(true);
    }
    function onKeyUp(ev) { if (ev.key === "b" || ev.key === "B") setBefore(false); }
    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKeyUp);

    render();

    return {
      setAudience(a) { audience = a; render._keepScroll = true; render(); },
      setChallenge(c) { challenge = c; if (pos >= 1 && pos <= N && step >= 3 && locked(doc.layers[pos - 1])) step = 2; render._keepScroll = true; render(); },
      setOnePage(v) { onePage = !!v; before = false; render(); },
      setBefore,
      openSheet,
      get before() { return before; },
      // from Models, Vocabulary and links: open a layer at its fix if it's been read
      goToLayer(idx) { goTo(idx, attemptFor(idx).revealed ? 3 : 1); },
      get position() { return pos; },
      get step() { return step; },
      // the state the diagram is ACTUALLY showing (pos-1 before the fix).
      // Anything mirroring the diagram must use this, not position.
      get shownUpto() { return lastShown; },
      // cancel the pending debounce so a late timer can't overwrite a fresher
      // record after this view is torn down / the breakdown is re-opened
      destroy() {
        clearTimeout(saveTimer);
        closeSheet();
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("keyup", onKeyUp);
      }
    };
  }

  return { mount };
})();
