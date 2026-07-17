/* ═══════════════════════════════════════════════════════════════
   SYSTEM DECONSTRUCTOR — GENERATOR (§8)
   ───────────────────────────────────────────────────────────────
   Direct browser → api.anthropic.com with the user's own key
   (BYOK). The dangerous-direct-browser-access header is
   Anthropic's deliberate warning that a key in a browser is
   exposed to that browser's user — acceptable here because the
   user IS the key's owner.
   · Streaming is for UX, not parsing: phases derived from section
     keys appearing in the stream; parsing happens once, at the end.
   · Validate → ONE repair call → honest failure with the raw text
     downloadable (never silently discard tokens the user paid for).
   Errors: { kind: "key"|"rate"|"overloaded"|"offline"|"toobig"|
             "invalid"|"http", message, raw? }
   ═══════════════════════════════════════════════════════════════ */

var Generator = (() => {
  const API = "https://api.anthropic.com/v1/messages";

  /* ── model-aware tuning ──
     max_tokens is a hard ceiling on THINKING + OUTPUT combined. Models that
     default to adaptive thinking (sonnet-5) silently spend part of the budget
     reasoning, so the ceiling must leave room for both. output_config.effort
     caps that thinking spend (faster + cheaper) — but it 400s on models that
     don't support it (haiku-4-5, sonnet-4-5 and older), so gate by family.
     The model field is free text; unknown ids just get no effort param. */
  function effortFor(modelId, speed) {
    const m = (modelId || "").toLowerCase();
    const supportsEffort = /sonnet-5|opus-4-6|opus-4-7|opus-4-8|fable|mythos/.test(m);
    if (!supportsEffort) return {};
    return { output_config: { effort: speed === "fast" ? "low" : "medium" } };
  }

  const FABLE = /fable|mythos/;
  function headers(apiKey, modelId) {
    const h = {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    };
    // Fable runs safety classifiers that can decline benign requests with a
    // 200 + stop_reason "refusal"; the server-side fallback beta reruns the
    // same request on Opus 4.8 in one round trip instead of failing.
    if (FABLE.test(modelId || "")) h["anthropic-beta"] = "server-side-fallback-2026-06-01";
    return h;
  }

  function fallbackFor(modelId) {
    return FABLE.test(modelId) ? { fallbacks: [{ model: "claude-opus-4-8" }] } : {};
  }

  function fail(kind, message, raw, errors) { const e = new Error(message); e.kind = kind; e.raw = raw; e.errors = errors; return e; }

  async function httpError(res) {
    let detail = "";
    try { detail = (await res.json()).error.message || ""; } catch (e) { /* opaque body */ }
    if (res.status === 401 || res.status === 403) return fail("key", "Your API key was rejected. Check it in Settings.");
    if (res.status === 429) return fail("rate", "Rate limited by Anthropic. Wait a minute and try again.");
    if (res.status === 413 || /prompt is too long|max_tokens|too many tokens/i.test(detail)) return fail("toobig", "The request was too large. Try narrowing the system (add a focus note).");
    if (res.status >= 500 || res.status === 529) return fail("overloaded", "Anthropic is overloaded right now. Retry in a moment.");
    return fail("http", `API error ${res.status}${detail ? ": " + detail : ""}`);
  }

  /* ── streaming call; returns full text; reports phases ── */
  async function streamCall(apiKey, modelId, body, onProgress, seen = new Set()) {
    if (!navigator.onLine) throw fail("offline", COPY.offlineGenNote);
    let res;
    try {
      res = await fetch(API, { method: "POST", headers: headers(apiKey, modelId), body: JSON.stringify({ ...body, ...fallbackFor(modelId), model: modelId, stream: true }) });
    } catch (e) {
      throw fail("offline", "Could not reach Anthropic. Check your connection.");
    }
    if (!res.ok) throw await httpError(res);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "", text = "", tokens = 0;   // `seen` (phase keys already emitted) is threaded in so the
                                           // repair call doesn't replay strip_down…transfer over "repair"
    const PHASES = [
      ['"strip_down"', "strip_down"],
      ['"visual"', "visual"],
      ['"layers"', "layers"],
      ['"stress_tests"', "stress"],
      ['"transfer"', "transfer"]
    ];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let ev;
        try { ev = JSON.parse(payload); } catch (e) { continue; }
        if (ev.type === "content_block_delta" && ev.delta && ev.delta.text) {
          text += ev.delta.text;
          tokens += 1;                                     // ~1 token per delta chunk is close enough for a trickle
          if (onProgress) {
            for (const [needle, phase] of PHASES) {
              if (!seen.has(phase) && text.includes(needle)) { seen.add(phase); onProgress({ phase, tokens: 0 }); }
            }
            onProgress({ tokens: Math.round(text.length / 4) });
          }
        }
        if (ev.type === "message_delta" && ev.delta && ev.delta.stop_reason === "max_tokens")
          throw fail("toobig", "The breakdown hit the output limit. Try narrowing the system.", text);
        // Fable/Mythos: whole fallback chain declined — partial text is not a document
        if (ev.type === "message_delta" && ev.delta && ev.delta.stop_reason === "refusal")
          throw fail("refusal", "The model declined this request (safety classifiers). Try a different model, or rephrase the system.");
        if (ev.type === "error") throw fail("http", (ev.error && ev.error.message) || "stream error", text);
      }
    }
    return text;
  }

  function parseDoc(text) {
    let t = text.trim();
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");   // defensive fence-stripping
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a === -1 || b === -1) throw fail("invalid", "The model returned no JSON document.", text);
    try { return JSON.parse(t.slice(a, b + 1)); }
    catch (e) { throw fail("invalid", "The model returned unparseable JSON.", text); }
  }

  /* ── the full pipeline: generate → validate → one repair ── */
  async function generate({ apiKey, modelId, system, focus, speed, mode, onProgress }) {
    const sys = SKILL.text(mode);
    const userMsg = (mode === "design"
      ? `Review and deconstruct this design I'm building:\n\n${system}`
      : `Deconstruct this system: ${system}`) + (focus ? `\n\nFocus note from the reader: ${focus}` : "");
    // 32k ceiling: a full breakdown runs ~8-15k tokens of JSON, and adaptive
    // thinking shares the same budget — 16k truncated real generations.
    // Streaming is already on, so a large ceiling is safe (billed per token
    // actually generated, not per the cap).
    const base = { max_tokens: 32000, ...effortFor(modelId, speed), system: sys, messages: [{ role: "user", content: userMsg }] };

    if (onProgress) onProgress({ phase: "start", tokens: 0 });
    const seen = new Set();                                 // shared across both calls: no phase replays on repair
    const text = await streamCall(apiKey, modelId, base, onProgress, seen);

    let doc, errors = null;
    try {
      doc = parseDoc(text);
      const res = Schema.validate(doc, { strict: true });   // freshly generated → full quality gate
      if (res.ok) return { doc, repaired: false };
      errors = res.errors;
    } catch (e) {
      if (e.kind !== "invalid") throw e;
      errors = [e.message];
    }

    /* one repair round — the loop is insurance, not a crutch */
    if (onProgress) onProgress({ phase: "repair", tokens: 0 });
    const repairMsg = `Your document failed validation with these exact errors:\n${errors.map(e => "- " + e).join("\n")}\n\nReturn the corrected COMPLETE JSON document only: no prose, no code fences.`;
    const text2 = await streamCall(apiKey, modelId, {
      ...base,
      // omit the assistant turn when the first response was blank — an empty
      // content block would make a malformed request instead of retrying cleanly
      messages: [...base.messages, ...(text.trim() ? [{ role: "assistant", content: text }] : []), { role: "user", content: repairMsg }]
    }, onProgress, seen);

    const doc2 = parseDoc(text2);                          // throws kind:"invalid" with raw attached
    const res2 = Schema.validate(doc2, { strict: true });
    if (!res2.ok) throw fail("invalid", `Still invalid after one repair (${res2.errors.length} errors). Your tokens aren't lost; download the raw output below.`, text2, res2.errors);
    return { doc: doc2, repaired: true };
  }

  /* ── AI-compare: the small second-type call (§7) ── */
  async function compare({ apiKey, modelId, layer, attempt }) {
    if (!navigator.onLine) throw fail("offline", "AI comparison needs a connection.");
    const p = SKILL.comparePrompt(layer, attempt);
    let res;
    try {
      // 1500 not 400: on adaptive-thinking models the ceiling covers thinking
      // + verdict together — 400 would truncate the verdict mid-sentence
      res = await fetch(API, {
        method: "POST", headers: headers(apiKey, modelId),
        body: JSON.stringify({ model: modelId, max_tokens: 1500, ...effortFor(modelId, "fast"), ...fallbackFor(modelId), system: p.system, messages: [{ role: "user", content: p.user }] })
      });
    } catch (e) { throw fail("offline", "Could not reach Anthropic. Check your connection."); }
    if (!res.ok) throw await httpError(res);
    const data = await res.json();
    if (data.stop_reason === "refusal") throw fail("refusal", "The model declined this request. Try a different model.");
    return data.content.map(b => b.text || "").join("").trim();
  }

  /* ── Ask-this-layer: one bounded Q&A call (§value-add) ── */
  async function ask({ apiKey, modelId, doc, layer, question }) {
    if (!navigator.onLine) throw fail("offline", "Asking needs a connection.");
    const p = SKILL.askPrompt(doc, layer, question);
    let res;
    try {
      res = await fetch(API, {
        method: "POST", headers: headers(apiKey, modelId),
        body: JSON.stringify({ model: modelId, max_tokens: 1200, ...effortFor(modelId, "fast"), ...fallbackFor(modelId), system: p.system, messages: [{ role: "user", content: p.user }] })
      });
    } catch (e) { throw fail("offline", "Could not reach Anthropic. Check your connection."); }
    if (!res.ok) throw await httpError(res);
    const data = await res.json();
    if (data.stop_reason === "refusal") throw fail("refusal", "The model declined this question. Try a different model.");
    return data.content.map(b => b.text || "").join("").trim();
  }

  /* ── What-if: propose a change → verdict + ghost diff (§value-add) ── */
  const NODE_KINDS = ["actor", "store", "process", "channel"];
  const EDGE_KINDS = ["payload", "control", "money"];
  function sanitizeWhatif(w, doc) {
    if (!w || typeof w !== "object") throw fail("invalid", "The model returned no verdict.");
    if (!["improves", "mixed", "harmful"].includes(w.verdict)) w.verdict = "mixed";
    if (typeof w.assessment !== "string" || !w.assessment.trim()) throw fail("invalid", "The verdict was empty.");
    const lanes = new Set(doc.visual.lanes.map(l => l.id));
    const invIds = new Set(doc.strip_down.invariants.map(i => i.id));
    // existing node/edge ids across the whole doc
    const existing = new Set();
    doc.visual.nodes.forEach(n => existing.add(n.id));
    doc.visual.edges.forEach(e => existing.add(e.id));
    doc.layers.forEach(L => { L.diff.add_nodes.forEach(n => existing.add(n.id)); L.diff.add_edges.forEach(e => existing.add(e.id)); });
    const d = w.diff || (w.diff = {});
    // keep only structurally sound proposed nodes; edges whose endpoints resolve
    const nodeIds = new Set(existing);
    d.add_nodes = (Array.isArray(d.add_nodes) ? d.add_nodes : []).filter(n =>
      n && typeof n.id === "string" && !existing.has(n.id) && typeof n.label === "string" &&
      NODE_KINDS.includes(n.kind) && lanes.has(n.lane) && Number.isInteger(n.order));
    d.add_nodes.forEach(n => nodeIds.add(n.id));
    d.add_edges = (Array.isArray(d.add_edges) ? d.add_edges : []).filter(e =>
      e && typeof e.id === "string" && !existing.has(e.id) && EDGE_KINDS.includes(e.kind) &&
      nodeIds.has(e.from) && nodeIds.has(e.to));
    d.highlight = (Array.isArray(d.highlight) ? d.highlight : []).filter(id => existing.has(id));
    w.defends = (Array.isArray(w.defends) ? w.defends : []).filter(id => invIds.has(id));
    w.stresses = (Array.isArray(w.stresses) ? w.stresses : []).filter(id => invIds.has(id));
    w.alternatives = (Array.isArray(w.alternatives) ? w.alternatives : []).filter(a => a && a.name && a.note);
    return w;
  }
  async function whatif({ apiKey, modelId, doc, change, speed }) {
    if (!navigator.onLine) throw fail("offline", "What-if needs a connection.");
    const p = SKILL.whatifPrompt(doc, change);
    async function call() {
      let res;
      try {
        res = await fetch(API, {
          method: "POST", headers: headers(apiKey, modelId),
          body: JSON.stringify({ model: modelId, max_tokens: 4000, ...effortFor(modelId, speed), ...fallbackFor(modelId), system: p.system, messages: [{ role: "user", content: p.user }] })
        });
      } catch (e) { throw fail("offline", "Could not reach Anthropic. Check your connection."); }
      if (!res.ok) throw await httpError(res);
      const data = await res.json();
      if (data.stop_reason === "refusal") throw fail("refusal", "The model declined this proposal. Try a different model.");
      return data.content.map(b => b.text || "").join("").trim();
    }
    let text = await call();
    try { return sanitizeWhatif(parseDoc(text), doc); }
    catch (e) { if (e.kind !== "invalid") throw e; }
    text = await call();                                   // one retry
    return sanitizeWhatif(parseDoc(text), doc);
  }

  return { generate, compare, ask, whatif };
})();
