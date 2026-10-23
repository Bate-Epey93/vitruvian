#!/usr/bin/env node
/* Vitruvian — Marketing & Commercialization Guide (.docx)
   Enso-branded: EnsoKit palette, brush-ring assets, machine/human motif.
   US Letter, docx (npm). Run: node marketing/build-guide.js */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  ImageRun, PageBreak, LevelFormat, TableOfContents, PageOrientation
} = require("docx");

const DIR = __dirname;
const A = n => fs.readFileSync(path.join(DIR, "assets", n));

/* ── EnsoKit palette ── */
const INK = "211E19", WASHI = "F7F4ED", TEAL = "0E7A63", TEAL_DEEP = "0A5748",
      VERMILLION = "D95B31", MUTED = "8A877D", FAIL = "C22F2F", LINE = "D8D4C8";
const SANS = "Helvetica Neue", MONO = "Courier New";

/* ── helpers ── */
const t = (text, opts = {}) => new TextRun({ text, font: SANS, size: 22, color: INK, ...opts });
const p = (children, opts = {}) => new Paragraph({ children: Array.isArray(children) ? children : [t(children)], spacing: { after: 160, line: 300 }, ...opts });
const kicker = s => new Paragraph({ spacing: { before: 80, after: 60 }, children: [t(s.toUpperCase(), { font: MONO, size: 16, color: MUTED, characterSpacing: 30 })] });
const h1 = s => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, children: [t(s, { size: 44, bold: true, color: INK })] });
const h2 = s => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 100 }, children: [t(s, { size: 30, bold: true, color: TEAL_DEEP })] });
const h3 = s => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 80 }, children: [t(s, { size: 24, bold: true, color: INK })] });
const divider = () => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new ImageRun({ type: "png", data: A("divider.png"), transformation: { width: 480, height: 48 } })] });
const bullets = items => items.map(s => new Paragraph({ numbering: { reference: "bul", level: 0 }, spacing: { after: 100, line: 290 }, children: Array.isArray(s) ? s : [t(s)] }));
const b = (s, o = {}) => t(s, { bold: true, ...o });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

/* vermillion pull-quote / verdict callout (washi cell, vermillion left border) */
function callout(label, lines) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA }, columnWidths: [9360],
    borders: noBorders({ left: { style: BorderStyle.SINGLE, size: 24, color: VERMILLION } }),
    rows: [new TableRow({ children: [new TableCell({
      width: { size: 9360, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: WASHI },
      margins: { top: 160, bottom: 160, left: 240, right: 240 },
      children: [
        new Paragraph({ spacing: { after: 80 }, children: [t(label.toUpperCase(), { font: MONO, size: 15, color: VERMILLION, bold: true, characterSpacing: 25 })] }),
        ...lines.map(l => new Paragraph({ spacing: { after: 60, line: 290 }, children: Array.isArray(l) ? l : [t(l, { size: 22 })] }))
      ]
    })] })]
  });
}
function noBorders(overrides = {}) {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none, ...overrides };
}
/* data table in the app's drafting-table grammar */
function grid(headers, rows, widths) {
  const total = widths.reduce((a, x) => a + x, 0);
  const mk = (cells, head) => new TableRow({ children: cells.map((c, i) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    shading: head ? { type: ShadingType.CLEAR, fill: INK } : (rows.indexOf(cells) % 2 === 1 ? { type: ShadingType.CLEAR, fill: WASHI } : undefined),
    margins: { top: 90, bottom: 90, left: 140, right: 140 },
    borders: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE }, bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 } },
    children: [new Paragraph({ spacing: { after: 0, line: 260 }, children: (Array.isArray(c) ? c : [head
      ? t(String(c), { font: MONO, size: 16, color: WASHI, bold: true, characterSpacing: 20 })
      : t(String(c), { size: 20 })]) })]
  })) });
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, borders: noBorders(), rows: [mk(headers, true), ...rows.map(r => mk(r, false))] });
}

