/* ═══════════════════════════════════════════════════════════════
   VITRUVIAN — DIAGRAM ENGINE (§5)
   ───────────────────────────────────────────────────────────────
   Deterministic lane layout — no graph auto-layout, ever. The AI
   assigns lane + order; this file does arithmetic:
   · lanes = horizontal bands, order = column, kind = glyph.
   · every node/edge is COLOR-CODED by the layer that introduced
     it (layer 0 = ink), so you can read the system's strata at a
     glance; edge KIND stays encoded in the dash pattern.
   · viewBox is computed from the FINAL state (all diffs applied)
     so the diagram never jumps or rescales between layers.
   · Diagram.mount(container, doc) → instance
       instance.show(uptoLayer, { highlight, animate }) renders
       baseline + diffs 1..uptoLayer; highlight pulses the ids
       that the NEXT layer will fix (gate state).
   All SVG built via DOM APIs; labels are text nodes — generated
   content is structurally inert here (§13).
   ═══════════════════════════════════════════════════════════════ */

var Diagram = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const NODE_W = 110, NODE_H = 44, ACTOR_R = 20;
  const LANE_H = 100, COL_W = 132, GUTTER = 18, PAD_TOP = 8, PAD_BOTTOM = 12;
  const CELL_GAP = 6;   // vertical gap between co-located nodes in one lane+order cell

  /* Layer strata palette — index 0 is the ink baseline; 1..7 are the
     layers. Chosen to stay distinct from the failure red and from each
     other at 1.5-2px stroke weight on warm paper. */
  const LAYER_COLORS = ["#141416", "#0e7a63", "#3057b0", "#7048a8", "#aa3f7e", "#6b7a1c", "#40707e", "#8a5a2a"];
  function layerColor(i) { return LAYER_COLORS[Math.min(i, LAYER_COLORS.length - 1)]; }

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(node, s) { node.appendChild(document.createTextNode(s)); return node; }

  /* ── Layout: column x + lane-center y, sized to the union of every
     node that ever exists so the viewBox never rescales. Vertical
     stagger is applied per-state in show(). ── */
  function computeLayout(doc) {
    const lanes = doc.visual.lanes;
    const laneY = {};                       // lane id → band top
    lanes.forEach((l, i) => { laneY[l.id] = PAD_TOP + i * LANE_H; });

    const allNodes = [...doc.visual.nodes];
    doc.layers.forEach(L => allNodes.push(...L.diff.add_nodes));

    let maxOrder = 0;
    allNodes.forEach(n => { if (n.order > maxOrder) maxOrder = n.order; });

    const width = GUTTER + (maxOrder + 1) * COL_W + GUTTER;
    const height = PAD_TOP + lanes.length * LANE_H + PAD_BOTTOM;

    const pos = {};
    allNodes.forEach(n => {
      pos[n.id] = { x: GUTTER + n.order * COL_W + COL_W / 2, y: laneY[n.lane] + LANE_H / 2 };
    });
    return { lanes, laneY, pos, width, height, maxOrder };
  }

  /* ── origin map: element id → index of the layer that introduced it ── */
  function computeOrigins(doc) {
    const origin = {};
    doc.visual.nodes.forEach(n => { origin[n.id] = 0; });
    doc.visual.edges.forEach(e => { origin[e.id] = 0; });
    doc.layers.forEach(L => {
      L.diff.add_nodes.forEach(n => { origin[n.id] = L.index; });
      L.diff.add_edges.forEach(e => { origin[e.id] = L.index; });
    });
    return origin;
  }

  /* ── State N = baseline + diffs 1..N, honoring remove ── */
  function stateAt(doc, upto) {
    const nodes = new Map(), edges = new Map();
    doc.visual.nodes.forEach(n => nodes.set(n.id, n));
    doc.visual.edges.forEach(e => edges.set(e.id, e));
    for (let i = 0; i < upto && i < doc.layers.length; i++) {
      const d = doc.layers[i].diff;
      d.remove.forEach(id => {
        if (nodes.delete(id)) {
          [...edges.values()].forEach(e => { if (e.from === id || e.to === id) edges.delete(e.id); });
        } else edges.delete(id);
      });
      d.add_nodes.forEach(n => nodes.set(n.id, n));
      d.add_edges.forEach(e => edges.set(e.id, e));
    }
    return { nodes, edges };
  }

  /* ── Edge path: V-H-V midpoint routing between lanes,
     straight shot within a lane. Crossings are tolerated. ── */
  function edgePath(e, pos) {
    const a = pos[e.from], b = pos[e.to];
    if (Math.abs(a.y - b.y) < 6) {                       // same band → horizontal
      const dir = b.x > a.x ? 1 : -1;
      const x1 = a.x + dir * (NODE_W / 2 + 2), x2 = b.x - dir * (NODE_W / 2 + 6);
      return { d: `M ${x1} ${a.y} L ${x2} ${b.y}`, mx: (x1 + x2) / 2, my: a.y - 7 };
    }
    const down = b.y > a.y ? 1 : -1;
    const y1 = a.y + down * (NODE_H / 2 + 2);
    const y2 = b.y - down * (NODE_H / 2 + 6);
    const midY = (y1 + y2) / 2;
    if (Math.abs(a.x - b.x) < 6)                          // same column → vertical
      return { d: `M ${a.x} ${y1} L ${a.x} ${y2}`, mx: a.x, my: midY };
    return { d: `M ${a.x} ${y1} L ${a.x} ${midY} L ${b.x} ${midY} L ${b.x} ${y2}`, mx: (a.x + b.x) / 2, my: midY - 7 };
  }

  /* ── Node glyphs by kind; stroke tinted by origin layer ── */
  function drawNode(g, n, color) {
    g.setAttribute("class", `dg-node dg-kind-${n.kind}`);
    const w = NODE_W, h = NODE_H, x = -w / 2, y = -h / 2;
    if (n.kind === "actor") {
      el("circle", { r: ACTOR_R, class: "dg-shape" }, g).style.stroke = color;
      labelBelow(g, n.label);
      return;
    }
    if (n.kind === "store") {                             // open-topped rect: 3 sides
      el("rect", { x, y, width: w, height: h, class: "dg-fill" }, g);
      el("path", { d: `M ${x} ${y} L ${x} ${y + h} L ${x + w} ${y + h} L ${x + w} ${y}`, class: "dg-shape dg-open", fill: "none" }, g).style.stroke = color;
    } else if (n.kind === "channel") {
      el("rect", { x, y, width: w, height: h, rx: h / 2, class: "dg-shape" }, g).style.stroke = color;
    } else {                                              // process
      el("rect", { x, y, width: w, height: h, rx: 3, class: "dg-shape" }, g).style.stroke = color;
    }
    labelInside(g, n.label);
  }

  function splitLabel(s, max) {
    if (s.length <= max) return [s];
    const words = s.split(" ");
    const lines = [""];
    words.forEach(w => {
      const cur = lines[lines.length - 1];
      if (cur && (cur + " " + w).length > max) lines.push(w);
      else lines[lines.length - 1] = cur ? cur + " " + w : w;
    });
    return lines.length > 2 ? [lines[0], lines[1].replace(/.$/, "…")] : lines;
  }
  function labelInside(g, label) {
    const lines = splitLabel(label, 14);
    const t = el("text", { class: "dg-label", "text-anchor": "middle", y: lines.length > 1 ? -3 : 4 }, g);
    lines.forEach((ln, i) => txt(el("tspan", { x: 0, dy: i ? 12 : 0 }, t), ln));
  }
  function labelBelow(g, label) {
    const t = el("text", { class: "dg-label", "text-anchor": "middle", y: ACTOR_R + 13 }, g);
    txt(t, label);
  }

  /* ── Edge-label collision pass: after insertion (so getBBox works),
     greedily push overlapping labels down in 11px steps, a few rounds.
     Crossings in LINES are tolerated by design; unreadable TEXT is not. ── */
  function resolveLabelCollisions(edgesG, maxY) {
    const labels = [...edgesG.querySelectorAll(".dg-elabel")];
    const boxes = labels.map(t => {
      let b;
      try { b = t.getBBox(); } catch (e) { return null; }   // detached/hidden svg: skip pass
      return { t, x: b.x, y: b.y, w: b.width, h: b.height };
    });
    if (boxes.some(b => !b)) return;
    boxes.sort((a, b) => a.y - b.y || a.x - b.x);
    for (let round = 0; round < 3; round++) {
      let moved = false;
      for (let i = 0; i < boxes.length; i++) {
        for (let j = 0; j < i; j++) {
          const a = boxes[j], c = boxes[i];
          const overlap = !(c.x > a.x + a.w + 2 || c.x + c.w + 2 < a.x || c.y > a.y + a.h + 1 || c.y + c.h + 1 < a.y);
          if (overlap) {
            const dy = (a.y + a.h + 2) - c.y;
            const newY = +c.t.getAttribute("y") + dy;
            if (newY < maxY - 4) {
              c.t.setAttribute("y", newY);
              c.y += dy;
              moved = true;
            }
          }
        }
      }
      if (!moved) break;
    }
  }

  /* ── Mount ── */
  function mount(container, doc) {
    const layout = computeLayout(doc);
    const origin = computeOrigins(doc);
    container.textContent = "";
    const svg = el("svg", {
      viewBox: `0 0 ${layout.width} ${layout.height}`,
      class: "dg-svg", role: "img",
      "aria-label": `System diagram: ${doc.meta.system}`
    }, container);
    svg.style.minWidth = Math.min(layout.width, 760) + "px";

    // arrow markers: one per layer color + the failure marker
    const defs = el("defs", {}, svg);
    const markerFor = {};
    for (let i = 0; i <= doc.layers.length; i++) {
      const m = el("marker", { id: "arr-l" + i, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
      el("path", { d: "M 0 1 L 9 5 L 0 9 z", fill: layerColor(i) }, m);
      markerFor[i] = "arr-l" + i;
    }
    const mb = el("marker", { id: "arr-broken", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M 0 1 L 9 5 L 0 9 z", fill: "#c22f2f" }, mb);

    // lane bands + labels (static)
    const bandsG = el("g", {}, svg);
    layout.lanes.forEach((l, i) => {
      const y = layout.laneY[l.id];
      el("rect", { x: 0, y, width: layout.width, height: LANE_H, class: "dg-lane" + (i % 2 ? " alt" : "") }, bandsG);
      if (i) el("line", { x1: 0, y1: y, x2: layout.width, y2: y, class: "dg-lane-line" }, bandsG);
      txt(el("text", { x: 6, y: y + 13, class: "dg-lane-label" }, bandsG), l.label.toUpperCase());
    });

    const edgesG = el("g", {}, svg);
    const nodesG = el("g", {}, svg);
    let shownIds = new Set();

    function show(upto, opts = {}) {
      const { highlight = [], animate = false } = opts;
      const st = stateAt(doc, upto);
      const hl = new Set(highlight);
      const prev = shownIds;
      edgesG.textContent = "";
      nodesG.textContent = "";

      // Vertical stagger over the nodes VISIBLE in this state, grouped by
      // lane+order cell: a sole occupant sits on the centerline; N co-located
      // nodes spread symmetrically by (NODE_H + gap) so they never overlap.
      const cells = {};
      st.nodes.forEach(n => { const k = n.lane + "|" + n.order; (cells[k] = cells[k] || []).push(n.id); });
      Object.values(cells).forEach(ids => ids.sort());   // deterministic slot order across renders
      const pos = {};
      st.nodes.forEach(n => {
        const ids = cells[n.lane + "|" + n.order];
        const dy = (ids.indexOf(n.id) - (ids.length - 1) / 2) * (NODE_H + CELL_GAP);
        const b = layout.pos[n.id];
        pos[n.id] = { x: b.x, y: b.y + dy };
      });

      st.edges.forEach(e => {
        if (!st.nodes.has(e.from) || !st.nodes.has(e.to)) return;
        const o = origin[e.id] || 0;
        const g = el("g", { class: `dg-edge dg-ekind-${e.kind}` }, edgesG);
        const p = edgePath(e, pos);
        const path = el("path", { d: p.d, fill: "none", class: "dg-epath", "marker-end": `url(#${hl.has(e.id) ? "arr-broken" : markerFor[o]})` }, g);
        path.style.stroke = layerColor(o);
        if (e.label) {
          const t = el("text", { x: p.mx, y: p.my, "text-anchor": "middle", class: "dg-elabel" }, g);
          t.style.fill = layerColor(o);
          txt(t, e.label);
        }
        if (hl.has(e.id)) g.classList.add("dg-broken");
        if (animate && !prev.has(e.id)) g.classList.add("dg-enter");
      });

      st.nodes.forEach(n => {
        const p = pos[n.id];
        const g = el("g", { transform: `translate(${p.x} ${p.y})` }, nodesG);
        drawNode(g, n, layerColor(origin[n.id] || 0));
        if (hl.has(n.id)) g.classList.add("dg-broken");
        if (animate && !prev.has(n.id)) g.classList.add("dg-enter");
      });

      resolveLabelCollisions(edgesG, layout.height);
      shownIds = new Set([...st.nodes.keys(), ...st.edges.keys()]);
    }

    return { show, layout, origin };
  }

  return { mount, stateAt, computeLayout, layerColor };
})();
