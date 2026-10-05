/* Fishing.js - the Hooked rod, for the lagoon and the sea.

   idle -> charge (hold LMB) -> fly (the bobber is a projectile on a line)
        -> wait (it bobs; small nibbles dip it - DON'T click yet)
        -> bite (it goes under: CLICK to strike, inside the window)
        -> the fight (game/Catching.js, the tug meter) -> landed / lost
   Holding LMB while waiting reels the bobber in (and a fish may still take it).

   What bites depends on where the bobber is (lagoon, sea, river, swamp,
   deep water), the time, the weather and how far from home you are - the
   same tables the wild spawns use, tilted toward small things. Hook
   something LARGE and the fight changes: the water goes still, then a head,
   a neck, a fin or a huge back rolls up out of the water now and then
   (Catching: F.big). Fish Bait in your items is used up one per bite and
   makes bites come faster. */
import * as THREE from '../../lib/three.module.js';
import { TOOLS } from '../data/Tools.js';
import { SP, RARITY, SIZE } from '../data/Species.js';
import { Rope } from '../art/ToolArt.js';
import { clamp, weighted } from '../core/Util.js';
import { Bus } from '../core/Bus.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const TIP = new THREE.Vector3(0, 0.95, 1.45);    // the rod tip, in the hand's frame

