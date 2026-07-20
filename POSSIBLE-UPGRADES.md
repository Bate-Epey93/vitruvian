# Vitruvian — possible upgrades

<!-- Compiled by mining the full build session transcript (129 candidates,
     each verified against the codebase before inclusion). Re-run that audit
     after a long build session to refresh this file. -->

This file collects ideas surfaced during build sessions that were never built, or were only half-built, plus the caveats and dead ends worth remembering. Nothing here is a commitment — it is a place to look when deciding what to do next.

## Open ideas

### Reader & diagram

| Idea | What it would do | Notes / effort |
|---|---|---|
| Tap-to-reveal full labels | Truncated labels currently only reveal via an SVG `<title>` tooltip on nodes — desktop-only, on a mobile-first app. Add a tap affordance, and cover edge labels and sequence-view labels, which have no reveal at all. | Small. `splitLabel()` at renderer-diagram.js:206; sequence truncation at :929 and :947. |
| Intermediate reader breakpoint | Between 860px and desktop the reader drops straight to a single column, so small laptops and tablets lose the side-by-side layout entirely. | Medium. `@media(max-width:860px)` at styles.css:228 (plus 705, 972, 1292). |
| Essence line + true SVG export on the share card | PNG export ships, but the footer carries only the system name and site URL, and there is no `.svg` download — the serialised SVG is just an intermediate for canvas rasterising. | Small. `exportDiagramPNG()` at engine.js:735-790. |
| Better label placement than a 13-sample scan | The placer samples ±30px in 5px steps and picks the least-overlapping slot; on a dense diagram a marginal contact is still possible, and v1.19.0 narrowed the window further. | Medium. renderer-diagram.js:360-381. Would need a real routing pass, not more samples. |
| Fuzz harness for extreme-but-valid documents | Generate max-node, single-lane, longest-label, empty-diff and top-to-bottom-edge documents to set renderer capacity bounds empirically rather than by review. | Medium, and the host page is gone — the standalone diagram test page no longer exists in the repo. |

### Generation & schema

| Idea | What it would do | Notes / effort |
|---|---|---|
| Hostile corpus of 10–12 diverse systems | A real generality test (power grid, DNS, peer review, hospital triage, card payments, "the internet") rather than three hand-authored flagships passing the validator. | Medium-large. `flagships/` holds only railway/whatsapp/youtube; tools/validate.js defaults to that directory. |
| Backfill path for old Deconstructs | `at_scale`, `developer.approach` and `vocab` are strict-required on generation but optional on import, so pre-existing studies open without the Under-load band, the Start-here line, or any chips — with no way to fix them short of regenerating. | Medium. schema.js:172-175, 187-190, 191-197. An on-demand Probe-style tagging call was proposed and never built. |
| Cross-check `software_only` against `meta.domain` | Technology tags are gated to software by prompt instruction only; the validator never checks it, so a misbehaving generation would pass. | Small. skill.js:139 states the rule; schema.js has no corresponding check. |
| Quantified capacity, not prose | The Under-load band answers scale in words, with a shared generic NUMBERS_LIBRARY beneath it — the "a million users a second" question is still narrative rather than modelled per system. | Large, and content-heavy. renderer-doc.js:516-545. |

### Vocabulary & transfer

| Idea | What it would do | Notes / effort |
|---|---|---|
| Second deep vocabulary tier for one non-software domain | Only software has the 52-entry pattern/concept/technology library; every other domain gets short Rosetta translations. Deferred until a domain earns it on evidence of an audience. | Large, and needs the user's subject review. |
| Fill the two unmapped models | `first-principles` and `inversion` map to no vocabulary entries, so the ladder is structurally short on layers driven by them. Rosetta translations do exist for both, so this may be correct as-is. | Small if pursued; arguably not a defect. |

### Growth & commercial

