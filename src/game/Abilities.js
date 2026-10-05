/* Abilities.js - the code behind data/Abilities.js.

   F uses your mount's main ability. Each handler is a method named after the
   ability id. They change the world through game.act() so co-op stays in step
   (the host stuns the creatures, opens the gate, rolls the loot).
   Passive abilities (climb, heatproof, warm, sturdy, wade, dive...) are read
   where they matter (Creature physics, Player hazards, Riding). */
import * as THREE from '../../lib/three.module.js';
import { ABILITIES } from '../data/Abilities.js';
import { RARITY } from '../data/Species.js';
import { TOOLS } from '../data/Tools.js';
import { clamp } from '../core/Util.js';
import { Bus } from '../core/Bus.js';

const _v = new THREE.Vector3();

export class Abilities {
  constructor(game) { this.g = game; this.trail = null; this.trailT = 0; }
  primary(c) { return c.sp.abilities.find(a => ABILITIES[a]?.key === 'F') || null; }
  use(c) {
    const G = this.g, a = this.primary(c);
    if (!a) return G.ui.toast(c.sp.name + ' has no special move.', 'info');
    if (G.riding.cd > 0) return;
    if (this[a]) { this[a](c); Bus.emit('ability', { a, sp: c.spId }); }
  }
  _front(c, dist) { return _v.set(c.pos.x + Math.sin(c.yaw) * dist, c.pos.y, c.pos.z + Math.cos(c.yaw) * dist).clone(); }

  /* ---------------- movement attacks ---------------- */
  smash(c) { this.charge(c, true); }
  charge(c, smash = false) {
    const G = this.g;
    G.riding.charging = 1.3; G.riding.cd = 2.2; c.anim.play(smash ? 'attack' : 'roar');
    G.audio.roar(c.pos, Math.min(1, c.height / 5) * 0.7, 'bellow');
    G.cam.shake(0.25);
    this._smashFlag = smash || c.has('smash');
  }
  /** while charging: knock things over, break boulders */
  chargeHit(c) {
    const G = this.g, at = this._front(c, c.radius + 2);
    for (const w of G.wild.list) {
      if (w.gone || w === c) continue;
      if (w.pos.distanceTo(at) < w.radius + c.radius + 1.5) { G.act({ k: 'stun', id: w.id, t: 2.5, knock: [Math.sin(c.yaw) * 8, Math.cos(c.yaw) * 8] }); }
    }
    if (this._smashFlag) for (const id in G.landmarks.gates) {
      const S = G.landmarks.gates[id];
      if (S.open || S.G.kind !== 'boulder') continue;
      if (Math.hypot(S.G.x - at.x, S.G.z - at.z) < S.G.r + c.radius + 2.5) { G.act({ k: 'gate', id, how: c.spId }); G.riding.charging = 0; c.speed *= -0.3; }
    }
  }
  tailwhip(c) {
    const G = this.g; G.riding.cd = 3; c.anim.play('attack');
    G.fx.ring(c.pos.x, c.pos.y + 0.3, c.pos.z, c.len * 0.9, '#ffffff'); G.audio.whoosh(1.5); G.cam.shake(0.2);
    G.act({ k: 'aoe', x: c.pos.x, z: c.pos.z, r: c.len * 0.85, stun: 2.5, knock: 9 });
  }
  roar(c) {
    const G = this.g; G.riding.cd = 7; c.anim.play('roar');
    G.audio.roar(c.pos, Math.min(1, c.height / 5), 'roar'); G.cam.shake(0.6);
    G.fx.ring(c.pos.x, c.pos.y + 0.5, c.pos.z, 30, '#ffe8c0', 1); G.fx.ring(c.pos.x, c.pos.y + 0.5, c.pos.z, 18, '#ffe8c0', 0.7);
    G.act({ k: 'roar', x: c.pos.x, z: c.pos.z, r: 36, big: RARITY[c.sp.rarity].stars });
  }
  call(c) {
    const G = this.g; G.riding.cd = 5; c.anim.play('call');
    G.audio.roar(c.pos, 0.5, 'honk'); G.fx.ring(c.pos.x, c.pos.y + 1, c.pos.z, 40, '#a0ffb0', 1.2);
    G.act({ k: 'call', x: c.pos.x, z: c.pos.z, r: 42 });
  }
  spit(c) {
    const G = this.g; G.riding.cd = 3; c.anim.play('attack');
    const a = G.tools.assist;
    const target = a && a.d < 28 ? a.c : G.wild.list.find(w => !w.gone && w.pos.distanceTo(this._front(c, 8)) < 8);
    c.mouth(_v); G.fx.burst(_v.x, _v.y, _v.z, 'magic', 12, { dir: { x: Math.sin(c.yaw) * 10, y: 2, z: Math.cos(c.yaw) * 10 } });
    G.audio.bite(c.pos);
    if (target) { G.act({ k: 'stun', id: target.id, t: 5 }); G.fx.burst(target.pos.x, target.pos.y + target.height, target.pos.z, 'spark', 16); G.ui.toast(target.sp.name + ' is dazzled - catch it now!', 'good'); }
  }
  sting(c) {
    const G = this.g; G.riding.cd = 3; c.anim.play('attack');
    const t = G.wild.list.find(w => !w.gone && w.pos.distanceTo(this._front(c, c.radius + 2)) < w.radius + 3);
    if (t) { G.act({ k: 'stun', id: t.id, t: 5 }); G.fx.burst(t.pos.x, t.pos.y + t.height, t.pos.z, 'spark', 14); G.ui.toast(t.sp.name + ' is stunned!', 'good'); }
  }
  dig(c) {
    const G = this.g, L = G.landmarks, p = c.pos;
    const d = L.digs.find(d => L.digReady(d.i) && Math.hypot(d.x - p.x, d.z - p.z) < 5 + c.radius);
    c.anim.play('chomp'); G.riding.cd = 1;
    G.fx.burst(p.x, p.y, p.z, 'dirt', 14); G.audio.dig();
    if (d) G.act({ k: 'dig', i: d.i, how: c.spId });
    else G.ui.toast('It digs a hole and finds... dirt. Look for sparkling mounds.', 'info');
  }
  cut(c) {
    const G = this.g; c.anim.play('attack'); G.riding.cd = 1.2; G.audio.slash();
    const id = Object.keys(G.landmarks.gates).find(k => { const S = G.landmarks.gates[k]; return !S.open && S.G.kind === 'vines' && Math.hypot(S.G.x - c.pos.x, S.G.z - c.pos.z) < 7 + c.radius; });
    if (id) G.act({ k: 'gate', id, how: c.spId });
    else G.fx.burst(c.pos.x + Math.sin(c.yaw) * 3, c.pos.y + 1.5, c.pos.z + Math.cos(c.yaw) * 3, 'leaf', 10);
  }
  track(c) {
    const G = this.g; G.riding.cd = 6; c.anim.play('chomp');
    let best = null, bs = -1;
    for (const w of G.wild.list) { if (w.gone) continue; const d = w.pos.distanceTo(c.pos); if (d > 400) continue; const s = RARITY[w.sp.rarity].stars * 10 + (w.v ? 25 : 0) - d * 0.01; if (s > bs) { bs = s; best = w; } }
    if (!best) return G.ui.toast('Nothing interesting to smell around here.', 'info');
    this.trail = best; this.trailT = 10;
    G.ui.toast('It caught a scent: ' + (G.W.dex[best.spId]?.caught ? best.sp.name : 'something ' + RARITY[best.sp.rarity].name.toLowerCase()) + '!', 'good');
    G.ui.mark(best, 30);
  }
  echo(c) {
    const G = this.g; G.riding.cd = 6;
    G.fx.ring(c.pos.x, c.pos.y, c.pos.z, 60, '#9af0ff', 1.5); G.fx.ring(c.pos.x, c.pos.y, c.pos.z, 30, '#9af0ff', 1);
    G.audio.tone(1800, 0.6, 'sine', 0.08, 0.01, 0.5);
    let n = 0;
    for (const w of G.wild.list) if (!w.gone && (w.under || w.swimmer) && w.pos.distanceTo(c.pos) < 140) { G.ui.mark(w, 25); n++; }
    for (const id in G.landmarks.chests) { const S = G.landmarks.chests[id]; if (!G.W.found[id] && Math.hypot(S.x - c.pos.x, S.z - c.pos.z) < 160) { G.ui.markPoint(S.x, S.y, S.z, 'Treasure', 25); n++; } }
    G.ui.toast(n ? 'Echo: ' + n + ' things found nearby.' : 'Echo: nothing nearby.', 'info');
  }
  dash(c) { const G = this.g; G.riding.dashT = 1.6; G.riding.cd = 4; G.sky.strike(c.pos.x + (Math.random() - 0.5) * 60, c.pos.z + (Math.random() - 0.5) * 60, (x, z) => G.terrain.ground(x, z)); G.fx.burst(c.pos.x, c.pos.y, c.pos.z, 'spark', 30, { scale: 2 }); G.audio.thunder(40); }

