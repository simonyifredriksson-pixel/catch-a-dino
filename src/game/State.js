/* State.js - what is saved.

   PROFILE (per browser): your name, look, settings and hotbar layout.
   WORLD (the host's save, shared with everyone in a co-op game):
     money, time, weather, the zoo (exhibits, decor), every creature you own,
     the dex, quests, opened gates, discovered places, team tools/items and
     upgrades, and per-player packs (what each player carries). */
import { uid } from '../core/Util.js';
import { ZOO } from '../data/Biomes.js';

const PKEY = 'catchadino-profile-v1', WKEY = 'catchadino-save-v2';   // v2: the island world (v1 saves were the old map)

export function loadProfile() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(PKEY) || '{}') || {}; } catch (e) { p = {}; }
  return {
    name: 'Ranger', look: 0, sens: 1, invert: false, vol: 0.8, music: 0.5, fov: 70, shadows: true, hotbar: null, hotSeen: [],
    key: 'k' + Math.random().toString(36).slice(2, 10), tips: {},
    ...p,
  };
}
export function saveProfile(p) { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch (e) { /* */ } }
export function loadWorld() { try { const w = JSON.parse(localStorage.getItem(WKEY) || 'null'); return w && w.v === 2 ? w : null; } catch (e) { return null; } }
export function saveWorld(W) { try { localStorage.setItem(WKEY, JSON.stringify(W)); } catch (e) { /* */ } }
export function wipeWorld() { try { localStorage.removeItem(WKEY); } catch (e) { /* */ } }

/** a creature record (what the save keeps about one animal you own) */
export function creatureRecord(sp, o = {}) {
  return { uid: o.uid || uid('c'), sp, v: o.v || null, size: o.size ?? 0.5, kg: o.kg || 0, name: o.name || null, traits: o.traits || [], at: o.at || 'zoo', by: o.by || null, t: Date.now(), happy: 0.7 };
}

export function newWorld(hostKey) {
  const zx = ZOO.x, zz = ZOO.z;
  const W = {
    v: 2, money: 600, day: 1, tod: 0.34, weather: { kind: 'clear', t: 240 },
    tools: { rope: 1, reedrod: 1, axe: 1, pickaxe: 1, binoculars: 1, journal: 1 }, items: { berries: 6, meat: 2, fish: 5 },
    upg: { crate: 0, boots: 0, helmet: 0, coat: 0, glider: 0, saddle: 0, drone: 0, beacon: 0 },
    plot: 0,
    zoo: {
      exhibits: [
        { id: 'ex1', hab: 'meadow', size: 'M', x: zx - 24, z: zz - 18, rot: 0, name: 'Meadow Pen' },
        { id: 'ex2', hab: 'aquatic', size: 'M', x: zx + 24, z: zz - 18, rot: 0, name: 'Lagoon Tank' },
      ],
      decor: [
        { id: 'd2', k: 'bench', x: zx - 8, z: zz + 14, rot: 0 },
        { id: 'd3', k: 'lamp', x: zx - 4, z: zz + 30, rot: 0 },
        { id: 'd4', k: 'flowers', x: zx + 6, z: zz + 40, rot: 0 },
        { id: 'd5', k: 'tree', x: zx - 12, z: zz + 34, rot: 1 },
        { id: 'd6', k: 'bin', x: zx + 9, z: zz + 22, rot: 0 },
        { id: 'd7', k: 'palm', x: zx + 44, z: zz + 36, rot: 0 },
      ],
      paths: [],
    },
    creatures: {},
    journal: [],
    dex: {},
    quest: 0, flags: {}, gates: {}, found: {}, beacons: {}, explored: '',
    stats: { caught: 0, earned: 0, rarest: null, photos: 0, bought: 0 },
    players: {},
  };
  // a path from the gate up to both exhibits
  for (let z = zz + 56; z >= zz + 4; z -= 4) W.zoo.paths.push([zx, z]);
  for (let x = zx - 24; x <= zx + 24; x += 4) if (x !== zx) W.zoo.paths.push([x, zz + 4]);
  // the starting animals: two compies in the pen, and a dryosaurus to ride
  for (const s of [0.35, 0.6]) { const c = creatureRecord('compy', { size: s, kg: 2.4 + s, at: 'ex:ex1' }); c.starter = true; W.creatures[c.uid] = c; }
  const d = creatureRecord('dryo', { size: 0.55, kg: 82, at: 'pack:' + hostKey, name: 'Sprinkles' });
  d.starter = true;
  W.creatures[d.uid] = d;
  W.dex.compy = { seen: 2, caught: 2 }; W.dex.dryo = { seen: 1, caught: 1 };
  return W;
}
/** fill in anything an older save is missing */
export function migrate(W) {
  W.tools ||= { rope: 1, binoculars: 1 }; W.items ||= {}; W.upg ||= {}; W.zoo ||= { exhibits: [], decor: [], paths: [] };
  W.zoo.paths ||= []; W.creatures ||= {}; W.dex ||= {}; W.flags ||= {}; W.gates ||= {}; W.found ||= {}; W.beacons ||= {}; W.players ||= {}; W.stats ||= {};
  for (const k of ['crate', 'boots', 'helmet', 'coat', 'glider', 'saddle', 'drone', 'beacon']) W.upg[k] ??= 0;
  W.plot ??= 0;
  W.tools.journal ||= 1; W.tools.axe ||= 1; W.tools.pickaxe ||= 1; W.journal ||= [];
  for (const e of W.zoo.exhibits) if ((e.id === 'ex1' || e.id === 'ex2') && e.size === 'S') e.size = 'M';   // the starter exhibits fit any tutorial catch
  return W;
}
