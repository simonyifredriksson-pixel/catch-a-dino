/* Zoo.js - your zoo: exhibits, the animals living in them, and the money.

   HAPPINESS (0..1) per animal: its own habitat (+), enough space (crowding
   hurts), decor inside the fence, company for herd animals, no predators
   staring at it. Aggressive predators outside a predator paddock get
   restless - and restless tyrants BREAK OUT (then you get to catch them again).
   APPEAL = sum over animals of species appeal x colour bonus x happiness,
   plus decor and facilities. It sets the zoo's STAR LEVEL (unlocks), how
   many visitors come, and the ticket price.
   MONEY: tickets as visitors arrive, spending at stalls and shops, tips when
   an animal does something spectacular in front of a crowd. While you are
   out exploring the zoo keeps earning (counted, not simulated).

   Animals in exhibits wander inside the fence, eat at the trough, nap, sleep
   at night, roar at the crowd; swimmers circle their tank, flyers their dome. */
import * as THREE from '../../lib/three.module.js';
import { Creature } from './Creature.js';
import { SP, RARITY, SIZE, VARIANTS } from '../data/Species.js';
import { HABITATS, EX_SIZES, DECOR, ZOO_LEVELS, ZOO_LEVEL_NAMES, PLOTS } from '../data/Build.js';
import { ZOO } from '../data/Biomes.js';
import { exhibitArt, decorArt, zooGate, rangerStation } from '../art/ZooArt.js';
import { clamp, damp, wrapAngle, lerp } from '../core/Util.js';
import { Bus } from '../core/Bus.js';

const _v = new THREE.Vector3();
export const GATE = { x: ZOO.x, z: ZOO.z + 62 };       // the entrance (moves out as the plot grows)
export const STATION = { x: ZOO.x + 16, z: ZOO.z + 44 };

/** which habitats keep a species happy */
export function habitatOK(sp, hab) {
  if (sp.move === 'fly') return hab === 'aviary' ? 1 : 0;
  if (sp.move === 'swim') return hab === 'aquatic' ? 1 : 0;
  if (hab === 'aviary' || hab === 'aquatic') return sp.move === 'amph' && hab === 'aquatic' ? 0.5 : 0;
  if (hab === sp.habitat) return 1;
  if (hab === 'predator' && sp.diet === 'carn' && sp.size !== 'S') return 0.95;
  const near = { meadow: ['forest', 'jungle'], jungle: ['meadow', 'swamp', 'forest'], forest: ['jungle', 'meadow'], desert: ['mountain', 'volcanic'], swamp: ['jungle'], mountain: ['desert', 'arctic'], arctic: ['mountain'], volcanic: ['desert', 'mountain'], cave: ['mountain'], predator: ['jungle'] };
  return near[sp.habitat]?.includes(hab) ? 0.65 : 0.35;
}

export class Zoo {
  constructor(game) {
    this.g = game;
    this.ex = new Map();        // exhibit id -> { d, group, cols[] }
    this.decor = new Map();     // decor id -> { d, group, col }
    this.creatures = [];        // Creature entities living here
    this.byUid = new Map();
    this.appeal = 0; this.level = 0; this.visitorsWant = 0;
    this.incomeT = 0; this.rate = 0;
    this.pathMesh = null;
  }
  get W() { return this.g.W; }
  get y() { return ZOO.y; }
  get half() { return PLOTS[this.W.plot || 0].half; }
  gatePos() { return { x: ZOO.x, z: ZOO.z + this.half + 6 }; }

