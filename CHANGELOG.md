# Changelog

All notable changes to **Vitruvian** — a zero-backend, installable PWA that deconstructs any system into a failure-driven, layer-by-layer rebuild with a growing diagram.

Live at <https://bate-epey93.github.io/vitruvian/>. The format follows [Keep a Changelog](https://keepachangelog.com/); this project versions the app (`CONFIG.appVersion`) and the service-worker cache (`CACHE_VERSION`) together, bumped on every deploy.

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
