/* Bus.js - a tiny event bus. Systems announce things ("creature:caught",
   "zone:entered") and whoever cares listens: quests, the dex, sounds, tests. */
const H = new Map();
export const Bus = {
  on(k, f) { if (!H.has(k)) H.set(k, new Set()); H.get(k).add(f); return () => H.get(k).delete(f); },
  emit(k, d) { const s = H.get(k); if (s) for (const f of [...s]) { try { f(d); } catch (e) { console.error('[bus]', k, e); } } },
};