  /* ---------------- building the zoo from the save ---------------- */
  build() {
    const G = this.g, S = G.scene, y = this.y;
    this.root = new THREE.Group(); S.add(this.root);
    const gate = zooGate(); this.gateG = gate; this.root.add(gate);
    const st = rangerStation(); st.position.set(STATION.x, y, STATION.z); st.rotation.y = 0; this.root.add(st);
    G.colliders.box(STATION.x, STATION.z, 4.2, 3.2, 0, y - 1, y + 6, 'station');
    G.colliders.box(STATION.x, STATION.z + 4.6, 4.5, 1.5, 0, y - 1, y + 0.8, 'deck', true);
    this.stationItem = { id: 'station', x: STATION.x, y: y + 1, z: STATION.z + 5, r: 4.5, label: () => 'Ranger Station - shop, upgrades and your animals', act: () => G.ui.openPanel('station') };
    G.addInteract(this.stationItem);
    this.perimeter = new THREE.Group(); this.root.add(this.perimeter);
    this.rebuild();
  }
  /** (re)build everything that comes from W.zoo */
  rebuild() {
    const G = this.g, W = this.W;
    for (const [id, E] of this.ex) this._dropEx(id);
    for (const [id, D] of this.decor) this._dropDecor(id);
    for (const e of W.zoo.exhibits) this._addEx(e);
    for (const d of W.zoo.decor) this._addDecor(d);
    this._paths();
    this._perimeter();
    this.syncCreatures();
    this.compute();
  }
  _perimeter() {
    const G = this.g, h = this.half, y = this.y;
    for (const c of this._perCols || []) G.colliders.remove(c);
    this._perCols = [];
    while (this.perimeter.children.length) this.perimeter.remove(this.perimeter.children[0]);
    const M = new (G.Mesher)(0.05, 300);
    const post = (x, z) => { M.box(x, y, z, 0.35, 2.4, 0.35, '#7a4a2a'); };
    const run = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 4), ry = Math.atan2(x1 - x0, z1 - z0);
      for (let i = 0; i <= n; i++) post(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n);
      for (const yy of [0.8, 1.8]) M.box((x0 + x1) / 2, y + yy, (z0 + z1) / 2, 0.14, 0.2, L, '#a06a3a', ry);
      this._perCols.push(G.colliders.box((x0 + x1) / 2, (z0 + z1) / 2, 0.3, L / 2, ry, y - 1, y + 2.6, 'perimeter'));
    };
    const x0 = ZOO.x - h, x1 = ZOO.x + h, z0 = ZOO.z - h, z1 = ZOO.z + h;
    run(x0, z0, x1, z0); run(x1, z0, x1, z1); run(x0, z1, x0, z0);
    run(x0, z1, ZOO.x - 9, z1); run(ZOO.x + 9, z1, x1, z1);
    this.perimeter.add(M.mesh());
    this.gateG.position.set(ZOO.x, y, z1);
    for (const c of this._gateCols || []) G.colliders.remove(c);
    this._gateCols = [G.colliders.box(ZOO.x - 7, z1, 1.2, 1.2, 0, y - 1, y + 9), G.colliders.box(ZOO.x + 7, z1, 1.2, 1.2, 0, y - 1, y + 9), G.colliders.box(ZOO.x - 11, z1 + 1, 1.6, 1.3, 0, y - 1, y + 3), G.colliders.box(ZOO.x + 11, z1 + 1, 1.6, 1.3, 0, y - 1, y + 3)];
  }
  _addEx(e) {
    const G = this.g, S = EX_SIZES[e.size], h = S.w / 2, y = this.y;
    const g = exhibitArt(e); g.position.set(e.x, y, e.z); g.rotation.y = e.rot || 0;
    this.root.add(g);
    // fence colliders: three sides and the two halves of the front
    const cols = [], c = Math.cos(e.rot || 0), s = Math.sin(e.rot || 0);
    const W2 = (lx, lz) => ({ x: e.x + lx * c + lz * s, z: e.z - lx * s + lz * c });
    const tall = e.hab === 'electric' || e.hab === 'predator' ? 4.4 : e.hab === 'aquatic' ? 6.2 : e.hab === 'aviary' ? h * 1.2 : 1.8;
    const seg = (lx, lz, hw, hd) => { const p = W2(lx, lz); cols.push(G.colliders.box(p.x, p.z, hw, hd, -(e.rot || 0), y - 1, y + tall, 'fence:' + e.id)); };
    seg(0, -h, h, 0.3); seg(-h, 0, 0.3, h); seg(h, 0, 0.3, h);
    if (e.hab === 'aquatic') seg(0, h, h, 0.3);
    else { seg(-(h + 2.4) / 2, h, (h - 2.4) / 2, 0.3); seg((h + 2.4) / 2, h, (h - 2.4) / 2, 0.3); }
    const gp = W2(0, h + 2.4);
    const item = { id: 'ex:' + e.id, x: gp.x, y: y + 1, z: gp.z, r: 3.5, label: () => (e.name || HABITATS[e.hab].name) + ' - manage animals', act: () => G.ui.openPanel('exhibit', e.id) };
    G.addInteract(item);
    this.ex.set(e.id, { d: e, group: g, cols, item, half: h });
  }
  _dropEx(id) { const E = this.ex.get(id); if (!E) return; this.root.remove(E.group); for (const c of E.cols) this.g.colliders.remove(c); this.g.removeInteract(E.item); this.ex.delete(id); }
  _addDecor(d) {
    const G = this.g, D = DECOR[d.k]; if (!D) return;
    if (D.cat === 'path') return;
    const g = decorArt(d.k, G); g.position.set(d.x, this.y, d.z); g.rotation.y = d.rot || 0;
    this.root.add(g);
    let col = null;
    if (D.r > 0.5 && D.cat !== 'path' && d.k !== 'pond') col = G.colliders.circle(d.x, d.z, D.r * 0.7, this.y - 1, this.y + 3, 'decor');
    if (d.k === 'platform') col = G.colliders.box(d.x, d.z, 3, 2.5, -(d.rot || 0), this.y - 1, this.y + 2.9, 'platform', true);
    let item = null;
    if (d.k === 'hatchery') { item = { id: 'hatch:' + d.id, x: d.x, y: this.y + 1, z: d.z + 4.8, r: 4, label: () => 'Hatchery - incubate eggs', act: () => G.ui.openPanel('hatchery') }; G.addInteract(item); }
    this.decor.set(d.id, { d, group: g, col, item });
  }
  _dropDecor(id) { const D = this.decor.get(id); if (!D) return; this.root.remove(D.group); if (D.col) this.g.colliders.remove(D.col); if (D.item) this.g.removeInteract(D.item); this.decor.delete(id); }
  _paths() {
    if (this.pathMesh) { this.root.remove(this.pathMesh); this.pathMesh = null; }
    const P = this.W.zoo.paths; if (!P.length) return;
    const M = new (this.g.Mesher)(0.06, 301);
    for (const [x, z, k] of P) {
      M.box(x, this.y - 0.1, z, 4, 0.2, 4, k === 2 ? '#a8a498' : '#d8c8a0');
      M.box(x - 1, this.y - 0.02, z + ((x * 7 + z) % 2 ? 0.8 : -0.6), 1, 0.12, 1, k === 2 ? '#b8b4a8' : '#c8b890');
    }
    this.pathMesh = M.mesh(); this.root.add(this.pathMesh);
    this.pathSet = new Set(P.map(([x, z]) => x + ',' + z));
  }
  onPath(x, z) { return this.pathSet?.has((Math.round((x - ZOO.x) / 4) * 4 + ZOO.x) + ',' + (Math.round((z - ZOO.z) / 4) * 4 + ZOO.z)); }

  /* ---------------- animals ---------------- */
  residents(exId) { return Object.values(this.W.creatures).filter(r => r.at === 'ex:' + exId); }
  holding() { return Object.values(this.W.creatures).filter(r => r.at === 'zoo'); }
  /** make the live animals match the save */
  syncCreatures() {
    const want = new Map(Object.values(this.W.creatures).filter(r => r.at.startsWith('ex:') && this.ex.has(r.at.slice(3))).map(r => [r.uid, r]));
    for (const c of [...this.creatures]) if (!want.has(c.uid) || want.get(c.uid).at !== 'ex:' + c.exId) this._drop(c);
    for (const [uid, r] of want) if (!this.byUid.has(uid)) this._spawn(r);
  }
  _spawn(r) {
    const exId = r.at.slice(3), E = this.ex.get(exId); if (!E) return;
    const c = new Creature(this.g, { sp: r.sp, v: r.v, size: r.size, uid: r.uid, baby: r.baby, id: 'z' + r.uid });
    c.exId = exId; c.rec = r;
    const p = this._randIn(E, 0.6);
    c.pos.set(p.x, this.y, p.z); c.yaw = Math.random() * 6.28;
    if (c.swimmer) c.pos.y = this.y + 2.5;
    if (c.flyer) { c.flying = true; c.pos.y = this.y + 4; }
    c.ai = { st: 'wander', t: Math.random() * 3, tx: p.x, tz: p.z, ang: Math.random() * 6.28 };
    c.place();
    this.creatures.push(c); this.byUid.set(r.uid, c);
  }
  _drop(c) { c.dispose(); this.creatures.splice(this.creatures.indexOf(c), 1); this.byUid.delete(c.uid); }
  _randIn(E, k = 0.8) {
    const h = E.half * k, lx = (Math.random() - 0.5) * 2 * h, lz = (Math.random() - 0.5) * 2 * h, c = Math.cos(E.d.rot || 0), s = Math.sin(E.d.rot || 0);
    return { x: E.d.x + lx * c + lz * s, z: E.d.z - lx * s + lz * c };
  }
  /** keep a point inside an exhibit (local square, margin m) */
  _clampIn(E, p, m) {
    const c = Math.cos(E.d.rot || 0), s = Math.sin(E.d.rot || 0), dx = p.x - E.d.x, dz = p.z - E.d.z;
    let lx = dx * c - dz * s, lz = dx * s + dz * c;
    const h = E.half - m;
    const out = Math.abs(lx) > h || Math.abs(lz) > h;
    lx = clamp(lx, -h, h); lz = clamp(lz, -h, h);
    p.x = E.d.x + lx * c + lz * s; p.z = E.d.z - lx * s + lz * c;
    return out;
  }
  _ai(c, dt) {
    const G = this.g, A = c.ai, E = this.ex.get(c.exId), sp = c.sp; if (!E) return;
    A.t -= dt;
    const night = (G.sky?.state.night || 0) > 0.5;
    const m = Math.max(1, c.radius + 0.5);
    if (c.swimmer) {
      A.ang += dt * (sp.speed.swim || 6) * 0.25 / Math.max(4, E.half * 0.6);
      const R = E.half * 0.55, tx = E.d.x + Math.cos(A.ang) * R, tz = E.d.z + Math.sin(A.ang) * R;
      _v.set(tx - c.pos.x, (this.y + 2.6 + Math.sin(G.time * 0.4 + A.ang) * 1.2 - c.pos.y) * 0.4, tz - c.pos.z).normalize();
      c.speed = damp(c.speed, (sp.speed.swim || 6) * 0.35, 2, dt);
      const ty = Math.atan2(_v.x, _v.z); c.yaw += wrapAngle(ty - c.yaw) * Math.min(1, dt * 1.5);
      c.pitch = damp(c.pitch, -_v.y * 0.6, 2, dt);
      c.pos.x += Math.sin(c.yaw) * c.speed * dt; c.pos.z += Math.cos(c.yaw) * c.speed * dt; c.pos.y += _v.y * c.speed * dt;
      c.pos.y = clamp(c.pos.y, this.y + Math.max(0.6, c.height * 0.5), this.y + 5.2);
      this._clampIn(E, c.pos, m); c.under = true; c.inWater = true;
      c.yawRate = 0.3;
      return;
    }
    if (c.flyer) {
      A.ang += dt * 0.35;
      const R = E.half * 0.55, tx = E.d.x + Math.cos(A.ang) * R, tz = E.d.z + Math.sin(A.ang) * R;
      if (A.st === 'perch') { c.flying = false; c.stepGround(dt, c.yaw, 0, {}); c.astate = A.t > 4 ? 'rest' : null; if (A.t <= 0) { c.takeOff(); A.st = 'fly'; A.t = 12 + Math.random() * 10; } }
      else { c.stepFly(dt, Math.atan2(tx - c.pos.x, tz - c.pos.z), (sp.speed.fly || 12) * 0.4, (this.y + 4 + E.half * 0.3 - c.pos.y) * 0.5, {}); if (A.t <= 0) { A.st = 'perch'; A.landing = true; A.t = 10 + Math.random() * 10; } if (A.landing) { c.vy = -3; if (c.pos.y < this.y + 1.5) { A.landing = false; c.flying = false; } } }
      this._clampIn(E, c.pos, m);
      return;
    }
    c.astate = null;
    if (night && A.st !== 'sleep' && Math.random() < dt * 0.05) { A.st = 'sleep'; A.t = 60; }
    switch (A.st) {
      case 'sleep': c.stepGround(dt, c.yaw, 0, {}); c.astate = 'sleep'; if (!night || A.t <= 0) { A.st = 'wander'; A.t = 1; } break;
      case 'eat': c.stepGround(dt, c.yaw, 0, {}); c.astate = 'eat'; if (A.t <= 0) { A.st = 'wander'; A.t = 1; } break;
      case 'rest': c.stepGround(dt, c.yaw, 0, {}); c.astate = 'rest'; if (A.t <= 0) { A.st = 'wander'; A.t = 1; } break;
      case 'show': c.stepGround(dt, c.yaw, 0, {}); if (A.t <= 0) { A.st = 'wander'; A.t = 2; } break;
      case 'feed': {
        const c0 = Math.cos(E.d.rot || 0), s0 = Math.sin(E.d.rot || 0), lx = -E.half * 0.6, lz = -E.half * 0.6 + 1.5;
        const fx = E.d.x + lx * c0 + lz * s0, fz = E.d.z - lx * s0 + lz * c0;
        const d = Math.hypot(fx - c.pos.x, fz - c.pos.z);
        if (d > c.radius + 1.5) c.stepGround(dt, Math.atan2(fx - c.pos.x, fz - c.pos.z), sp.speed.walk, {});
        else { A.st = 'eat'; A.t = 8 + Math.random() * 6; }
        break;
      }
      default: {
        if (A.t <= 0) {
          const r = Math.random();
          if (r < 0.15) { A.st = 'feed'; break; }
          if (r < 0.28) { A.st = 'rest'; A.t = 8 + Math.random() * 10; break; }
          if (r < 0.36 && this.crowdAt(E) > 0) { A.st = 'show'; A.t = 2.5; c.anim.play(sp.diet === 'carn' ? 'roar' : 'call'); this.g.audio.roar(c.pos, Math.min(1, c.height / 6) * 0.7, sp.id === 'para' ? 'honk' : sp.move === 'fly' ? 'screech' : 'roar'); this.g.visitors?.react(c, 'roar'); break; }
          const p = this._randIn(E, 0.75); A.tx = p.x; A.tz = p.z; A.t = 6 + Math.random() * 8;
        }
        const d = Math.hypot(A.tx - c.pos.x, A.tz - c.pos.z);
        c.stepGround(dt, Math.atan2(A.tx - c.pos.x, A.tz - c.pos.z), d > 1.5 ? sp.speed.walk * (c.baby ? 1.3 : 1) : 0, { ignore: 'fence:' + c.exId });
      }
    }
    if (this._clampIn(E, c.pos, m)) { c.speed *= 0.5; A.t = Math.min(A.t, 0.5); }
    c.pos.y = Math.max(c.pos.y, this.y);
  }
  crowdAt(E) { return this.g.visitors ? this.g.visitors.watching(E.d.id) : 0; }

  /* ---------------- happiness, appeal, level ---------------- */
  happiness(r) {
    const sp = SP[r.sp], exId = r.at.slice(3), E = this.ex.get(exId); if (!E) return 0.5;
    const e = E.d, res = this.residents(exId);
    let h = 0.25 + 0.5 * habitatOK(sp, e.hab);
    const space = res.reduce((s, o) => s + SIZE[SP[o.sp].size].crate, 0), cap = EX_SIZES[e.size].space;
    if (space > cap) h -= 0.25 * Math.min(2, (space - cap) / cap * 2);
    const decor = this.W.zoo.decor.filter(d => this._inside(E, d.x, d.z) && DECOR[d.k]?.cat === 'nature').length;
    h += Math.min(0.2, decor * 0.035);
    if (sp.herd[1] > 1) h += res.filter(o => o.sp === r.sp).length > 1 ? 0.12 : -0.08;
    if (sp.diet !== 'carn' && res.some(o => SP[o.sp].diet === 'carn' && SIZE[SP[o.sp].size].crate >= SIZE[sp.size].crate)) h -= 0.3;
    if (sp.temper === 'aggressive' && e.hab !== 'predator' && sp.size !== 'S') h -= 0.3;
    if (r.traits?.includes('Grumpy')) h -= 0.08;
    if (r.traits?.includes('Cheerful')) h += 0.08;
    return clamp(h, 0, 1);
  }
  _inside(E, x, z) { const c = Math.cos(E.d.rot || 0), s = Math.sin(E.d.rot || 0), dx = x - E.d.x, dz = z - E.d.z; return Math.abs(dx * c - dz * s) < E.half && Math.abs(dx * s + dz * c) < E.half; }
  compute() {
    const W = this.W;
    let appeal = 0;
    for (const r of Object.values(W.creatures)) {
      if (!r.at.startsWith('ex:')) continue;
      const sp = SP[r.sp];
      r.happy = this.happiness(r);
      const V = r.v ? VARIANTS[r.v]?.mult || 1 : 1;
      const showoff = r.traits?.includes('Showoff') ? 1.25 : 1;
      appeal += sp.appeal * Math.sqrt(V) * (0.35 + r.happy * 0.85) * (r.baby ? 1.5 : 1) * showoff;
    }
    // variety: every different species on show adds a little
    const kinds = new Set(Object.values(W.creatures).filter(r => r.at.startsWith('ex:')).map(r => r.sp)).size;
    appeal *= 1 + kinds * 0.03;
    for (const d of W.zoo.decor) appeal += DECOR[d.k]?.joy || 0;
    this.appeal = Math.round(appeal);
    let lv = 0; while (lv < ZOO_LEVELS.length - 1 && this.appeal >= ZOO_LEVELS[lv + 1]) lv++;
    if (lv > (W.zooLevel || 0)) { W.zooLevel = lv; this.g.onZooLevel(lv); }
    this.level = lv;
    this.visitorsWant = clamp(Math.round(3 + Math.pow(this.appeal, 0.62) * 0.55), 2, 46);
    this.ticket = 4 + lv * 3;
    this.rate = this.visitorsWant / 90 * (this.ticket + 4);   // $ per second, roughly, while away
    return this.appeal;
  }
  get levelName() { return ZOO_LEVEL_NAMES[this.level]; }
  next() { return ZOO_LEVELS[this.level + 1] ?? null; }

  /* ---------------- per frame ---------------- */
  update(dt) {
    const G = this.g;
    if ((this._cT = (this._cT || 0) - dt) <= 0) { this._cT = 2; if (G.isHost) this.compute(); }
    const cam = G.camera.position;
    for (const c of this.creatures) {
      const d = Math.hypot(c.pos.x - cam.x, c.pos.z - cam.z);
      c.group.visible = d < 380;
      if (G.isHost || true) this._ai(c, dt);
      if (!c.group.visible) continue;
      c.place();
      c._af = (c._af || 0) + dt;
      if (d < 90 || (G.frame % 3 === 0)) { c.animate(c._af, {}); c._af = 0; }
    }
    // escapes: restless big predators break out now and then
    if (G.isHost && (this._escT = (this._escT || 0) - dt) <= 0) {
      this._escT = 30;
      for (const r of Object.values(this.W.creatures)) {
        if (!r.at.startsWith('ex:')) continue;
        const sp = SP[r.sp];
        if (sp.temper === 'aggressive' && sp.size !== 'S' && r.happy < 0.4 && Math.random() < 0.25) { G.events.escape(r); break; }
      }
    }
    // away from the zoo it still earns
    const P = G.player.pos, away = Math.hypot(P.x - ZOO.x, P.z - ZOO.z) > 260;
    if (G.isHost && away) {
      this.incomeT += dt;
      if (this.incomeT > 10) { const m = Math.round(this.rate * this.incomeT); this.incomeT = 0; if (m > 0) G.earn(m, null, true); }
    }
  }
  /** keep the player out of fences except through the gate (colliders do it) */
  blockPlayer() {}
}
void lerp; void RARITY; void Bus;
