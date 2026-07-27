# Changelog

All notable changes to **Vitruvian** — a zero-backend, installable PWA that deconstructs any system into a failure-driven, layer-by-layer rebuild with a growing diagram.

Live at <https://bate-epey93.github.io/vitruvian/>. The format follows [Keep a Changelog](https://keepachangelog.com/); this project versions the app (`CONFIG.appVersion`) and the service-worker cache (`CACHE_VERSION`) together, bumped on every deploy.

## [1.35.0] — 2026-07-27 · Some subjects are also machines
### Added
- **A Deconstruct whose subject exists as a field study now says so.** Open one and the offer sits between the essence and the failure ladder — after you know what the system is, before the argument starts, because it is a second way through the same argument rather than a detour out of it. Matching Deconstructs also carry a **3D study** chip in the library.
- The match is on unambiguous phrases only. Bare "transmission" is also what TCP does and "gear" alone catches half the industrial world, so neither qualifies; "manual transmission", "gearbox", "synchromesh" and their kin do. Verified against the false-positive cases that matter — *TCP data transmission*, *video transcoding* and *gear pump* all correctly decline.
- Only **built** studies are registered. An offer to open something that does not exist is worse than no offer, so the registry in `content.js` carries what ships and nothing else; the Field studies section of the library now renders from it rather than from a hardcoded card.
- `lab/CANDIDATES.md` — the systems worth building next, judged against what the engine can actually draw and what makes a mechanism worth drawing at all. Twelve strong candidates, seven reachable with hand-built geometry, and a list of what is deliberately out of scope, of which the first line is every software system in the library: a message queue has no axis of revolution, and 3D would buy occlusion at the cost of legibility.

## [1.34.0] — 2026-07-27 · The shell, separated from the machine
### Changed
- **A field study is now four files and a mount call.** The walkthrough, demo transport, stage toggles, camera, theme and accessibility plumbing moved out of the gearbox page into `lab/lab-page.js`, which knows nothing about any mechanism. A study supplies a copy object and a scene module; whatever readouts its machine needs — a gauge, a selector gate — it supplies as its own instruments, and the shell gives them a place to live and a frame to paint on. The gearbox page keeps only what is actually about a gearbox and drops from 428 lines to 166.
- Two boundaries moved to where the knowledge is. Putting the machine where a demo starts is something only the machine knows, so the shell now hands a layer's demo block over untouched instead of reaching into its state. And the third stage toggle is declared by the copy — its label and the two scene modes it flips — rather than the shell knowing what "1930 mode" means.
- Prose stranded in the page file — the four card headings, the free-shift note, the list of phases that count as failures, the stage hint — moved to the copy file, which is where this project keeps prose. Nothing visible changed: all twelve layer and mode combinations, gate enablement, and both replay outcomes verified identical to before the split.

## [1.33.0] — 2026-07-27 · Sweep: the shapes a lathe cannot make
### Added
- **`Ink3D.sweep(profile, path)`** — runs a closed 2D section along an arbitrary 3D path. Between them, `revolve` and `prism` cover solids of revolution and constant-section extrusions; everything else a machine is made of lives here — springs, threads, chains, belts, hoses, and blades that taper and twist. The section frame is parallel-transported rather than rebuilt from a fixed up-vector, so a path that turns through vertical does not flip the section inside out halfway along; on a closed path the residual the frame fails to close by is measured and spread over the loop, so the seam meets itself. Options for closing the loop, total twist, per-station taper, and open ends. `Ink3D.helixPath` supplies the path a coil spring or a thread runs on.
- Verified closed and manifold on straight, helical, half-turn and closed-loop paths: zero open edges, zero non-manifold edges, every wall normal facing outward and both end caps facing along the path.

### Fixed
- **A part that crosses the cut plane more than once now sections correctly.** Every hub, sleeve and clutch body cut through its axis exposes two rings, one either side of the shaft; they were being filled as a single even-odd path at one averaged depth, so rings that overlapped on screen cancelled each other into holes and the whole group sorted at the wrong distance. Each ring now carries its own depth, and a ring enclosed by another is punched out of it as its bore rather than drawn as a second face.

