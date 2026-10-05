/* Visitors.js - the people who pay for all this.

   They arrive at the gate (ticket money), pick an exhibit (rarer and happier
   animals pull more of them), walk there along the paths (A* over a 2 m grid
   of the zoo; paths are cheaper to walk), crowd at the front and react:
   pointing, photos (with a flash), cheering - and tips when an animal roars
   or shows off right in front of them. Between exhibits they buy snacks and
   souvenirs, sit on benches, and eventually go home. When something escapes
   they scream and run.

   Speech bubbles are little drawn icons (heart, camera, !, star, $). */
import * as THREE from '../../lib/three.module.js';
import { makeHuman } from '../art/PeopleArt.js';
import { SP, RARITY } from '../data/Species.js';
import { DECOR, EX_SIZES } from '../data/Build.js';
import { ZOO } from '../data/Biomes.js';
import { clamp, damp, dampAngle, rng } from '../core/Util.js';

const ICONS = {};
function icon(k) {
  if (ICONS[k]) return ICONS[k];
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.strokeStyle = '#2a2a3a'; g.lineWidth = 4;
  g.beginPath(); g.arc(32, 28, 22, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(24, 46); g.lineTo(20, 60); g.lineTo(34, 49); g.fill();
  g.fillStyle = { heart: '#ff4a6a', cam: '#3a3a4a', bang: '#ff6a2a', star: '#ffc020', money: '#2aa84a', note: '#5a7aff', q: '#8a6ad0', scream: '#ff3a3a' }[k];
  if (k === 'heart') { g.beginPath(); g.moveTo(32, 40); g.bezierCurveTo(10, 26, 20, 10, 32, 20); g.bezierCurveTo(44, 10, 54, 26, 32, 40); g.fill(); }
  else if (k === 'cam') { g.fillRect(17, 20, 30, 18); g.fillRect(26, 16, 10, 5); g.fillStyle = '#9ad0ff'; g.beginPath(); g.arc(32, 29, 6, 0, 7); g.fill(); }
  else if (k === 'star') { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 7 : 16; g.lineTo(32 + Math.cos(a) * r, 28 + Math.sin(a) * r); } g.fill(); }
  else { g.font = '900 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText({ bang: '!', money: '$', note: '♪', q: '?', scream: '!!' }[k], 32, 30); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (ICONS[k] = new THREE.SpriteMaterial({ map: t, depthWrite: false }));
}

export class Visitors {
  constructor(game) {
    this.g = game; this.list = []; this.spawnT = 0; this.seed = 1;
    this.grid = null;
    this.flash = new THREE.PointLight('#ffffff', 0, 12, 2); game.scene.add(this.flash);
  }
  get zoo() { return this.g.zoo; }

  /* ---------------- navigation ---------------- */
  buildGrid() {
    const Z = this.zoo, h = Z.half + 8, G = this.g;
    const n = Math.ceil(h * 2 / 2);
    const cost = new Float32Array(n * n);
    const x0 = ZOO.x - h, z0 = ZOO.z - h;
    const p = { x: 0, y: Z.y + 0.1, z: 0 };
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      p.x = x0 + i * 2 + 1; p.z = z0 + j * 2 + 1; p.y = Z.y + 0.1;
      const q = { ...p };
      const blocked = G.colliders.push(q, 0.7, 1.6);
      cost[i * n + j] = blocked ? Infinity : Z.onPath(p.x, p.z) ? 1 : 2.4;
    }
    this.grid = { n, x0, z0, cost };
  }
  _cell(x, z) { const G = this.grid; return [clamp(Math.floor((x - G.x0) / 2), 0, G.n - 1), clamp(Math.floor((z - G.z0) / 2), 0, G.n - 1)]; }
  path(ax, az, bx, bz) {
    const G = this.grid; if (!G) return [{ x: bx, z: bz }];
    const n = G.n, [si, sj] = this._cell(ax, az), [ti, tj] = this._cell(bx, bz);
    const start = si * n + sj, goal = ti * n + tj;
    const gs = new Map([[start, 0]]), from = new Map(), open = [[0, start]], closed = new Set();
    let guard = 0;
    while (open.length && guard++ < 6000) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, cur] = open.splice(bi, 1)[0];
      if (cur === goal) break;
      if (closed.has(cur)) continue; closed.add(cur);
      const ci = Math.floor(cur / n), cj = cur % n;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
        const k = ni * n + nj, c = G.cost[k]; if (c === Infinity && k !== goal) continue;
        const step = (di && dj ? 1.414 : 1) * (c === Infinity ? 3 : c);
        const ng = gs.get(cur) + step;
        if (ng < (gs.get(k) ?? Infinity)) { gs.set(k, ng); from.set(k, cur); open.push([ng + Math.hypot(ni - ti, nj - tj) * 1.1, k]); }
      }
    }
    const out = []; let k = goal;
    if (!from.has(k)) return [{ x: bx, z: bz }];
    while (k !== start && out.length < 400) { out.push({ x: G.x0 + Math.floor(k / n) * 2 + 1, z: G.z0 + (k % n) * 2 + 1 }); k = from.get(k); }
    out.reverse(); out.push({ x: bx, z: bz });
    // thin the path: keep every other point
    return out.filter((p, i) => i % 2 === 0 || i === out.length - 1);
  }

  /* ---------------- people ---------------- */
  spawn() {
    const Z = this.zoo, G = this.g, gp = Z.gatePos();
    const kid = Math.random() < 0.25;
    const H = makeHuman({ visitor: true, seed: this.seed++ * 7919, kid });
    G.scene.add(H.root);
    const v = { H, pos: new THREE.Vector3(gp.x + (Math.random() - 0.5) * 8, Z.y, gp.z + 24), yaw: Math.PI, st: 'enter', t: 0, path: [], kid, speed: kid ? 2.4 : 1.6 + Math.random() * 0.5, mood: 0.6, bubble: null, spent: 0 };
    v.path = [{ x: gp.x + (Math.random() - 0.5) * 6, z: gp.z - 4 }];
    this.list.push(v);
    return v;
  }
  _remove(v) { this.g.scene.remove(v.H.root); if (v.bubble) this.g.scene.remove(v.bubble); this.list.splice(this.list.indexOf(v), 1); }
  clear() { for (const v of [...this.list]) this._remove(v); }
  say(v, k, dur = 2) {
    if (!v.bubble) { v.bubble = new THREE.Sprite(icon(k)); v.bubble.scale.set(0.9, 0.9, 0.9); this.g.scene.add(v.bubble); }
    v.bubble.material = icon(k); v.bubble.visible = true; v.bubbleT = dur;
  }
  /** pick an exhibit worth seeing (rarer, happier animals pull harder) */
  _pickExhibit() {
    const Z = this.zoo, list = [];
    for (const [id, E] of Z.ex) {
      const res = Z.residents(id); if (!res.length) continue;
      const w = res.reduce((s, r) => s + SP[r.sp].appeal * (0.5 + (r.happy || 0.5)), 0);
      list.push({ E, w });
    }
    if (!list.length) return null;
    let t = Math.random() * list.reduce((s, o) => s + o.w, 0);
    for (const o of list) { t -= o.w; if (t <= 0) return o.E; }
    return list[0].E;
  }
  _viewSpot(E) {
    const h = E.half, side = E.d.hab === 'aquatic' ? Math.floor(Math.random() * 4) : 0;
    const lx = (Math.random() - 0.5) * h * 1.4, lz = h + 3 + Math.random() * 1.5;
    const a = (E.d.rot || 0) + side * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    return { x: E.d.x + lx * c + lz * s, z: E.d.z - lx * s + lz * c, face: Math.atan2(E.d.x - (E.d.x + lz * s), E.d.z - (E.d.z + lz * c)) };
  }
  _pickShop() {
    const D = this.g.W.zoo.decor.filter(d => DECOR[d.k]?.cat === 'shop' && (DECOR[d.k].income || DECOR[d.k].joy) && d.k !== 'hatchery' && d.k !== 'platform');
    const benches = this.g.W.zoo.decor.filter(d => d.k === 'bench');
    const r = Math.random();
    if (benches.length && r < 0.25) return { d: benches[Math.floor(Math.random() * benches.length)], sit: true };
    if (!D.length) return null;
    return { d: D[Math.floor(Math.random() * D.length)] };
  }
  /** an animal did something spectacular: the crowd at its exhibit reacts (and tips) */
  react(c, kind) {
    const G = this.g;
    let tips = 0;
    for (const v of this.list) {
      if (v.st !== 'watch' || v.ex !== c.exId) continue;
      v.cheerT = 2; this.say(v, Math.random() < 0.5 ? 'heart' : 'star', 2.2);
      if (Math.random() < 0.5) { v.photoT = 1.5; this._flash(v); }
      tips += Math.round((1 + RARITY[c.sp.rarity].stars) * (v.kid ? 0.5 : 1) * (0.5 + Math.random()));
    }
    if (tips > 0) { G.earn(tips, c.pos, false, 'Tips'); G.audio.wow(c.pos); }
  }
  _flash(v) { this.flash.position.copy(v.pos).add(new THREE.Vector3(0, 1.8, 0)); this.flash.intensity = 6; this.g.audio.shutter && Math.random() < 0.3 && this.g.audio.shutter(); }
  watching(exId) { let n = 0; for (const v of this.list) if (v.st === 'watch' && v.ex === exId) n++; return n; }
  scare(at, r) { for (const v of this.list) if (v.pos.distanceTo(at) < r && v.st !== 'flee') { v.st = 'flee'; v.t = 6; v.from = at.clone(); this.say(v, 'scream', 3); if (Math.random() < 0.2) this.g.audio.scream(v.pos); } }

  update(dt) {
    const G = this.g, Z = this.zoo;
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 30);
    const P = G.camera.position, near = Math.hypot(P.x - ZOO.x, P.z - ZOO.z) < 330;
    if (!near) { if (this.list.length) this.clear(); return; }
    if (!this.grid) this.buildGrid();
    // keep the crowd at the size the zoo deserves
    this.spawnT -= dt;
    const want = Z.visitorsWant * (G.sky.state.night > 0.6 ? 0.3 : 1);
    if (this.spawnT <= 0 && this.list.length < want) {
      this.spawnT = 3 + Math.random() * 4;
      const v = this.spawn();
      if (G.isHost) { G.earn(Z.ticket, v.pos, false, 'Ticket'); G.W.stats.visitors = (G.W.stats.visitors || 0) + 1; }
    }
    for (const v of [...this.list]) this._tick(v, dt);
  }
  _tick(v, dt) {
    const G = this.g, Z = this.zoo;
    v.t -= dt;
    let moving = false;
    const goTo = (speed) => {
      const tgt = v.path[0];
      if (!tgt) return true;
      const dx = tgt.x - v.pos.x, dz = tgt.z - v.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.7) { v.path.shift(); return !v.path.length; }
      v.yaw = dampAngle(v.yaw, Math.atan2(dx, dz), 8, dt);
      const s = speed * (Z.onPath(v.pos.x, v.pos.z) ? 1.15 : 1);
      v.pos.x += dx / d * s * dt; v.pos.z += dz / d * s * dt;
      moving = true;
      return false;
    };
    switch (v.st) {
      case 'enter': if (goTo(v.speed)) { v.st = 'choose'; } break;
      case 'choose': {
        v.visits = (v.visits || 0) + 1;
        if (v.visits > 4 + Math.random() * 3) { v.st = 'leave'; const gp = Z.gatePos(); v.path = this.path(v.pos.x, v.pos.z, gp.x, gp.z + 2).concat([{ x: gp.x + (Math.random() - 0.5) * 6, z: gp.z + 26 }]); break; }
        if (v.visits > 1 && Math.random() < 0.35) { const S = this._pickShop(); if (S) { v.st = 'shop'; v.shop = S; const ang = Math.random() * 6.28, R = (DECOR[S.d.k].r || 1) + 1.4; v.path = this.path(v.pos.x, v.pos.z, S.d.x + Math.sin(S.d.rot || 0) * R + Math.cos(ang) * 0.5, S.d.z + Math.cos(S.d.rot || 0) * R + Math.sin(ang) * 0.5); v.arrived = false; break; } }
        const E = this._pickExhibit();
        if (!E) { v.st = 'wanderz'; v.t = 5; const a = Math.random() * 6.28; v.path = this.path(v.pos.x, v.pos.z, ZOO.x + Math.cos(a) * Z.half * 0.5, ZOO.z + Math.sin(a) * Z.half * 0.5); break; }
        const s = this._viewSpot(E);
        v.st = 'goto'; v.ex = E.d.id; v.face = s.face; v.path = this.path(v.pos.x, v.pos.z, s.x, s.z);
        break;
      }
      case 'wanderz': if (goTo(v.speed) || v.t <= 0) v.st = 'choose'; break;
      case 'goto': if (goTo(v.speed)) { v.st = 'watch'; v.t = 8 + Math.random() * 10; } break;
      case 'watch': {
        v.yaw = dampAngle(v.yaw, v.face ?? v.yaw, 4, dt);
        if (Math.random() < dt * 0.25) { const k = Math.random(); if (k < 0.35) { v.photoT = 1.4; this.say(v, 'cam', 1.5); this._flash(v); } else if (k < 0.6) { v.pointT = 1.5; this.say(v, 'bang', 1.4); } else if (k < 0.8) this.say(v, 'heart', 1.6); }
        if (v.t <= 0) v.st = 'choose';
        break;
      }
      case 'shop': {
        if (!v.arrived) { if (goTo(v.speed)) { v.arrived = true; v.t = v.shop.sit ? 10 + Math.random() * 8 : 3 + Math.random() * 3; if (!v.shop.sit) v.yaw = (v.shop.d.rot || 0) + Math.PI; } }
        else if (v.t <= 0) {
          const D = DECOR[v.shop.d.k];
          if (D.income && G.isHost) { const m = Math.round(D.income * (0.6 + Math.random() * 0.8) * (v.kid ? 0.6 : 1)); G.earn(m, v.pos, false, D.name); this.say(v, 'money', 1.5); }
          v.st = 'choose';
        }
        break;
      }
      case 'leave': if (goTo(v.speed * 1.1)) { this._remove(v); return; } break;
      case 'flee': {
        const a = Math.atan2(v.pos.x - v.from.x, v.pos.z - v.from.z);
        v.yaw = dampAngle(v.yaw, a, 10, dt); v.pos.x += Math.sin(v.yaw) * 5 * dt; v.pos.z += Math.cos(v.yaw) * 5 * dt; moving = true;
        if (v.t <= 0) v.st = 'choose';
        break;
      }
    }
    const pq = { x: v.pos.x, y: Z.y, z: v.pos.z };
    G.colliders.push(pq, 0.3, 1.6); v.pos.x = pq.x; v.pos.z = pq.z;
    const floor = G.colliders.floorAt(v.pos.x, v.pos.z, Z.y + 3.2, 0.6);
    v.pos.y = Math.max(G.terrain.ground(v.pos.x, v.pos.z), floor > -Infinity ? floor : -Infinity);
    v.H.root.position.copy(v.pos); v.H.root.rotation.y = v.yaw;
    v.cheerT = Math.max(0, (v.cheerT || 0) - dt); v.photoT = Math.max(0, (v.photoT || 0) - dt); v.pointT = Math.max(0, (v.pointT || 0) - dt);
    const sit = v.st === 'shop' && v.arrived && v.shop.sit;
    v.H.anim(dt, { speed: moving ? (v.st === 'flee' ? 5 : v.speed) : 0, cheer: v.cheerT > 0, photo: v.photoT > 0, point: v.pointT > 0, scared: v.st === 'flee', sit, wave: v.st === 'watch' && v.kid && Math.sin(G.time * 0.7 + v.speed * 10) > 0.8 });
    if (v.bubble) { v.bubbleT -= dt; v.bubble.visible = v.bubbleT > 0; v.bubble.position.copy(v.pos).add(new THREE.Vector3(0, v.kid ? 1.7 : 2.5, 0)); }
  }
}
void damp; void EX_SIZES; void rng;