  /* ---------------- per frame: the scent trail ---------------- */
  update(dt) {
    const G = this.g;
    if (this.trail && this.trailT > 0) {
      this.trailT -= dt;
      const w = this.trail, from = G.player.pos;
      if (w.gone) { this.trail = null; return; }
      if (Math.random() < dt * 14) {
        const f = Math.random() * 0.25, d = w.pos.distanceTo(from);
        const t = f * Math.min(1, 60 / Math.max(1, d)) * 4;
        const x = from.x + (w.pos.x - from.x) * Math.min(1, t), z = from.z + (w.pos.z - from.z) * Math.min(1, t);
        G.fx.burst(x, Math.max(G.terrain.ground(x, z), 0) + 0.6, z, 'scent', 2);
      }
    }
  }

  /* ---------------- interactions (E) ---------------- */
  /** at a gate: do we have what it takes? */
  tryGate(id) {
    const G = this.g, S = G.landmarks.gates[id]; if (!S || S.open) return;
    const m = G.player.mount;
    if (S.G.kind === 'vines') {
      if (m && m.has('cut')) return this.cut(m);
      if (G.W.tools.machete) return G.ui.toast('Hold the Machete and swing it (LMB).', 'info');
    } else if (m && (m.has('smash') || m.has('charge'))) return G.ui.toast('Charge it! Press F and run at the rocks.', 'info');
    G.ui.toast(S.G.hint, 'warn');
  }
  tryDig(i) {
    const G = this.g, m = G.player.mount;
    if (m && m.has('dig')) return this.dig(m);
    if (G.tools.id === 'shovel') return G.act({ k: 'dig', i, how: 'shovel' });
    if (G.W.tools.shovel) return G.ui.toast('Hold your Shovel (hotbar) and click.', 'info');
    G.ui.toast('Something is buried here. A Shovel - or a creature that digs, like a Protoceratops - would get it out.', 'info');
  }
  tryScout(i) {
    const G = this.g;
    const tiny = G.packCreatures().find(r => G.spOf(r).abilities.includes('scout'));
    if (!tiny) return G.ui.toast('Far too narrow for you. A tiny creature in your crate (like a Compsognathus) could squeeze in.', 'warn');
    G.act({ k: 'scout', i, uid: tiny.uid });
  }
}
void clamp; void TOOLS;
