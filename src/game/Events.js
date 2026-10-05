/* Events.js - the world doing things without asking you.

   WEATHER drifts between clear, cloudy, rain and thunderstorms (Stormwing
   only flies in storms). EVENTS roll every couple of minutes, chosen by
   where the players are, so no two trips go the same way:
     stampede   a panicked herd thunders past - dodge it, or rope one
     migration  pterosaur flocks overhead, ichthyosaur pods at sea
     eruption   Mount Cinder spits lava bombs; Emberbacks get bold
     raid       predators come sniffing round your zoo; visitors panic
     sea        something huge notices you swimming
     meteors    a night shower; one lands, and a STARBORN creature walks out
     golden     a golden-coloured animal is seen nearby (look for the pillar)
     titan      the ground shakes... the mythic Titanus walks the land
   Sightings: rare spawns get a pillar of light and a compass marker.
   Escapes: a restless predator breaks out of its exhibit. */
import * as THREE from '../../lib/three.module.js';
import { SP, RARITY } from '../data/Species.js';
import { VOLCANO, ZOO } from '../data/Biomes.js';
import { clamp, lerp } from '../core/Util.js';
import { Bus } from '../core/Bus.js';

const WEATHER = {
  clear: { cloud: 0.1, rain: 0, storm: 0, next: [['clear', 3], ['cloudy', 3], ['rain', 1]] },
  cloudy: { cloud: 0.6, rain: 0, storm: 0, next: [['clear', 3], ['rain', 2], ['storm', 1]] },
  rain: { cloud: 0.85, rain: 0.8, storm: 0.15, next: [['cloudy', 2], ['storm', 1.2], ['clear', 1]] },
  storm: { cloud: 1, rain: 1, storm: 1, next: [['rain', 2], ['cloudy', 1]] },
};

export class Events {
  constructor(game) {
    this.g = game;
    this.active = {};
    this.nextT = 70; this.bombs = []; this.meteors = []; this.tremorT = 0;
    this.w = { cloud: 0.1, rain: 0, storm: 0 };
  }
  get W() { return this.g.W; }
  /** smooth weather values */
  get storm() { return this.w.storm; }
  update(dt) {
    const G = this.g, W = this.W;
    // weather (host decides, everyone eases toward it)
    if (G.isHost) {
      W.weather.t -= dt;
      if (W.weather.t <= 0) {
        const opts = WEATHER[W.weather.kind].next, tot = opts.reduce((s, o) => s + o[1], 0);
        let r = Math.random() * tot, k = opts[0][0];
        for (const [n, w] of opts) { r -= w; if (r <= 0) { k = n; break; } }
        if (k !== W.weather.kind) { W.weather.kind = k; G.event({ k: 'weather', w: k }); }
        W.weather.t = k === 'storm' ? 150 + Math.random() * 120 : 180 + Math.random() * 240;
      }
    }
    const T = WEATHER[W.weather.kind] || WEATHER.clear;
    for (const k of ['cloud', 'rain', 'storm']) this.w[k] += (T[k] - this.w[k]) * Math.min(1, dt * 0.08);
    // events
    if (G.isHost) {
      this.nextT -= dt;
      if (this.nextT <= 0) { this.nextT = 100 + Math.random() * 120; this._roll(); }
      for (const k in this.active) { const A = this.active[k]; A.t -= dt; if (A.tick) A.tick(dt, A); if (A.t <= 0) { if (A.end) A.end(A); delete this.active[k]; } }
    }
    // effects everyone sees
    this._tremor(dt);
    this._bombs(dt);
    this._meteors(dt);
  }
  _roll() {
    const G = this.g, P = G.player.pos, b = G.terrain.biome(P.x, P.z), night = G.sky.state.night > 0.5;
    const nearZoo = Math.hypot(P.x - ZOO.x, P.z - ZOO.z) < 200, nearV = Math.hypot(P.x - VOLCANO.x, P.z - VOLCANO.z) < 650, sea = G.terrain.ground(P.x, P.z) < -3;
    const opts = [];
    if (['meadow', 'desert', 'jungle', 'elder', 'tundra'].includes(b) && !nearZoo) opts.push(['stampede', 3]);
    opts.push(['migration', 2]);
    if (nearV) opts.push(['eruption', 4]);
    if (nearZoo && (G.zoo.level >= 1)) opts.push(['raid', 2]);
    if (sea || G.player.mount?.swimmer) opts.push(['sea', 3]);
    if (night) opts.push(['meteors', 2]);
    opts.push(['golden', 1.2]);
    if (['elder', 'meadow', 'valley', 'jungle'].includes(b) && (G.zoo.level >= 2 || this.W.found.c_vault)) opts.push(['titan', 0.5]);
    const tot = opts.reduce((s, o) => s + o[1], 0);
    let r = Math.random() * tot;
    for (const [k, w] of opts) { r -= w; if (r <= 0) { if (!this.active[k]) this.start(k); return; } }
  }
  start(k, o = {}) {
    const G = this.g;
    if (this['_' + k]) { this['_' + k](o); Bus.emit('event:' + k, {}); G.W.stats['ev_' + k] = (G.W.stats['ev_' + k] || 0) + 1; }
  }