export class Fishing {
  constructor(game) {
    this.g = game; this.state = 'idle'; this.charge = 0;
    this.bpos = new THREE.Vector3(); this.bvel = new THREE.Vector3();
    const b = new THREE.Group();
    const m1 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e83a2a', flatShading: true }));
    const m2 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f4f0e8', flatShading: true }));
    const m3 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 4), new THREE.MeshStandardMaterial({ color: '#2a2a2a' })); m3.position.y = 0.2;
    b.add(m1, m2, m3); b.visible = false; game.scene.add(b);
    this.bobber = b;
    this.line = new Rope(game.scene, '#f0ece0', 0.02, 22);
    this.timer = 0; this.nibbles = 0; this.biteT = 0; this.pending = null;
  }
  get rod() { return TOOLS[this.rodId] || TOOLS.reedrod; }
  get busy() { return this.state !== 'idle'; }
  tipPos(out) {
    const T = this.g.tools;
    if (T.model) return T.model.localToWorld(out.copy(TIP));
    return this.g.player.rig.P.handR.getWorldPosition(out);
  }
  cancel() { this.state = 'idle'; this.bobber.visible = false; this.line.hide(); this.pending = null; }
  msg(t, k) { this.g.ui.toast(t, k); }

  update(dt, input, blocked, rodId) {
    const G = this.g, P = G.player;
    this.rodId = rodId;
    if (G.catching.state === 'fight' && G.catching.F?.fishing) { this.bobber.visible = false; this.line.hide(); this.state = 'idle'; return; }
    const lmb = !blocked && input.btn(0), click = !blocked && input.click(0), unclick = input.unclick(0);
    const tip = this.tipPos(_w).clone();
    const surf = () => G.water.waveAt(this.bpos.x, this.bpos.z, G.time, G.events.w.storm) * 0.4;
    switch (this.state) {
      case 'idle':
        if (click && !G.catching.busy && !P.koT) { this.state = 'charge'; this.charge = 0; }
        break;
      case 'charge':
        this.charge = Math.min(1, this.charge + dt / 1.0);
        P.A.throw = 1; P.A.charge = this.charge; P.A.spin = false;
        if (unclick || !lmb) {
          const f = G.camera.getWorldDirection(_v).clone(); f.y = Math.max(f.y, -0.2) + 0.35;
          const sp = 9 + this.rod.stats.range * 0.55 * (0.3 + 0.7 * this.charge);
          this.bpos.copy(tip); this.bvel.copy(f.normalize()).multiplyScalar(sp);
          this.state = 'fly'; P.A.throw = 2; setTimeout(() => (P.A.throw = 0), 350);
          G.audio.whoosh(0.8); this.bobber.visible = true;
        }
        break;
      case 'fly': {
        this.bvel.y -= 9.8 * dt; this.bvel.multiplyScalar(Math.exp(-0.15 * dt));
        this.bpos.addScaledVector(this.bvel, dt);
        if (this.bpos.distanceTo(tip) > this.rod.stats.range + 4) this.bvel.multiplyScalar(0.3);
        const g = G.terrain.ground(this.bpos.x, this.bpos.z);
        if (this.bpos.y <= 0 && g < -0.6) {
          this.bpos.y = 0; this.state = 'wait';
          this.timer = this._biteTime(); this.nibbles = Math.floor(Math.random() * 3.2);
          G.fx.splash(this.bpos.x, 0, this.bpos.z, 0.4); G.audio.splash(this.bpos, 0.3);
          Bus.emit('fish:cast', {});
        } else if (this.bpos.y <= g) { this.bpos.y = g; this.state = 'reel'; this.msg('Snagged on dry land. Cast into the water!', 'warn'); }
        break;
      }
      case 'wait': case 'nibble': {
        this.bpos.y = surf() + (this.state === 'nibble' ? -0.12 : 0);
        if (lmb) {
          // reeling an empty line in (something may still take it)
          _v.copy(tip).sub(this.bpos); _v.y = 0; const L = _v.length();
          if (L < 2.5) { this.state = 'reel'; break; }
          this.bpos.addScaledVector(_v.normalize(), 5 * dt);
          if (Math.random() < dt * 0.6) G.audio.reel();
        }
        this.timer -= dt;
        if (this.state === 'nibble') { this.nibT -= dt; if (this.nibT <= 0) this.state = 'wait'; if (click) { this.msg('Too early - you spooked it.', 'warn'); this.timer = this._biteTime() + 3; this.state = 'wait'; } }
        else if (this.nibbles > 0 && this.timer < this.nibbles * 1.3) { this.nibbles--; this.state = 'nibble'; this.nibT = 0.35; G.fx.ring(this.bpos.x, 0.05, this.bpos.z, 0.8, '#ffffff', 0.5); G.audio.tone(500, 0.06, 'sine', 0.05); }
        if (this.timer <= 0 && this.state === 'wait') this._bite();
        if (this.bpos.distanceTo(tip) > this.rod.stats.range + 8) this.state = 'reel';
        break;
      }
      case 'bite': {
        this.biteT -= dt;
        this.bpos.y = -0.35;
        if (Math.random() < dt * 20) G.fx.burst(this.bpos.x, 0.05, this.bpos.z, 'splash', 1, { scale: this.pending?.big ? 1.6 : 0.5 });
        if (click || G.admin?.autoCatch) { this._hook(this.biteT > this.biteDur * 0.5); break; }
        if (this.biteT <= 0) { this.msg('Too slow - it got away.', 'warn'); this.pending = null; this.state = 'wait'; this.timer = this._biteTime(); }
        break;
      }
      case 'reel': {
        _v.copy(tip).sub(this.bpos); const L = _v.length();
        this.bpos.addScaledVector(_v.normalize(), Math.min(L, 14 * dt));
        if (this.bpos.y < 0) this.bpos.y = 0;
        if (L < 1.2) this.cancel();
        break;
      }
    }
    // draw
    const on = this.state !== 'idle' && this.state !== 'charge';
    this.bobber.visible = on && this.state !== 'bite';
    if (on) {
      this.bobber.position.copy(this.bpos);
      const L = tip.distanceTo(this.bpos);
      this.line.draw(tip, this.bpos, L * (this.state === 'fly' ? 0.02 : this.state === 'reel' ? 0.05 : 0.1), G.camera.position);
      P.A.pull = this.state === 'bite' ? 0.6 : 0.2;
    } else { this.line.hide(); if (!G.catching.busy) P.A.pull = 0; }
  }
  _biteTime() {
    const G = this.g, bait = (G.W.items.fish || 0) > 0;
    let t = (5 + Math.random() * 9) / (this.rod.stats.bite || 1) / (bait ? 1.6 : 1);
    if (G.events.w.storm > 0.5) t *= 0.7;
    if (G.sky.state.night > 0.5) t *= 0.85;
    return t;
  }
  /** what bites here: the wild tables for this water, tilted toward small things */
  pick() {
    const G = this.g, ctx = G.wild._ctx(this.bpos.x, this.bpos.z);
    ctx.depth = Math.max(ctx.depth, 2.5); ctx.fishing = true;
    const list = G.wild.weights(ctx, 'swim').map(e => ({ sp: e.sp, w: e.w * ({ S: 3, M: 1.5, L: 0.55, XL: 0.22 }[e.sp.size]) * (this.rod.effect === 'luck' && RARITY[e.sp.rarity].stars >= 3 ? 2 : 1) }));
    const p = weighted(list);
    return p ? p.sp : SP.coel;
  }
  _bite() {
    const G = this.g;
    const sp = this.pick();
    const big = sp.size === 'L' || sp.size === 'XL';
    if ((G.W.items.fish || 0) > 0) G.act({ k: 'use', item: 'fish' });
    this.pending = { sp, big };
    this.state = 'bite';
    this.biteDur = this.biteT = this.rod.stats.window * 0.9 * (big ? 1.4 : 1);
    G.audio.tone(big ? 220 : 880, 0.25, big ? 'sawtooth' : 'square', 0.08, 0.005, 0.6);
    G.fx.splash(this.bpos.x, 0, this.bpos.z, big ? 2 : 0.7);
    if (big) { G.cam.shake(0.25); G.fx.ring(this.bpos.x, 0.1, this.bpos.z, 6, '#ffffff', 1); }
    G.ui.flashBite?.(big);
    Bus.emit('fish:bite', { sp: sp.id });
  }
  _hook(perfect) {
    const G = this.g, P = G.player, { sp } = this.pending;
    const depth = Math.min(4, Math.max(1, -G.terrain.ground(this.bpos.x, this.bpos.z) - 1));
    const c = G.wild.add({ sp: sp.id, x: this.bpos.x, z: this.bpos.z, y: -depth, size: Math.random() * 0.9, v: G.wild.rollVariant(this.rod.effect === 'luck' ? 2 : 1), yaw: Math.random() * 6.28 });
    c.ai.st = 'held';
    G.wild.claim(c);
    const C = G.catching;
    C.c = c; C.toolId = this.rodId; C.eating = false; C.sneak = false;
    C._startFight(perfect, { fishing: true, dist: Math.hypot(this.bpos.x - P.pos.x, this.bpos.z - P.pos.z) });
    this.state = 'idle'; this.bobber.visible = false; this.line.hide(); this.pending = null;
    G.audio.latch();
    Bus.emit('fish:hooked', { sp: sp.id });
  }
  hud() { return { state: this.state, charge: this.charge, bite: this.state === 'bite' ? this.biteT / this.biteDur : 0, big: this.pending?.big }; }
}
void clamp; void SIZE;
