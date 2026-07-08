/* ═══════════════════════════════════════════════════════════════
   SYSTEM DECONSTRUCTOR — SCHEMA VALIDATOR (hand-rolled, §3)
   ───────────────────────────────────────────────────────────────
   Schema.validate(doc) → { ok: true } | { ok: false, errors: [] }

   Two duties, one pass:
   1. STRUCTURE — required fields, enums, id uniqueness, edge
      endpoints existing by the time their layer applies, diff
      references resolving, model ids known, defends resolving.
   2. CAPACITY (SKILL.BOUNDS) — the renderer's measured limits,
      so "valid" means legible on a 380px phone, not merely
      drawable. These errors feed the generator's repair loop.
   No external JSON-schema library, by design.
   ═══════════════════════════════════════════════════════════════ */

var Schema = (() => {
  const B = SKILL.BOUNDS;
  const NODE_KINDS = ["actor", "store", "process", "channel"];
  const EDGE_KINDS = ["payload", "control", "money"];

  function isStr(v)      { return typeof v === "string"; }
  function isFullStr(v)  { return typeof v === "string" && v.trim().length > 0; }
  function isArr(v)      { return Array.isArray(v); }
  function isObj(v)      { return v !== null && typeof v === "object" && !Array.isArray(v); }

  function validate(doc) {
    const errors = [];
    const err = m => errors.push(m);

    if (!isObj(doc)) return { ok: false, errors: ["document is not an object"] };
    if (doc.schemaVersion !== 1) err("schemaVersion must be 1");

    /* ── meta ── */
    const meta = doc.meta;
    if (!isObj(meta)) err("meta missing");
    else {
      if (!isFullStr(meta.system)) err("meta.system must be a non-empty string");
      if (!isStr(meta.narrowing)) err("meta.narrowing must be a string ('' allowed)");
      if (!isFullStr(meta.ordering_note)) err("meta.ordering_note must be a non-empty string");
      if (!["high", "medium", "low"].includes(meta.history_confidence)) err("meta.history_confidence must be high|medium|low");
    }

    /* ── essence ── */
    const es = doc.essence;
    if (!isObj(es)) err("essence missing");
    else {
      if (!isFullStr(es.text)) err("essence.text must be a non-empty string");
      if (!isFullStr(es.beginner)) err("essence.beginner must be a non-empty string");
      checkStrArray(es.deep_facts, "essence.deep_facts", B.deepFacts, err);
    }

    /* ── strip_down ── */
    const invariantIds = new Set();
    const sd = doc.strip_down;
    if (!isObj(sd)) err("strip_down missing");
    else {
      if (!isFullStr(sd.purpose)) err("strip_down.purpose must be a non-empty string");
      checkIdObjArray(sd.actors, "strip_down.actors", B.actors, ["name", "want"], err);
      checkIdObjArray(sd.invariants, "strip_down.invariants", B.invariants, ["text"], err);
      if (isArr(sd.invariants)) sd.invariants.forEach(iv => { if (isObj(iv) && isFullStr(iv.id)) invariantIds.add(iv.id); });
      checkIdObjArray(sd.entities, "strip_down.entities", B.entities, ["name", "note"], err);
      checkIdObjArray(sd.flows, "strip_down.flows", B.flows, ["text"], err);
      checkStrArray(sd.constraints, "strip_down.constraints", B.constraints, err);
    }

    /* ── visual (Layer 0 baseline) + diffs, applied in order ──
       liveNodes/liveEdges track the state the diagram is actually
       in when each layer applies — endpoints must exist BY THEN. */
    const laneIds = new Set();
    const allIds = new Set();          // global uniqueness across nodes AND edges
    const liveNodes = new Map();       // id → node
    const liveEdges = new Map();       // id → edge
    let totalNodes = 0, totalEdges = 0;

    function claimId(id, where) {
      if (!isFullStr(id)) { err(`${where}: missing id`); return false; }
      if (allIds.has(id)) { err(`${where}: id "${id}" is not globally unique`); return false; }
      allIds.add(id);
      return true;
    }
    // Cell occupancy is checked at EVERY state the renderer shows (baseline
    // and after each layer's diff), not just the final one — the diagram
    // staggers over co-located nodes per state, so a cell that is legible at
    // the end can still stack 3+ nodes during an earlier layer/gate view.
    function checkCells(where) {
      const c = {};
      liveNodes.forEach(n => {
        const k = n.lane + "·" + n.order;
        c[k] = (c[k] || 0) + 1;
        if (c[k] === B.nodesPerCellMax + 1) err(`${where}: more than ${B.nodesPerCellMax} nodes share lane "${n.lane}" order ${n.order}`);
      });
    }
    function checkNode(n, where) {
      if (!isObj(n)) { err(`${where}: node is not an object`); return; }
      if (!claimId(n.id, where)) return;
      if (!isFullStr(n.label)) err(`${where} "${n.id}": label must be a non-empty string`);
      else if (n.label.length > B.nodeLabelMax) err(`${where} "${n.id}": label exceeds ${B.nodeLabelMax} chars ("${n.label}")`);
      if (!NODE_KINDS.includes(n.kind)) err(`${where} "${n.id}": kind must be ${NODE_KINDS.join("|")}`);
      if (!laneIds.has(n.lane)) err(`${where} "${n.id}": lane "${n.lane}" does not exist`);
      if (!Number.isInteger(n.order) || n.order < 0 || n.order > B.orderMax) err(`${where} "${n.id}": order must be an integer 0-${B.orderMax}`);
      liveNodes.set(n.id, n);
      totalNodes++;
    }
    function checkEdge(e, where) {
      if (!isObj(e)) { err(`${where}: edge is not an object`); return; }
      if (!claimId(e.id, where)) return;
      if (!liveNodes.has(e.from)) err(`${where} "${e.id}": endpoint "${e.from}" does not exist when this layer applies`);
      if (!liveNodes.has(e.to)) err(`${where} "${e.id}": endpoint "${e.to}" does not exist when this layer applies`);
      if (!EDGE_KINDS.includes(e.kind)) err(`${where} "${e.id}": kind must be ${EDGE_KINDS.join("|")}`);
      if (e.label != null && (!isStr(e.label) || e.label.length > B.edgeLabelMax)) err(`${where} "${e.id}": label exceeds ${B.edgeLabelMax} chars`);
      liveEdges.set(e.id, e);
      totalEdges++;
    }

    const vis = doc.visual;
    if (!isObj(vis)) err("visual missing");
    else {
      if (!isArr(vis.lanes) || vis.lanes.length < B.lanes.min || vis.lanes.length > B.lanes.max)
        err(`visual.lanes must have ${B.lanes.min}-${B.lanes.max} lanes`);
      else vis.lanes.forEach((l, i) => {
        if (!isObj(l) || !isFullStr(l.id) || !isFullStr(l.label)) { err(`visual.lanes[${i}] needs id and label`); return; }
        if (laneIds.has(l.id)) err(`visual.lanes: duplicate lane id "${l.id}"`);
        laneIds.add(l.id);
        if (l.label.length > B.laneLabelMax) err(`visual.lanes "${l.id}": label exceeds ${B.laneLabelMax} chars`);
      });
      if (!isArr(vis.nodes) || vis.nodes.length < 1 || vis.nodes.length > B.baselineNodesMax)
        err(`visual.nodes must have 1-${B.baselineNodesMax} nodes (Layer 0 is the NAIVE baseline)`);
      else vis.nodes.forEach(n => checkNode(n, "visual.nodes"));
      if (!isArr(vis.edges)) err("visual.edges must be an array");
      else vis.edges.forEach(e => checkEdge(e, "visual.edges"));
      checkCells("visual (layer 0)");
    }

    /* ── layers ── */
    const layers = doc.layers;
    if (!isArr(layers) || layers.length < B.layers.min || layers.length > B.layers.max)
      err(`layers must have ${B.layers.min}-${B.layers.max} entries`);
    else layers.forEach((L, i) => {
      const w = `layers[${i}]`;
      if (!isObj(L)) { err(`${w} is not an object`); return; }
      if (L.index !== i + 1) err(`${w}.index must be ${i + 1} (1-based, sequential)`);
      if (!isFullStr(L.name)) err(`${w}.name must be a non-empty string`);

      const p = L.problem;
      if (!isObj(p)) err(`${w}.problem missing`);
      else {
        if (!isFullStr(p.statement)) err(`${w}.problem.statement must be a non-empty string`);
        if (!isFullStr(p.beginner)) err(`${w}.problem.beginner must be a non-empty string`);
        if (!isObj(p.model)) err(`${w}.problem.model missing`);
        else {
          if (!MODEL_LIBRARY.some(m => m.id === p.model.id)) err(`${w}.problem.model.id "${p.model.id}" is not in the model library`);
          if (!isFullStr(p.model.application)) err(`${w}.problem.model.application must be a non-empty string`);
        }
      }
      if (!isObj(L.gate) || !isFullStr(L.gate.question) || !isFullStr(L.gate.hint)) err(`${w}.gate needs question and hint`);
      if (!isFullStr(L.solution)) err(`${w}.solution must be a non-empty string`);
      if (!isObj(L.user_lens) || !isFullStr(L.user_lens.gives)) err(`${w}.user_lens.gives must be a non-empty string`);
      if (!isObj(L.user_lens) || !isFullStr(L.user_lens.costs)) err(`${w}.user_lens.costs must be non-empty — every mechanism charges its users something`);
      if (!isObj(L.tech_lens) || !isFullStr(L.tech_lens.mechanism) || !isFullStr(L.tech_lens.principle)) err(`${w}.tech_lens needs mechanism and principle`);
      if (!isFullStr(L.tradeoff)) err(`${w}.tradeoff must be a non-empty string`);
      if (!isArr(L.defends) || L.defends.length === 0) err(`${w}.defends must name at least one invariant`);
      else L.defends.forEach(d => { if (!invariantIds.has(d)) err(`${w}.defends: "${d}" is not an invariant id`); });
      const dev = L.developer;
      if (!isObj(dev)) err(`${w}.developer missing`);
      else {
        if (!isArr(dev.mappings) || dev.mappings.length < B.devMappings.min || dev.mappings.length > B.devMappings.max)
          err(`${w}.developer.mappings must have ${B.devMappings.min}-${B.devMappings.max} entries`);
        else dev.mappings.forEach((m, j) => { if (!isObj(m) || !isFullStr(m.mechanism) || !isFullStr(m.software_concept)) err(`${w}.developer.mappings[${j}] needs mechanism and software_concept`); });
        if (!isArr(dev.interview_probes) || dev.interview_probes.length < B.interviewProbes.min || dev.interview_probes.length > B.interviewProbes.max)
          err(`${w}.developer.interview_probes must have ${B.interviewProbes.min}-${B.interviewProbes.max} entries`);
        else dev.interview_probes.forEach((s, j) => { if (!isFullStr(s)) err(`${w}.developer.interview_probes[${j}] must be a non-empty string`); });
      }
      if (!isFullStr(L.beginner_analogy)) err(`${w}.beginner_analogy must be a non-empty string`);

      const diff = L.diff;
      if (!isObj(diff)) { err(`${w}.diff missing`); return; }
      if (!isArr(diff.add_nodes) || diff.add_nodes.length > B.addNodesPerLayerMax) err(`${w}.diff.add_nodes must be an array of ≤${B.addNodesPerLayerMax}`);
      if (!isArr(diff.add_edges) || diff.add_edges.length > B.addEdgesPerLayerMax) err(`${w}.diff.add_edges must be an array of ≤${B.addEdgesPerLayerMax}`);
      if (!isArr(diff.highlight) || diff.highlight.length > B.highlightMax) err(`${w}.diff.highlight must be an array of ≤${B.highlightMax}`);
      else diff.highlight.forEach(h => {                       // refs the PRE-layer state — that's what pulses at the gate
        if (!liveNodes.has(h) && !liveEdges.has(h)) err(`${w}.diff.highlight: "${h}" does not exist before this layer`);
      });
      if (!isArr(diff.remove)) err(`${w}.diff.remove must be an array`);
      else diff.remove.forEach(r => {
        if (liveNodes.has(r)) {
          liveNodes.delete(r);
          [...liveEdges.values()].forEach(e => { if (e.from === r || e.to === r) liveEdges.delete(e.id); });
        } else if (liveEdges.has(r)) liveEdges.delete(r);
        else err(`${w}.diff.remove: "${r}" does not exist before this layer`);
      });
      if (isArr(diff.add_nodes)) diff.add_nodes.forEach(n => checkNode(n, `${w}.diff.add_nodes`));
      if (isArr(diff.add_edges)) diff.add_edges.forEach(e => checkEdge(e, `${w}.diff.add_edges`));
      checkCells(`${w} view`);           // this state is rendered — check its cells
    });

    /* ── total capacity (final state) ── */
    if (totalNodes > B.totalNodesMax) err(`diagram has ${totalNodes} nodes total; max ${B.totalNodesMax} — abstract harder`);
    if (totalEdges > B.totalEdgesMax) err(`diagram has ${totalEdges} edges total; max ${B.totalEdgesMax} — abstract harder`);

    /* ── stress_tests ── */
    const st = doc.stress_tests;
    if (!isArr(st) || st.length < B.stressTests.min || st.length > B.stressTests.max)
      err(`stress_tests must have ${B.stressTests.min}-${B.stressTests.max} entries`);
    else st.forEach((s, i) => {
      if (!isObj(s) || !isFullStr(s.id) || !isFullStr(s.title) || !isFullStr(s.scenario) || !isFullStr(s.reveal))
        err(`stress_tests[${i}] needs id, title, scenario, reveal`);
    });

    /* ── transfer ── */
    const tr = doc.transfer;
    if (!isObj(tr)) err("transfer missing");
    else {
      checkStrArray(tr.principles, "transfer.principles", B.principles, err);
      if (!isArr(tr.mappings) || tr.mappings.length < B.transferMappings.min || tr.mappings.length > B.transferMappings.max)
        err(`transfer.mappings must have ${B.transferMappings.min}-${B.transferMappings.max} entries`);
      else tr.mappings.forEach((m, i) => { if (!isObj(m) || !isFullStr(m.mechanism) || !isFullStr(m.elsewhere)) err(`transfer.mappings[${i}] needs mechanism and elsewhere`); });
    }

    return errors.length ? { ok: false, errors } : { ok: true };
  }

  function checkStrArray(arr, name, bounds, err) {
    if (!isArr(arr) || arr.length < bounds.min || arr.length > bounds.max) { err(`${name} must have ${bounds.min}-${bounds.max} entries`); return; }
    arr.forEach((s, i) => { if (!isFullStr(s)) err(`${name}[${i}] must be a non-empty string`); });
  }
  function checkIdObjArray(arr, name, bounds, fields, err) {
    if (!isArr(arr) || arr.length < bounds.min || arr.length > bounds.max) { err(`${name} must have ${bounds.min}-${bounds.max} entries`); return; }
    const seen = new Set();
    arr.forEach((o, i) => {
      if (!isObj(o) || !isFullStr(o.id)) { err(`${name}[${i}] needs an id`); return; }
      if (seen.has(o.id)) err(`${name}: duplicate id "${o.id}"`);
      seen.add(o.id);
      fields.forEach(f => { if (!isFullStr(o[f])) err(`${name} "${o.id}": ${f} must be a non-empty string`); });
    });
  }

  return { validate };
})();
