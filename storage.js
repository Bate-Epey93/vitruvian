/* ═══════════════════════════════════════════════════════════════
   SYSTEM DECONSTRUCTOR — STORAGE (deep module, §9)
   ───────────────────────────────────────────────────────────────
   The only file that touches IndexedDB. Three stores:
   · breakdowns — keyPath id; { id, system, created, source,
     schemaVersion, doc, attempts:{ [layerIndex]:{answer, revealed,
     verdict, ts} }, progress:{ layersRead, gatesAnswered } }
   · meta — keyPath key; audienceMode, challengeModeDefault,
     apiKey, modelId, lastOpenBreakdown, lastBackup, schemaVersion,
     device-local keys (visits, iosHintDismissed, installOffered,
     persistAsked, flagshipsSeeded).
   · modelIndex — kept as an empty store so DB_VERSION never moves;
     nothing reads it any more.
   Backups NEVER contain the API key (§9, acceptance #10).
   ═══════════════════════════════════════════════════════════════ */

var Store = (() => {
  const DB_NAME = "sdc-" + CONFIG.storageKey;
  const DB_VERSION = 1;

  /* Model ids this app once offered as a preset and no longer does. Matched
     whole, never as a prefix: claude-fable-5 must not catch claude-fable-5-1,
     which is a current model and a legitimate thing to type. Sonnet 5 is
     deliberately absent — it was dropped from the buttons but is cheaper than
     the default, so moving anyone off it would raise their bill uninvited. */
  const RETIRED_MODELS = /^(claude-fable-5|claude-haiku-4-5(-20251001)?)$/;
  const SCHEMA_VERSION = 1;                 // backup file format
  const LOCAL_ONLY_META = ["apiKey", "visits", "iosHintDismissed", "installOffered", "persistAsked", "flagshipsSeeded"];
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
  /* Handlers go on before the callback runs, and a synchronous throw inside
     it aborts the transaction. Without that, a put() that throws half-way
     through a restore left the clear() before it to commit on its own: the
     library, the settings and the API key all gone, and nothing restored. */
  function write(storeNames, fn) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
      try { fn(...storeNames.map(n => tx.objectStore(n))); }
      catch (e) { try { tx.abort(); } catch (_) {} reject(e); }
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
  /* A stored row keyed "__proto__" would, by plain assignment, replace this
     object's prototype, and every key it carried (an API key, say) would
     then read as if it were set. Skipping the three names here also defuses
     any such row already sitting in an existing install. */
  const UNSAFE_KEYS = ["__proto__", "constructor", "prototype"];
  async function getMetaMap() {
    const rows = await readAll("meta");
    const m = {};
    rows.forEach(r => { if (!UNSAFE_KEYS.includes(r.key)) m[r.key] = r.value; });
    return m;
  }

  async function requestPersistence() {
    if (navigator.storage && navigator.storage.persist) {
      try { return await navigator.storage.persist(); } catch (e) { return false; }
    }
    return false;
  }
  /* Best-effort storage can be evicted (Chrome under disk pressure, Safari
     after a week without a visit), and for a study the user generated or
     brought in, this is the only copy. Ask once, the first time the library
     holds one, so Firefox's permission prompt follows something the user
     just did rather than a cold boot. Not awaited by the save: Firefox only
     settles once the prompt is answered. persistAsked is written first, so a
     slow answer can't lead to a second prompt. */
  let persistAsking = false;
  async function askPersistenceOnce() {
    if (persistAsking) return;
    persistAsking = true;
    if ((await getMetaMap()).persistAsked) return;
    await write(["meta"], ms => ms.put({ key: "persistAsked", value: true }));
    await requestPersistence();
  }

  /* The modelIndex store is kept, empty, so DB_VERSION never has to move.
     It used to be rebuilt from every breakdown on every save and delete, for
     a Models view that now reads the documents directly: nothing read it,
     and a first-boot seed of 25 flagships paid for 25 full-store rebuilds. */

  return {
    async init() {
      db = await open();
      const meta = await getMetaMap();
      if (meta.schemaVersion == null) {
        await this.saveMeta({
          schemaVersion: SCHEMA_VERSION,
          audienceMode: "enthusiast",
          challengeModeDefault: false,   // full deconstruct by default; gates are opt-in
          genSpeed: "balanced",          // generation thinking depth: balanced | fast
          modelId: CONFIG.defaultModel,
          tipsOn: true,                  // explain each feature as it is reached
          tipsDone: {}                   // ids already shown, so none ever repeats
        });
      }
      // Retiring a model from the Settings buttons doesn't unpick it for anyone
      // already on it: modelId is saved, so a install sitting on Fable would
      // keep billing at Fable rates with no way back short of retyping the id.
      // Move those installs to the default once. Only ids this app itself
      // offered are matched — a model typed by hand is a deliberate choice and
      // is left alone.
      else if (RETIRED_MODELS.test(meta.modelId || "")) {
        await this.saveMeta({ modelId: CONFIG.defaultModel });
      }
      // The old first-run tour was one flag for three tips. Anyone who sat
      // through it keeps those three spent; the rest of the catalogue is new
      // to them and should still fire.
      if (meta.tipsSeen && !meta.tipsDone) {
        await this.saveMeta({ tipsDone: { timeline: true, steps: true, diagram: true } });
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
      // not for flagships or a shared link: both exist elsewhere, and a shared
      // link imports at boot, the very moment the prompt should not appear
      if (rec.source !== "flagship" && rec.source !== "shared") askPersistenceOnce().catch(() => {});
    },
    /* attempts/progress updates: the frequent write, with no side effects */
    saveBreakdownLight(rec) {
      return write(["breakdowns"], bs => bs.put(rec));
    },
    async deleteBreakdown(id) {
      await write(["breakdowns"], bs => bs.delete(id));
    },

    /* ── Backup / restore: the API key never leaves the device ── */
    async exportAll() {
      const [breakdowns, meta] = await Promise.all([readAll("breakdowns"), getMetaMap()]);
      LOCAL_ONLY_META.forEach(k => delete meta[k]);
      return { app: "vitruvian", tool: "vitruvian", schemaVersion: SCHEMA_VERSION, breakdowns, meta };
    },
    async importAll(state) {
      if (!state || !Array.isArray(state.breakdowns)) throw new Error("not a Vitruvian backup");
      if (state.app && state.app !== "vitruvian" && state.app !== "system-deconstructor") throw new Error("not a Vitruvian backup");
      if (state.schemaVersion > SCHEMA_VERSION) throw new Error("backup from a newer version");
      const results = [];
      const good = [];
      const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
      state.breakdowns.forEach(b => {
        /* every id the app mints is a non-empty string; anything else would
           make put() throw inside the transaction below */
        const idOk = isObj(b) && typeof b.id === "string" && b.id.trim() !== "";
        const res = !idOk ? { ok: false, errors: ["missing or invalid id"] }
                  : b.doc ? Schema.validate(b.doc) : { ok: false, errors: ["no document"] };
        results.push({ id: b && b.id, system: b && b.system, ok: res.ok, errors: res.errors || [] });
        /* normalise what the rest of the app assumes is always there: a
           record with no attempts used to crash the Library on every boot */
        if (res.ok) good.push({
          ...b,
          system: typeof b.system === "string" && b.system ? b.system : b.doc.meta.system,
          attempts: isObj(b.attempts) ? b.attempts : {},
          progress: isObj(b.progress) ? b.progress : { layersRead: 0, gatesAnswered: 0, position: 0 }
        });
      });
      /* Nothing worth restoring means nothing gets cleared. */
      if (!good.length) throw new Error("nothing in this file could be restored");
      const local = await getMetaMap();
      const kept = {};
      LOCAL_ONLY_META.forEach(k => { if (local[k] !== undefined) kept[k] = local[k]; });
      // Device-local keys (esp. apiKey) must come only from THIS device, never
      // from the imported file — a shared/hand-edited backup can't plant a key.
      const incoming = Object.fromEntries(
        Object.entries(state.meta || {}).filter(([k]) => !LOCAL_ONLY_META.includes(k) && !UNSAFE_KEYS.includes(k))
      );
      await write(["breakdowns", "meta"], (bs, ms) => {
        bs.clear(); ms.clear();
        good.forEach(b => bs.put(b));
        Object.entries({ ...incoming, ...kept, schemaVersion: SCHEMA_VERSION }).forEach(([key, value]) => {
          if (value !== undefined) ms.put({ key, value });
        });
      });
      askPersistenceOnce().catch(() => {});
      return results;
    },

    requestPersistence
  };
})();