/* ═══ Competitor table — research-verified mid-2026 checkout prices ═══ */
function competitorTable() {
  return grid(["Product", "Free tier", "Real price (2026)", "Positioning"], [
    ["ByteByteGo", "Newsletter + samples", "$189–399/yr · ~$499 lifetime", "Visual all-in-one interview prep; 1M+ newsletter subs"],
    ["Hello Interview", "Full 'In a Hurry' guide", "$79/yr · $279 lifetime", "SD-first guided practice + AI tutor; current community favorite"],
    ["Educative.io", "Trial + few free courses", "$149–249/yr", "1,000+ text-interactive courses incl. Grokking; ~$98M revenue"],
    ["Exponent", "Limited articles, peer mocks", "~$149/yr (list $79/mo)", "Broadest role coverage; mocks + coaching upsell"],
    ["AlgoExpert / SystemsExpert", "Sample questions", "$99–199/yr bundles", "Curated video question bank; fading brand"],
    ["NeetCode Pro", "NeetCode 150 roadmap", "$119/yr · $297 lifetime", "Solo-creator courses; ~1M YouTube subs"],
    ["interviewing.io", "Peer mocks", "$179–339 per session", "Human FAANG mock interviews; the $2k high-touch ceiling"],
    ["Codemia", "Free problem set", "~$59–119/yr", "'LeetCode for system design' — practice with AI feedback"],
    ["SysSimulator · systemdesignsimulator.org", "Everything", "Free (unmonetized)", "The visual/simulation niche today: indie, free, unowned"]
  ], [2000, 2100, 2160, 3100]);
}

