/* Base.js - your base on Home Island, and the creatures that live and work there.

   RESOURCE SPOTS round the island (they grow back):
     tree      wood     an axe, or any lumber creature
     bigtree   wood x3  too big for an axe: a lumber creature of level 3+
     rock      stone    a pickaxe, or any miner
     ore       ore      a pickaxe, or a miner of level 2+
     gem       crystal  only a miner of level 3+
     bush      berries  a farmer (or your hands)
   CREATURES AT THE BASE (record.at === 'zoo') walk about and DO their job:
   they go to a spot, work it (you see them chop, bash, dig), carry what
   they got to the storage by the Ranger Station and drop it in. Transport
   creatures make every haul bigger; fishers fish off the shore by the dock;
   kindlers sit at the campfire and turn wood into charcoal; explorers walk
   off the island and come back later with something they found. Without a
   job they just live here, each in their own way (personality).

   The host decides what breaks and what is earned; everyone sees the same
   spots (events) and simulates the creatures locally. */
import * as THREE from '../../lib/three.module.js';
import { Creature } from './Creature.js';
import { Mesher, geo, mat4 } from '../art/Mesher.js';
import { putFlora } from '../art/ZooArt.js';
import { SP, RARITY } from '../data/Species.js';
import { JOBS } from '../data/Creatures.js';
import { ITEMS } from '../data/Items.js';
import { HOME, ZOO, DOCK } from '../data/Biomes.js';
import { rng, damp, clamp, wrapAngle } from '../core/Util.js';

export const NODES = {
  tree:    { name: 'Tree', job: 'lumber', res: 'wood', hp: 6, yield: [3, 5], lv: 1, regrow: 150, tool: 'chop' },
  bigtree: { name: 'Ancient Tree', job: 'lumber', res: 'wood', hp: 18, yield: [12, 18], lv: 3, regrow: 360 },
  rock:    { name: 'Rock', job: 'mining', res: 'stone', hp: 6, yield: [3, 5], lv: 1, regrow: 150, tool: 'mine' },
  ore:     { name: 'Iron Vein', job: 'mining', res: 'ore', hp: 10, yield: [2, 4], lv: 2, regrow: 240, tool: 'mine' },
  gem:     { name: 'Crystal Outcrop', job: 'mining', res: 'gem', hp: 16, yield: [2, 3], lv: 3, regrow: 420 },
  bush:    { name: 'Berry Bush', job: 'farming', res: 'berries', hp: 3, yield: [2, 4], lv: 1, regrow: 80, tool: 'hand' },
};
const CLUSTERS = [
  // [type, centre x, z, radius, count]
  // close to the storage yard (by the plaza, south of the zoo) so the workers' trips are short
  ['tree', -70, 95, 42, 16], ['bigtree', -105, 125, 26, 4], ['rock', 105, 95, 32, 9], ['ore', 125, 60, 20, 5],
  ['gem', 95, 150, 16, 3], ['bush', 65, 125, 18, 7], ['bush', -30, 150, 14, 4],
  // and a few further out
  ['tree', -120, -70, 60, 8], ['tree', 110, -110, 40, 4], ['rock', 150, -40, 30, 4],
];

export class Base {
  constructor(game) {
    this.g = game; this.nodes = []; this.byId = new Map();
    this.workers = []; this.byUid = new Map(); this.carry = new Map();
  }
  get W() { return this.g.W; }
  /** where hauls are dropped: the storage yard beside the entrance plaza */
  get storage() { return { x: ZOO.x + 40, z: ZOO.z + 78 }; }     // outside the fence, by the plaza
  get fire() { return { x: ZOO.x + 52, z: ZOO.z + 72 }; }