| Idea | What it would do | Notes / effort |
|---|---|---|
| Keyless generation behind a managed proxy | Everything except the three precached flagships needs the user's own Anthropic key. The marketing guide names BYOK the mainstream-buyer blocker; the proxy it prescribes does not exist. | Large — it is the "no backend" non-goal being reversed. generator.js:35-38, storage.js:22. |
| Execute the 90-day launch plan | The plan is written (personas, competitor table, $72/yr pricing, Seed/Beta/Launch arc at marketing/build-guide.js:238-242) but nothing has shipped against it: no waitlist, no lead magnet, no audience channel. | Effort is the user's, not the code's. |
| SEO surface for the flagships | Meta tags and three share pages exist; missing entirely are robots.txt, sitemap.xml, canonical tags and long-form indexable "how X actually works" pages — the channel the plan calls the content mine. | Medium. tools/build-share-pages.js is the natural place to extend. |
| Paid trademark clearance before charging | The 2026-07 scan found Vitruvian marks in PE, fitness and telecom — low risk for a free app, explicitly needing re-verification before commercial distribution. Fallback noted: "Vitruvian Systems". | External cost. build-guide.js:132, :270. |
| Public gallery / community sharing | Deferred as a v1 non-goal but the export format was designed to allow it. Share pages exist for the three built-in flagships only, not user Deconstructs. The marketing guide never mentions it as a channel, so this has gone quiet rather than advanced. | Large; needs a backend, so blocked behind the proxy decision. |
| Non-engineer positioning to match the Rosetta | The Rosetta spine was placed outside the Developer box specifically so marketers and ops readers see it, but all three marketing personas are engineer-shaped. | Copy work, no code. |
| Share the release-log artifact | The branded timeline is published and current (through v1.21.0) but still private; sharing is a user-side action in the page menu. | Trivial, user-side. |

### Platform & infrastructure

| Idea | What it would do | Notes / effort |
|---|---|---|
| Adversarial review as a standing pre-deploy gate | Recommended while the engine is still moving, citing its hit rate (10 findings one round, 1 the next). Run ad hoc and repeatedly cut short by session limits; never formalised. There is no workflows directory, hook or review script. | Medium. Two review dimensions — dark-contrast and scroll-diagram — died mid-run and were never machine-verified, though later manual work covered both areas. |
| Reproducible contrast audit | The v1.18.1 WCAG sweep was a one-off manual pass; no contrast tooling exists in the repo, so it cannot be re-run on the next palette change. Any script also needs to handle its own blind spot: it cannot see through translucent glass or gradients and will false-positive on them. | Medium. |
| Automate the version lockstep | CHANGELOG.md, `CONFIG.appVersion` (content.js:27) and `CACHE_VERSION` (sw.js:1) are hand-synced every deploy, and the release-log artifact lives outside the repo entirely. A standing drift risk. | Small script; would close a recurring manual step. |
| Rename the local folder | Working directory is still `My Builds/system-deconstructor` while the remote is `vitruvian`. Note the IndexedDB key `system_deconstructor_v1` must not cascade — it is pinned deliberately. | Trivial, but check nothing references the path. |
| Recover the missing source documents | The v2 skill doc and three flagship markdowns were never exported into a `docs/` folder; the build proceeded without them and the flagships were authored fresh. There is still no `docs/` directory. | Small, if the originals can be found at all. |
| Redirect from the dead old URL | The rename broke the previous Pages URL; anyone who installed from it must reinstall. No redirect shim or old-path stub exists. | Small, if the old repo name can be reclaimed. |
| Install `gh` for deploy visibility | Pages once sat on a stale version for ~20 minutes with no way to inspect the build log from the CLI. Still unfixed. | Trivial. |
| Reference-grade changelog | An option for full per-feature detail with gotchas and the reasoning behind each decision. CHANGELOG.md is currently ~8 lines per release; rationale appears only in the v1.20.0/v1.21.0 Changed sections. | Large, ongoing. Milestone-only grouping was the other option offered and was not chosen. |

## Known limitations

