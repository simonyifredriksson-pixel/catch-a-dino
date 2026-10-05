/* Wild.js - the wild animals: who spawns where, and how they behave.

   SPAWNING (host): each player keeps a living world around them. Species are
   picked from the biome under the spawn point, weighted by rarity, time of
   day, weather and events; herds spawn together; rare colours roll on every
   spawn. Spawns happen out of sight (behind you, far off) and animals that
   no player is near quietly leave. Some species never spawn this way: they
   live in DENS (a nest on Sky Mesa, inside the Whiteout, over the Trench,
   deep in Crystal Hollow) or only come with an EVENT.

   BEHAVIOUR (host): wander and graze, rest, sleep at night; herds stick
   together; skittish ones bolt, territorial ones warn you (roar) and then
   charge, aggressive ones hunt you. Predators chase other animals too (the
   prey always gets away - this is a zoo game). Bait pulls them in, a roar
   scatters them, a herd call calms them, spit and stings daze them. Flyers
   soar, perch and dive for fish; swimmers cruise, breach and lurk.

   Clients draw what the host's snapshots say, smoothly. */
import * as THREE from '../../lib/three.module.js';
import { Creature } from './Creature.js';
import { SPECIES, SP, RARITY, VARIANTS } from '../data/Species.js';
import { ITEMS } from '../data/Items.js';
import { ZOO, RIVER, WHITEOUT, VOLCANO, TRENCH, MESAS } from '../data/Biomes.js';
import { INTERIORS } from '../data/Places.js';
import { clamp, wrapAngle, weighted, lerp, damp } from '../core/Util.js';
import { Bus } from '../core/Bus.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const DENS = [
  { id: 'nest', sp: 'quetz', x: MESAS[0][0], z: MESAS[0][1], top: true, r: 20, respawn: 600 },
  { id: 'whiteout', sp: 'frostmaw', x: WHITEOUT.x, z: WHITEOUT.z, r: 70, respawn: 900 },
  { id: 'trench', sp: 'megalodon', x: TRENCH.x, z: TRENCH.z, r: 160, depth: [40, 120], respawn: 900 },
  { id: 'trench2', sp: 'leviathan', x: TRENCH.x - 120, z: TRENCH.z + 20, r: 120, depth: [140, 220], night: true, respawn: 1200 },
  { id: 'hollow', sp: 'crystal', x: INTERIORS.hollow.x, z: INTERIORS.hollow.z - 10, r: 30, respawn: 480 },
  { id: 'hollow2', sp: 'crystal', x: INTERIORS.hollow.x + 25, z: INTERIORS.hollow.z - 30, r: 20, respawn: 600 },
  { id: 'caldera', sp: 'ember', x: VOLCANO.x + 40, z: VOLCANO.z + 120, r: 50, respawn: 420 },
  { id: 'skull', sp: 'trex', x: INTERIORS.skullcave.x, z: INTERIORS.skullcave.z - 15, r: 20, respawn: 900 },
  { id: 'valley1', sp: 'trex', x: -150, z: -640, r: 50, respawn: 600 },
];
// river creatures spawn in the river's water, whatever the biome
function nearRiver(x, z) {
  let best = Infinity;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
const STATE = ['wander', 'eat', 'rest', 'sleep', 'flee', 'warn', 'charge', 'hunt', 'chase', 'bait', 'follow', 'soar', 'perch', 'cruise', 'dazed', 'held', 'back'];

export class Wild {
  constructor(game) {
    this.g = game;
    this.list = []; this.byId = new Map();
    this.baits = [];
    this.spawnT = 0; this.dens = {}; this.frame = 0;
  }
  get host() { return this.g.isHost; }

  /* ---------------- creating and removing ---------------- */
  add(o) {
    const c = new Creature(this.g, o);
    c.kg = o.kg ?? lerp(c.sp.kg[0], c.sp.kg[1], c.size);
    c.ai = { st: c.flyer ? 'soar' : c.swimmer ? 'cruise' : 'wander', t: Math.random() * 4, home: new THREE.Vector3(o.x, 0, o.z), tx: o.x, tz: o.z, alt: 0 };
    c.pos.set(o.x, o.y ?? 0, o.z); c.yaw = o.yaw ?? Math.random() * 6.28;
    c.flying = c.flyer && (o.flying ?? true);
    if (o.den) c.den = o.den;
    if (o.event) c.event = o.event;
    this.list.push(c); this.byId.set(c.id, c);
    c.place();
    return c;
  }
  remove(c) {
    if (!c || c.gone) return;
    c.gone = true; c.dispose();
    this.list.splice(this.list.indexOf(c), 1); this.byId.delete(c.id);
    if (c.pillar) c.pillar.remove();
    if (c.den) this.dens[c.den] = { t: this.g.time };
  }
  clear() { for (const c of [...this.list]) this.remove(c); }

  /* ---------------- spawning ---------------- */
  _ctx(x, z) {
    const G = this.g, T = G.terrain;
    const h = T.ground(x, z);
    let b = T.biome(x, z);
    const river = h < -1.5 && nearRiver(x, z) < 70;
    return { b, h, river, night: (G.sky?.state.night || 0) > 0.5, storm: G.weather.storm > 0.5, depth: -h, events: G.events.active };
  }
  weights(ctx, move) {
    const out = [];
    for (const sp of SPECIES) {
      if (sp.when?.den || sp.when?.event) continue;
      if (move && sp.move !== move && !(move === 'walk' && sp.move === 'amph')) continue;
      const here = sp.where.includes(ctx.b) || (ctx.river && sp.where.includes('river'));
      if (!here) continue;
      let w = RARITY[sp.rarity].w;
      if (sp.when?.night && !ctx.night) continue;
      if (sp.when?.storm && !ctx.storm) continue;
      if (sp.when?.storm && ctx.storm) w *= 25;
      if (sp.when?.night && ctx.night) w *= 6;
      if (ctx.night && sp.diet === 'carn') w *= 1.4;
      if (sp.move === 'swim') { const [a, b] = sp.depth || [2, 60]; if (ctx.depth < a) continue; if (ctx.depth > b * 3) w *= 0.2; }
      if (ctx.events?.migration && sp.move === 'fly') w *= 3;
      out.push({ sp, w });
    }
    return out;
  }
  /** pick a spot near (but not too near) p, out of sight if close */
  _spot(p, r0, r1) {
    const cam = this.g.camera, f = cam.getWorldDirection(_w);
    const back = Math.atan2(-f.x, -f.z);
    for (let k = 0; k < 8; k++) {
      const d = r0 + Math.random() * (r1 - r0);
      const a = d < 160 ? back + (Math.random() - 0.5) * 3.2 : Math.random() * Math.PI * 2;
      const x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d;
      if (Math.abs(x - ZOO.x) < ZOO.half + 40 && Math.abs(z - ZOO.z) < ZOO.half + 40) continue;
      if (Math.abs(x) > 1150 && !(x > 1300)) continue;
      return { x, z };
    }
    return null;
  }
  spawnAround(p) {
    const G = this.g, T = G.terrain;
    const interior = T.interiorAt(p.x, p.z);
    const s = interior ? { x: interior.x + (Math.random() - 0.5) * interior.r * 1.4, z: interior.z + (Math.random() - 0.5) * interior.r * 1.4 } : this._spot(p, 95, 230);
    if (!s) return;
    const ctx = this._ctx(s.x, s.z);
    if (interior) ctx.b = 'cave';
    let move = ctx.h < -2 ? 'swim' : 'walk';
    if (move === 'walk' && Math.random() < 0.18 && !interior) move = 'fly';
    if (move === 'swim' && Math.random() < 0.15) move = 'fly';
    const list = this.weights(ctx, move);
    const pick = weighted(list);
    if (!pick) return;
    this.spawnHerd(pick.sp, s.x, s.z, ctx);
  }
  rollVariant(boost = 1) {
    const r = Math.random();
    let acc = 0;
    for (const [k, V] of Object.entries(VARIANTS)) { acc += V.chance * boost; if (r < acc) return k; }
    return null;
  }
  spawnHerd(sp, x, z, ctx = {}, o = {}) {
    const G = this.g, T = G.terrain;
    const n = Math.max(1, Math.round(sp.herd[0] + Math.random() * (sp.herd[1] - sp.herd[0])));
    let leader = null;
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, d = i ? 3 + Math.random() * (4 + Math.sqrt(n) * 3) : 0;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      const h = T.ground(px, pz);
      let y = h;
      if (sp.move === 'swim') { if (h > -2) continue; const [a0, b0] = o.depth || sp.depth || [2, 40]; y = -clamp(a0 + Math.random() * (b0 - a0), 1.5, -h - 2); }
      else if (sp.move === 'fly') { const [f0, f1] = sp.flyH || [20, 60]; y = Math.max(h, 0) + f0 + Math.random() * (f1 - f0); }
      else if (h < -0.3 && sp.move !== 'amph') continue;
      else if (T.slope(px, pz) > 0.6 && !sp.abilities.includes('climb')) continue;
      const size = Math.min(1, Math.max(0, Math.random() * 0.75 + (Math.random() < 0.08 ? 0.3 : 0) + (o.big || 0)));
      const v = o.v !== undefined ? o.v : this.rollVariant(o.luck || 1);
      const c = this.add({ sp: sp.id, x: px, z: pz, y, size, v, flying: sp.move === 'fly', den: i === 0 ? o.den : null, event: o.event });
      if (leader) { c.ai.leader = leader; c.ai.off = [Math.cos(a) * d, Math.sin(a) * d]; c.ai.st = c.flyer ? 'soar' : c.swimmer ? 'cruise' : 'follow'; }
      else leader = c;
      out.push(c);
      // something special? tell the world (a little)
      const R = RARITY[sp.rarity];
      if ((R.stars >= 4 || v || (R.stars === 3 && Math.random() < 0.3)) && !o.quiet) this.g.events.sighting(c);
    }
    return out;
  }
  _dens(dt) {
    const G = this.g;
    for (const D of DENS) {
      const live = this.list.find(c => c.den === D.id);
      if (live) continue;
      const last = this.dens[D.id];
      if (last && G.time - last.t < D.respawn) continue;
      if (D.night && (G.sky?.state.night || 0) < 0.5) continue;
      const near = G.players().some(p => Math.hypot(p.pos.x - D.x, p.pos.z - D.z) < 320);
      if (!near) continue;
      const sp = SP[D.sp];
      const a = Math.random() * 6.28, d = Math.random() * D.r * 0.6;
      const x = D.x + Math.cos(a) * d, z = D.z + Math.sin(a) * d;
      const cs = this.spawnHerd(sp, x, z, {}, { den: D.id, depth: D.depth, big: 0.25 });
      for (const c of cs || []) { c.ai.home.set(D.x, 0, D.z); c.ai.homeR = D.r; if (D.top) { c.flying = false; c.pos.y = G.terrain.ground(x, z); c.ai.st = 'perch'; c.ai.t = 30; } }
      this.dens[D.id] = { t: G.time };
    }
  }

  /* ---------------- claiming (catching) ---------------- */
  claim(c) {
    if (c.claim && c.claim !== this.g.me) return false;
    if (c.uid) return false;
    c.claim = this.g.me; c.ai.st = 'held';
    if (!this.host) this.g.act({ k: 'claim', id: c.id });
    return true;
  }
  release(c, mode = 'flee') {
    if (!c) return;
    c.claim = null; c.astate = null;
    if (!this.host) this.g.act({ k: 'unclaim', id: c.id, mode });
    this._setAfter(c, mode);
  }
  _setAfter(c, mode) {
    c.ai.st = mode === 'angry' ? 'charge' : mode === 'calm' ? 'wander' : c.flyer ? 'soar' : c.swimmer ? 'cruise' : 'flee';
    if (mode === 'angry') { c.ai.target = this.g.nearestPlayer(c.pos)?.pid; c.ai.t = 6; }
    else if (mode !== 'calm') { c.ai.t = 8; const p = this.g.nearestPlayer(c.pos); if (p) c.ai.from = p.pos.clone(); }
    if (c.flyer && mode !== 'calm') { c.ai.alt = 50; c.flying = true; }
  }
  spook(c, from) { if (c.claim) return; c.ai.st = 'flee'; c.ai.t = 6; c.ai.from = from.clone(); }
  /** a projectile at pos: did it reach a creature? */
  hitTest(pos, reach) {
    let best = null, bd = Infinity;
    for (const c of this.list) {
      if (c.gone) continue;
      c.centre(_v);
      const d = _v.distanceTo(pos) - c.radius - c.height * 0.25;
      if (d < reach && d < bd) { bd = d; best = c; }
    }
    return best;
  }
  near(p, r) { return this.list.filter(c => !c.gone && c.pos.distanceTo(p) < r); }

  /* ---------------- host: stuns, roars, calls, bait ---------------- */
  stun(c, t, knock) { c.stun = Math.max(c.stun, t); if (c.ai) { c.ai.st = 'dazed'; c.ai.t = t; } if (knock) { c.pos.x += knock[0] * 0.15; c.pos.z += knock[1] * 0.15; c.speed = 0; } c.anim.play('shake'); }
  roarAt(x, z, r, big) {
    for (const c of this.list) {
      if (c.claim) continue;
      const d = Math.hypot(c.pos.x - x, c.pos.z - z); if (d > r) continue;
      const stars = RARITY[c.sp.rarity].stars;
      if (stars >= 5) continue;     // legends do not care
      if (c.sp.diet === 'carn' && stars <= big) { c.ai.st = 'flee'; c.ai.t = 10; c.ai.from = new THREE.Vector3(x, 0, z); }
      else if (c.sp.size === 'S' || c.sp.size === 'M') this.stun(c, 3.5);
      else { c.ai.st = 'flee'; c.ai.t = 6; c.ai.from = new THREE.Vector3(x, 0, z); }
    }
  }
  callAt(x, z, r) { for (const c of this.list) { if (c.claim || c.sp.diet === 'carn') continue; if (Math.hypot(c.pos.x - x, c.pos.z - z) < r) { c.calm = 10; if (c.ai.st === 'flee' || c.ai.st === 'charge' || c.ai.st === 'warn') { c.ai.st = 'wander'; c.ai.t = 4; } } } }
  aoe(x, z, r, stun, knock) { for (const c of this.list) { if (c.claim) continue; const dx = c.pos.x - x, dz = c.pos.z - z, d = Math.hypot(dx, dz); if (d < r + c.radius) this.stun(c, stun, [dx / (d || 1) * knock, dz / (d || 1) * knock]); } }
  addBait(x, y, z, item) {
    const I = ITEMS[item]; if (!I) return;
    this.baits.push({ x, y, z, item, diet: I.diet, t: 30, lure: !!I.lure });
    this.g.baitMesh?.(x, y, z, item);
    if (I.lure) {
      // golden fruit: something rare comes for it
      const ctx = this._ctx(x, z);
      const list = this.weights(ctx, ctx.h < -2 ? 'swim' : 'walk').filter(e => RARITY[e.sp.rarity].stars >= 3);
      const pick = weighted(list);
      if (pick) { const a = Math.random() * 6.28; const cs = this.spawnHerd(pick.sp, x + Math.cos(a) * 110, z + Math.sin(a) * 110, ctx, { quiet: true, luck: 3 }); cs?.forEach(c => { c.ai.st = 'bait'; c.ai.bait = this.baits[this.baits.length - 1]; }); this.g.ui.toast('Something big smelled the Golden Fruit...', 'good'); }
    }
  }

  /* ---------------- per frame ---------------- */
  update(dt) {
    const G = this.g;
    this.frame++;
    if (this.host) {
      // spawning: keep a living world around every player
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 0.35;
        for (const p of G.players()) {
          const n = this.list.filter(c => Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < 240).length;
          const want = G.terrain.interiorAt(p.pos.x, p.pos.z) ? 6 : G.terrain.ground(p.pos.x, p.pos.z) < -10 ? 12 : 20;
          if (n < want && this.list.length < 90) this.spawnAround(p.pos);
        }
        this._dens(dt);
        // leave quietly when nobody is near
        for (const c of [...this.list]) {
          if (c.claim) continue;
          const d = G.players().reduce((m, p) => Math.min(m, Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z)), Infinity);
          if (d > (c.den || c.event ? 420 : 320)) this.remove(c);
        }
      }
      for (let i = this.baits.length - 1; i >= 0; i--) { const b = this.baits[i]; b.t -= dt; if (b.t <= 0) { this.baits.splice(i, 1); G.unbaitMesh?.(b); } }
    }
    const cam = G.camera.position;
    for (const c of this.list) {
      if (c.gone) continue;
      const dc = Math.hypot(c.pos.x - cam.x, c.pos.z - cam.z);
      c.visible = dc < 430; c.group.visible = c.visible;
      const mine = c.claim === G.me;
      if (this.host && !c.claim) {
        // far from everyone: think less often
        c._acc = (c._acc || 0) + dt;
        const every = dc < 160 ? 0 : dc < 280 ? 0.15 : 0.4;
        if (c._acc >= every) { this._ai(c, c._acc); c._acc = 0; }
      } else if (!this.host && !mine) this._interp(c, dt);
      else if (this.host && c.claim && c.claim !== G.me) this._fromClaimer(c, dt);
      c.stun = Math.max(0, c.stun - dt);
      c.calm = Math.max(0, (c.calm || 0) - dt);
      if (!c.visible) continue;
      c.place();
      // animation level of detail
      const every = dc < 70 ? 1 : dc < 160 ? 2 : 5;
      c._af = (c._af || 0) + dt;
      if (this.frame % every === 0) { c.animate(c._af, {}); c._af = 0; }
    }
    this._separate();
  }
  _separate() {
    const L = this.list;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      if (a.flying || b.flying) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, m = a.radius + b.radius, d2 = dx * dx + dz * dz;
      if (d2 > m * m || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), push = (m - d) * 0.5;
      const wa = b.heavy / (a.heavy + b.heavy + 0.01), wb = 1 - wa;
      if (!a.claim) { a.pos.x -= dx / d * push * wa; a.pos.z -= dz / d * push * wa; }
      if (!b.claim) { b.pos.x += dx / d * push * wb; b.pos.z += dz / d * push * wb; }
    }
  }

  /* ---------------- the brain (host) ---------------- */
  _ai(c, dt) {
    const G = this.g, A = c.ai, sp = c.sp;
    A.t -= dt;
    if (c.stun > 0 || A.st === 'dazed') { if (c.stun <= 0) { A.st = 'wander'; A.t = 2; } this._move(c, dt, c.yaw, 0); c.astate = null; if (Math.random() < dt * 0.6) c.anim.play('shake'); return; }
    const near = G.nearestPlayer(c.pos);
    const P = near?.pos, d = near ? Math.hypot(P.x - c.pos.x, P.z - c.pos.z) : 1e9;
    const sneaking = near?.crouch;
    const pm = near?.mountSp ? SP[near.mountSp] : null;
    let detect = (sp.temper === 'skittish' ? 26 : sp.temper === 'aggressive' ? 34 : 18) * (sneaking ? 0.45 : 1) * (pm?.abilities.includes('ambush') && near?.under ? 0.3 : 1);
    if (pm && pm.diet === 'carn' && sp.diet !== 'carn') detect *= 1.3;
    const night = (G.sky?.state.night || 0) > 0.5, nocturnal = !!sp.when?.night;
    // reactions to you (unless something more urgent is going on)
    if (near && !['flee', 'charge', 'hunt', 'held', 'bait', 'back'].includes(A.st) && !(c.calm > 0)) {
      if (sp.temper === 'skittish' && d < detect) { A.st = 'flee'; A.t = 6 + Math.random() * 4; A.from = P.clone(); if (A.leader === undefined) this._herd(c, 'flee', P); c.anim.play(Math.random() < 0.5 ? 'call' : 'shake'); }
      else if (sp.temper === 'territorial' && d < 22 && A.st !== 'warn') { A.st = 'warn'; A.t = 2.6; A.target = near.pid; c.anim.play('roar'); G.event({ k: 'roar', id: c.id }); }
      else if (sp.temper === 'aggressive' && d < detect && !(pm && pm.abilities.includes('roar') && RARITY[pm.rarity].stars > RARITY[sp.rarity].stars)) { A.st = 'hunt'; A.t = 22; A.target = near.pid; c.anim.play('roar'); G.event({ k: 'roar', id: c.id }); }
      else if (pm && pm.abilities.includes('roar') && sp.temper === 'aggressive' && d < detect) { A.st = 'flee'; A.t = 6; A.from = P.clone(); }
      else if (sp.temper === 'calm' && d < 3.5 + c.radius) { A.st = 'back'; A.t = 1.5; A.from = P.clone(); }
    }
    // bait?
    if (!['flee', 'charge', 'hunt', 'held', 'bait', 'warn'].includes(A.st)) {
      for (const b of this.baits) {
        if (!b.diet.includes(sp.diet)) continue;
        // swimmers take bait in the water, walkers on land; flyers and amphibians take either
        const wet = b.y < -0.3;
        if (!(c.flyer || c.amph || (c.swimmer ? wet : !wet))) continue;
        const db = Math.hypot(b.x - c.pos.x, b.z - c.pos.z);
        if (db < (b.lure ? 140 : 48)) { A.st = 'bait'; A.bait = b; A.t = 25; break; }
      }
    }
    if (c.flyer) return this._aiFly(c, dt, near, d);
    if (c.swimmer) return this._aiSwim(c, dt, near, d);
    c.astate = null;
    switch (A.st) {
      case 'follow': {
        const L = A.leader;
        if (!L || L.gone) { A.st = 'wander'; A.leader = null; break; }
        if (L.ai.st === 'flee') { A.st = 'flee'; A.t = L.ai.t; A.from = L.ai.from; break; }
        const tx = L.pos.x + A.off[0], tz = L.pos.z + A.off[1], dd = Math.hypot(tx - c.pos.x, tz - c.pos.z);
        const want = dd > 2 ? clamp(dd * 0.8, 0, Math.max(L.speed * 1.1, sp.speed.walk)) : 0;
        this._move(c, dt, Math.atan2(tx - c.pos.x, tz - c.pos.z), want);
        c.astate = L.astate === 'eat' || L.astate === 'rest' || L.astate === 'sleep' ? L.astate : null;
        if (c.astate === 'eat' && dd < 3) c.speed = 0;
        break;
      }
      case 'wander': {
        if (A.t <= 0) {
          const roll = Math.random();
          if (night && !nocturnal && roll < 0.6) { A.st = 'sleep'; A.t = 40 + Math.random() * 40; break; }
          if (roll < 0.3) { A.st = 'eat'; A.t = 6 + Math.random() * 8; break; }
          if (roll < 0.4) { A.st = 'rest'; A.t = 10 + Math.random() * 14; break; }
          const R = A.homeR || 45, a = Math.random() * 6.28;
          A.tx = A.home.x + Math.cos(a) * R * Math.random(); A.tz = A.home.z + Math.sin(a) * R * Math.random();
          A.t = 8 + Math.random() * 10;
          if (sp.diet === 'carn' && Math.random() < 0.18) this._startChase(c);
        }
        const dd = Math.hypot(A.tx - c.pos.x, A.tz - c.pos.z);
        this._move(c, dt, Math.atan2(A.tx - c.pos.x, A.tz - c.pos.z), dd > 2 ? sp.speed.walk : 0, { avoidWater: !c.amph, onBlocked: () => { A.t = 0; } });
        break;
      }
      case 'eat': this._move(c, dt, c.yaw, 0); c.astate = 'eat'; if (A.t <= 0) { A.st = 'wander'; A.t = 0; } break;
      case 'rest': this._move(c, dt, c.yaw, 0); c.astate = 'rest'; if (A.t <= 0) { A.st = 'wander'; A.t = 0; } break;
      case 'sleep': this._move(c, dt, c.yaw, 0); c.astate = 'sleep'; if (A.t <= 0 || !night) { A.st = 'wander'; A.t = 0; } if (near && d < detect * 0.4 && !sneaking) { A.st = sp.temper === 'skittish' ? 'flee' : 'wander'; A.t = 5; A.from = P?.clone(); } break;
      case 'back': { const a = Math.atan2(c.pos.x - A.from.x, c.pos.z - A.from.z); this._move(c, dt, a, sp.speed.walk * 1.4); if (A.t <= 0) A.st = 'wander'; break; }
      case 'flee': {
        const from = A.from || P || c.pos;
        const a = Math.atan2(c.pos.x - from.x, c.pos.z - from.z);
        this._move(c, dt, a + Math.sin(G.time * 0.7 + c.pos.x) * 0.4, sp.speed.run, { avoidWater: !c.amph, onBlocked: () => { A.from = c.pos.clone().add(_v.set(Math.random() - 0.5, 0, Math.random() - 0.5)); } });
        if (A.t <= 0) { A.st = 'wander'; A.t = 2; A.home.copy(c.pos); }
        break;
      }
      case 'warn': {
        const tp = G.playerPos(A.target);
        if (tp) this._move(c, dt, Math.atan2(tp.x - c.pos.x, tp.z - c.pos.z), 0);
        if (A.t <= 0) { const dd = tp ? Math.hypot(tp.x - c.pos.x, tp.z - c.pos.z) : 99; if (dd < 15) { A.st = 'charge'; A.t = 5; } else { A.st = 'wander'; A.t = 3; } }
        break;
      }
      case 'charge': case 'hunt': {
        const tp = G.playerPos(A.target);
        if (!tp || A.t <= 0) { A.st = 'wander'; A.t = 4; break; }
        const dx = tp.x - c.pos.x, dz = tp.z - c.pos.z, dd = Math.hypot(dx, dz);
        if (dd > 60) { A.st = 'wander'; A.t = 3; break; }
        this._move(c, dt, Math.atan2(dx, dz), sp.speed.run * (A.st === 'charge' ? 1 : 0.92), { avoidWater: !c.amph });
        if (dd < c.radius + 1.8 + (A.st === 'charge' ? 1 : 0)) {
          c.anim.play('attack');
          G.hitPlayer(A.target, c, A.st === 'charge' ? 9 : 6);
          A.st = 'back'; A.t = 2.5; A.from = tp.clone();
          if (Math.random() < 0.5) setTimeout(() => { if (!c.gone && c.ai.st === 'back') { c.ai.st = sp.temper === 'aggressive' ? 'hunt' : 'wander'; c.ai.t = 10; } }, 2600);
        }
        break;
      }
      case 'chase': {
        const prey = A.prey;
        if (!prey || prey.gone || A.t <= 0) { A.st = 'wander'; A.t = 3; break; }
        const dx = prey.pos.x - c.pos.x, dz = prey.pos.z - c.pos.z, dd = Math.hypot(dx, dz);
        this._move(c, dt, Math.atan2(dx, dz), sp.speed.run * 0.9, { avoidWater: !c.amph });
        if (dd < c.radius + prey.radius + 1) { c.anim.play('attack'); G.event({ k: 'roar', id: c.id }); A.st = 'eat'; A.t = 8; prey.ai.st = 'flee'; prey.ai.t = 8; prey.ai.from = c.pos.clone(); }
        break;
      }
      case 'bait': {
        const b = A.bait;
        if (!b || b.t <= 0) { A.st = 'wander'; A.t = 1; break; }
        const dx = b.x - c.pos.x, dz = b.z - c.pos.z, dd = Math.hypot(dx, dz);
        if (dd > c.radius + 1.6) this._move(c, dt, Math.atan2(dx, dz), sp.speed.walk * 1.6, {});
        else { this._move(c, dt, Math.atan2(dx, dz), 0); c.astate = 'eat'; A.eatT = (A.eatT || 0) + dt; if (A.eatT > 18) { b.t = 0; A.st = 'rest'; A.t = 8; A.eatT = 0; } }
        break;
      }
      default: A.st = 'wander'; A.t = 0;
    }
  }
  _startChase(c) {
    const prey = this.list.find(o => o !== c && !o.gone && !o.claim && !o.flyer && !o.swimmer && o.sp.diet !== 'carn' && o.radius < c.radius * 1.3 && o.pos.distanceTo(c.pos) < 45);
    if (!prey) return;
    c.ai.st = 'chase'; c.ai.prey = prey; c.ai.t = 10;
    prey.ai.st = 'flee'; prey.ai.t = 12; prey.ai.from = c.pos.clone();
    this._herd(prey, 'flee', c.pos);
    this.g.event({ k: 'roar', id: c.id });
  }
  _herd(c, st, from) { for (const o of this.list) if (o.ai.leader === c || (c.ai.leader && (o === c.ai.leader || o.ai.leader === c.ai.leader))) { o.ai.st = st; o.ai.t = 6 + Math.random() * 3; o.ai.from = from.clone(); } }
  _move(c, dt, heading, want, o) {
    // amphibians in deep water swim, everything else walks
    c.stepGround(dt, heading, want, o);
  }
  _aiFly(c, dt, near, d) {
    const G = this.g, A = c.ai, sp = c.sp;
    const [f0, f1] = sp.flyH || [20, 60];
    c.astate = null;
    if (A.st === 'perch' || !c.flying) {
      c.flying = false;
      c.stepGround(dt, c.yaw, 0, {});
      c.astate = A.t > 6 ? 'rest' : null;
      if (A.t <= 0 || (near && d < (sp.temper === 'skittish' ? 22 : 12))) { c.takeOff(); A.st = 'soar'; A.t = 20 + Math.random() * 20; A.alt = f0 + Math.random() * (f1 - f0); }
      return;
    }
    const gy = Math.max(G.terrain.ground(c.pos.x, c.pos.z), 0);
    if (!A.alt) A.alt = f0 + Math.random() * (f1 - f0);
    let heading, want = (sp.speed.fly || 15) * 0.6, climb = (gy + A.alt - c.pos.y) * 0.4;
    if (A.st === 'flee') {
      const from = A.from || near?.pos || c.pos;
      heading = Math.atan2(c.pos.x - from.x, c.pos.z - from.z); want = sp.speed.fly || 15; climb = 6;
      if (A.t <= 0) { A.st = 'soar'; A.home.copy(c.pos); }
    } else if (A.st === 'bait' && A.bait) {
      const b = A.bait; heading = Math.atan2(b.x - c.pos.x, b.z - c.pos.z); climb = (Math.max(b.y, 0) + 1.5 - c.pos.y) * 0.6;
      if (Math.hypot(b.x - c.pos.x, b.z - c.pos.z) < 4) { want = 2; c.astate = 'eat'; A.eatT = (A.eatT || 0) + dt; if (A.eatT > 12) { b.t = 0; A.st = 'soar'; A.eatT = 0; } }
      if (b.t <= 0) A.st = 'soar';
    } else if (A.st === 'hunt' || A.st === 'charge' || A.st === 'warn') {
      const tp = G.playerPos(A.target);
      if (!tp || A.t <= 0) { A.st = 'soar'; }
      else {
        heading = Math.atan2(tp.x - c.pos.x, tp.z - c.pos.z); want = sp.speed.fly || 15; climb = (tp.y + 2 - c.pos.y) * 0.8;
        if (c.pos.distanceTo(tp) < c.radius + 2.5) { c.anim.play('attack'); G.hitPlayer(A.target, c, 6); A.st = 'flee'; A.t = 4; A.from = tp.clone(); }
      }
    } else {
      // soar: big lazy circles around home; fish eaters dive to the water now and then
      A.ang = (A.ang ?? Math.random() * 6.28) + dt * (want / Math.max(20, 40 + c.len * 2));
      const R = 40 + c.len * 3;
      const tx = A.home.x + Math.cos(A.ang) * R, tz = A.home.z + Math.sin(A.ang) * R;
      heading = Math.atan2(tx - c.pos.x, tz - c.pos.z);
      if (A.t <= 0) {
        A.t = 15 + Math.random() * 20;
        const r = Math.random();
        if (r < 0.25) { A.st = 'perch'; c.flying = true; A.landing = true; }
        else A.alt = f0 + Math.random() * (f1 - f0);
        if (sp.diet === 'fish' && G.terrain.ground(c.pos.x, c.pos.z) < -1 && Math.random() < 0.5) A.dive = 3;
      }
      if (A.dive > 0) { A.dive -= dt; climb = (0.8 - c.pos.y) * 1.2; if (c.pos.y < 2) { G.fx.splash(c.pos.x, 0, c.pos.z, 1); A.dive = 0; } }
      if (near && sp.temper === 'territorial' && d < 30 && near.flying) { A.st = 'hunt'; A.target = near.pid; A.t = 12; G.event({ k: 'roar', id: c.id }); }
      if (near && sp.temper === 'skittish' && d < 25) { A.st = 'flee'; A.t = 6; A.from = near.pos.clone(); }
    }
    if (A.landing) { climb = (gy - c.pos.y) * 0.6; want = Math.min(want, 6); if (c.pos.y - gy < 2) { c.flying = false; A.landing = false; A.st = 'perch'; A.t = 15 + Math.random() * 15; return; } }
    c.stepFly(dt, heading ?? c.yaw, want, clamp(climb, -10, 8), {});
  }
  _aiSwim(c, dt, near, d) {
    const G = this.g, A = c.ai, sp = c.sp;
    c.astate = null;
    const [d0, d1] = sp.depth || [2, 40];
    if (A.tdepth == null || A.t <= 0) { A.tdepth = d0 + Math.random() * (d1 - d0); A.t = 6 + Math.random() * 8; const a = Math.random() * 6.28, R = A.homeR || 60; A.tx = A.home.x + Math.cos(a) * R * Math.random(); A.tz = A.home.z + Math.sin(a) * R * Math.random(); if (sp.abilities.includes('leap') && Math.random() < 0.35) A.leap = true; }
    let tx = A.tx, tz = A.tz, ty = -A.tdepth, want = sp.speed.swim * 0.45;
    if (A.st === 'flee') { const from = A.from || near?.pos || c.pos; tx = c.pos.x + (c.pos.x - from.x); tz = c.pos.z + (c.pos.z - from.z); ty = -d1; want = sp.speed.swim; if (A.t <= 0) A.st = 'cruise'; }
    else if (A.st === 'hunt' || A.st === 'charge' || A.st === 'warn') {
      const tp = G.playerPos(A.target);
      if (!tp || A.t <= 0 || tp.y > 1.5) A.st = 'cruise';
      else { tx = tp.x; tz = tp.z; ty = Math.min(-0.5, tp.y); want = sp.speed.swim * 0.9; if (c.pos.distanceTo(tp) < c.radius + 2.5) { c.anim.play('attack'); G.hitPlayer(A.target, c, 7); A.st = 'flee'; A.t = 5; A.from = tp.clone(); } }
    } else if (A.st === 'bait' && A.bait) { const b = A.bait; tx = b.x; tz = b.z; ty = -1; if (Math.hypot(b.x - c.pos.x, b.z - c.pos.z) < 4) { want = 1; c.astate = 'eat'; A.eatT = (A.eatT || 0) + dt; if (A.eatT > 12) { b.t = 0; A.st = 'cruise'; A.eatT = 0; } } if (b.t <= 0) A.st = 'cruise'; }
    else {
      A.st = 'cruise';
      if (near && near.inWater && sp.temper === 'aggressive' && d < 30) { A.st = 'hunt'; A.target = near.pid; A.t = 14; }
      else if (near && near.inWater && sp.temper === 'skittish' && d < 18) { A.st = 'flee'; A.t = 6; A.from = near.pos.clone(); }
      if (A.leap) { ty = 2; want = sp.speed.swim; }
    }
    _v.set(tx - c.pos.x, (ty - c.pos.y) * 0.5, tz - c.pos.z);
    if (_v.lengthSq() < 0.5) _v.set(Math.sin(c.yaw), 0, Math.cos(c.yaw));
    c.stepSwim(dt, _v.normalize(), want, { breach: A.leap, onBreach: () => { A.leap = false; this.g.event({ k: 'splash', x: c.pos.x, z: c.pos.z, s: c.height * 0.5 }); }, onSplash: () => this.g.event({ k: 'splash', x: c.pos.x, z: c.pos.z, s: c.height * 0.6 }), onShallow: () => { A.t = 0; } });
  }

  /* ---------------- network ---------------- */
  snapshot() {
    const r = v => Math.round(v * 100) / 100;
    return this.list.map(c => [c.id, c.spId, c.v || 0, r(c.size), r(c.pos.x), r(c.pos.y), r(c.pos.z), r(c.yaw), r(c.pitch), r(c.roll), r(c.speed), c.astate ? STATE.indexOf(c.astate) : -1, (c.flying ? 1 : 0) | (c.under ? 2 : 0) | (c.inWater ? 4 : 0), c.claim || 0, c.anim.act || 0, r(c.flap)]);
  }
  applySnapshot(arr) {
    const seen = new Set();
    for (const s of arr) {
      const [id, sp, v, size, x, y, z, yaw, p, rl, spd, st, fl, cl, act, fp] = s;
      seen.add(id);
      let c = this.byId.get(id);
      if (!c) { c = this.add({ id, sp, v: v || null, size, x, y, z, yaw }); c.pos.set(x, y, z); }
      c.net = { x, y, z, yaw, p, r: rl };
      if (c.claim !== this.g.me) { c.speed = spd; c.astate = st >= 0 ? (['eat', 'rest', 'sleep'].includes(STATE[st]) ? STATE[st] : null) : null; c.flying = !!(fl & 1); c.under = !!(fl & 2); c.inWater = !!(fl & 4); c.flap = fp; }
      if (cl !== this.g.me) c.claim = cl || null;
      if (act && act !== c._netAct) { c._netAct = act; c.anim.play(act); } else if (!act) c._netAct = 0;
    }
    for (const c of [...this.list]) if (!seen.has(c.id) && c.claim !== this.g.me) this.remove(c);
  }
  _interp(c, dt) {
    const n = c.net; if (!n) return;
    const k = 1 - Math.exp(-dt * 8);
    c.pos.x += (n.x - c.pos.x) * k; c.pos.y += (n.y - c.pos.y) * k; c.pos.z += (n.z - c.pos.z) * k;
    c.yaw += wrapAngle(n.yaw - c.yaw) * k; c.pitch += (n.p - c.pitch) * k; c.roll += (n.r - c.roll) * k;
  }
  /** host: a client is fighting this one; take its position from their state */
  _fromClaimer(c, dt) {
    const st = this.g.remoteState(c.claim)?.cl;
    if (st && st.id === c.id) { c.net = st; this._interp(c, dt); c.astate = 'thrash'; c.speed = st.s || 3; }
  }
}
void damp; void Bus;
