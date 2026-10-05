/* Tools.js - what you are holding, and what it does.

   The hotbar picks the held item; this puts its model in your hand and runs
   its behaviour (data/Tools.js `behavior`):
     lasso / bola / net / harpoon / skyhook   -> game/Catching.js
     bait     LMB throws it; creatures that eat it come over (and are easy to snare)
     scan     binoculars: RMB zooms, look at a creature to scan it into the dex
     cut      machete: LMB slashes vine curtains
     dig      shovel: LMB digs a sparkling mound
     light    lantern: LMB toggles it
     photo    camera: RMB to frame, LMB to snap - good photos of rare creatures pay
   It also finds the creature under your crosshair (soft aim assist, and the
   nameplate the HUD shows). ADDING A BEHAVIOUR: add a method named after it. */
import * as THREE from '../../lib/three.module.js';
import { TOOLS } from '../data/Tools.js';
import { ITEMS } from '../data/Items.js';
import { holdModel, projectileModel } from '../art/ToolArt.js';
import { clamp, damp } from '../core/Util.js';
import { Bus } from '../core/Bus.js';

const _v = new THREE.Vector3(), _f = new THREE.Vector3(), _c = new THREE.Vector3();

export class Tools {
  constructor(game) {
    this.g = game;
    this.id = null; this.model = null;
    this.assist = null;            // { c, d, ang } the creature under the crosshair
    this.scanT = 0; this.scanId = null;
    this.zoom = 0; this.swingT = 0; this.lantern = false;
    this.bait = [];                 // thrown bait flying through the air (local)
    this.light = new THREE.PointLight('#ffd890', 0, 22, 1.4); game.scene.add(this.light);
  }
  get def() { return TOOLS[this.id] || ITEMS[this.id] || null; }
  get behavior() { const T = TOOLS[this.id]; return T ? T.behavior : ITEMS[this.id]?.kind === 'bait' ? 'bait' : null; }
  hold(id) {
    if (id === this.id) return;
    if (this.g.catching.busy && this.g.catching.state !== 'reel') return;   // not mid-catch
    this.id = id;
    const hand = this.g.player.rig.P.handR;
    if (this.model) hand.remove(this.model);
    this.model = id ? holdModel(id) : null;
    if (this.model) { this.model.position.set(0, -0.06, 0.02); hand.add(this.model); }
    if (TOOLS[id]?.behavior !== 'light') this.lantern = false;
  }

  /** the creature nearest the crosshair */
  _findAssist(range) {
    const G = this.g, cam = G.camera, f = cam.getWorldDirection(_f);
    let best = null, bs = Infinity;
    const scan = (c) => {
      if (c.gone || c === G.player.mount) return;
      c.centre(_c); _v.subVectors(_c, cam.position);
      const d = _v.length(); if (d > range || d < 1) return;
      const ang = Math.acos(clamp(_v.dot(f) / d, -1, 1));
      const tol = Math.max(0.05, Math.atan((c.radius + c.height * 0.3) / d) * 1.4);
      if (ang > tol) return;
      const s = ang / tol + d / range * 0.4;
      if (s < bs) { bs = s; best = { c, d, ang }; }
    };
    for (const c of G.wild.list) scan(c);
    for (const c of G.zoo.creatures) scan(c);
    return best;
  }

  update(dt, input, blocked) {
    const G = this.g, P = G.player, B = this.behavior, T = TOOLS[this.id];
    const range = T?.stats?.range ? T.stats.range + 12 : B === 'scan' || B === 'photo' ? 160 : 60;
    this.assist = blocked ? null : this._findAssist(range);
    // catching runs whatever is in your hand (a fight keeps going)
    G.catching.update(dt, input, blocked || P.koT > 0, T?.kind === 'catch' ? this.id : (G.catching.busy ? G.catching.toolId : null));
    // zoom with binoculars / the camera
    const zoomWant = (B === 'scan' || B === 'photo') && input.btn(2) && !blocked ? 1 : 0;
    this.zoom = damp(this.zoom, zoomWant, 8, dt);
    G.cam.baseFov = (G.profile.fov || 70) - this.zoom * 48;
    this.swingT = Math.max(0, this.swingT - dt);
    const click = !blocked && input.click(0) && !G.catching.busy;
    if (B && this[B] && !blocked) this[B](dt, input, click);
    // bait in flight
    for (let i = this.bait.length - 1; i >= 0; i--) {
      const b = this.bait[i];
      b.vel.y -= 12 * dt; b.pos.addScaledVector(b.vel, dt); b.m.position.copy(b.pos); b.m.rotation.x += dt * 5;
      const g = G.terrain.ground(b.pos.x, b.pos.z);
      if (b.pos.y < Math.max(g, 0)) {
        if (b.pos.y < 0 && g < 0) G.fx.splash(b.pos.x, 0, b.pos.z, 0.4); else G.fx.burst(b.pos.x, g, b.pos.z, 'leaf', 6);
        G.scene.remove(b.m); this.bait.splice(i, 1);
        G.act({ k: 'bait', item: b.item, x: b.pos.x, y: Math.max(g, b.pos.y < 0 ? -0.5 : g), z: b.pos.z });
      }
    }
    // the lantern
    this.light.intensity = damp(this.light.intensity, this.lantern ? 2.4 : 0, 6, dt);
    if (this.lantern || this.light.intensity > 0.01) { P.rig.P.handR.getWorldPosition(this.light.position); this.light.position.y += 0.3; }
    // swing animation for the machete / shovel
    if (this.model) this.model.rotation.x = this.swingT > 0 ? -Math.sin((1 - this.swingT / 0.35) * Math.PI) * 1.8 : 0;
    P.A.photo = B === 'photo' && this.zoom > 0.5 ? 1 : 0;
    P.A.point = (B === 'scan' && this.zoom > 0.5) ? 1 : 0;
  }

