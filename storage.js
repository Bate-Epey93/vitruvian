/* ═══════════════════════════════════════════════════════════════
   SYSTEM DECONSTRUCTOR — STORAGE (deep module, §9)
   ───────────────────────────────────────────────────────────────
   The only file that touches IndexedDB. Three stores:
   · breakdowns — keyPath id; { id, system, created, source,
     schemaVersion, doc, attempts:{ [layerIndex]:{answer, revealed,
     verdict, ts} }, progress:{ layersRead, gatesAnswered } }
   · meta — keyPath key; audienceMode, challengeModeDefault,
     apiKey, modelId, lastOpenBreakdown, lastBackup, schemaVersion,
     device-local keys (visits, iosHintDismissed, persistAsked,
     flagshipsSeeded).
   · modelIndex — keyPath modelId; { modelId, uses:[{breakdownId,
     layerIndex}] } — rebuilt on every breakdown save/delete so the
     Models view never scans documents at render time.
   Backups NEVER contain the API key (§9, acceptance #10).
   ═══════════════════════════════════════════════════════════════ */

var Store = (() => {
  const DB_NAME = "sdc-" + CONFIG.storageKey;
  const DB_VERSION = 1;
  const SCHEMA_VERSION = 1;                 // backup file format
  const LOCAL_ONLY_META = ["apiKey", "visits", "iosHintDismissed", "persistAsked", "flagshipsSeeded"];
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains("breakdowns")) d.createObjectStore("breakdowns", { keyPath: "id" });
        if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "key" });
        if (!d.objectStoreNames.contains("modelIndex")) d.createObjectStore("modelIndex", { keyPath: "modelId" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function write(storeNames, fn) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, "readwrite");
      fn(...storeNames.map(n => tx.objectStore(n)));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  function reqAsPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function readAll(storeName) {
    return reqAsPromise(db.transaction(storeName).objectStore(storeName).getAll());
  }
  async function getMetaMap() {
    const rows = await readAll("meta");
    const m = {};
    rows.forEach(r => { m[r.key] = r.value; });
    return m;
  }

  /* modelIndex is derived data: rebuild from all breakdowns. At
     library scale (dozens of docs) this is instant and can never
     drift out of sync. */
  async function rebuildModelIndex() {
    const all = await readAll("breakdowns");
    const index = {};
    MODEL_LIBRARY.forEach(m => { index[m.id] = []; });
    all.forEach(b => {
      (b.doc.layers || []).forEach(L => {
        const id = L.problem && L.problem.model && L.problem.model.id;
        if (index[id]) index[id].push({ breakdownId: b.id, layerIndex: L.index });
      });
    });
    await write(["modelIndex"], mi => {
      mi.clear();
      Object.entries(index).forEach(([modelId, uses]) => mi.put({ modelId, uses }));
    });
  }

  return {
    async init() {
      db = await open();
      const meta = await getMetaMap();
      if (meta.schemaVersion == null) {
        await this.saveMeta({
          schemaVersion: SCHEMA_VERSION,
          audienceMode: "enthusiast",
          challengeModeDefault: false,   // full deconstruct by default; gates are opt-in
          modelId: "claude-sonnet-5"
        });
      }
      return getMetaMap();
    },

    getMeta: getMetaMap,
    saveMeta(partial) {
      return write(["meta"], ms => {
        Object.entries(partial).forEach(([key, value]) => {
          if (value !== undefined) ms.put({ key, value });
        });
      });
    },

    getBreakdowns() { return readAll("breakdowns"); },
    getBreakdown(id) {
      return reqAsPromise(db.transaction("breakdowns").objectStore("breakdowns").get(id));
    },
    async saveBreakdown(rec) {
      await write(["breakdowns"], bs => bs.put(rec));
      await rebuildModelIndex();
    },
    /* attempts/progress updates are frequent; skip the index rebuild
       (layers don't change) */
    saveBreakdownLight(rec) {
      return write(["breakdowns"], bs => bs.put(rec));
    },
    async deleteBreakdown(id) {
      await write(["breakdowns"], bs => bs.delete(id));
      await rebuildModelIndex();
    },

    getModelIndex() { return readAll("modelIndex"); },

    /* ── Backup / restore: the API key never leaves the device ── */
    async exportAll() {
      const [breakdowns, meta] = await Promise.all([readAll("breakdowns"), getMetaMap()]);
      LOCAL_ONLY_META.forEach(k => delete meta[k]);
      return { app: "system-deconstructor", schemaVersion: SCHEMA_VERSION, breakdowns, meta };
    },
    async importAll(state) {
      if (!state || !Array.isArray(state.breakdowns)) throw new Error("not a System Deconstructor backup");
      if (state.schemaVersion > SCHEMA_VERSION) throw new Error("backup from a newer version");
      const results = [];
      const good = [];
      state.breakdowns.forEach(b => {
        const res = b && b.doc ? Schema.validate(b.doc) : { ok: false, errors: ["no document"] };
        results.push({ id: b && b.id, system: b && b.system, ok: res.ok, errors: res.errors || [] });
        if (res.ok) good.push(b);
      });
      const local = await getMetaMap();
      const kept = {};
      LOCAL_ONLY_META.forEach(k => { if (local[k] !== undefined) kept[k] = local[k]; });
      // Device-local keys (esp. apiKey) must come only from THIS device, never
      // from the imported file — a shared/hand-edited backup can't plant a key.
      const incoming = Object.fromEntries(
        Object.entries(state.meta || {}).filter(([k]) => !LOCAL_ONLY_META.includes(k))
      );
      await write(["breakdowns", "meta"], (bs, ms) => {
        bs.clear(); ms.clear();
        good.forEach(b => bs.put(b));
        Object.entries({ ...incoming, ...kept, schemaVersion: SCHEMA_VERSION }).forEach(([key, value]) => {
          if (value !== undefined) ms.put({ key, value });
        });
      });
      await rebuildModelIndex();
      return results;
    },

    async requestPersistence() {
      if (navigator.storage && navigator.storage.persist) {
        try { return await navigator.storage.persist(); } catch (e) { return false; }
      }
      return false;
    }
  };
})();