## [1.32.0] — 2026-07-27 · Field studies: a gearbox you can turn over
### Added
- **The Gear Change** — the first field study, at `lab/transmission.html`. A five-speed manual gearbox drawn in three dimensions, walked through the same failure ladder the rest of the library uses: sliding-gear crash box → constant mesh and dog clutches → synchromesh → selector interlock → reverse, the deliberate throwback → the whole shift, shiftable yourself through a live H-gate.
- **Ink3D** (`lab/ink3d.js`) — a ~700-line 3D engine written for this and nothing else. Canvas 2D, painter-sorted, three quantised paper washes with diagonal hatching on the darkest and ink outlines over the top: a technical plate rather than a render. Colours come from the app's own custom properties, so dark mode costs nothing. No library, no CDN, no build step — the page loads under the same `script-src 'self'` as everything else.
- **The gears actually mesh.** Only the input shaft and the mainshaft carry an integrated angle; every other gear's angle is derived from the gear driving it, so the train cannot drift out of phase no matter how long it runs. Verified by sweeping all seven meshes for polygon interference: zero clashes, ~0.8 units of visible backlash throughout.
- **Cutaway is a real section, not a hidden half.** The plane clips each polygon where it crosses, the crossing segments stitch back into rings, and those rings are filled and hatched — so a sliced shaft reads as solid metal with the far wall visible behind it, and the cut edge is a straight line instead of a sawtooth of dropped faces. Neighbouring parts get opposite hatch angles, the way a drawn section distinguishes them, and while the cut is open hatching means one thing only: the plane passes through here.
- **Exploded opens the stack the way it was assembled** — along the shaft first, so assembly order is legible, then off the shaft by how deep in the stack each part sits. The shafts hold still, the countershaft train drops clear of the mainshaft, and the reverse idler leaves along its own centre line, the one direction that clears both.
- **1930 mode takes the synchromesh out rather than describing its absence.** The blocker rings leave the bench, and any synchronised shift on any layer becomes the shift that preceded them: dogs meeting at different speeds, a clash, and the lever back where it started. It is the reader's setting, so it survives walking between layers.
- Reduced motion is a first-class path, not a fallback: nothing autoplays, and the scrubber drives the identical timeline the animation does.

## [1.31.0] — 2026-07-26 · Leader lines: no label left in the scrum
### Changed
- **A label with nowhere to sit now moves out to clear paper and runs a hairline back to the edge it names.** Before, a crowded label had two options: overlap something, or truncate. It has a third now, and it's the better one — a whole label parked in the margin beats a shortened one in the middle of the traffic.
- Truncation is still there as the last resort, but it no longer fires anywhere in the library. **Every edge label in every sample now renders in full.**
- Measured across the same 19 systems, 130 layer states and 1282 labels as the previous two passes: labels buried under another label **6 → 0**, labels behind a node box **12 → 3**, truncated labels **15 → 0**, affected layer states **12 → 3**. 32 labels use a leader. Against the original baseline three versions ago, that is 51 → 0 and 28 → 3.

## [1.30.0] — 2026-07-26 · The spine, and what would take it out
### Added
- **⌁ spine — the critical path.** One tap traces the heaviest chain of payload edges from an entry to a delivery: what a request actually waits on. Everything off it dims, because shortening anything off the spine changes nothing. Structural, so it reads standing still, on any layer, and it survives the PNG export.
- **Single points of failure.** Nodes whose removal leaves no entry able to reach any delivery get a red ring. Slow and fatal are different facts, so they get different marks. Pure reachability, tested by removal rather than approximated — the railway's chokepoint is the shared track, which is the whole story of that system in one ring.
- **What the layers cost.** The toast reports the spine against layer 0: YouTube's request path ends up 2.9× the cost it started at, recommendation feed 3.2×. Every layer added to survive a failure also added something the request has to wait for, and until now nothing in the app said so out loud.
- Weights come from the same per-kind costs the Pulse simulation uses, so the spine explains the animation rather than contradicting it. They are modelled, not measured, so the readout stays unitless — printing milliseconds nobody measured would be the one dishonest thing this could do.