  /* ---------------- behaviours ---------------- */
  bait(dt, input, click) {
    const G = this.g;
    if (!click) return;
    if (!(G.W.items[this.id] > 0)) { G.ui.toast('No ' + ITEMS[this.id].name + ' left. Buy more at the Ranger Station.', 'warn'); return; }
    const cam = G.camera, f = cam.getWorldDirection(_f).clone();
    const from = new THREE.Vector3(); G.player.rig.P.handR.getWorldPosition(from);
    const vel = f.multiplyScalar(17); vel.y += 4;
    const m = projectileModel(this.id); m.position.copy(from); G.scene.add(m);
    this.bait.push({ pos: from.clone(), vel, m, item: this.id });
    G.act({ k: 'use', item: this.id });
    G.player.A.throw = 2; setTimeout(() => (G.player.A.throw = 0), 300);
    G.audio.whoosh(0.6);
  }
  scan(dt, input) {
    const G = this.g, a = this.assist;
    if (input.btn(2) && a && a.d < 160) {
      if (this.scanId !== a.c.id) { this.scanId = a.c.id; this.scanT = 0; }
      this.scanT += dt;
      if (this.scanT > 0.8 && !a.c._scanned) { a.c._scanned = true; G.onScan(a.c); }
    } else { this.scanT = 0; this.scanId = null; }
  }
  cut(dt, input, click) {
    if (!click) return;
    const G = this.g; this.swingT = 0.35; G.audio.slash();
    const id = G.landmarks && Object.keys(G.landmarks.gates).find(k => { const S = G.landmarks.gates[k]; return !S.open && S.G.kind === 'vines' && Math.hypot(S.G.x - G.player.pos.x, S.G.z - G.player.pos.z) < 5.5; });
    if (id) G.act({ k: 'gate', id, how: 'machete' });
  }
  dig(dt, input, click) {
    if (!click) return;
    const G = this.g; this.swingT = 0.35;
    const L = G.landmarks, p = G.player.pos;
    const d = L.digs.find(d => L.digReady(d.i) && Math.hypot(d.x - p.x, d.z - p.z) < 3.2);
    if (d) { G.audio.dig(); G.act({ k: 'dig', i: d.i, how: 'shovel' }); }
    else { G.audio.dig(); G.fx.burst(p.x + Math.sin(G.player.yaw), G.terrain.ground(p.x, p.z), p.z + Math.cos(G.player.yaw), 'dirt', 5); G.ui.toast('Nothing here. Look for sparkling mounds.', 'info'); }
  }
  light(dt, input, click) { if (click) { this.lantern = !this.lantern; this.g.audio.click(); } }
  photo(dt, input, click) {
    const G = this.g;
    if (!click) return;
    G.audio.shutter(); G.ui.flash();
    const a = this.assist;
    if (!a || a.d > 90) { G.ui.toast('Nothing in the shot worth printing.', 'info'); return; }
    const c = a.c;
    if (c._photo && G.time - c._photo < 60) { G.ui.toast('You already have that shot.', 'info'); return; }
    c._photo = G.time;
    G.act({ k: 'photo', sp: c.spId, v: c.v, act: c.anim.act || c.astate || (c.flying ? 'fly' : c.speed > 4 ? 'run' : 'idle'), d: a.d, wild: !c.uid });
  }
}
void Bus;