  /* ---------------- the events ---------------- */
  _stampede() {
    const G = this.g, P = G.player.pos, b = G.terrain.biome(P.x, P.z);
    const sp = { meadow: ['galli', 'para', 'dryo'], desert: ['galli', 'proto'], jungle: ['para', 'trike', 'stego'], elder: ['diplo', 'stego'], tundra: ['mammoth', 'rhino'] }[b] || ['galli'];
    const S = SP[sp[Math.floor(Math.random() * sp.length)]];
    const a = Math.random() * 6.28, side = new THREE.Vector3(Math.cos(a + 1.57), 0, Math.sin(a + 1.57));
    const start = P.clone().add(new THREE.Vector3(Math.cos(a) * 110, 0, Math.sin(a) * 110));
    const dir = P.clone().sub(start).setY(0).normalize();
    const herd = [];
    for (let i = 0; i < 12 + Math.floor(Math.random() * 6); i++) {
      const x = start.x + side.x * (Math.random() - 0.5) * 30 - dir.x * Math.random() * 25, z = start.z + side.z * (Math.random() - 0.5) * 30 - dir.z * Math.random() * 25;
      const v = i === 3 && Math.random() < 0.35 ? (Math.random() < 0.3 ? 'golden' : 'albino') : null;
      const c = G.wild.add({ sp: S.id, x, z, y: G.terrain.ground(x, z), size: Math.random() * 0.8, v, yaw: Math.atan2(dir.x, dir.z) });
      c.ai.st = 'flee'; c.ai.t = 16; c.ai.from = new THREE.Vector3(x - dir.x * 50, 0, z - dir.z * 50); c.event = 'stampede';
      herd.push(c);
    }
    G.event({ k: 'banner', t: 'STAMPEDE!', s: 'A herd of ' + S.name + ' is coming right at you!', kind: 'bad' });
    this.active.stampede = { t: 22, herd, tick: (dt, A) => {
      // anyone in the way gets bowled over
      for (const c of A.herd) { if (c.gone) continue; for (const p of G.players()) if (Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < c.radius + 1.2 && c.speed > 4) G.hitPlayer(p.pid, c, 8); }
    } };
  }
  _migration() {
    const G = this.g, P = G.player.pos;
    const sea = G.terrain.ground(P.x, P.z) < -3;
    const S = sea && Math.random() < 0.5 ? SP.ichthy : SP[Math.random() < 0.7 ? 'ptera' : 'tape'];
    const a = Math.random() * 6.28, n = 8 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      const x = P.x + Math.cos(a) * 160 + (Math.random() - 0.5) * 40, z = P.z + Math.sin(a) * 160 + (Math.random() - 0.5) * 40;
      const fly = S.move === 'fly';
      const c = G.wild.add({ sp: S.id, x, z, y: fly ? 40 + Math.random() * 20 : -3, size: Math.random(), flying: fly });
      c.ai.home.set(P.x - Math.cos(a) * 200, 0, P.z - Math.sin(a) * 200); c.ai.st = fly ? 'soar' : 'cruise'; c.ai.alt = 45; c.event = 'migration';
    }
    G.event({ k: 'toast', t: S.move === 'fly' ? 'A flock of ' + S.name + ' is passing overhead!' : 'A pod of ' + S.name + ' is passing by!', kind: 'good' });
    this.active.migration = { t: 60 };
  }
  _eruption() {
    const G = this.g;
    G.event({ k: 'banner', t: 'MOUNT CINDER IS ERUPTING!', s: 'Lava bombs! Emberbacks love this.', kind: 'bad' });
    G.event({ k: 'quake', s: 0.8 });
    this.active.eruption = { t: 80, bombT: 0, tick: (dt, A) => {
      A.bombT -= dt;
      if (A.bombT <= 0) { A.bombT = 0.6 + Math.random(); const a = Math.random() * 6.28, d = 60 + Math.random() * 220; G.event({ k: 'bomb', x: VOLCANO.x + Math.cos(a) * d, z: VOLCANO.z + Math.sin(a) * d }); }
      if (Math.random() < dt * 0.05) { const a = Math.random() * 6.28; G.wild.spawnHerd(SP.ember, VOLCANO.x + Math.cos(a) * 140, VOLCANO.z + Math.sin(a) * 140, {}, {}); }
    } };
  }
  _raid() {
    const G = this.g, Z = G.zoo;
    const lv = Z.level, S = lv >= 4 ? SP.trex : lv >= 2 ? SP.allo : SP.raptor;
    const a = Math.random() * 6.28, R = Z.half + 60;
    const x = ZOO.x + Math.cos(a) * R, z = ZOO.z + Math.sin(a) * R;
    const cs = G.wild.spawnHerd(S, x, z, {}, { quiet: true });
    for (const c of cs || []) { c.ai.st = 'hunt'; c.ai.t = 60; c.ai.target = G.me; c.event = 'raid'; c.ai.homeR = 20; }
    G.event({ k: 'banner', t: (S.herd[1] > 1 ? 'A PACK OF ' : 'A WILD ') + S.name.toUpperCase() + (S.herd[1] > 1 ? 'S' : '') + ' IS RAIDING THE ZOO!', s: 'Catch it before it scares off every visitor - or roar it away.', kind: 'bad' });
    G.audio.alarm();
    this.active.raid = { t: 120, cs, tick: () => { for (const c of cs || []) if (!c.gone && Math.hypot(c.pos.x - ZOO.x, c.pos.z - ZOO.z) < Z.half + 20) G.visitors.scare(c.pos, 25); } };
  }
  _sea() {
    const G = this.g, P = G.player.pos;
    const deep = G.terrain.ground(P.x, P.z) < -40;
    const S = deep && Math.random() < 0.25 ? SP.megalodon : Math.random() < 0.5 ? SP.mosa : SP.dunk;
    const a = Math.random() * 6.28;
    const cs = G.wild.spawnHerd(S, P.x + Math.cos(a) * 90, P.z + Math.sin(a) * 90, {}, { quiet: true, depth: [6, 20] });
    for (const c of cs || []) { c.ai.st = 'hunt'; c.ai.t = 30; c.ai.target = G.me; c.event = 'sea'; }
    G.event({ k: 'banner', t: 'SOMETHING IS IN THE WATER', s: 'A ' + S.name + ' has noticed you.', kind: 'bad' });
  }
  _meteors() {
    const G = this.g, P = G.player.pos;
    G.event({ k: 'toast', t: 'Shooting stars! Make a wish... and watch where they land.', kind: 'good' });
    this.active.meteors = { t: 45, n: 0, tick: (dt, A) => {
      if (Math.random() < dt * 1.5) G.event({ k: 'meteor', x: P.x + (Math.random() - 0.5) * 900, z: P.z + (Math.random() - 0.5) * 900, land: false });
      if (!A.landed && A.t < 30) {
        A.landed = true;
        const a = Math.random() * 6.28, x = P.x + Math.cos(a) * 160, z = P.z + Math.sin(a) * 160;
        if (G.terrain.ground(x, z) > 1) {
          G.event({ k: 'meteor', x, z, land: true });
          setTimeout(() => {
            const pool = G.wild.weights(G.wild._ctx(x, z), 'walk');
            const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)].sp : SP.dryo;
            const cs = G.wild.spawnHerd(pick, x + 6, z + 6, {}, { v: 'starborn', quiet: true });
            for (const c of cs || []) { c.event = 'meteor'; c.pillar = G.fx.pillar(c.pos.x, c.pos.y, c.pos.z, '#9af0ff', 220); c.pillar.follow = c.pos; G.ui.mark(c, 240); }
            G.event({ k: 'banner', t: 'A STARBORN CREATURE!', s: 'Something walked out of the crater. Follow the blue light.', kind: 'good' });
          }, 3500);
        }
      }
    } };
  }
  _golden() {
    const G = this.g, P = G.player.pos;
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * 6.28, d = 150 + Math.random() * 120, x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
      const ctx = G.wild._ctx(x, z), pool = G.wild.weights(ctx, ctx.h < -2 ? 'swim' : 'walk');
      if (!pool.length) continue;
      const pick = pool[Math.floor(Math.random() * pool.length)].sp;
      const cs = G.wild.spawnHerd(pick, x, z, ctx, { v: 'golden', quiet: true });
      if (cs && cs[0]) { const c = cs[0]; c.pillar = G.fx.pillar(c.pos.x, c.pos.y, c.pos.z, '#ffd040', 200); c.pillar.follow = c.pos; G.ui.mark(c, 240); G.event({ k: 'banner', t: 'GOLDEN SIGHTING!', s: 'A golden ' + pick.name + ' was spotted nearby. Follow the light!', kind: 'good' }); return; }
    }
  }
  _titan() {
    const G = this.g, P = G.player.pos;
    const a = Math.random() * 6.28, d = 380;
    const x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d;
    const c = G.wild.add({ sp: 'titanus', x, z, y: G.terrain.ground(x, z), size: 0.6 + Math.random() * 0.4 });
    c.event = 'titan'; c.ai.home.set(P.x - Math.cos(a) * 200, 0, P.z - Math.sin(a) * 200); c.ai.homeR = 150;
    c.pillar = G.fx.pillar(x, c.pos.y, z, '#5affc8', 260); c.pillar.follow = c.pos;
    G.ui.mark(c, 400);
    G.event({ k: 'banner', t: 'THE GROUND IS SHAKING...', s: 'Something enormous is walking this way. The TITAN WALKS.', kind: 'legend' });
    this.active.titan = { t: 360, c, tick: (dt, A) => { A.st = (A.st || 0) - dt; if (A.st <= 0) { A.st = 1.6; if (!A.c.gone) G.event({ k: 'quake', s: clamp(1 - A.c.pos.distanceTo(G.player.pos) / 400, 0.05, 0.6), x: A.c.pos.x, z: A.c.pos.z }); } }, end: (A) => { if (!A.c.gone && !A.c.claim) { G.wild.remove(A.c); G.event({ k: 'toast', t: 'The Titan has walked on, out of sight...', kind: 'info' }); } } };
  }

  /* ---------------- sightings and escapes ---------------- */
  sighting(c) {
    const G = this.g, R = RARITY[c.sp.rarity];
    if (G.time < 8) return;
    const known = G.W.dex[c.spId]?.caught;
    const name = c.v ? c.v[0].toUpperCase() + c.v.slice(1) + ' ' + (known ? c.sp.name : 'creature') : (known ? c.sp.name : 'Something ' + R.name.toLowerCase());
    if (R.stars >= 4 || c.v) { c.pillar = G.fx.pillar(c.pos.x, c.pos.y, c.pos.z, c.v === 'golden' ? '#ffd040' : R.css, 160); c.pillar.follow = c.pos; G.ui.mark(c, 180); }
    G.event({ k: 'toast', t: (R.stars >= 5 ? 'LEGENDARY SIGHTING: ' : 'Rare sighting: ') + name + ' nearby!', kind: R.stars >= 5 ? 'legend' : 'good' });
    Bus.emit('sighting', { sp: c.spId, v: c.v });
  }
  escape(r) {
    const G = this.g, E = G.zoo.ex.get(r.at.slice(3)); if (!E) return;
    r.at = 'zoo'; G.zoo.syncCreatures();
    const x = E.d.x, z = E.d.z + E.half + 4;
    const c = G.wild.add({ sp: r.sp, v: r.v, size: r.size, x, z, y: G.terrain.ground(x, z) });
    c.escaped = r.uid; c.ai.st = 'hunt'; c.ai.t = 40; c.ai.target = G.me; c.ai.homeR = 40; c.ai.home.set(ZOO.x, 0, ZOO.z);
    delete G.W.creatures[r.uid];   // it is wild again until you catch it
    G.event({ k: 'banner', t: 'THE ' + SP[r.sp].name.toUpperCase() + ' HAS ESCAPED!', s: 'It was unhappy in there. Catch it again - and give it a proper Predator Paddock.', kind: 'bad' });
    G.audio.alarm();
    G.visitors.scare(c.pos, 40);
    G.saveSoon();
  }

  /* ---------------- shared effects ---------------- */
  quake(s, x, z) { this.tremorT = Math.max(this.tremorT, 1.2); this.tremorS = s; this.g.audio.stomp(x != null ? { x, y: 0, z } : this.g.player.pos, 1); }
  _tremor(dt) { if (this.tremorT > 0) { this.tremorT -= dt; this.g.cam.shake(this.tremorS * dt * 2); } }
  bomb(x, z) {
    const G = this.g, m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), new THREE.MeshBasicMaterial({ color: '#ff7a2a' }));
    const from = new THREE.Vector3(VOLCANO.x, VOLCANO.lava + 10, VOLCANO.z), to = new THREE.Vector3(x, G.terrain.ground(x, z), z);
    G.scene.add(m);
    this.bombs.push({ m, from, to, t: 0, dur: 3 + Math.random() });
  }
  _bombs(dt) {
    const G = this.g;
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const B = this.bombs[i]; B.t += dt; const f = B.t / B.dur;
      B.m.position.lerpVectors(B.from, B.to, f); B.m.position.y += Math.sin(f * Math.PI) * 120;
      if (Math.random() < dt * 30) G.fx.burst(B.m.position.x, B.m.position.y, B.m.position.z, 'ember', 1);
      if (f >= 1) {
        G.scene.remove(B.m); this.bombs.splice(i, 1);
        G.fx.burst(B.to.x, B.to.y + 1, B.to.z, 'ember', 30, { scale: 2 }); G.fx.burst(B.to.x, B.to.y + 1, B.to.z, 'smoke', 8, { scale: 2 }); G.fx.ring(B.to.x, B.to.y + 0.3, B.to.z, 8, '#ff7a2a');
        G.audio.crash(B.to);
        const P = G.player;
        if (P.pos.distanceTo(B.to) < 7 && !(P.mount && P.mount.has('heatproof'))) P.hit(P.pos.clone().sub(B.to), 9, 1, 'A lava bomb!');
      }
    }
  }
  meteor(x, z, land) {
    const G = this.g;
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(land ? 3 : 1.2, 0), new THREE.MeshBasicMaterial({ color: '#c8f0ff' }));
    const to = new THREE.Vector3(x, land ? G.terrain.ground(x, z) : 120 + Math.random() * 60, z), from = to.clone().add(new THREE.Vector3(-400, 500, 200));
    G.scene.add(m);
    this.meteors.push({ m, from, to, t: 0, dur: land ? 3 : 1.6, land });
  }
  _meteors(dt) {
    const G = this.g;
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const M = this.meteors[i]; M.t += dt; const f = M.t / M.dur;
      M.m.position.lerpVectors(M.from, M.to, f);
      if (Math.random() < dt * 40) G.fx.burst(M.m.position.x, M.m.position.y, M.m.position.z, 'magic', 1, { scale: M.land ? 3 : 1.5 });
      if (f >= 1) {
        G.scene.remove(M.m); this.meteors.splice(i, 1);
        if (M.land) { G.fx.debris(M.to.x, M.to.y + 1, M.to.z, 30); G.fx.burst(M.to.x, M.to.y + 2, M.to.z, 'magic', 60, { scale: 3 }); G.fx.ring(M.to.x, M.to.y + 0.5, M.to.z, 30, '#9af0ff', 1.4); G.audio.crash(M.to); G.cam.shake(0.8); }
      }
    }
  }
}
void lerp;