## [1.29.0] — 2026-07-25 · Each kind moves load its own way
### Added
- **Per-kind flow physics.** Every token used to behave identically no matter what it passed through, which made the four kinds decorative. Now each one moves load its own way:
  - **actor** *emits* — arrivals come in bursts, not on a metronome. Smooth arrivals at the same average rate would never form a queue.
  - **store** *retains* — a write lands and ends there, raising a fill meter on the box; what leaves a store is a read, served back out on its own cadence. A store now visibly buffers between a fast writer and a slow reader. A full store drops the write, and drops it visibly.
  - **process** *transforms* — costs time. The token dwells at the node before departing.
  - **channel** *conveys* — has capacity, so it bunches a token sooner than anything else does.

## [1.28.0] — 2026-07-25 · Payloads that carry their origin, and jams that travel
### Added
- **A payload takes the shape of what emitted it.** Colour still says *where* a token came from (its source's lane); shape now says *what* — circle from an actor, square from a store, diamond from a process, capsule from a channel, mirroring the node glyphs. Colour was already carrying the lane legend, so tinting tokens by kind would have put two colour languages in one frame; shape was free. Only the arrowhead rotates to the path now, so a square never reads as a diamond.
- **Backpressure.** Congestion was local: one edge, one colour. A node taking on more than it can clear now pushes resistance *backward* — the edges feeding it stiffen into a red marching jam and their tokens slow, two hops upstream. Killing a node backs up everything behind it the same way. This is why one slow component browns out everything upstream of it, and it was previously invisible.
- Legend gains a backpressure key and a note that payloads carry their source's shape.

## [1.27.0] — 2026-07-25 · Labels that stop hiding, and hover to isolate
### Fixed
- **Edge labels no longer bury each other.** The placer only searched vertically at a fixed midpoint, so two edges meeting near the same point had nowhere to go — and burying one label under another was priced at a quarter of what hiding behind a node cost, so the placer often chose it. Labels now search in two dimensions, sampling candidate positions along the edge they name, and a collision with a sibling label costs nearly as much as a collision with a box. Where no clear slot exists at all, the label truncates and keeps its full text on hover rather than drawing something unreadable.
- Measured across the whole library — 19 systems, 130 layer states, 1282 labels: labels buried under another label fell from **51 to 6**, labels behind a node box from **28 to 12**, and affected layer states from **39 to 12**. 15 labels now truncate.
### Added
- **Hover to isolate.** On a pointer that can hover, passing over a node lights it and every edge touching it and drops the rest back — "what talks to this?" without committing to a click. Touch keeps tap-to-trace; an explicit click-trace outranks the hover preview.

## [1.26.0] — 2026-07-25 · Opus 5, and cards that carry their own colour
### Changed
- **Opus 5 is the default model.** Sonnet 5 retired from the presets. One source of truth (`CONFIG.defaultModel`) now feeds Settings, the storage seed, and the reset fallback, so there is one place to change it next time.
- **Opus 4.8 catches the declines.** Fable 5 and Opus 5 both run safety classifiers that can decline a benign request; both now send `fallbacks: "default"`, which reruns the request on Anthropic's recommended substitute (cyber declines route to Opus 4.8) in the same round trip.
- **Tinted cards are tinted all the way through.** "The purpose", the invariant (INV) items, and generation errors were accent-coloured on one edge only; they now carry the colour across the whole card as a light liquid-gloss wash, matching the problem, solution, gate, and scale cards. Text contrast checked in both themes.

## [1.25.0] — 2026-07-20 · Batch 3: the canonical products
### Added
- Six more worked Deconstructs — **Rate limiter, Search typeahead, Ride matching, Ticket booking, Payment ledger, Photo store** — the first six of the ten canonical interview products. The library reaches 19.
- Each drills into the primitives it's built from (e.g. Ticket booking → Distributed cache, Message queue; Photo store → Object storage, CDN, News feed), all resolving offline.
### Notes
- Four of the batch (real-time chat, web crawler, job scheduler, collaborative editor) hit an authoring session limit and will land in a follow-up; the six that passed validation ship now.

## [1.24.0] — 2026-07-20 · The Track, progress, and shareable Pulse
### Added
- **The Track** — a curated screen that walks the sample library as an ordered path (foundations first, then the systems built on them), with per-system completion. A study plan, not a toy box.
- **Progress you can carry** — the Track shows systems done, thinking models collected, and gates earned, plus a one-tap **branded progress card** (PNG) to share.
- **Pulse as a GIF** — a ⚏ button records a few seconds of the running simulation as a looping GIF, encoded in-browser (self-contained GIF89a/LZW, no dependencies).
- Five infrastructure-primitive Deconstructs — **Distributed cache, Object storage, Message queue, Notification system, Unique ID generator** — the second batch of the canonical set. The library reaches 13.
### Changed
- Every drill target in the library now resolves to a real nested Deconstruct offline: the primitives are exactly the ⊕ badges the product studies pointed at.

## [1.23.0] — 2026-07-20 · The library grows
### Added
- Five new worked Deconstructs, the first batch of the canonical interview set: **Video transcoding pipeline**, **Content delivery network**, **Recommendation feed**, **News feed**, and **URL shortener**. The sample library goes from 3 to 8.
- These give semantic zoom real depth: **YouTube now drills into three nested Deconstructs** (transcoding, CDN, recommendation feed), all resolving offline.
### Changed
- Library ordered so the richest hub (YouTube) leads; all eight precached for offline reading and given share pages.

---

## [1.21.1] — 2026-07-19
### Fixed
- The browser tab still carried the retired tagline (`<title>Vitruvian · Rebuild it to understand it</title>`); now matches the current one. Caught by the backlog audit.
### Added
- `POSSIBLE-UPGRADES.md` — deferred ideas, known limitations, and explicitly declined directions, compiled by mining the build session and verifying each candidate against the code.

## [1.21.0] — 2026-07-19 · The Rosetta spine
### Added
- **"Also called"** on every layer's thinking-model card: the same force in each profession's words. 97 translations across 7 domains (software, marketing, operations, living systems, markets & money, machines, institutions) hung off the 14 thinking models.
- `meta.domain` — the system's field, which decides whose word is shown first. Optional: documents without it show every domain, none marked "here".
### Changed
- Deliberately **not** a vocabulary per domain. Building parallel pattern/concept/technology libraries for six fields would be unbounded to curate, would age badly outside software, and would force a domain label onto hybrid systems. Translating the spine we already have is bounded (14 × 7), cannot mislabel, and makes transfer bidirectional — a marketer learns that frequency capping *is* rate limiting; an engineer learns that attribution *is* telemetry.
- Costs the generator nothing: a layer already names its model, so both "called here" and "called elsewhere" derive from existing fields.
- The Rosetta sits on the model card, visible in **all three registers** — the software vocabulary stays in the Developer-only For Engineers box, since a marketer reading a campaign never opens Developer mode.
- Translations are sparse by design: a model with no honest term in a domain is omitted rather than invented.

## [1.20.0] — 2026-07-19 · The engineering vocabulary
### Added
- **`VOCAB_LIBRARY`** — 52 curated entries in three tiers: **patterns** (problem shapes), **concepts** (mechanisms), **technologies** (things you deploy). Deliberately a *separate altitude* from the 14 thinking models: a model is why a layer is forced, the vocabulary is what the profession calls it.
- **"Known as" chips** in the For Engineers box (Developer mode), tagged per layer by the generator from a fixed id list — never free text.
- **The ladder** — tap a chip to climb from the timeless thinking model that forces the layer, down through concept and technology to the component you'd deploy, plus **where the same force recurs across your other Deconstructs**.
- **Vocabulary index screen**, sibling to Models, with tier filters and per-entry recurrence counts.
- **"Not yet addressed"** — Dissect (own-design) reviews now name the concerns your description hasn't answered, each with a specific consequence and rough timing (`design_gaps`).
- **Numbers to reason with** — latency/throughput/size orders of magnitude, folded into the Under load band where the scaling question is already being asked.
### Changed
- Technology tags are gated to systems that are actually software — a railway may be described with patterns and concepts as honest analogies, but never with a technology. Layers with no honest match are left untagged rather than mislabeled.
- All three flagships retrofitted with vocabulary tags (`flagshipVersion` 5 re-seeds existing installs, attempts preserved).

## [1.22.0] — 2026-07-20 · Semantic zoom
### Added
- **Nested Deconstructs.** A node that is a system in its own right now carries a ⊕ badge; tapping it opens that sub-system as its own Deconstruct, with a breadcrumb (System › Sub-system) to climb back up. Depth comes from nesting, not from crowding a single diagram, so every level stays a clean, comparable rebuild.
- Optional `visual.nodes[].expands_to` in the schema (lenient); generation may mark 2–3 genuine sub-systems per study.
- YouTube's transcoder, CDN and ranking nodes are tagged; drilling resolves to a matching library Deconstruct, or offers to generate one.

## [1.19.0] — 2026-07-19 · Simulation & diagram polish
### Added
- Payload tokens now carry a small **directional arrowhead** that rotates to the path tangent — extra at-a-glance cue for which way flow moves.
### Fixed
- **Stray "shadowy line"** during a pulse — the ink-trail's teleport branch only cleared one coordinate, leaving a segment that streaked from the origin across the diagram. The whole trail now hides on a hop/first frame.
- **Arrowheads detaching at node entries** — the chevron's concave notched tail left a gap where the thin edge line met it; replaced with a solid triangle that overlaps the line.
### Changed
- Edge labels search a tighter vertical window with a firmer pull toward their edge, so a label stays pinned to what it names instead of drifting into space.
- Crash/exit burst re-homed onto the token's inner dot so it still animates cleanly with the new arrow group.

## [1.18.1] — 2026-07-19 · Dark-mode legibility
### Fixed
- **For Engineers box** used `color: var(--paper)` (and the software-concept column too); `--paper` flips near-black in dark theme, so that text was invisible. Pinned the always-dark dev box to fixed light text.
- Retired `--faint` as a **text** colour in dark (it's a border tone) — the "Defends" labels, invariant text, footnotes, and legend note lift to `--muted`.
- White/`--paper`-on-mid-teal contrast failures fixed: dark text on the teal invariant badge and active audience segment; the segmented `.on` pill and its hover no longer use theme-flipping colours.
### Changed
- Dark palette lifted for warmth and contrast (`--ink`, `--ink-soft`, `--muted`); amber card text (analogy, gate hint, Under load) lifted to a legible gold.
- Verified with a WCAG contrast sweep across reader, settings, drill, library, models, and tutorial; light mode unchanged.

## [1.18.0] — 2026-07-19 · Liquid-glass cards, graded answers, dev "Start here"
### Added
- **Graded challenge answers** — revealing a gate now colour-codes your written answer (pass / close / miss) against the actual solution.
- **"Start here" dev approach** — the For Engineers block suggests a concrete, practical coding approach to tackle the layer's problem.
### Changed
- All reader cards converted to a uniform tinted **liquid-glass** treatment (blur, top sheen, edge highlight) instead of a coloured left stripe on a flat panel.

## [1.17.0] — 2026-07-19 · Topbar tools, challenge at the layer head, diagram fit
### Added
- **Graft** and **Sequence view** promoted from the ⋯ menu to reading-only buttons in the topbar's context zone.
- **Challenge toggle** relocated to the layer head, beside the "Layer 05 / 05" label.
### Fixed
- **Diagram top-clip on desktop** — when zoomed taller than the pane, grid centering pushed the top lane above the scrollable area (hidden under the topbar). Now uses `align-items: safe center`: centred when it fits, top-aligned when it overflows.
### Changed
- Sequence view restyled as a floating liquid-glass card.

## [1.16.1] — 2026-07-19 · Tutorial catches up
### Added
- "How to read a Deconstruct" gains a **Go deeper: simulate & interrogate** section documenting Pulse/replay, fault injection, Live HUD, race spotlight, sequence view, Probe, and Graft; plus "Trace a part" and tappable invariant chips.

## [1.16.0] — 2026-07-19 · Concurrency + behaviour
### Added
- **Race spotlight** (concurrency) — rings every node with two or more concurrent writers and counts the contention points.
- **Sequence view** (behaviour) — the current state rendered as a UML-style interaction timeline: who sends what, top to bottom, in order.
### Changed
- Graft's proposed elements now self-draw in dashed blueprint ink.

## [1.15.0] — 2026-07-18 · Simulation instrumentation
### Added
- **Live HUD** — throughput (delivered/min), in-flight count, and crashes while traffic flows; under load, delivered plateaus while in-flight climbs.
- **Fault injection** — tap any node mid-simulation to kill it; traffic piles up behind it and everything downstream starves.
- **Tappable invariant chips** — tap a "Defends INV n" chip to light the mechanism on the diagram that enforces it.

## [1.14.0] — 2026-07-18 · Pulse story + live Graft
### Added
- **Pulse story pack** — scripted incident replay (two payloads into the historical failure) with ink-splatter crashes, and control-edge gating (tokens pause at a node's door until its permission edge flashes).
- **Live Graft** — A/B the proposal on and off, pulse traffic through the grafted architecture, alternative suggestions, and an enso completion stamp.

## [1.13.1] — 2026-07-17
### Changed
- Request-a-system link hidden pending a submission workflow.

## [1.13.0] — 2026-07-17 · Warmth
### Added
- Branded splash / load screen (brush-enso self-draw).
### Changed
- Copy humanised across the app.

## [1.12.0] — 2026-07-17 · Share infrastructure
### Added
- **Deep links** — `#/study/<slug>` opens a library Deconstruct directly.
- **Share pages** — per-study `share/<slug>.html` with Open Graph / Twitter cards and brand-enso card images, generated by `tools/build-share-pages.js`.
- **Branded diagram PNG export** — the current diagram state exported with the Vitruvian mark and URL footer.
- Root Open Graph tags; "Request a system" issue link (later hidden).

## [1.11.2] — 2026-07-17
### Fixed
- Diff validation now tolerates a layer that explicitly lists edges already cascade-removed with their node — this had rejected valid generations (e.g. a manual-transmission study). Validation errors are now surfaced in the generation error screen.

## [1.11.1] — 2026-07-16 · Landing polish
### Added
- Deconstructed-enso living background on the landing page (exploded arcs, split square, drifting seal; reduced-motion aware).
### Changed
- Tighter landing copy: "Everyday systems, deconstructed one failure at a time."

## [1.11.0] — 2026-07-16 · Deconstruction lexicon + diagram overhaul
### Added
- **Deconstruction lexicon** — one metaphor family: **Deconstruct** (noun), **Dissect** (own-design review), **Graft** (what-if), **Probe** (ask a layer), **Pulse** (flow sim), **The Skeleton** (strip-down).
- **Diagram legibility overhaul** — orthogonal edge routing with ports, deterministic node ordering, delta emphasis (new elements draw in), tap-to-trace a part, and an aesthetic pass (glyphs, arrowheads, label hierarchy).

## [1.10.0] — 2026-07-16 · Claude Fable 5
### Added
- **Claude Fable 5** model preset with an automatic server-side fallback to Opus 4.8 on a classifier refusal, `stop_reason: "refusal"` handling, and a per-model cost guide in Settings.

## [1.9.0] — 2026-07-16 · What-if / Graft
### Added
- **What-if mode** — propose a change and see it ghosted onto the architecture in dashed blueprint ink, with an honest verdict (improves · mixed · harmful) argued from the system's own invariants.

## [1.8.0] — 2026-07-16 · Deconstruct your own design
### Added
- **Design-review mode** — describe a system you're building; Vitruvian rebuilds it failure-by-failure and shows what breaks first (no invented incidents; layers forced by your design's next failure).

## [1.7.0] — 2026-07-16 · Mobile diagram
### Added
- Follow-the-story auto-pan (each layer's changes pan into view), pinch-zoom and double-tap, and a collapsible on-diagram legend.
### Changed
- Topbar reclaims room while reading for the audience switch.

## [1.6.0] — 2026-07-12 · Simulation + Q&A
### Added
- **Flow simulation (Pulse)** — payloads travel the current architecture, crash red where history crashed, and congest under load.
- **Ask-this-layer (Probe)** — one bounded question per layer, answered from that layer's mechanism, saved and offline-readable.

## [1.5.0] — 2026-07-12 · Generation fix + glass
### Fixed
- Generation truncation — `max_tokens` raised to 32k with model-family effort gating, since adaptive thinking shares the output budget on newer models.
### Added
- Speed toggle (balanced / fast), always-visible diagram legend, and an app-wide **liquid glass** material pass.

## [1.4.2] — 2026-07-08
### Fixed
- Under-load path spotlight now toggles off cleanly; strokes thinned.

## [1.4.1] — 2026-07-08 · Tutorial
### Added
- Enso brush icons on the landing cards, a "How to read a study" tutorial/legend screen, and a spotlightable "Under load" path.

## [1.3.4] — 2026-07-08
### Fixed
- Landing page reachable from Settings ("About Vitruvian").

## [1.3.3] — 2026-07-08
### Fixed
- Reader topbar — the tagline no longer overlaps the audience switch.

## [1.3.2] — 2026-07-08
### Fixed
- Mobile layout blow-out — the app grid uses `minmax(0,1fr)` so the diagram can scroll horizontally instead of clipping the viewport.

## [1.3.0] — 2026-07-08 · Under load + spotlight
### Added
- Per-layer **`at_scale`** ("Under load") answering scaling / throughput questions.
- **Card → diagram spotlight** — tap a problem card to red-light what breaks, a solution card to light what's added.
### Changed
- Challenge gates are now **opt-in** (default off); the diagram renders at natural width and colours encode **lane**, not layer.

## [1.2.0] — 2026-07-08 · Landing + theming
### Added
- First-run landing page, light/dark toggle (follows the OS first run), and a home split into "Your Deconstructions" + samples.
### Changed
- Diagram renders at natural width and scrolls when the pane is narrow.

## [1.1.1] — 2026-07-08
### Fixed
- Diagram label occlusion, lane colour-coding, and page scroll.

## [1.1.0] — 2026-07-08 · Depth
### Added
- Layer strata colours, a timeline scrubber, predict-the-break micro-gates, drill mode, wet-ink gloss, and enso completion stamps.
- Renamed **System Deconstructor → Vitruvian** (trademark-checked: existing marks are in unrelated classes).

## [1.0.1] — 2026-07-08
### Fixed
- Ten review findings (flushSaves no-op, stagger overlap, strict-vs-lenient `at_scale` on restore, partial flagship seeding, theme re-apply after restore, and more).

## [1.0.0] — 2026-07-08 · Launch
### Added
- Offline-first reader with three audience registers (Beginner / Enthusiast / Developer).
- Deterministic lane-grid **diagram engine** (no auto-layout): lanes = roles, columns = order, four node kinds, three edge kinds, colour = lane.
- **BYOK generation pipeline** — browser → Anthropic, streamed, schema-validated with one repair loop.
- Three worked flagship Deconstructs (railway, WhatsApp, YouTube); installable PWA with a cache-first service worker.

---

_Vocabulary note: "studies"/"breakdowns" in early versions are the same artifact later unified as **Deconstructs** (v1.11). The IndexedDB storage key (`system_deconstructor_v1`) is retained from launch and never changes._
