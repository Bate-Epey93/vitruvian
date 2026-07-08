/* ═══════════════════════════════════════════════════════════════
   SYSTEM DECONSTRUCTOR — CONTENT LAYER
   ───────────────────────────────────────────────────────────────
   Branding (CONFIG), the thinking-model library (MODEL_LIBRARY),
   and UI copy (COPY). The engine never contains copy; this file
   never contains rendering, storage, or generation logic.

   FORK CHECKLIST — same discipline as UX-First Studio:
   1. Copy the whole folder.
   2. Edit CONFIG (name, tagline, accent trio, storageKey — or
      saved data collides between forks on the same origin).
   3. Edit manifest.webmanifest (name, colors) + regenerate icons.
   4. Bump CACHE_VERSION in sw.js on EVERY deploy.
   ═══════════════════════════════════════════════════════════════ */

/* ---------- CONFIG ---------- */
var CONFIG = {
  toolName: "System·Deconstructor",     // "·" renders as the accent dot
  tagline:  "Rebuild it to understand it",
  accent:     "#0e7a63",
  accentDeep: "#0a5748",
  accentWash: "#e2f0ec",
  failure:    "#c22f2f",
  money:      "#9a6212",
  storageKey: "system_deconstructor_v1",
  appVersion: "1.0.0"
};

/* ---------- MODEL_LIBRARY · the 14 thinking models ----------
   Every layer's problem names exactly one of these. Their ids are
   the contract between generated documents, the validator, and
   the cross-system Models index. Do not rename ids casually —
   saved breakdowns reference them forever. */
var MODEL_LIBRARY = [
  {
    id: "first-principles",
    name: "First Principles",
    one_liner: "Strip every assumption; rebuild from what must be true.",
    description: "Take the problem apart until you reach facts that cannot be argued with, then build the solution up from only those. Most designs inherit assumptions from their predecessors; first-principles thinking asks which inherited beliefs are actually load-bearing — and deletes the rest. The railway's block system was born this way: safety requires knowing a track is empty, not assuming it after enough time has passed."
  },
  {
    id: "inversion",
    name: "Inversion",
    one_liner: "Design by asking how it would fail, then make that impossible.",
    description: "Instead of asking 'how do I make this work?', enumerate the ways it could go wrong and design each one out. Interlocking frames, checklists, and type systems are all inversion at work: list the conflicting moves, then make them mechanically unexpressible rather than merely forbidden."
  },
  {
    id: "bottleneck",
    name: "Bottleneck Analysis",
    one_liner: "Find the one constraint that governs the whole system's throughput.",
    description: "Every system has a narrowest point, and the system as a whole cannot go faster than it. Optimizing anywhere else is invisible. Find the bottleneck, widen it or route around it, then find the new one — because there is always a new one."
  },
  {
    id: "feedback-loop",
    name: "Feedback Loops",
    one_liner: "Feed the output back as input; the loop stabilizes or amplifies.",
    description: "A system that senses its own state can correct it (negative feedback: thermostats, track circuits) or runaway-amplify it (positive feedback: viral sharing, bank runs). Ask what the system measures about itself, how fast that signal travels, and whether the loop damps errors or compounds them."
  },
  {
    id: "single-source-of-truth",
    name: "Single Source of Truth",
    one_liner: "One authoritative record; everything else is a copy that can be wrong.",
    description: "When two records can disagree, one of them is lying and the system must decide which. Designating a single authoritative source turns conflict resolution into a lookup. Timetables, land registries, and primary databases all answer the same question: when copies diverge, who wins?"
  },
  {
    id: "mutual-exclusion",
    name: "Mutual Exclusion",
    one_liner: "One-at-a-time access enforced by possession, not politeness.",
    description: "When a shared resource can only safely serve one user at a time, etiquette is not enforcement. Make permission a thing that can be held — a token, a lock, a lease — so that uniqueness is physical, not behavioral. Two people cannot hold one brass key."
  },
  {
    id: "queue-and-buffer",
    name: "Queues & Buffers",
    one_liner: "Decouple producers from consumers; absorb bursts with waiting room.",
    description: "When arrivals are bursty and service is steady, something must give: either arrivals are rejected or they wait. A buffer converts a rate mismatch into latency instead of loss. The follow-up questions are always the same: how long can the queue grow, what happens when it's full, and who waits?"
  },
  {
    id: "redundancy",
    name: "Redundancy & Failover",
    one_liner: "No single point of failure; spares that take over when parts die.",
    description: "Any component will eventually fail; the design question is whether the system fails with it. Redundancy buys survival with duplication — spare parts, second paths, replicas — and introduces its own hard problem: detecting failure and switching over without making things worse."
  },
  {
    id: "separation-of-concerns",
    name: "Separation of Concerns",
    one_liner: "Split responsibilities so parts can change without breaking each other.",
    description: "Bundle unrelated responsibilities together and every change risks everything at once. Separate them behind clear boundaries and each part can evolve, fail, and scale on its own. The boundary is the design: what one side promises the other is the system's real architecture."
  },
  {
    id: "trust-boundary",
    name: "Trust Boundaries",
    one_liner: "Decide where verification happens; never trust across the line.",
    description: "Every system has lines where data or people cross from 'unverified' to 'trusted'. Security failures are almost always a crossing that skipped its checkpoint. Draw the boundaries explicitly, verify at each crossing, and assume everything outside is hostile — not because it is, but because you can't tell."
  },
  {
    id: "incentive-alignment",
    name: "Incentive Alignment",
    one_liner: "Make the selfish choice and the correct choice the same choice.",
    description: "Systems run by people do what the incentives reward, not what the rules say. If the profitable action and the intended action diverge, the system drifts toward profit. Durable designs make honest behavior the cheapest path — aligning what actors want with what the system needs."
  },
  {
    id: "graceful-degradation",
    name: "Graceful Degradation",
    one_liner: "Partial failure yields reduced service, not collapse.",
    description: "The question is never whether parts fail but what the whole does when they do. Fail-safe defaults (a dead signal shows red; released brakes engage) choose the harmless state when knowledge is lost. Degrading gracefully means the system keeps serving — slower, dumber, safer — instead of stopping."
  },
  {
    id: "locality-and-caching",
    name: "Locality & Caching",
    one_liner: "Put copies near demand; pay for speed with staleness.",
    description: "Distance is latency, and most demand is concentrated and repetitive. Keeping copies close to where they're wanted converts far, slow, expensive reads into near, fast, cheap ones. The bill arrives as staleness: every cache is a bet that the original hasn't changed since you copied it."
  },
  {
    id: "idempotency",
    name: "Idempotency",
    one_liner: "Safe retries: doing it twice equals doing it once.",
    description: "Unreliable channels force a brutal choice — retry and risk duplicates, or don't and risk loss. Idempotent operations dissolve the dilemma: design the action so repeating it changes nothing, and retries become free. Message ids, payment ids, and 'set' instead of 'increment' are all the same move."
  }
];

