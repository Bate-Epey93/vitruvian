/* ═══════════════════════════════════════════════════════════════
   SYSTEM DECONSTRUCTOR — THE GENERATION CORE (skill v2 + schema)
   ───────────────────────────────────────────────────────────────
   Single source of truth for the breakdown document shape:
   · SKILL.BOUNDS — renderer-capacity limits. schema.js enforces
     them; the prompt states them. Change them in ONE place.
   · SKILL.SCHEMA_DOC — the schema, serialized into the prompt.
   · SKILL.text() — the full system prompt for generation.
   · SKILL.EXEMPLAR — compact railway excerpt (few-shot anchor).
   · SKILL.comparePrompt() — the small second-type call (§7).
   ═══════════════════════════════════════════════════════════════ */

var SKILL = (() => {

  /* ── Capacity bounds — the renderer's measured limits ──
     Valid must mean LEGIBLE, not just drawable. These numbers are
     sized to a 380px phone with horizontal pan allowed. */
  const BOUNDS = {
    lanes:            { min: 2, max: 5 },
    laneLabelMax:     14,
    baselineNodesMax: 8,
    totalNodesMax:    22,
    orderMax:         7,      // ≤ 8 columns
    nodesPerCellMax:  2,      // per (lane, order) cell at final state
    nodeLabelMax:     24,
    edgeLabelMax:     16,
    totalEdgesMax:    30,
    addNodesPerLayerMax: 5,
    addEdgesPerLayerMax: 6,
    highlightMax:     6,
    layers:           { min: 4, max: 7 },
    deepFacts:        { min: 3, max: 6 },
    actors:           { min: 2, max: 6 },
    invariants:       { min: 2, max: 5 },
    entities:         { min: 2, max: 8 },
    flows:            { min: 1, max: 5 },
    constraints:      { min: 1, max: 5 },
    stressTests:      { min: 2, max: 4 },
    principles:       { min: 3, max: 6 },
    transferMappings: { min: 2, max: 5 },
    devMappings:      { min: 1, max: 3 },
    interviewProbes:  { min: 1, max: 2 }
  };

  /* ── The schema, as the prompt and the validator understand it ──
     kinds: node = actor|store|process|channel · edge = payload|control|money */
  const SCHEMA_DOC = {
    schemaVersion: 1,
    meta: { system: "string", narrowing: "string — the tractable slice you chose, '' if none needed", ordering_note: "string — why the layers come in this order", history_confidence: "high|medium|low — how sure you are the failure story is historically accurate" },
    essence: { text: "string — the system in one breath, enthusiast register", beginner: "string — same idea, no jargon", deep_facts: ["3-6 strings — surprising, checkable facts"] },
    strip_down: {
      purpose: "string — what the system is FOR, one sentence",
      actors: [{ id: "a1…", name: "string", want: "string — what this actor wants" }],
      invariants: [{ id: "inv1…", text: "string — what must NEVER be false" }],
      entities: [{ id: "en1…", name: "string", note: "string" }],
      flows: [{ id: "f1…", text: "string — what moves through the system" }],
      constraints: ["strings — physics, economics, law: what cannot be wished away"]
    },
    visual: {
      lanes: [{ id: "string", label: "string ≤14 chars — a SEMANTIC ROLE (people, control, data, money), never a physical place" }],
      nodes: [{ id: "string", label: "≤24 chars", kind: "actor|store|process|channel", lane: "lane id", order: "int 0-7 — column within the lane" }],
      edges: [{ id: "string", from: "node id", to: "node id", kind: "payload|control|money", label: "≤16 chars, optional" }]
    },
    layers: [{
      index: "int — 1-based, sequential",
      name: "string",
      problem: {
        statement: "string — the failure that forces this layer, enthusiast register; name the historical incident when confident",
        beginner: "string — same failure, plain words",
        model: { id: "one of the 14 model ids", application: "string — one sentence: how this model cracks THIS problem" }
      },
      gate: { question: "string — challenge the reader to redesign before the reveal", hint: "string — a nudge, not the answer" },
      solution: "string — what was actually built",
      user_lens: { gives: "string — what the user gains", costs: "string — what the user pays or loses; NEVER empty" },
      tech_lens: { mechanism: "string — how it works, plainly", principle: "string — the transferable rule" },
      tradeoff: "string — what this layer sacrifices",
      at_scale: "string — how this mechanism behaves under HEAVY LOAD and as the system grows: does it hold, become the bottleneck, or need to be multiplied/sharded/cached? Name the scaling property or ceiling concretely (e.g. 'one train per block-time caps a line at ~N trains/hour' or 'a blind server fan-out lets one uplink reach a 100k-member group')",
      defends: ["invariant ids this layer protects — at least one"],
      developer: {
        mappings: [{ mechanism: "string — the concrete mechanism", software_concept: "string — its software twin" }],
        interview_probes: ["strings — questions that transfer the insight to an interview"]
      },
      beginner_analogy: "string — one everyday analogy",
      diff: {
        add_nodes: ["0-5 node objects, same shape as visual.nodes"],
        add_edges: ["0-6 edge objects, same shape as visual.edges"],
        highlight: ["0-6 existing node/edge ids — what is BROKEN before this layer fixes it"],
        remove: ["existing node/edge ids this layer retires, usually []. Removing a node removes its edges automatically — do NOT also list those edges"]
      }
    }],
    stress_tests: [{ id: "st1…", title: "string", scenario: "string — push the system somewhere nasty", reveal: "string — how the finished system handles it, or honestly fails" }],
    transfer: {
      principles: ["3-6 strings — the rules this system teaches, stated system-neutrally"],
      mappings: [{ mechanism: "string — a mechanism from this system", elsewhere: "string — where the same shape appears in other systems" }]
    }
  };

  /* ── The generation skill ── mode "system" (default) deconstructs a known
     system; mode "design" reviews the reader's OWN proposed design. ── */
  function text(mode) {
    const models = MODEL_LIBRARY.map(m => `- ${m.id}: ${m.name} — ${m.one_liner}`).join("\n");
    const designMode = mode === "design" ? `
DESIGN-REVIEW MODE. The reader is DESIGNING this system themselves and has described their proposed design. You are their rigorous, generous design reviewer — never a cheerleader.
- meta.system: name the system they're building. Set history_confidence to "low" and NEVER invent historical incidents or dates — the failures here are the inevitable ones THEIR described design will hit as it grows, not documented history. Say so in ordering_note.
- strip_down: surface the invariants they did NOT state but their system must hold, the actors/entities/flows implied by their description, and the hard constraints they're up against. Naming an unstated invariant is often the most valuable thing you do.
- Each rebuild layer is forced by the failure THEIR current design would hit next — what breaks first, then next, especially under load. Where their description already handles a failure well, credit it plainly in that layer's solution; where it doesn't, the layer IS the fix they're missing. Stay specific to what they actually described — never swap in a generic textbook system.
- If the description is too thin to deconstruct, choose the most load-bearing interpretation and state it in meta.narrowing.
` : "";
    return `You are the System Deconstructor. Given a named system, you produce ONE JSON document that teaches how the system works by rebuilding it from nothing, failure by failure. Your reader should finish able to re-derive the system, not just describe it.
${designMode}
METHOD — five movements, in order:
1. ESSENCE. The system in one breath: what it is, what makes it remarkable. Then 3-6 deep facts — surprising, specific, checkable.
2. STRIP-DOWN. Remove everything until only the irreducible core remains: the purpose, the actors and what they want, the invariants (what must never be false), the entities, the flows, the hard constraints. This is the system's skeleton.
3. FAILURE-DRIVEN REBUILD (4-7 layers). Start from the naive version and let each layer be FORCED by a concrete failure of the previous state. Never add a mechanism the failure doesn't demand. Each layer names exactly one thinking model that cracks its problem, poses a gate question (the reader designs before seeing the answer), then gives the solution, both lenses, the tradeoff, HOW IT HOLDS AT SCALE (at_scale), and which invariants it defends. When you know the real historical failure (Clayton Tunnel 1861), use it and set history_confidence accordingly; when you don't, construct the inevitable failure honestly and say so in ordering_note.
4. STRESS TESTS (2-4). Push the finished system somewhere nasty. Reveal how it copes — or honestly where it breaks.
5. TRANSFER. Extract the system-neutral principles and map this system's mechanisms to their twins elsewhere.

THE 14 THINKING MODELS — problem.model.id MUST be one of:
${models}

SCOPING. If the system is broad (a whole company, "the internet"), choose ONE tractable slice — the most load-bearing path — and declare it in meta.narrowing. A sharp slice deconstructed fully beats a blur covered thinly.

THREE REGISTERS, ONE DOCUMENT. essence.beginner and problem.beginner say the same thing as their siblings with zero jargon. beginner_analogy is one everyday image. developer.mappings and interview_probes speak to engineers. Never dumb down the enthusiast register; never jargon up the beginner one.

THE DIAGRAM. You are drawing on a fixed grid, not a canvas:
- Lanes are horizontal bands: SEMANTIC ROLES (people, service, control, data, money) — never physical places. ${BOUNDS.lanes.min}-${BOUNDS.lanes.max} lanes, labels ≤${BOUNDS.laneLabelMax} chars.
- Node kinds mean things: actor = a person/party, store = where things wait or accumulate, process = where work happens, channel = what things move through.
- Edge kinds mean things: payload = the thing the system exists to move, control = signals and permissions, money = value.
- visual = Layer 0, the naive baseline (≤${BOUNDS.baselineNodesMax} nodes). Each layer's diff adds ≤${BOUNDS.addNodesPerLayerMax} nodes and ≤${BOUNDS.addEdgesPerLayerMax} edges. Final state: ≤${BOUNDS.totalNodesMax} nodes, ≤${BOUNDS.totalEdgesMax} edges, order values 0-${BOUNDS.orderMax}, at most ${BOUNDS.nodesPerCellMax} nodes per lane+order cell. Node labels ≤${BOUNDS.nodeLabelMax} chars, edge labels ≤${BOUNDS.edgeLabelMax}.
- diff.highlight lists what is BROKEN before the layer fixes it (shown pulsing red at the gate). Every edge endpoint must exist by the time its layer applies. All ids globally unique.
- If the system feels too complex for these limits, you are drawing at the wrong altitude — abstract harder. The limits are the pedagogy.

HARD RULES:
- Output ONLY the JSON document. No prose before or after, no code fences, no markdown inside string fields.
- user_lens.costs is never empty — every mechanism charges its users something.
- at_scale is never empty — every layer must answer "how does this hold when load is enormous or the system grows?" with a concrete scaling property, ceiling, or the multiplication/sharding/caching it forces. This is how the reader learns to reason about load (e.g. "a million users a second"), not just correctness.
- defends is never empty — a layer that defends nothing shouldn't exist.
- Layer indexes are 1-based and sequential.
- Honesty over drama: if history_confidence is low, never invent named disasters with dates.

THE SCHEMA (shape and field meanings):
${JSON.stringify(SCHEMA_DOC, null, 1)}

EXEMPLAR (abridged excerpt of a full breakdown — match its density and voice, not its subject):
${EXEMPLAR}

If you receive a message listing validation errors, return the corrected COMPLETE JSON document only — same rules.`;
  }

  /* ── Few-shot exemplar: trimmed two-layer excerpt of railway ── */
  const EXEMPLAR = JSON.stringify({
    schemaVersion: 1,
    meta: { system: "The railway network", narrowing: "", ordering_note: "Layers follow the historical order because each mechanism was forced by a real failure of the previous state.", history_confidence: "high" },
    essence: {
      text: "A railway is a machine the size of a country that lets thousands of trains share a few threads of steel without touching. Its genius is not the engine — it is the invisible discipline of separation.",
      beginner: "A railway is how many heavy, fast trains share the same few tracks all day without ever crashing into each other.",
      deep_facts: ["A loaded freight train can need over 2 km to stop — the driver can never stop within the distance they can see.", "The 1861 Clayton Tunnel crash killed 23 people while the railway was following its safety rules perfectly.", "Britain legislated standard time largely because railways could not run on hundreds of local town clocks."]
    },
    strip_down: {
      purpose: "Move people and goods over long distances, on schedule, without collisions.",
      actors: [{ id: "a1", name: "Passenger", want: "Arrive safely, on time" }, { id: "a2", name: "Driver", want: "Clear, unambiguous permission to move" }],
      invariants: [{ id: "inv1", text: "Two trains never occupy the same stretch of track at the same time." }],
      entities: [{ id: "en1", name: "Train", note: "Fast, heavy, nearly blind — cannot stop within sight distance" }, { id: "en2", name: "Track section", note: "The shared, exclusive resource" }],
      flows: [{ id: "f1", text: "Trains flow along tracks; permission flows against them." }],
      constraints: ["Stopping distance exceeds sighting distance — reaction is not an option; only prevention works."]
    },
    visual: {
      lanes: [{ id: "people", label: "People" }, { id: "service", label: "Trains & track" }, { id: "control", label: "Control" }],
      nodes: [
        { id: "passenger", label: "Passenger", kind: "actor", lane: "people", order: 0 },
        { id: "train1", label: "Train A", kind: "process", lane: "service", order: 1 },
        { id: "train2", label: "Train B", kind: "process", lane: "service", order: 2 },
        { id: "track_main", label: "Shared track", kind: "channel", lane: "service", order: 3 }
      ],
      edges: [{ id: "e_board", from: "passenger", to: "train1", kind: "payload", label: "boards" }, { id: "e_run1", from: "train1", to: "track_main", kind: "payload" }, { id: "e_run2", from: "train2", to: "track_main", kind: "payload" }]
    },
    layers: [
      { index: 1, name: "The Timetable: One Clock, One Plan",
        problem: { statement: "Two trains, one track, and nothing that coordinates them — each driver knows only what he can see, and he cannot see far enough to matter.", beginner: "Two trains share one track, but neither driver knows where the other is.", model: { id: "single-source-of-truth", application: "Give every train one authoritative plan — the timetable — so that 'where should everyone be?' has exactly one answer." } },
        gate: { question: "It's 1830. No telegraph, no radio — trains outrun every message. With only paper and clocks, how do you keep two trains from meeting?", hint: "If information can't travel faster than the trains, agree on everything before anyone moves." },
        solution: "The timetable: every movement planned in advance against one standard clock, plus a time-interval rule — wait N minutes behind the train ahead.",
        user_lens: { gives: "Predictability — a passenger can plan a journey to the minute.", costs: "Rigidity: the plan outranks the person. Miss the train and the system does not care." },
        tech_lens: { mechanism: "A pre-computed global schedule against synchronized clocks; gaps enforced by elapsed time.", principle: "When coordination can't happen at run time, move it to plan time." },
        tradeoff: "The plan is blind: it describes where trains SHOULD be, and a broken-down train is exactly where it shouldn't be.",
        at_scale: "Adding trains means adding timetable rows and safety gaps, not new coordination — one plan scales to a whole network for free. But it scales in a brittle way: one late train ripples delays down every dependent path, so heavy traffic amplifies small disturbances instead of absorbing them.",
        defends: ["inv1"],
        developer: { mappings: [{ mechanism: "the timetable", software_concept: "static scheduling — coordination compiled ahead of time" }], interview_probes: ["Where in your system do you coordinate by plan instead of by signal, and what happens when reality diverges from the plan?"] },
        beginner_analogy: "Like a family sharing one bathroom by agreeing on a morning schedule — it works until someone takes too long, because the schedule can't see.",
        diff: { add_nodes: [{ id: "timetable", label: "Timetable", kind: "store", lane: "control", order: 0 }], add_edges: [{ id: "e_plan1", from: "timetable", to: "train1", kind: "control", label: "departs 09:00" }], highlight: ["train1", "train2", "track_main"], remove: [] } },
      { index: 2, name: "The Block System: Space, Not Time",
        problem: { statement: "Time-based separation rests on a false assumption — 'enough time has passed, so the track must be clear.' A broken-down train doesn't move because ten minutes elapsed. Clayton Tunnel, 1861: 23 dead.", beginner: "The old rule was 'wait 10 minutes, then go.' But waiting doesn't move a broken train.", model: { id: "first-principles", application: "Safety requires KNOWING the section is empty, not inferring it from elapsed time — so build on confirmed knowledge, not clocks." } },
        gate: { question: "The telegraph now exists — you can message between fixed points along the line. Redesign train separation so it depends on knowledge, not assumption.", hint: "What if permission to enter were a physical object that can't be duplicated?" },
        solution: "Divide the line into blocks, one train per block, ever. Entry only after the signalman ahead confirms by telegraph that the block is clear. On single track: the token — one brass object per section; no token, no entry.",
        user_lens: { gives: "Ambient, invisible safety — boarding without wondering if the track ahead is clear.", costs: "Drivers lose authority: the signal decides, not the person driving." },
        tech_lens: { mechanism: "Per-block occupancy tracked by signal boxes; telegraph request/confirm protocol; physical token as uncopyable permission.", principle: "Replace inference with confirmation; guard shared resources with exclusive locks, not etiquette." },
        tradeoff: "Capacity is quantized: one train per block-traversal-time, a hard ceiling. Safety purchased with headroom.",
        at_scale: "This is the line's throughput ceiling: capacity ≈ one train per block-traversal-time, so you scale a busy route by cutting blocks SHORTER (more, smaller sections) — at the cost of more signal boxes and telegraph traffic. It's horizontal scaling by sharding the track.",
        defends: ["inv1"],
        developer: { mappings: [{ mechanism: "the brass token", software_concept: "distributed mutex / lease — possession is permission" }], interview_probes: ["Your rate limiter infers capacity from elapsed time. What's your Clayton Tunnel?"] },
        beginner_analogy: "Like a single bathroom key at a gas station: whoever holds the key can go in; two people can't hold one key.",
        diff: { add_nodes: [{ id: "signalbox_a", label: "Signal box A", kind: "process", lane: "control", order: 1 }, { id: "signalbox_b", label: "Signal box B", kind: "process", lane: "control", order: 3 }], add_edges: [{ id: "e_confirm", from: "signalbox_b", to: "signalbox_a", kind: "control", label: "block clear" }, { id: "e_permit", from: "signalbox_a", to: "train1", kind: "control", label: "may enter" }], highlight: ["track_main", "train1", "train2"], remove: [] } }
    ],
    stress_tests: [{ id: "st1", title: "The telegraph dies", scenario: "A storm cuts the telegraph line between two signal boxes. Trains are waiting.", reveal: "Fail-safe: no confirmation means no permission — traffic stops. The system chooses paralysis over guessing, and capacity collapses to protect the invariant." }],
    transfer: { principles: ["Replace inference with confirmation wherever an invariant is at stake."], mappings: [{ mechanism: "block + token", elsewhere: "Mutexes, leases, and semaphores guard shared resources in every operating system and distributed database." }] }
  }, null, 1);

  /* ── AI-compare: the small second-type call (§7) ── */
  function comparePrompt(layer, attempt) {
    return {
      system: `You are comparing a learner's design attempt against the canonical solution of a system-deconstruction layer. Verdict in under 150 words, exactly three parts, plain text:
RIGHT: what their attempt got right.
MISSED: what it missed that the canonical solution handles.
VERDICT: whether they found a DIFFERENT VALID solution — this is explicitly allowed and should be celebrated when true.
Be specific and generous; judge the design, not the prose.`,
      user: `THE PROBLEM: ${layer.problem.statement}\n\nTHE THINKING MODEL: ${layer.problem.model.id} — ${layer.problem.model.application}\n\nCANONICAL SOLUTION: ${layer.solution}\n\nLEARNER'S ATTEMPT: ${attempt}`
    };
  }

  /* ── Ask-this-layer: one bounded question, answered from the layer's own
     context (§value-add). Not freeform chat — one question, one answer. ── */
  function askPrompt(doc, layer, question) {
    return {
      system: `You answer ONE question from a reader about ONE layer of a system breakdown. Ground your answer in the provided context plus well-established knowledge of this system; when the context doesn't settle it, say so plainly rather than speculating. Maximum 160 words, plain text, no markdown. Be direct and specific — name the mechanism, tradeoff, or scaling shape that answers the question. If the reader proposes an alternative design, treat it seriously: say what it gets right before what it misses.`,
      user: `SYSTEM: ${doc.meta.system}
ESSENCE: ${doc.essence.text}

LAYER ${layer.index}: ${layer.name}
PROBLEM: ${layer.problem.statement}
SOLUTION: ${layer.solution}
MECHANISM: ${layer.tech_lens.mechanism}
PRINCIPLE: ${layer.tech_lens.principle}
TRADEOFF: ${layer.tradeoff}
UNDER LOAD: ${layer.at_scale || "not documented"}

READER'S QUESTION: ${question}`
    };
  }

  /* ── What-if: assess a proposed CHANGE to a deconstructed system, grounded
     in its invariants, and return a verdict + a diagram diff to ghost-render
     the proposed architecture. Single JSON object. ── */
  function finalNodes(doc) {
    const nodes = new Map();
    doc.visual.nodes.forEach(n => nodes.set(n.id, n));
    doc.layers.forEach(L => {
      L.diff.remove.forEach(id => nodes.delete(id));
      L.diff.add_nodes.forEach(n => nodes.set(n.id, n));
    });
    return [...nodes.values()];
  }
  function whatifPrompt(doc, change) {
    const invs = doc.strip_down.invariants.map(i => `${i.id}: ${i.text}`).join("\n");
    const lanes = doc.visual.lanes.map(l => `${l.id} ("${l.label}")`).join(", ");
    const nodeList = finalNodes(doc).map(n => `${n.id} [${n.kind}, lane ${n.lane}] "${n.label}"`).join("\n");
    const layerList = doc.layers.map(L => `${L.index}. ${L.name} — ${L.solution}`).join("\n");
    const shape = {
      name: "string ≤40 — a short name for the proposed change",
      verdict: "improves | mixed | harmful",
      assessment: "string, 2-4 sentences — why it works/improves or why it doesn't, GROUNDED in the system's invariants; name the invariant it strengthens or threatens. Honest, specific, never a cheerleader.",
      gain: "string — the capability or benefit the change is reaching for",
      defends: ["invariant ids it upholds or strengthens"],
      stresses: ["invariant ids it threatens or violates — usually the crux of why the change is hard"],
      tradeoff: "string — what it costs",
      at_scale: "string — how the changed system behaves under heavy load",
      diff: {
        add_nodes: ["new nodes: {id,label ≤24,kind:actor|store|process|channel,lane:<existing lane id>,order:0-7}"],
        add_edges: ["new edges: {id,from,to,kind:payload|control|money,label ≤16}; from/to reference existing node ids OR your new node ids"],
        highlight: ["existing node/edge ids the change stresses or breaks"]
      },
      alternatives: [{ name: "string", note: "string — a cleaner or established way to get the same benefit" }]
    };
    return {
      system: `You are a rigorous, generous systems-design reviewer. The reader has a fully deconstructed system and proposes a CHANGE to it. Assess the change honestly — never a cheerleader; a change that breaks a core invariant is 'harmful' even if popular.

Output ONLY one JSON object, no prose and no code fences, matching this shape:
${JSON.stringify(shape, null, 1)}

Rules:
- The single most valuable thing you do is name which INVARIANT the change strengthens (defends) or threatens (stresses), using the invariant ids provided. stresses is often why a tempting change is actually hard.
- verdict is one of improves|mixed|harmful. 'mixed' when it helps one goal while costing another.
- diff renders the change on the existing diagram. New nodes use ONLY the existing lane ids. Edges' from/to must reference an existing node id (listed below) or one of your own new node ids. New ids must be unique and must NOT reuse any existing id. If the change is purely behavioral with no new structure, use empty arrays.
- alternatives (1-3): the cleaner or established ways people actually achieve this benefit — this is where you point at how it's really done.
- Be concrete to THIS system; do not answer generically.`,
      user: `SYSTEM: ${doc.meta.system}
ESSENCE: ${doc.essence.text}

INVARIANTS (id: what must never be false):
${invs}

DIAGRAM LANES: ${lanes}

EXISTING DIAGRAM NODES (ids you may connect to):
${nodeList}

REBUILD LAYERS:
${layerList}

PROPOSED CHANGE: ${change}`
    };
  }

  return { BOUNDS, SCHEMA_DOC, text, EXEMPLAR, comparePrompt, askPrompt, whatifPrompt };
})();
