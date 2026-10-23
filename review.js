/* ═══════════════════════════════════════════════════════════════
   VITRUVIAN — REVIEW
   ───────────────────────────────────────────────────────────────
   Spaced review of the layers you've rebuilt. Every layer you read
   to its fix becomes a card. A card comes back after 1 day, then
   3, 7, 21 and 60 days if you keep getting it; a miss sends it back
   to tomorrow. Card types rotate so the same layer is asked about
   from different sides:
   · model  which thinking model cracks this failure (graded here)
   · rule   which rule the failure attacks (graded here)
   · fix    recall what was built (you rate yourself)
   · cost   recall what the fix costs (you rate yourself)
   · probe  an interview question, Developer reading level only
   State lives on the attempt: attempts[i].review = { step, due, history }.
   ═══════════════════════════════════════════════════════════════ */

var Review = (() => {
  const DAY = 864e5;
  const DAYS = [1, 3, 7, 21, 60];          // interval for each step on the ladder
  const LABEL = { model: "Which thinking model cracks this?", rule: "Which rule does this failure attack?",
    fix: "What was built to fix it?", cost: "What does the fix cost?", probe: "Interview question" };

  // a layer joins Review when it's read to its fix: first due a day later
  function ensure(a, now = Date.now()) {
    if (!a.review) a.review = { step: 0, due: now + DAY, history: [] };
    return a.review;
  }
  function dueAt(a) { return a.review ? a.review.due : 0; }     // backfilled layers are due right away
  function isDue(a, now) { return !!(a && a.revealed) && dueAt(a) <= now; }

  function nextDays(a, grade) {
    const s = a.review ? a.review.step : 0;
    if (grade === "again") return 1;
    return DAYS[Math.min(DAYS.length - 1, s + (grade === "easy" ? 2 : 1))];
  }
  function grade(a, g, now = Date.now()) {
    const r = ensure(a, now);
    const days = nextDays(a, g);
    r.step = g === "again" ? 0 : DAYS.indexOf(days);
    r.due = now + days * DAY;
    r.history = (r.history || []).concat({ t: now, ok: g !== "again" }).slice(-40);
    return days;
  }

  function typesFor(doc, L, audience) {
    const t = ["model", "fix", "cost"];
    if (doc.strip_down.invariants.length >= 2 && L.defends.length) t.splice(1, 0, "rule");
    if (audience === "developer" && L.developer && L.developer.interview_probes && L.developer.interview_probes.length) t.push("probe");
    return t;
  }
  // a stable little hash so a card's distractors don't reshuffle on every render
  function seed(s) { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return Math.abs(x); }

  function card(rec, L, audience) {
    const a = rec.attempts[L.index];
    const types = typesFor(rec.doc, L, audience);
    const n = a.review ? a.review.history.length : 0;
    const type = types[(n + seed(rec.id + L.index)) % types.length];
    const c = { rec, L, a, type, label: LABEL[type] };
    if (type === "model") {
      const right = L.problem.model.id;
      const pool = MODEL_LIBRARY.map(m => m.id).filter(id => id !== right);
      const s = seed(rec.id + ":" + L.index);
      const picks = [];
      for (let i = 0; picks.length < 3 && i < pool.length; i++) {
        const id = pool[(s + i * 7) % pool.length];
        if (!picks.includes(id)) picks.push(id);
      }
      const opts = picks.concat(right);
      c.options = opts.sort((x, y) => seed(x + s) - seed(y + s)).map(id => ({ id, right: id === right }));
    } else if (type === "rule") {
      c.options = rec.doc.strip_down.invariants.map(iv => ({ id: iv.id, right: L.defends.includes(iv.id) }));
    } else if (type === "probe") {
      c.probe = L.developer.interview_probes[seed(rec.id + L.index + n) % L.developer.interview_probes.length];
    }
    return c;
  }

  /* the cards to review now. `practice` ignores due dates; `systems` limits
     the deck to some records (a unit check) */
  function deck(recs, { now = Date.now(), practice = false, systems = null, audience = "enthusiast", max = 10 } = {}) {
    const out = [];
    recs.forEach(rec => {
      if (systems && !systems.has(rec.id)) return;
      rec.doc.layers.forEach(L => {
        const a = rec.attempts[L.index];
        if (!a || !a.revealed) return;
        if (!practice && !isDue(a, now)) return;
        out.push({ rec, L, a });
      });
    });
    out.sort((x, y) => practice ? (seed(x.rec.id + x.L.index + now) % 97) - (seed(y.rec.id + y.L.index + now) % 97) : dueAt(x.a) - dueAt(y.a));
    return out.slice(0, max).map(x => card(x.rec, x.L, audience));
  }

  function stats(recs, now = Date.now()) {
    let due = 0, cards = 0, right = 0, total = 0, nextDue = Infinity;
    const since = now - 30 * DAY;
    recs.forEach(rec => rec.doc.layers.forEach(L => {
      const a = rec.attempts[L.index];
      if (!a || !a.revealed) return;
      cards++;
      if (isDue(a, now)) due++; else nextDue = Math.min(nextDue, dueAt(a));
      ((a.review && a.review.history) || []).forEach(h => { if (h.t >= since) { total++; if (h.ok) right++; } });
    }));
    return { due, cards, right, total, accuracy: total ? Math.round(100 * right / total) : null, nextDue: nextDue === Infinity ? null : nextDue };
  }

  function inDays(t, now = Date.now()) {
    const d = Math.max(1, Math.round((t - now) / DAY));
    return d === 1 ? "tomorrow" : `in ${d} days`;
  }

  return { DAY, DAYS, ensure, grade, nextDays, deck, stats, inDays, isDue };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Review;
