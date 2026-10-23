/* ═══════════════════════════════════════════════════════════════
   VITRUVIAN — VOICE
   ───────────────────────────────────────────────────────────────
   One definition of the house voice, used three ways:
   · RULES / SHORT_RULES go into every prompt, so the model is told.
   · lint() checks what comes back, offline and free. It only flags;
     the one thing it fixes itself is curly quotes.
   · tools/validate.js runs the same lint over the shipped samples,
     so tells can't creep back in.
   The patterns are the humanizer's high-signal tells: dashes, stock
   AI vocabulary, "not X, it is Y", colon reveals, theatrical
   openers, aphorism formulas, signposting, filler, and runs of
   clipped fragments. Each carries the hint the rewrite pass sends.
   Loaded as a classic script (global `Voice`) and by Node.
   ═══════════════════════════════════════════════════════════════ */

var Voice = (() => {
  // words that are fine on their own but cluster in machine prose; kept to
  // the ones with a plainer replacement and no technical meaning here
  const VOCAB = ["delve", "delves", "crucial", "crucially", "pivotal", "tapestry", "testament", "underscore", "underscores",
    "showcase", "showcases", "showcasing", "vibrant", "intricate", "intricacies", "seamless", "seamlessly", "foster", "fosters",
    "fostering", "garner", "garners", "additionally", "moreover", "furthermore", "essentially", "ultimately", "notably",
    "realm", "holistic", "profound", "profoundly", "indelible", "genius", "game-changer", "game-changing", "unlock", "unlocks", "elevate"];

  const PATTERNS = [
    { id: "dash", label: "dash", re: /[—–]|\s--\s/,
      hint: "Replace the dash with a period, comma, colon or parentheses." },
    { id: "vocab", label: "stock word", re: new RegExp("\\b(" + VOCAB.join("|") + ")\\b", "i"),
      hint: "Swap the stock word for a plainer, more specific one, or cut it." },
    { id: "not-but", label: "not X, it is Y", re: /\b(?:is|are|was|were)\s+not\s+[^.;:!?]{1,60}?[;,]\s*(?:it|they|this|that)(?:'s|\s+is|\s+are|\s+was)\b|\bnot\s+(?:just|merely|only|simply)\s+[^.!?]{1,60}?\bbut\b|\bisn't\s+[^.;!?]{1,50}?[;,]\s*it's\b/i,
      hint: "Say what it is directly instead of 'not X, it is Y'." },
    { id: "colon-reveal", label: "colon reveal", re: /(?:^|[.!?]\s+)(?:The\s+(?:answer|trick|catch|twist|irony|lesson|secret|kicker|result)|Here's\s+(?:why|how|what|the\s+thing))\s*:/,
      hint: "Drop the set-up and state the point as a plain sentence." },
    { id: "opener", label: "theatrical opener", re: /(?:^|[.!?]\s+)(?:Honestly|Look|Here's the thing|The thing is|Let's be honest|Real talk)\b[?,.:]/,
      hint: "Remove the fake-candid opener; start with the point." },
    { id: "aphorism", label: "aphorism", re: /\bis the (?:language|currency|architecture|heartbeat|backbone|lifeblood|DNA) of\b|\bbecomes a trap\b/i,
      hint: "Replace the aphorism with the concrete claim it gestures at." },
    { id: "signpost", label: "signposting", re: /\b(?:let's (?:dive|explore|break (?:it|this) down|unpack)|without further ado|here's what you need to know)\b/i,
      hint: "Cut the announcement and just say the thing." },
    { id: "filler", label: "filler", re: /\b(?:in order to|due to the fact that|it is important to note that|it's worth noting that|at this point in time|in today's world)\b/i,
      hint: "Use the short form ('to', 'because') or cut the phrase." }
  ];

  // three or more sentences in a row under five words reads as staged drama
  function stackedFragments(text) {
    const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
    let run = 0;
    for (const s of sentences) {
      run = s.split(/\s+/).length < 5 ? run + 1 : 0;
      if (run >= 3) return true;
    }
    return false;
  }

  /* lint(text) → [{ id, label, hint, match }] */
  function lint(text) {
    if (typeof text !== "string" || text.length < 20) return [];
    const out = [];
    PATTERNS.forEach(p => {
      const m = p.re.exec(text);
      if (m) out.push({ id: p.id, label: p.label, hint: p.hint, match: m[0].trim() });
    });
    if (stackedFragments(text)) out.push({ id: "fragments", label: "stacked fragments", hint: "Join the clipped fragments into one or two full sentences.", match: "" });
    return out;
  }

  // structural fields: ids, kinds, lanes, labels and enums are not prose
  const SKIP = new Set(["id", "kind", "lane", "from", "to", "order", "label", "schemaVersion", "history_confidence",
    "domain", "expands_to", "vocab", "defends", "highlight", "remove", "model", "system", "name", "title", "mechanism", "software_concept"]);

  /* every prose string in a document, with its path */
  function strings(doc) {
    const out = [];
    (function walk(x, path, key) {
      if (typeof x === "string") { if (!SKIP.has(key) && x.length >= 20) out.push({ path, text: x }); return; }
      if (Array.isArray(x)) { x.forEach((v, i) => walk(v, path.concat(i), key)); return; }
      if (x && typeof x === "object") Object.keys(x).forEach(k => { if (!SKIP.has(k) || typeof x[k] === "object") walk(x[k], path.concat(k), k); });
    })(doc, [], "");
    return out;
  }

  /* lintDoc(doc) → [{ path, text, issues }] for the strings that need work */
  function lintDoc(doc) {
    return strings(doc).map(s => ({ ...s, issues: lint(s.text) })).filter(s => s.issues.length);
  }

  function get(doc, path) { return path.reduce((o, k) => (o == null ? o : o[k]), doc); }
  function set(doc, path, value) {
    const parent = get(doc, path.slice(0, -1));
    if (parent != null) parent[path[path.length - 1]] = value;
  }

  // the one safe automatic fix: curly quotes → straight
  function straighten(doc) {
    let n = 0;
    strings(doc).forEach(s => {
      const t = s.text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
      if (t !== s.text) { set(doc, s.path, t); n++; }
    });
    return n;
  }

  // the prompt version of the same rules, with one before/after pair each
  const RULES = `VOICE CHECKLIST - your output is checked against these, and any string that trips one is sent back to be rewritten:
- No em or en dashes. "The cache fills - and then it fails" becomes "The cache fills, then it fails."
- No stock words: ${VOCAB.slice(0, 22).join(", ")}. "This is crucial" becomes "Without it, X breaks."
- No "not X, it is Y" and no "not just X but Y". "A balance is not stored, it is derived" becomes "A balance is derived from the ledger every time you ask."
- No colon reveals ("The catch:", "Here's why:"). State the point as a plain sentence.
- No theatrical openers ("Look,", "Honestly?", "Here's the thing"), no signposting ("Let's dive in"), no aphorism formulas ("X is the currency of Y").
- No filler ("in order to", "due to the fact that", "it is worth noting that").
- No runs of three or more clipped fragments. Join them into full sentences.`;

  const SHORT_RULES = `Write plainly: no em or en dashes, no stock words like ${VOCAB.slice(0, 10).join(", ")}, no "not X, it is Y", no colon reveals like "The catch:", no theatrical openers, no filler phrases.`;

  return { PATTERNS, VOCAB, RULES, SHORT_RULES, lint, lintDoc, strings, get, set, straighten };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Voice;
