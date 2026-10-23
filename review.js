/* ═══════════════════════════════════════════════════════════════
   VITRUVIAN — PRACTICE
   ───────────────────────────────────────────────────────────────
   Optional questions on layers you've already read, whenever you
   want them. Nothing is scheduled and nothing is ever due. Card
   types rotate so a layer is asked about from different sides:
   · model  which thinking model cracks this failure (checked here)
   · rule   which rule the failure attacks (checked here)
   · fix    recall what was built, then compare
   · cost   recall what the fix costs, then compare
   · probe  an interview question, Developer reading level only
   ═══════════════════════════════════════════════════════════════ */

var Review = (() => {
  const LABEL = { model: "Which thinking model cracks this?", rule: "Which rule does this failure attack?",
    fix: "What was built to fix it?", cost: "What does the fix cost?", probe: "Interview question" };

  function typesFor(doc, L, audience) {
    const t = ["model", "fix", "cost"];
    if (doc.strip_down.invariants.length >= 2 && L.defends.length) t.splice(1, 0, "rule");
    if (audience === "developer" && L.developer && L.developer.interview_probes && L.developer.interview_probes.length) t.push("probe");
    return t;
  }
  // a stable little hash so a card's distractors don't reshuffle on every render
  function seed(s) { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return Math.abs(x); }

  function card(rec, L, audience, salt) {
    const types = typesFor(rec.doc, L, audience);
    const type = types[seed(rec.id + L.index + salt) % types.length];
    const c = { rec, L, a: rec.attempts[L.index], type, label: LABEL[type] };
    if (type === "model") {
      const right = L.problem.model.id;
      const pool = MODEL_LIBRARY.map(m => m.id).filter(id => id !== right);
      const s = seed(rec.id + ":" + L.index);
      const picks = [];
      for (let i = 0; picks.length < 3 && i < pool.length; i++) {
        const id = pool[(s + i * 7) % pool.length];
        if (!picks.includes(id)) picks.push(id);
      }
      c.options = picks.concat(right).sort((x, y) => seed(x + s) - seed(y + s)).map(id => ({ id, right: id === right }));
    } else if (type === "rule") {
      c.options = rec.doc.strip_down.invariants.map(iv => ({ id: iv.id, right: L.defends.includes(iv.id) }));
    } else if (type === "probe") {
      c.probe = L.developer.interview_probes[seed(rec.id + L.index + salt) % L.developer.interview_probes.length];
    }
    return c;
  }

  /* a shuffled round of questions from layers you've read; `systems` limits
     it to some Deconstructs */
  function deck(recs, { systems = null, audience = "enthusiast", max = 8 } = {}) {
    const salt = String(Date.now());
    const out = [];
    recs.forEach(rec => {
      if (systems && !systems.has(rec.id)) return;
      rec.doc.layers.forEach(L => { const a = rec.attempts[L.index]; if (a && a.revealed) out.push({ rec, L }); });
    });
    out.sort((x, y) => seed(x.rec.id + x.L.index + salt) - seed(y.rec.id + y.L.index + salt));
    return out.slice(0, max).map(x => card(x.rec, x.L, audience, salt));
  }

  function readCount(recs) {
    return recs.reduce((n, rec) => n + rec.doc.layers.filter(L => rec.attempts[L.index] && rec.attempts[L.index].revealed).length, 0);
  }

  return { deck, readCount };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Review;