- Broad systems (Google, the economy) are narrowed to one declared slice rather than covered whole — the narrowing is surfaced to the reader by design.
- Hard caps force abstraction over density: ≤5 lanes, ≤22 nodes, ≤2 per grid cell, 24-char node labels, 16-char edge labels, 3 vocabulary tags per layer.
- Content quality for an arbitrary system cannot be guaranteed — validation only promises that what passes renders legibly; substance is the skill's job.
- The written breakdown is the product and the diagram an enhancement; failure paths (one repair call, then raw-text download) exist so the document is never lost.
- Wide diagrams are panned, not reflowed or scaled — mitigated by pinch-zoom, a fit-width floor and follow-the-story auto-pan, but never squeezed to fit a phone.
- Edge labels still crowd near the control lane on the densest flagship; the Manhattan-with-crossings routing is the accepted v1 tradeoff, and YouTube has since grown to 18 nodes / 27 edges.
- The brand tagline is hidden while reading, to reclaim ~450px for the audience switch.
- Service-worker fixes reach installed copies only after the Update-ready prompt or a relaunch — inherent to a cache-first PWA.
- Flagship re-seeding is version-gated and all-or-nothing: a partial fetch failure retries the whole set rather than stranding one study.
- The landing page auto-shows once; afterwards Settings carries a primary entry point, but the library-footer "About Vitruvian" button remains the weak original affordance.
- Rosetta translations are deliberately sparse — a model with no honest term in a domain is omitted rather than invented (97 of 98 possible terms).
- Layers with no genuine vocabulary match ship untagged rather than mislabelled; technology tags never attach to non-software systems.
- `meta.domain` is a single value, so a hybrid system like YouTube has one "called here" answer where several would be valid.
- Generation, AI-compare and Probe all require the user's own API key; only the three precached flagships work fully offline.
- Probe is one bounded question per layer, not freeform chat. Accounts, cloud sync, in-app editing and any backend remain unbuilt v1 non-goals.

## Explicitly declined

- **Per-domain vocabulary libraries** — unbounded to curate and ages badly outside software; the Rosetta spine was chosen instead.
- **Merging the imported patterns into the 14 thinking models** — different altitudes; kept as separate labelled tiers chained by the ladder.
- **Keeping cross-domain names inside the For Engineers box** — would hide the feature from the non-engineers it exists for.
- **Positioning Vitruvian as interview prep** — competing head-on with a better-resourced brand; vocabulary stays an index and bridge, never the product.
- **Technical-spec / developer Markdown export** — cancelled mid-build; the developer framing was context for better commentary, not a request for an export button. Do not resurrect.
- **Layer-strata diagram colouring** — retired so colour has one meaning only (lane).
- **Challenge-mode gates as the default** — the full deconstruct must show immediately; gates are opt-in per study or via Settings.
- **The landing lede sentence** ("You don't read a description…") — deleted on request, not to be reinstated.
- **Old tagline "rebuild it to understand it" and heading "Start With These — They're the Bar"** — replaced. (The stale `<title>` this audit caught was fixed in v1.21.1.)
- **Generic emoji icons on landing cards** — replaced with generated enso brush icons.
- **Name candidates Kata, Strata, Teardown, The Anatomist** — all declined; Vitruvian was the user's own choice and is trademark-checked for non-commercial use.
- **A dedicated foldable "Also known as" band per layer** — the layer is already dense; the Rosetta lives on the thinking-model card instead.
- **Vocabulary "chips only" minimal slice** and **staying faithful to the source's ~28 terms** — the full build with index and ladder, and the extended 52-entry library, were chosen instead.
- **"Gloss only", "enso only" and full glassmorphism finishes** — wet-ink gloss plus enso was chosen. Worth noting the glass treatment Claude flagged as not-recommended has since largely arrived anyway (v1.5.0, v1.18.0), so the original warm-paper-versus-glass concern was overtaken rather than resolved.

---

_Last compiled at v1.21.0, 2026-07-19._