/* ---------- UI COPY ---------- */
var COPY = {
  libraryTitle: "Library",
  libraryFlagshipNote: "Start with these — they're the bar.",
  deconstructPlaceholder: "Name a system to deconstruct…",
  deconstructBtn: "Deconstruct",
  audienceModes: [
    { id: "beginner",   label: "Beginner" },
    { id: "enthusiast", label: "Enthusiast" },
    { id: "developer",  label: "Developer" }
  ],
  gateKicker: "Before the reveal — your turn",
  gateHint1: "Show the thinking model",
  gateHint2: "One more hint",
  gateReveal: "Reveal the solution",
  gateCompare: "Compare my answer (AI)",
  gateCompareOffline: "AI comparison needs a connection and an API key (Settings). Your answer is saved — compare it yourself against the reveal.",
  keyNotice: "Your key is stored on this device only and sent only to Anthropic.",
  costNote: "A breakdown typically costs a few cents to a few tens of cents of API usage, depending on the model.",
  pricingUrl: "https://www.anthropic.com/pricing",
  privacyNote: "Everything lives on this device. Breakdowns, attempts, and your key are never sent anywhere except your own calls to Anthropic.",
  offlineGenNote: "Generation needs a connection. Reading never does.",
  bridgeToast: "Reference notes copied — paste into UX-First Studio's Structure It station.",
  studioUrl: "https://bate-epey93.github.io/uxfirst-studio/",
  genPhases: {
    start:      "Reading the system…",
    strip_down: "Stripping it down…",
    visual:     "Drawing the baseline…",
    layers:     "Rebuilding — layer by layer…",
    stress:     "Stress-testing…",
    transfer:   "Extracting principles…"
  }
};