  /* ---------------- building the spots ---------------- */
  build() {
    const G = this.g, T = G.terrain, r = rng(777), ex = G.scatter.exclude;
    const half = 56 + 16;
    const blocked = (x, z, rad) => {
      if (Math.abs(x - ZOO.x) < half && Math.abs(z - ZOO.z) < half + 40) return true;    // the zoo, the plaza
      const ax = 0, az = ZOO.z + half + 30, bx = DOCK.x, bz = DOCK.z, L2 = (bx - ax) ** 2 + (bz - az) ** 2;
      const t = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / L2, 0, 1);
      if (Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t) < 14) return true;  // the avenue to the dock
      if (T.ground(x, z) < 1.6 || Math.hypot(x - HOME.x, z - HOME.z) > HOME.r - 30) return true;
      return ex.some(e => Math.hypot(e.x - x, e.z - z) < e.r + rad) || this.nodes.some(n => Math.hypot(n.x - x, n.z - z) < 6.5 + rad);
    };
    let id = 0;
    for (const [type, cx, cz, R, n] of CLUSTERS) {
      for (let k = 0, made = 0; k < n * 12 && made < n; k++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        const rad = type === 'bigtree' ? 4 : 2;
        if (blocked(x, z, rad)) continue;
        this._node({ id: 'n' + (id++), type, x, z, seed: Math.floor(r() * 1e6) });
        made++;
      }
    }
    // the campfire for kindlers, by the station
    const f = this.fire, fy = T.ground(f.x, f.z), M = new Mesher(0.05, 77);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; M.dode(f.x + Math.cos(a) * 1.1, fy + 0.15, f.z + Math.sin(a) * 1.1, 0.5, 0.35, 0.5, '#8a8478'); }
    for (let i = 0; i < 4; i++) M.add(geo.cyl(6), mat4(f.x, fy + 0.25, f.z, i * 0.8, 0.18, 1.3, 0.18, Math.PI / 2, 0), '#6a4a2a');
    G.scene.add(M.mesh());
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 6), new THREE.MeshBasicMaterial({ color: '#ffb040', transparent: true, opacity: 0.9 }));
    this.flame.position.set(f.x, fy + 0.8, f.z); G.scene.add(this.flame);
    this.fireLight = new THREE.PointLight('#ffa040', 0, 14, 1.6); this.fireLight.position.set(f.x, fy + 1.5, f.z); G.scene.add(this.fireLight);
    ex.push({ x: f.x, z: f.z, r: 3 });
    // a storage yard: crates and a log pile that grow with what you have
    const s = this.storage, sy = T.ground(s.x, s.z), S = new Mesher(0.05, 78);
    S.box(s.x, sy - 0.1, s.z, 6, 0.2, 4, '#9a7a4a');
    for (const [dx, dz] of [[-2, -1], [-0.6, -1.2], [2, -0.8]]) { S.box(s.x + dx, sy + 0.1, s.z + dz, 1.1, 1.0, 1.1, '#a07a4a'); S.box(s.x + dx, sy + 1.1, s.z + dz, 1.15, 0.08, 1.15, '#7a5a34'); }
    G.scene.add(S.mesh());
    this.pile = new THREE.Group(); this.pile.position.set(s.x, sy + 0.1, s.z + 1.2); G.scene.add(this.pile);
    ex.push({ x: s.x, z: s.z, r: 4 });
  }
  _node(o) {
    const G = this.g, T = G.terrain, N = NODES[o.type], y = T.ground(o.x, o.z), r = rng(o.seed);
    const M = new Mesher(0.06, o.seed), g = new THREE.Group();
    let rad = 1.2;
    if (o.type === 'tree') { putFlora(M, ['jtree', 'ginkgo', 'araucaria', 'palm'][o.seed % 4], 0, 0, 0, 0.85 + r() * 0.3, r() * 6); rad = 0.9; }
    else if (o.type === 'bigtree') { putFlora(M, 'redwood', 0, 0, 0, 1.5 + r() * 0.3, r() * 6); M.cyl(0, -0.2, 0, 2.2, 0.6, '#5a3a22', 9); rad = 2.6; }
    else if (o.type === 'rock') { M.dode(0, 0.7, 0, 2.6, 1.8, 2.2, '#9a968c', r() * 6); M.dode(0.9, 0.4, 0.6, 1.2, 0.9, 1.1, '#8a867c', r() * 6); rad = 1.4; }
    else if (o.type === 'ore') { M.dode(0, 0.8, 0, 2.6, 2.0, 2.4, '#7a7066', r() * 6); for (let i = 0; i < 6; i++) { const a = r() * 6.28; M.dode(Math.cos(a) * 0.9, 0.6 + r() * 0.9, Math.sin(a) * 0.9, 0.5, 0.35, 0.5, '#c86a3a', r() * 6); } rad = 1.4; }
    else if (o.type === 'gem') { M.dode(0, 0.4, 0, 2.6, 1.2, 2.4, '#5a5068'); for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28 + r(), h = 1.4 + r() * 1.8; M.add(geo.cone(5), mat4(Math.cos(a) * 0.6, 0.6 + h / 2, Math.sin(a) * 0.6, 0, 0.55, h, 0.55, Math.cos(a) * 0.3, Math.sin(a) * 0.3), i % 2 ? '#7af0ff' : '#b8a0ff', { glow: true }); } rad = 1.5; }
    else if (o.type === 'bush') { putFlora(M, 'bush', 0, 0, 0, 1.1, r() * 6); for (let i = 0; i < 9; i++) { const a = r() * 6.28; M.ico(Math.cos(a) * 0.7, 0.5 + r() * 0.6, Math.sin(a) * 0.7, 0.22, 0.22, 0.22, '#d8304a'); } rad = 0.8; }
    g.add(M.mesh()); g.position.set(o.x, y, o.z); G.scene.add(g);
    const n = { ...o, y, N, hp: N.hp, alive: true, regrowAt: 0, g, rad, fall: 0, grow: 1 };
    n.col = G.colliders.circle(o.x, o.z, rad, y - 1, y + (o.type.includes('tree') ? 8 : 2.4), 'node');
    this.nodes.push(n); this.byId.set(n.id, n);
    G.scatter.exclude.push({ x: o.x, z: o.z, r: rad + 2 });
  }

  /* ---------------- hitting a spot ---------------- */
  /** the nearest living spot a player tool can work, near p */
  nearTool(p, behavior, range = 3.4) {
    let best = null, bd = range;
    for (const n of this.nodes) { if (!n.alive) continue; const d = Math.hypot(n.x - p.x, n.z - p.z) - n.rad; if (d < bd && (behavior === 'any' || n.N.tool === behavior || (behavior === 'chop' && (n.type === 'bigtree' || n.type === 'bush')) || (behavior === 'mine' && n.type === 'gem'))) { bd = d; best = n; } }
    return best;
  }
  /** host: damage a spot (by a player pid, or a worker uid); returns true if it broke */
  hit(id, dmg, by) {
    const G = this.g, n = this.byId.get(id); if (!n || !n.alive) return false;
    n.hp -= dmg;
    G.event({ k: 'nodeHit', id });
    if (n.hp > 0) return false;
    n.alive = false; n.regrowAt = G.time + n.N.regrow;
    G.event({ k: 'node', id, alive: false });
    if (by && by.player) this._give(n.N.res, this._roll(n.N.yield), n, by.player);
    return true;
  }
  _roll([a, b]) { return a + Math.floor(Math.random() * (b - a + 1)); }
  /** host: add to storage, with a floater where it happened */
  _give(res, n, at, pid) {
    const G = this.g, W = this.W;
    W.items[res] = (W.items[res] || 0) + n;
    W.stats['got_' + res] = (W.stats['got_' + res] || 0) + n;
    G.event({ k: 'gather', res, n, x: at.x, z: at.z, pid });
    G.saveSoon();
  }
  /** everyone: a spot was hit (shake) or changed */
  onEvent(e) {
    const n = this.byId.get(e.id); if (!n) return;
    const G = this.g;
    if (e.k === 'nodeHit') {
      n.shake = 0.3;
      const kind = n.type.includes('tree') ? 'leaf' : n.type === 'bush' ? 'leaf' : 'debris';
      G.fx.burst(n.x, n.y + (n.type.includes('tree') ? 1.5 : 0.8), n.z, kind, n.type === 'gem' ? 4 : 6, { scale: 0.6 });
      if (n.type === 'gem') G.fx.burst(n.x, n.y + 1.2, n.z, 'spark', 5);
      G.audio.thud?.({ x: n.x, y: n.y, z: n.z }, 0.4); G.audio.tone?.(n.type.includes('tree') ? 180 : 420, 0.06, 'square', 0.04);
    } else if (e.k === 'node') {
      n.alive = e.alive; n.hp = n.N.hp;
      if (!e.alive) { n.fall = 0.0001; if (!n.type.includes('tree')) G.fx.debris(n.x, n.y + 0.6, n.z, 12); G.colliders.remove(n.col); n.col = null; }
      else { n.fall = 0; n.grow = 0; n.g.visible = true; n.g.rotation.set(0, 0, 0); n.col = G.colliders.circle(n.x, n.z, n.rad, n.y - 1, n.y + 4, 'node'); }
    }
  }

  /* ---------------- the creatures that live here ---------------- */
  /** records living at the base */
  residents() { return Object.values(this.W.creatures).filter(r => r.at === 'zoo'); }
  /** the best this record can do a job */
  level(r, job) { return SP[r.sp]?.jobs?.[job] || 0; }
  sync() {
    const want = new Map(this.residents().slice(0, 30).map(r => [r.uid, r]));
    for (const c of [...this.workers]) if (!want.has(c.uid)) this._drop(c);
    for (const [uid, r] of want) if (!this.byUid.has(uid)) this._spawn(r);
  }
  _spawn(r) {
    const G = this.g, s = this.storage;
    const c = new Creature(G, { sp: r.sp, v: r.v, size: r.size, uid: r.uid, baby: r.baby, id: 'b' + r.uid });
    c.rec = r;
    if (c.swimmer) { c.pos.set(DOCK.x + (Math.random() - 0.5) * 30, -2, DOCK.z + 30 + Math.random() * 20); }
    else { const a = Math.random() * 6.28; c.pos.set(s.x + Math.cos(a) * 12, 0, s.z + Math.sin(a) * 12); c.pos.y = G.terrain.ground(c.pos.x, c.pos.z); }
    c.flying = false;
    c.ai = { st: 'idle', t: Math.random() * 2, tx: c.pos.x, tz: c.pos.z, node: null, hitT: 0, workT: 0 };
    c.place();
    this.workers.push(c); this.byUid.set(r.uid, c);
  }
  _drop(c) { this._uncarry(c); c.dispose(); this.workers.splice(this.workers.indexOf(c), 1); this.byUid.delete(c.uid); }
  /** how much bigger every haul is, from the transport workers */
  get haulBonus() { return this.residents().filter(r => r.job === 'transport').reduce((s, r) => s + this.level(r, 'transport') * 0.15, 0); }

  update(dt) {
    const G = this.g, host = G.isHost;
    // spots grow back, shake, fall
    for (const n of this.nodes) {
      if (!n.alive && host && G.time > n.regrowAt) G.event({ k: 'node', id: n.id, alive: true });
      if (n.shake > 0) { n.shake -= dt; n.g.rotation.z = Math.sin(n.shake * 60) * 0.04 * n.shake * 3; }
      if (n.fall > 0) {
        n.fall += dt;
        if (n.type.includes('tree')) { n.g.rotation.x = Math.min(Math.PI / 2, n.fall * n.fall * 1.6); if (n.fall > 1.2 && n.fall < 1.25) G.fx.dust(n.x + 4, n.y, n.z, 3); }
        else n.g.scale.setScalar(Math.max(0.001, 1 - n.fall * 3));
        if (n.fall > 2.2) { n.g.visible = false; n.fall = 0; n.g.scale.setScalar(1); }
      }
      if (n.grow < 1 && n.alive) { n.grow = Math.min(1, n.grow + dt * 0.8); n.g.scale.setScalar(Math.max(0.05, n.grow)); }
    }
    // the fire burns brighter with a kindler sat by it
    const kindling = this.workers.some(c => c.ai.st === 'kindle');
    if (this.flame) { this.flame.visible = kindling || (G.sky?.state.night || 0) > 0.5; this.flame.scale.y = 0.8 + Math.sin(G.time * 13) * 0.15 + Math.sin(G.time * 7.3) * 0.1; this.fireLight.intensity = this.flame.visible ? 2 + Math.sin(G.time * 11) * 0.3 : 0; }
    // the storage pile shows what you have
    this._pileT = (this._pileT || 0) - dt; if (this._pileT <= 0) { this._pileT = 2; this._pile(); }
    // the creatures
    if ((this._syncT = (this._syncT || 0) - dt) <= 0) { this._syncT = 1; this.sync(); }
    const cam = G.camera.position;
    for (const c of this.workers) {
      this._ai(c, dt);
      const d = Math.hypot(c.pos.x - cam.x, c.pos.z - cam.z);
      c.group.visible = d < 400 && !c.ai.away;
      if (!c.group.visible) continue;
      c.place();
      c._af = (c._af || 0) + dt;
      if (d < 120 || G.frame % 3 === 0) { c.animate(c._af, {}); c._af = 0; }
      const cr = this.carry.get(c); if (cr) { c.mouthPos?.(cr.position) || cr.position.set(c.pos.x, c.pos.y + c.height * 1.05, c.pos.z); cr.rotation.y = c.yaw; }
    }
  }
  _pile() {
    const W = this.W, P = this.pile; if (!P || !W) return;
    const key = [W.items.wood || 0, W.items.stone || 0, W.items.ore || 0, W.items.gem || 0].map(v => Math.min(12, Math.ceil(v / 10))).join();
    if (key === this._pileKey) return; this._pileKey = key;
    while (P.children.length) P.remove(P.children[0]);
    const [w, s, o, g] = key.split(',').map(Number), M = new Mesher(0.05, 79);
    for (let i = 0; i < w; i++) M.add(geo.cyl(6), mat4(-2.4 + (i % 4) * 0.42, 0.22 + Math.floor(i / 4) * 0.38, 0, 0, 0.4, 1.8, 0.4, 0, Math.PI / 2), '#8a5a32');
    for (let i = 0; i < s; i++) M.dode(0.4 + (i % 3) * 0.55, 0.25 + Math.floor(i / 3) * 0.4, -0.2, 0.55, 0.45, 0.55, '#a8a49a', i);
    for (let i = 0; i < o; i++) M.dode(1.9 + (i % 2) * 0.5, 0.22 + Math.floor(i / 2) * 0.38, 0.1, 0.45, 0.4, 0.45, '#b06a4a', i);
    for (let i = 0; i < g; i++) M.add(geo.cone(5), mat4(2.8, 0.3 + i * 0.12, -0.6 + i * 0.2, 0, 0.3, 0.7, 0.3), '#7af0ff', { glow: true });
    if (!M.empty) P.add(M.mesh());
  }
  _carry(c, res) {
    this._uncarry(c);
    const M = new Mesher(0.05, 80), col = ITEMS[res]?.color || '#a0703a';
    if (res === 'wood') { M.add(geo.cyl(6), mat4(0, 0, 0, 0, 0.35, 1.4, 0.35, 0, Math.PI / 2), col); M.add(geo.cyl(6), mat4(0, 0.3, 0, 0, 0.3, 1.2, 0.3, 0, Math.PI / 2), col); }
    else if (res === 'gem') M.add(geo.cone(5), mat4(0, 0, 0, 0, 0.4, 0.8, 0.4), col, { glow: true });
    else M.dode(0, 0, 0, 0.6, 0.5, 0.6, col);
    const m = M.mesh(); m.matrixAutoUpdate = true; m.scale.setScalar(Math.max(1, c.height * 0.5));
    this.g.scene.add(m); this.carry.set(c, m);
  }
  _uncarry(c) { const m = this.carry.get(c); if (m) { this.g.scene.remove(m); this.carry.delete(c); } }

  /* ---------------- a worker's brain ---------------- */
  _ai(c, dt) {
    const G = this.g, A = c.ai, r = this.W.creatures[c.uid], sp = c.sp; if (!r) return;
    A.t -= dt;
    const job = r.job && this.level(r, r.job) > 0 ? r.job : null, lv = job ? this.level(r, job) : 0;
    const walk = (x, z, fast) => { const d = Math.hypot(x - c.pos.x, z - c.pos.z); if (c.swimmer) { c.stepSwim(dt, new THREE.Vector3(x - c.pos.x, (-1.6 - c.pos.y) * 0.4, z - c.pos.z).normalize(), d > 2 ? sp.speed.swim * 0.5 : 0, {}); } else c.stepGround(dt, Math.atan2(x - c.pos.x, z - c.pos.z), d > 1.2 ? (fast ? Math.max(sp.speed.walk * 1.6, sp.speed.run * 0.55) : sp.speed.walk) : 0, {}); return d; };
    const still = () => { if (c.swimmer) c.stepSwim(dt, new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw)), 0.3, {}); else c.stepGround(dt, c.yaw, 0, {}); };
    c.astate = null;
    const night = (G.sky?.state.night || 0) > 0.6;
    // ---- explorers are away for a while
    if (A.away) {
      A.awayT -= dt; c.pos.set(A.ex, c.pos.y, A.ez);
      if (A.awayT <= 0) { A.away = false; A.st = 'return'; }
      return;
    }
    switch (A.st) {
      case 'go': {
        const n = A.node && this.byId.get(A.node);
        if (!n || !n.alive) { A.st = 'idle'; A.t = 0.5; break; }
        if (walk(n.x, n.z, true) < c.radius + n.rad + 0.9) { A.st = 'work'; A.hitT = 0.4; }
        if (A.t <= 0) { A.st = 'idle'; A.t = 1; }    // stuck
        break;
      }
      case 'work': {
        const n = A.node && this.byId.get(A.node);
        if (!n || !n.alive) { A.st = A.got ? 'carry' : 'idle'; A.t = 0.5; break; }
        c.yaw += wrapAngle(Math.atan2(n.x - c.pos.x, n.z - c.pos.z) - c.yaw) * Math.min(1, dt * 5);
        still();
        A.hitT -= dt;
        if (A.hitT <= 0) {
          A.hitT = Math.max(0.55, 1.3 - lv * 0.18);
          c.anim.play(job === 'farming' ? 'chomp' : 'attack');
          if (G.isHost) {
            const broke = this.hit(n.id, 0.6 + lv * 0.5 + (sp.size === 'L' || sp.size === 'XL' ? 0.6 : 0), { uid: c.uid });
            if (broke) { A.got = { res: n.N.res, n: this._roll(n.N.yield) }; this._carry(c, n.N.res); A.st = 'carry'; }
          }
        }
        break;
      }
      case 'carry': {
        const s = this.storage;
        if (walk(s.x, s.z, true) < c.radius + 2.2) {
          if (A.got && G.isHost) { const n = Math.round(A.got.n * (1 + this.haulBonus)); this._give(A.got.res, n, { x: c.pos.x, z: c.pos.z }); r.worked = (r.worked || 0) + n; }
          A.got = null; this._uncarry(c); A.st = 'idle'; A.t = 1 + Math.random() * 2;
          c.anim.play('call');
        }
        break;
      }
      case 'fish': {
        const f = A.spot; if (!f) { A.st = 'idle'; break; }
        if (walk(f.x, f.z) < (c.swimmer ? 4 : 1.6)) {
          still(); c.yaw += wrapAngle(f.face - c.yaw) * Math.min(1, dt * 3);
          A.workT -= dt;
          if (A.workT <= 0) {
            A.workT = Math.max(5, 22 - lv * 4);
            c.anim.play('chomp'); G.fx.splash(f.x + Math.sin(f.face) * 3, 0, f.z + Math.cos(f.face) * 3, 0.5);
            if (G.isHost && Math.random() < 0.55 + lv * 0.1) this._give('fish', 1 + (Math.random() < lv * 0.15 ? 1 : 0), { x: c.pos.x, z: c.pos.z });
          }
        }
        if (A.t <= 0) { A.st = 'idle'; A.t = 1; }
        break;
      }
      case 'kindle': {
        const f = this.fire;
        if (walk(f.x + 2.2, f.z + 1) < 1.5) {
          still(); c.astate = 'rest';
          A.workT -= dt;
          if (A.workT <= 0) { A.workT = Math.max(6, 20 - lv * 4); if (G.isHost && (this.W.items.wood || 0) >= 2) { this.W.items.wood -= 2; this._give('charcoal', 1, { x: f.x, z: f.z }); G.fx.burst(f.x, G.terrain.ground(f.x, f.z) + 1.5, f.z, 'ember', 10); } }
        }
        if (A.t <= 0) { A.st = 'idle'; A.t = 1; }
        break;
      }
      case 'explore': {
        if (walk(A.tx, A.tz, true) < 3 || A.t <= 0) { A.away = true; A.awayT = Math.max(40, 140 - lv * 25) * (0.7 + Math.random() * 0.6); A.ex = A.tx; A.ez = A.tz; }
        break;
      }
      case 'return': {
        const s = this.storage;
        if (walk(s.x, s.z) < c.radius + 2.5) {
          if (G.isHost) { const pick = this._find(lv); this._give(pick, pick === 'stone' || pick === 'wood' || pick === 'berries' ? 3 + lv : 1, { x: c.pos.x, z: c.pos.z }); if (ITEMS[pick].kind === 'find') G.event({ k: 'toast', t: (r.name || sp.name) + ' came back from exploring with ' + ITEMS[pick].name + '!', kind: 'good' }); }
          A.st = 'idle'; A.t = 3; c.anim.play('call');
        }
        break;
      }
      case 'nap': still(); c.astate = night ? 'sleep' : 'rest'; if (A.t <= 0) { A.st = 'idle'; A.t = 1; } break;
      case 'follow': {
        const P = G.player.pos, d = Math.hypot(P.x - c.pos.x, P.z - c.pos.z);
        if (d > 3.5 + c.radius) walk(P.x, P.z, d > 10); else { still(); }
        if (A.t <= 0 || d > 40) { A.st = 'idle'; A.t = 2; }
        break;
      }
      case 'play': {
        const o = A.pal && this.byUid.get(A.pal);
        if (!o) { A.st = 'idle'; break; }
        if (walk(o.pos.x, o.pos.z, true) < c.radius + o.radius + 1.5) { c.anim.play('call'); A.st = 'idle'; A.t = 1.5; }
        if (A.t <= 0) { A.st = 'idle'; A.t = 1; }
        break;
      }
      default: { // idle: pick something to do
        if (A.t > 0) { const d = walk(A.tx, A.tz); if (d < 1.5) still(); break; }
        this._decide(c, r, job, lv, night);
      }
    }
    if (!c.swimmer) c.pos.y = Math.max(c.pos.y, G.terrain.ground(c.pos.x, c.pos.z));
  }
  _decide(c, r, job, lv, night) {
    const G = this.g, A = c.ai, P = G.player.pos, pers = c.sp.personality, s = this.storage;
    const dP = Math.hypot(P.x - c.pos.x, P.z - c.pos.z);
    A.t = 3 + Math.random() * 5;
    if (night && Math.random() < 0.7) { A.st = 'nap'; A.t = 20; return; }
    if (job === 'lumber' || job === 'mining' || job === 'farming') {
      const types = Object.keys(NODES).filter(k => NODES[k].job === job && NODES[k].lv <= lv);
      let best = null, bd = Infinity;
      for (const n of this.nodes) { if (!n.alive || !types.includes(n.type)) continue; const busy = this.workers.filter(o => o !== c && o.ai.node === n.id).length; const d = Math.hypot(n.x - c.pos.x, n.z - c.pos.z) + busy * 40 - (n.type === 'gem' || n.type === 'bigtree' || n.type === 'ore' ? 15 : 0); if (d < bd) { bd = d; best = n; } }
      if (best) { A.st = 'go'; A.node = best.id; A.t = 60; return; }
    }
    if (job === 'fishing') { const D = this.g.landmarks?.dock, x0 = DOCK.x, side = c.uid.charCodeAt(1) % 2 ? 1 : -1; A.spot = c.swimmer ? { x: x0 + side * 18, z: DOCK.z + 30, face: 0 } : { x: x0 + side * 7, z: (D?.z0 ?? DOCK.z) - 2, face: 0 }; A.st = 'fish'; A.t = 90; A.workT = 6; return; }
    if (job === 'kindle') { A.st = 'kindle'; A.t = 60; A.workT = 8; return; }
    if (job === 'explore' && !c.swimmer) { const a = Math.random() * Math.PI * 2; A.tx = HOME.x + Math.cos(a) * (HOME.r - 20); A.tz = HOME.z + Math.sin(a) * (HOME.r - 20); A.st = 'explore'; A.t = 40; return; }
    if (job === 'transport') { const o = this.workers.filter(w => w !== c && (w.ai.st === 'work' || w.ai.st === 'carry'))[0]; if (o) { A.tx = o.pos.x; A.tz = o.pos.z; A.t = 6; return; } }
    // no job (or nothing to do): be yourself
    const pals = this.workers.filter(o => o !== c);
    const roll = Math.random();
    if ((pers === 'lazy' || pers === 'sleepy') && roll < 0.55) { A.st = 'nap'; A.t = 15 + Math.random() * 20; return; }
    if ((pers === 'curious' || pers === 'playful' || pers === 'cheerful') && dP < 30 && roll < 0.45) { A.st = 'follow'; A.t = 12; return; }
    if (pers === 'playful' && pals.length && roll < 0.7) { A.st = 'play'; A.pal = pals[Math.floor(Math.random() * pals.length)].uid; A.t = 8; return; }
    if (pers === 'timid' && dP < 8) { A.tx = c.pos.x + (c.pos.x - P.x) * 2; A.tz = c.pos.z + (c.pos.z - P.z) * 2; return; }
    if ((pers === 'proud' || pers === 'fierce') && roll < 0.2) { c.anim.play('roar'); }
    if (pers === 'cheerful' && roll < 0.3) c.anim.play('call');
    if (pers === 'grumpy' && roll < 0.4) { A.st = 'nap'; A.t = 10; return; }
    // wander round the yard, the garden and the plaza
    const R = c.swimmer ? 20 : 26, a = Math.random() * 6.28;
    const cx = c.swimmer ? DOCK.x : s.x, cz = c.swimmer ? DOCK.z + 35 : s.z;
    A.tx = cx + Math.cos(a) * R * Math.random(); A.tz = cz + Math.sin(a) * R * Math.random();
  }
  /** what an explorer brings back */
  _find(lv) {
    const r = Math.random() * (1 + lv * 0.4);
    if (r > 1.6) return 'amber'; if (r > 1.35) return 'gem'; if (r > 1.1) return 'fossil';
    return ['wood', 'stone', 'berries', 'ore'][Math.floor(Math.random() * 4)];
  }
}
void RARITY; void JOBS; void damp;