/* ═══ DOCUMENT ═══ */
const doc = new Document({
  numbering: { config: [{ reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "·", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 200 } }, run: { color: TEAL, bold: true } } }] }] },
  styles: { default: { document: { run: { font: SANS, size: 22, color: INK } } } },
  sections: [
    /* ── COVER ── */
    { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children: [
        new Paragraph({ spacing: { before: 1400 }, alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: A("cover-mark.png"), transformation: { width: 300, height: 300 } })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 60 }, children: [t("VITRUVIAN", { size: 72, bold: true, color: INK, characterSpacing: 60 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [t("THE ANATOMY OF EVERYDAY SYSTEMS, SIMPLIFIED", { font: MONO, size: 18, color: MUTED, characterSpacing: 40 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 60 }, children: [t("Marketing & Commercialization Guide", { size: 32, color: TEAL_DEEP, bold: true })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [t("v2.0 · October 2026 · Confidential working document", { font: MONO, size: 16, color: MUTED })] })
      ] },

    /* ── BODY ── */
    { properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      children: [
        h1("Contents"),
        new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
        pageBreak(),

        /* 1 ─ Executive summary */
        kicker("01 · The ruling"), h1("Executive Summary"), divider(),
        p([t("Does Vitruvian have commercial value? "), b("Yes — and two of the three conditions from v1.0 are now met."), t(" The systems-design education market is proven at meaningful scale (ByteByteGo passed one million newsletter subscribers; Educative reports ~$98M revenue; every major tech-interview prep product sells a system-design tier). Vitruvian enters it with something none of the incumbents have: the reader doesn't watch or read the architecture — they rebuild it, break it, load-test it, and interrogate it.")]),
        p([b("What changed since v1.0. "), t("The library went from 3 studies to "), b("20 curated, schema-validated systems"), t(" — the content moat v1.0 named as a precondition is built. The product went from a reader to a learning loop: a four-step layer (problem → your guess → solution → tradeoff), spaced practice, a critical-path analysis, a load simulation with per-kind behaviour, and an app that now explains each of its own features as you reach it. Inference cost per generated study fell about 20% on Claude Opus 5.5. "), b("One condition remains: keyless generation, and the audience to sell it to.")]),
        callout("The verdict", [
          [b("Model: freemium subscription."), t(" The whole library and the whole reader are free forever, and BYOK stays free and unmetered. Pro at $8/mo · $72/yr sells one thing: "), b("keyless generation of your own systems"), t(" — plus practice sync and exports. Teams at $12/seat/mo. Realistic planning assumption: 2–4% free-to-paid conversion.")],
          [b("The strategic change from v1.0: "), t("the library is no longer the paid tier. It shipped free, and it should stay free — it is now a far better free artifact than three studies ever were, and the flywheel matters more than the gate.")]
        ]),
        p([t("The one-sentence pitch: "), t("“Most tools show you the blueprint. Vitruvian shows you the arguments that forced every line of it — and lets you argue back.”", { italics: true, color: TEAL_DEEP })]),
        pageBreak(),

        /* 2 ─ Product truth */
        kicker("02 · What we are selling"), h1("Product Truth"), divider(),
        p("Vitruvian is an installable, offline-first web app that deconstructs any system — a railway, WhatsApp, an ATM network, or the system you are designing right now — into a failure-driven rebuild: essence, skeleton, then layer after layer, each one forced into existence by a concrete failure of the previous state. A color-coded architecture diagram grows alongside the text. Every layer names the thinking model that cracks it, charges the reader a tradeoff, and answers how it holds under load."),
        h3("What no competitor has"),
        ...bullets([
          [b("The growing diagram. "), t("Architecture accretes visibly, layer by layer — not a finished poster but a time-lapse of decisions. Laid out by arithmetic (lanes are semantic roles, colour is lane, routing is orthogonal with ports) and drawn by hand.")],
          [b("Flow simulation. "), t("Press play: payload flows through the current state and each kind behaves as itself — a store absorbs and fills, a process dwells, a channel bunches. Saturation pushes backpressure upstream, so a jam creeps toward the source the way real ones do. At a gate it crashes, in red, exactly where history crashed.")],
          [b("The critical path. "), t("One tap traces the chain a request actually waits on and rings the nodes whose loss takes delivery with it. Read per layer, it prices the ladder: YouTube's request path ends up 2.9× the cost it started at. Every layer you added to survive failure also added something to wait for.")],
          [b("Graft (what-if). "), t("Propose a change; make your own call first; then see it ghosted onto the architecture with an honest verdict — improves, mixed, or harmful — argued from the system's own rules.")],
          [b("Dissect your own design. "), t("Describe what you are building; Vitruvian rebuilds it through the failures it will actually meet and names the concerns your description has not answered yet.")],
          [b("Semantic zoom. "), t("A node that is a system in its own right opens into its own Deconstruct, with a trail back up. The capstone studies nest several levels deep.")],
          [b("An active loop, not a reading list. "), t("Every layer runs problem → your guess → solution → tradeoff. Practice asks about layers you have actually read, whenever you want them; nothing is ever due.")],
          [b("Three audiences, one document. "), t("Beginner / enthusiast / developer registers switch instantly — one purchase serves the curious mind and the interviewing engineer.")],
          [b("It teaches itself. "), t("Thirteen tips fire as you first reach each part of the app, once each. A first-run tour cannot explain Graft, because nobody opens Graft in their first two minutes.")]
        ]),
        h3("What changed since v1.0"),
        ...bullets([
          [b("The library is built. "), t("3 → 20 curated systems, every one schema-validated, from unique-id generators up to YouTube as a capstone that drills into nearly everything before it. This was v1.0's named content moat.")],
          [b("The reader became a learning loop. "), t("Four steps per layer, Meet-the-system in two steps, a System sheet one tap from anywhere, and on a phone a sheet over the diagram you drag between three heights.")],
          [b("The diagram is drawn by hand. "), t("Rough.js, the engine Excalidraw draws with. Layout is unchanged and still deterministic; only the ink wobbles. Node marks say what a thing is — a database cylinder, a cache bolt, an object-store fold — while the shape still says what role it plays.")],
          [b("Cheaper to run. "), t("Claude Opus 5.5 at $4/$20 per MTok replaced Opus 5 at $5/$25. A generated study costs roughly $0.45.")]
        ]),
        h3("Honest product gaps (pre-commercial)"),
        ...bullets([
          "BYOK only — mainstream buyers will not create an Anthropic Console account. This is now the single remaining blocker, and the entire paid tier.",
          "No accounts or sync — device-local data is a privacy feature and a multi-device liability. Practice progress lives on one device.",
          "The library is free and shipped; Pro must therefore justify itself on generation alone. If generation is not worth $8/mo to a user, nothing else in the product will make it so.",
          "'Vitruvian' trademark needs a proper clearance before charging money (2026-07 scan: existing marks sit in PE/fitness/telecom — low risk, re-verify)."
        ]),
        pageBreak(),

        /* 3 ─ The user journey */
        kicker("03 · The experience"), h1("The User Journey"), divider(),
        p([t("What follows is the intended experience, end to end — not a feature list but the path a person actually walks. Each beat names what the product must do "), t("without being asked", { italics: true }), t(", because an app that has to be explained in a manual has already lost the reader it wants.")]),

        h3("Minute one · Arrival"),
        p("No signup, no account, no install prompt. The landing page makes one claim and offers one button. Behind it sits a shelf: your own Deconstructs first, then twenty worked systems. A tip names the shelf and gets out of the way. The promise a first-time visitor must feel in sixty seconds is that this is a thing you do, not a thing you read."),

        h3("Minute two to ten · The first system"),
        p("They open a sample — the railway, usually, because it is a machine everyone already half-understands. Meet the system in two short steps: the essence, then the rules it lives by. Then Layer 0, the naive baseline, drawn hand-sketched on the dot grid: two stations, one track, one train."),
        p([t("Then the first failure. The diagram pulses red exactly where history broke, and the layer that follows exists to survive it. This is the moment the product is selling. Everything before it is setup; everything after it is the same beat repeated at increasing depth. "), b("If a new reader does not reach their first red pulse, nothing else in this document matters.")]),

        h3("The loop · Four steps, repeated"),
        grid(["Step", "What the reader does", "What the product does"], [
          ["The problem", "Reads the failure that forces this layer", "Pulses the breaking parts red on the diagram"],
          ["Your guess", "Writes what they would do about it", "Takes it without judging it, and keeps it"],
          ["The solution", "Reads what was actually built", "Lights the new parts teal; names the thinking model"],
          ["The tradeoff", "Reads what it cost", "Shows what the layer sacrificed to buy the fix"]
        ], [1800, 3600, 3960]),
        p([t("The guess is the mechanism, not a formality. Reading a solution you have not reached for yourself produces recognition, which feels like understanding and is not. Strict mode makes the guess mandatory for readers who want the harder version. ")]),

        h3("Going deeper · The tools, discovered in order"),
        ...bullets([
          [b("The diagram first. "), t("Tapping a card lights its parts. The key lists only the glyphs this diagram uses and changes as you move; tap one and every node carrying it lights up.")],
          [b("Then load. "), t("Pulse sends traffic through the current state. The reader watches a store fill, a queue bunch, a jam creep backwards from whatever cannot keep up. Spine traces what a request waits on and rings the single points of failure.")],
          [b("Then argument. "), t("Graft takes a proposed change, asks the reader for their own verdict first, then gives its own and shows the two side by side. This is the feature that converts a reader into a user.")],
          [b("Then their own system. "), t("Dissect takes a description of what they are building and runs it through the same ladder. This is the feature that converts a user into a subscriber.")]
        ]),

        h3("Week two · Why they come back"),
        p("Practice asks questions about layers they have actually read — never about material they have not seen, and nothing is ever due. The Models index shows the fourteen thinking models recurring across their whole library, which is the point of the product stated as a screen: you are not learning twenty systems, you are learning fourteen ideas twenty times."),

        callout("The journey as one sentence", [
          [t("Open something you half-understand → watch it break → guess → see what was actually built → pay the tradeoff → repeat until the system is standing → then do it to "), t("your", { italics: true }), t(" system. The paid product begins at the last step, and only at the last step.")]
        ]),

        h3("Where the journey currently leaks"),
        ...bullets([
          [b("The key moment is three taps deep. "), t("Pulse and Spine are the features people repeat to other people, and a first-time reader may never press either. The tips now name them; the next move is to run the failure replay automatically on first arrival at a layer.")],
          [b("Dissect asks for a key. "), t("The highest-intent action in the app — describe your own system — is also the one gated behind an Anthropic Console account. This is the conversion wall and the reason Pro exists.")],
          [b("Progress is device-local. "), t("A reader who studies on a laptop and practises on a phone has two separate Vitruvians. Sync is the first real reason to hold an account.")]
        ]),
        pageBreak(),

        /* 4 ─ Market & competition */
        kicker("04 · The territory"), h1("Market & Competition"), divider(),
        p([t("Signals of a real market: "), b("ByteByteGo"), t(" grew from zero (Nov 2021) to one million newsletter subscribers (2024), converting roughly 4% to paid at $189–399/yr. "), b("Educative"), t(" reports ~$98M revenue on the back of the 'Grokking' system-design brand. "), b("NeetCode"), t(" turned a YouTube channel (~1M subs) into a self-described multi-million-dollar education business. "), b("Hello Interview"), t(" — two ex-FAANG staff engineers, $79/yr — is the fastest-growing name in the niche. "), b("Duolingo"), t(", the consumer-education ceiling, converts ~9% of monthly actives to paid. System design is the highest-stakes, highest-anxiety part of senior engineering interviews, and anxiety buys subscriptions.")]),
        h2("Competitive landscape"),
        competitorTable(),
        callout("The unowned niche", [
          [t("Every monetized player sells content; the interactive/simulation corner is served today only by free indie tools with no business attached. Nearest monetized neighbor is Codemia (practice-with-feedback). Pattern to note and reject: incumbents run fake-high list prices with permanent 50–70% 'sales' — Vitruvian's honest-reviewer brand should price plainly instead.")]
        ]),
        h3("The gap Vitruvian occupies"),
        p([t("Every incumbent sells "), b("content about systems"), t(" — articles, videos, course text with static diagrams. None sells "), b("interaction with systems"), t(": no growing diagram, no simulation, no what-if, no design review of the buyer's own architecture. Vitruvian's category is not 'another system design course'; it is the "), t("interactive systems anatomy tool", { italics: true, color: TEAL_DEEP }), t(" — closer to a flight simulator than a textbook. That category framing is the whole positioning battle: courses compete on syllabus; Vitruvian competes on the experience of understanding.")]),
        pageBreak(),

        /* 4 ─ Audience */
        kicker("05 · Who buys"), h1("Audience"), divider(),
        h3("P1 · The interview candidate (primary revenue)"),
        p("Mid-to-senior engineer, 3–10 years in, facing system-design rounds at FAANG-adjacent companies. Deadline-driven, outcome-buying, already paying for ByteByteGo/Hello Interview/mock interviews. Jobs: pass the round; sound senior; practice under pressure, not just read. Vitruvian's hooks: drills, gates, interview probes, at-scale reasoning, what-if ('the interviewer asked what if we cached this — I had already run it')."),
        h3("P2 · The practicing engineer / architect (expansion)"),
        p("Senior IC or tech lead making real design decisions. Jobs: pressure-test a design before committing; explain a system to stakeholders; onboard juniors onto an architecture. Hooks: design review, what-if verdicts grounded in invariants, exportable studies. This persona pays for judgment, not certification — and later becomes the Teams buyer."),
        h3("P3 · The curious systems mind (audience flywheel)"),
        p("Reads Wait But Why, watches Practical Engineering, loved 'How does WhatsApp actually work?'. Rarely pays — but shares. P3 is the distribution engine: free samples and simulation GIFs travel through them to P1s and P2s. Serve them free, deliberately, forever."),
        callout("Job-to-be-done ladder", [
          "1 · Help me understand how X works — free tier, samples.",
          "2 · Help me reason about a change to X — what-if, Pro.",
          "3 · Help me design MY system — design review, Pro.",
          "4 · Get me through the interview — drills + library + probes, Pro. The money concentrates on rungs 2–4."
        ]),
        pageBreak(),

        /* 5 ─ Positioning & messaging */
        kicker("06 · The words"), h1("Positioning & Messaging"), divider(),
        p([b("Positioning statement. "), t("For engineers who need to genuinely understand systems — not memorize them — Vitruvian is the interactive systems-anatomy tool that rebuilds any architecture failure by failure, in front of you and with you. Unlike courses and newsletters, it doesn't tell you the design; it makes you design, then argues with you honestly.")]),
        h3("Messaging house"),
        grid(["Pillar", "Claim", "Proof in product"], [
          ["Rebuild, don't read", "You watch the system get invented, layer by failure-forced layer", "Growing diagram · timeline scrubber · gates"],
          ["Break it to learn it", "Every mechanism exists because something crashed", "Failure pulses · flow-sim crashes · real incidents (Clayton Tunnel 1861)"],
          ["Argue with the architecture", "Propose changes; get honest verdicts from the system's own invariants", "What-if ghosts + improves/mixed/harmful rulings"],
          ["Own the reasoning", "14 thinking models recur across every system you study", "Models index · cross-system links · drills"]
        ], [2200, 3960, 3200]),
        h3("Voice"),
        p([t("The honest reviewer — rigorous, generous, never a cheerleader. The app already refuses to rubber-stamp bad what-ifs; marketing must sound identical. No 'crush your interview!!' — instead: "), t("“A change that breaks a core invariant is harmful even if it's popular.”", { italics: true }), t(" That sentence sells to the exact person we want.")]),
        h3("Lines that work"),
        ...bullets([
          "Every system is a stack of survived failures. Study the failures.",
          "The diagram is the argument.",
          "23 people died so the railway could learn one sentence: knowing beats assuming. Systems thinking has a body count — learn it the honest way.",
          "Don't memorize architectures. Re-derive them."
        ]),
        pageBreak(),

        /* 6 ─ Brand system */
        kicker("07 · The look"), h1("Brand System"), divider(),
        p([t("The mark is the thesis: a "), b("precise teal square"), t(" (the machine — grids, invariants, mono labels) overlapped by a "), b("hand-brushed enso ring"), t(" (the human — one imperfect stroke of understanding), sealed with a "), b("vermillion dot"), t(". Machine precision for the system; brushwork for the human moments. This split is a rule, not a mood — but v2 moved where the line falls, and the rule is stronger for it.")]),
        callout("Revision to the brand rule (v2.0)", [
          [b("v1.0 said: "), t("diagrams, tables and UI stay drafting-table exact; brushwork appears only at human milestones.")],
          [b("v2.0 says: "), t("the split is by layer, not by element. "), b("Structure is machine-exact; ink is human."), t(" Every box still sits exactly where its role and its order put it — lanes, ports, orthogonal routing and the critical-path maths are untouched arithmetic. What changed is that the stroke is now drawn by hand, everywhere.")],
          [t("This was a deliberate revision, made when the diagram went hand-drawn, and it resolves a tension v1.0 left open: a precise teal square beside a brushed enso ring argued that the machine and the human are separate things, while the product's actual argument is that a system is a human artefact made under constraint. A hand-drawn diagram over an exact layout says that better than a clean one did.")]
        ]),
        h3("Palette"),
        grid(["Token", "Hex", "Use"], [
          ["Ink", "#211E19 / #141416", "Text, diagram strokes, authority"],
          ["Washi", "#F7F4ED / #F2F0EA", "Grounds, paper, cards"],
          ["Teal", "#0E7A63", "The machine: accents, links, the square"],
          ["Vermillion", "#D95B31", "The human seal: completion, verdict stamps — never decoration"],
          ["Failure red", "#C22F2F", "Reserved: what breaks. Never brand chrome"]
        ], [1800, 2600, 4960]),
        h3("Type & texture"),
        ...bullets([
          "Display: Bricolage Grotesque · Body: Hanken Grotesk · Labels: JetBrains Mono (uppercase, letter-spaced — the drafting-table register).",
          "Texture: dot grid (the pinboard), liquid-glass cards with a bright top edge; wet-ink gloss, never plastic glassmorphism.",
          "Diagram ink: Rough.js at roughness 0.9, endpoints pinned so an arrow never leaves its port, and the wobble seeded per element so it is identical on every render. A diagram that re-wobbles as you scrub reads as broken, not as hand-made.",
          "Marketing assets inherit app assets: simulation GIFs, growing-diagram time-lapses, ghosted what-if frames. The product screenshots ARE the brand campaign."
        ]),
        pageBreak(),

        /* 7 ─ Packaging & pricing */
        kicker("08 · The offer"), h1("Packaging & Pricing"), divider(),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new ImageRun({ type: "png", data: A("teal-enso.png"), transformation: { width: 110, height: 110 } })] }),
        grid(["", "Free — 'The Reading Room'", "Pro — 'The Workbench' $8/mo · $72/yr", "Teams $12/seat/mo (min 5)"], [
          ["The library", "All 20 studies, forever", "All 20, plus new ones as they land", "Library + team-shared studies"],
          ["Reader, diagram, Pulse, Spine, Graft", "Everything, forever", "Everything", "Everything"],
          ["Generation with your own key", "Unlimited, unmetered", "Unlimited, unmetered", "Unlimited, unmetered"],
          ["Keyless generation (no API account)", "—", "12 Deconstructs/mo", "20/seat/mo, pooled"],
          ["Keyless Graft, Dissect, ask", "—", "30 runs/mo", "Pooled + shared verdict history"],
          ["Practice & progress", "This device", "Synced across devices", "Team dashboards (later)"],
          ["Support the maker", "—", "Founder badge on early plans", "Invoicing, SSO (later)"]
        ], [2160, 2400, 2400, 2400]),
        h3("Why these choices"),
        ...bullets([
          [b("The library is free, and that is the change. "), t("v1.0 planned to sell it. It shipped free instead, and it should stay free: twenty interactive studies is a far better free artifact than three, and the flywheel is worth more than the gate. Pro now sells exactly one thing — "), b("generation without an API account"), t(" — which is honest, easy to explain, and the only part that actually costs money to serve.")],
          [b("BYOK free and unmetered forever. "), t("Zero marginal cost, huge goodwill, and the hacker audience becomes the distribution channel. Removing it would be the single most brand-damaging move available.")],
          [b("The fair-use cap is safe because escaping it is free. "), t("A user who exceeds 12 keyless Deconstructs in a month is not cut off and not upsold — they add their own key and carry on unmetered. That is the rare quota that costs the heavy user nothing and the business nothing, and it is only possible because BYOK exists.")],
          [b("Quota math, recomputed on Claude Opus 5.5. "), t("A study runs ~$0.45 at $4/$20 per MTok (down from ~$0.55 on Opus 5). Worst case at the cap: 12 × $0.45 + 30 short runs × ~$0.02 ≈ "), b("$6.00"), t(" against ~$7.46 net of card fees — a 20% floor on a subscriber who maxes every allowance, and roughly 85% on the realistic median of two to five studies a month.")],
          [b("Subscription, not one-time. "), t("Generation carries recurring inference COGS; a lifetime licence against a metered cost is a slow bankruptcy. One-time works only for static content — that is the incumbents' game, and they are selling a different thing.")],
          [b("$72/yr undercuts Hello Interview's $79/yr"), t(" — the community favourite — and sits far under ByteByteGo ($189–399/yr) and coaching ($179–339/session). Launch offer: $59/yr founder price, price-locked. Price plainly; no fake list prices with permanent sales.")],
          [b("2–4% conversion planning "), t("(EdTech averages 2.6%, ByteByteGo ~4%): 50k free users → 1,000–2,000 Pro → $96k–$190k ARR. The free-user flywheel is therefore the business.")]
        ]),
        callout("The risk this pricing takes on", [
          [t("Selling only generation means the free tier is genuinely excellent and most people will never need to pay. That is the deliberate trade: a free product good enough to be recommended unprompted, with a paid tier that converts the narrow band of users who reach the last step of the journey — "), t("do it to my system", { italics: true }), t(". If conversion lands below 2%, the answer is not to claw back the library. It is to make Dissect better.")]
        ]),
        pageBreak(),

        /* 8 ─ Go-to-market */
        kicker("09 · The route"), h1("Go-To-Market"), divider(),
        p([t("The evidenced indie pattern (ByteByteGo, NeetCode, Comeau, Hello Interview): "), b("build one owned audience channel for ~12 months, give away a substantial free artifact, then launch as an event to your own audience."), t(" Cold launches are folklore; every winner pre-sold to people who already trusted them.")]),
        h3("Channel plan (in priority order)"),
        ...bullets([
          [b("1 · LinkedIn + X visual posts. "), t("ByteByteGo's exact wedge — system-design visuals — except ours move. A 20-second GIF of the WhatsApp diagram growing, or tokens crashing at Clayton Tunnel, is a native scroll-stopper. 2–3 posts/week, each one study insight.")],
          [b("2 · YouTube Shorts / long-form. "), t("Screen-captured studies with narration; NeetCode proved the funnel. Long-form: 'How the railway invented the mutex' (8 min), Shorts: single-layer cuts.")],
          [b("3 · The free artifact. "), t("Twenty interactive studies, instantly tryable, no signup, offline. This is now a genuinely large giveaway and should be led with as one — \u201ctwenty systems, free, no account\u201d is a stronger headline than any feature. Add one 'greatest hits' PDF (the 14 thinking models) as the email-capture lead magnet, ByteByteGo-style.")],
          [b("4 · SEO. "), t("Each flagship becomes a public long-form page — 'How WhatsApp actually works, failure by failure' — targeting the how-does-X-work long tail. The app IS the content mine.")],
          [b("5 · Show HN. "), t("Format: 'Show HN: Vitruvian – interactive system-design studies where the diagram grows as you learn'. Instantly tryable ✓ no signup ✓ free ✓ — already HN-shaped. Author's first comment: the invariant-based what-if engine, the zero-backend architecture, the Clayton Tunnel story. Tue–Thu 9am–12pm ET. Never solicit votes.")],
          [b("6 · Product Hunt. "), t("One-day spike + permanent backlink; schedule after HN, expect ~1.5k visits, treat as SEO asset.")],
          [b("7 · Google Play via TWA. "), t("~1 day + $25; negligible discovery but a credibility checkbox ('install from Play'). iOS stays Add-to-Home-Screen.")]
        ]),
        h3("90-day launch arc"),
        grid(["Phase", "Weeks", "Moves", "Gate to next phase"], [
          ["Seed", "1–4", "Daily-build posts · 8 GIFs banked (Pulse, backpressure, Spine) · SEO pages live · lead-magnet PDF + waitlist", "1k followers or 500 waitlist"],
          ["Beta", "5–8", "Keyless proxy in closed beta · founder pricing to waitlist · sync behind an account", "50 beta users, conversion signal ≥2%"],
          ["Launch", "9–12", "Show HN → PH → LinkedIn/X/YT same fortnight · founder $59/yr window · public changelog", "First 100 paying"]
        ], [1400, 1100, 4760, 2100]),
        callout("What v1.0 listed as Beta work and is now done", [
          [t("The 20-study library is authored, validated and shipped. That was the content moat and the stated precondition for charging money; it is no longer a milestone but an asset. The Beta phase is now one thing: "), b("the keyless proxy"), t(". Nothing else stands between the product and a paid tier.")]
        ]),
        pageBreak(),

        /* 9 ─ Metrics & unit economics */
        kicker("10 · The dials"), h1("Metrics"), divider(),
        grid(["Metric", "Definition", "Target"], [
          ["North star", "Studies completed per week (read ≥ final layer)", "Growth 10%/mo"],
          ["Activation", "New user finishes one sample study", "≥ 35%"],
          ["Wow moment", "Runs Pulse, Spine or Graft in first session", "≥ 20%"],
          ["Tips completion", "Share of reader tips read rather than switched off", "≥ 70% (if tips are being turned off, they are wrong)"],
          ["Free → paid", "Rolling 90-day conversion", "2–4% (EdTech avg 2.6%; BBG ~4%; Duolingo ceiling 9%)"],
          ["Retention", "Pro logo churn monthly", "< 5%"],
          ["COGS guardrail", "Inference cost / Pro subscriber / mo", "< $3 (cap is $6; median should sit near $1.50)"],
          ["Cap pressure", "Share of Pro subscribers hitting the 12-study cap", "< 10% — above that, the cap is mispriced, not the plan"]
        ], [1700, 4560, 3100]),
        callout("Unit economics sketch", [
          "50,000 free users × 3% = 1,500 Pro × $72/yr ≈ $108k ARR − inference (~$40–60k worst case, realistically half) − hosting (~$0, static) = a real one-person business. At 200k free users the same math clears $400k ARR. The lever is free-user growth, which is why channels 1–4 precede monetization."
        ]),
        pageBreak(),

        /* 10 ─ Risks */
        kicker("11 · The failure modes"), h1("Risks — Deconstructed Honestly"), divider(),
        p("A product that teaches failure-driven design should market-plan the same way. What breaks first:"),
        grid(["Risk", "Failure it causes", "Mitigation layer"], [
          ["Copyable prompt", "Moat is shallow; anyone can clone the skill", "Moat = curated library + brand voice + UX craft + audience. Ship content velocity, not secrets"],
          ["Anthropic dependency", "Price/API changes reset COGS math", "Model field free-text; effort capped per family; refusal fallback to Opus 4.8 server-side. Opus 5.5 cut cost ~20%, which is upside, not a plan"],
          ["Free tier is too good", "Nobody reaches the paywall; conversion stalls under 2%", "Accepted deliberately. The answer is a better Dissect, never a smaller library — clawing back shipped free features is the one move that would cost more trust than it earns"],
          ["BYOK-to-proxy jump", "Proxy = server, abuse, keys, uptime — the first backend", "Cloudflare Worker, hard quotas, prepaid credits only at first"],
          ["Content quality variance", "One bad generated study read publicly = trust damage", "Curated library is human-reviewed; generated studies labeled 'your study', never marketed as canon"],
          ["Solo maintainer", "Velocity and support ceiling", "Keep zero-backend surface; automate validation (schema gate already exists); scope Teams tier later"],
          ["Outside contribution", "v2 arrived as a 6,000-line PR from a contributor with no prior tie to the repo, into a codebase that handles a user's API key and deploys straight to Pages", "It was reviewed before merging — no new endpoints, no change to key handling. That review must become policy, not a one-off: any PR touching generator, storage or the service worker gets read line by line before it lands"],
          ["Trademark", "'Vitruvian' collision on commercialization", "Paid clearance search before charging; fallback compound 'Vitruvian Systems'"]
        ], [1900, 3330, 4130]),
        divider(),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 60 }, children: [new ImageRun({ type: "png", data: A("seal-enso.png"), transformation: { width: 90, height: 90 } })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [t("Sealed — rebuild it to understand it.", { font: MONO, size: 16, color: MUTED, characterSpacing: 25 })] })
      ] }
  ]
});

Packer.toBuffer(doc).then(buf => {
  const out = path.join(DIR, "Vitruvian-Marketing-Guide.docx");
  fs.writeFileSync(out, buf);
  console.log("wrote", out, buf.length, "bytes");
});
