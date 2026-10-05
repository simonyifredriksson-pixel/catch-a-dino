/* Build.js - build mode (B, inside the zoo).

   The camera lifts into a top-down orbit over the zoo: WASD pans, the wheel
   zooms, drag with the right mouse button to turn. Pick something in the
   catalog at the bottom (exhibits: choose a habitat and a size; nature,
   paths, decor, facilities), move the ghost with the mouse (green = fits,
   red = blocked or too expensive), R rotates, LMB places. Paths paint while
   you hold the button. X toggles sell mode (half your money back; exhibits
   must be empty). B or ESC leaves. Placement goes through game.act so co-op
   players build the same zoo. */
import * as THREE from '../../lib/three.module.js';
import { HABITATS, EX_SIZES, HAB_PRICE, SIZE_LEVEL, DECOR, DECOR_CATS, PLOTS } from '../data/Build.js';
import { SP } from '../data/Species.js';
import { ZOO } from '../data/Biomes.js';
import { exhibitArt, decorArt } from '../art/ZooArt.js';
import { STATION } from './Zoo.js';
import { esc, money, clamp, damp } from '../core/Util.js';

const $ = id => document.getElementById(id);
export function exhibitPrice(hab, size) { return Math.round(EX_SIZES[size].price * HAB_PRICE[hab] / 10) * 10; }

export class Build {
  constructor(game) {
    this.g = game; this.active = false;
    this.cat = 'exhibit'; this.hab = 'meadow'; this.size = 'S'; this.key = 'tree'; this.rot = 0; this.sell = false;
    this.ghost = null; this.ghostKey = '';
    this.focus = new THREE.Vector3(ZOO.x, ZOO.y, ZOO.z); this.yaw = 0; this.pitch = 0.95; this.dist = 70;
    this.mouse = new THREE.Vector2(); this.ray = new THREE.Raycaster(); this.at = null; this.ok = false;
    this.el = document.createElement('div'); this.el.id = 'build'; document.body.appendChild(this.el);
    this.el.addEventListener('mousedown', e => e.stopPropagation());
    this.el.addEventListener('click', e => this._click(e));
    addEventListener('mousemove', e => {
      this.mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      if (this.active && this.drag) { this.yaw -= e.movementX * 0.006; this.pitch = clamp(this.pitch + e.movementY * 0.004, 0.35, 1.45); }
    });
    game.renderer.domElement.addEventListener('mousedown', e => { if (!this.active) return; if (e.button === 2) this.drag = true; if (e.button === 0) { this.down = true; this._place(); } });
    addEventListener('mouseup', e => { if (e.button === 2) this.drag = false; if (e.button === 0) { this.down = false; this.lastPaint = null; } });
    game.renderer.domElement.addEventListener('wheel', e => { if (this.active) this.dist = clamp(this.dist * (1 + Math.sign(e.deltaY) * 0.12), 18, 190); }, { passive: true });
  }
  get W() { return this.g.W; }
  get half() { return PLOTS[this.W.plot || 0].half; }
  canEnter() { const P = this.g.player.pos; return Math.abs(P.x - ZOO.x) < this.half + 30 && Math.abs(P.z - ZOO.z) < this.half + 30; }
  toggle() {
    const G = this.g;
    if (this.active) return this.exit();
    if (!this.canEnter()) return G.ui.toast('You can only build at your zoo.', 'warn');
    if (G.catching.busy || G.player.riding) return G.ui.toast('Get off your mount first.', 'warn');
    this.active = true; G.input.unlock(); this.focus.set(G.player.pos.x, ZOO.y, G.player.pos.z);
    this.yaw = G.cam.yaw; this.el.classList.add('on'); this.render(); G.audio.open();
    G.cam.override = { pos: new THREE.Vector3(), look: new THREE.Vector3(), rate: 8 };
  }
  exit() { const G = this.g; this.active = false; this.el.classList.remove('on'); this._clearGhost(); G.cam.override = null; G.audio.close(); }

  /* ---------------- the catalog ---------------- */
  items() {
    const lv = this.g.zoo.level;
    if (this.cat === 'exhibit') return [];
    return Object.entries(DECOR).filter(([k, D]) => D.cat === this.cat).map(([k, D]) => ({ k, D, lock: D.level > lv }));
  }
  render() {
    const G = this.g, lv = G.zoo.level, W = this.W;
    let body = '';
    if (this.cat === 'exhibit') {
      const habs = Object.entries(HABITATS).map(([k, H]) => `<button class="bh ${this.hab === k ? 'on' : ''} ${H.level > lv ? 'lock' : ''}" data-a="hab" data-v="${k}" style="--hc:${H.ground}">${esc(H.name)}${H.level > lv ? ' ' + '&#9733;'.repeat(H.level) : ''}</button>`).join('');
      const sizes = Object.entries(EX_SIZES).map(([k, S]) => `<button class="bsz ${this.size === k ? 'on' : ''} ${SIZE_LEVEL[k] > lv ? 'lock' : ''}" data-a="size" data-v="${k}">${S.name} ${S.w}m<em>space ${S.space}</em></button>`).join('');
      const likes = Object.values(SP).filter(s => (s.move === 'fly' ? 'aviary' : s.move === 'swim' ? 'aquatic' : s.habitat) === this.hab || (this.hab === 'predator' && s.temper === 'aggressive')).map(s => s.name).slice(0, 9);
      body = `<div class="brow">${habs}</div><div class="brow">${sizes}<span class="bprice">${money(exhibitPrice(this.hab, this.size))}</span></div><div class="blikes">Happy here: ${esc(likes.join(', ') || '-')}</div>`;
    } else {
      body = '<div class="bitems">' + this.items().map(({ k, D, lock }) => `<div class="bi ${this.key === k ? 'on' : ''} ${lock ? 'lock' : ''}" data-a="item" data-v="${k}"><img src="${G.inv.icons.get('dec:' + k, () => decorArt(k, G), { dir: [1, 0.7, 1] })}"><b>${esc(D.name)}</b><span>${lock ? '&#9733;'.repeat(D.level) + ' zoo' : money(D.price)}</span></div>`).join('') + '</div>';
    }
    this.el.innerHTML = `<div class="bcats">${DECOR_CATS.map(c => `<button data-a="cat" data-v="${c.k}" class="${this.cat === c.k ? 'on' : ''}">${c.name}</button>`).join('')}<span class="bmoney">${money(W.money)}</span></div>${body}
      <div class="bkeys"><span><b class="key">LMB</b>place</span><span><b class="key">R</b>rotate</span><span><b class="key">X</b>${this.sell ? '<u>sell mode ON</u>' : 'sell mode'}</span><span><b class="key">WASD</b>pan</span><span><b class="key">RMB drag</b>turn</span><span><b class="key">wheel</b>zoom</span><span><b class="key">B</b>done</span></div>`;
    this.ghostKey = '';
  }
  _click(e) {
    const t = e.target.closest('[data-a]'); if (!t) return;
    const a = t.dataset.a, v = t.dataset.v, lv = this.g.zoo.level;
    this.g.audio.click();
    if (a === 'cat') { this.cat = v; this.sell = false; const it = this.items(); if (it.length && !it.find(i => i.k === this.key)) this.key = it[0].k; }
    if (a === 'hab') { if (HABITATS[v].level > lv) return this.g.ui.toast('Unlocks at ' + HABITATS[v].level + ' zoo stars.', 'warn'); this.hab = v; }
    if (a === 'size') { if (SIZE_LEVEL[v] > lv) return this.g.ui.toast('Unlocks at ' + SIZE_LEVEL[v] + ' zoo stars.', 'warn'); this.size = v; }
    if (a === 'item') { if (DECOR[v].level > lv) return this.g.ui.toast('Unlocks at ' + DECOR[v].level + ' zoo stars.', 'warn'); this.key = v; }
    this.render();
  }

  /* ---------------- placement ---------------- */
  _clearGhost() { if (this.ghost) { this.g.scene.remove(this.ghost); this.ghost = null; } this.ghostKey = ''; }
  _makeGhost() {
    const k = this.cat === 'exhibit' ? 'ex:' + this.hab + this.size : 'd:' + this.key;
    if (k === this.ghostKey) return;
    this._clearGhost(); this.ghostKey = k;
    const g = this.cat === 'exhibit' ? exhibitArt({ id: 'ghost', hab: this.hab, size: this.size, name: HABITATS[this.hab].name }) : decorArt(this.key, this.g);
    this.mats = [];
    g.traverse(m => { if (m.isMesh) { const arr = Array.isArray(m.material) ? m.material : [m.material]; m.material = arr.map(x => { const c = x.clone(); c.transparent = true; c.opacity = 0.62; c.depthWrite = false; if (c.emissive) { c.emissive.set('#20ff60'); c.emissiveIntensity = 0.25; } this.mats.push(c); return c; }); if (!Array.isArray(arr) || arr.length === 1) m.material = m.material[0]; m.castShadow = false; } });
    this.ghost = g; this.g.scene.add(g);
  }
  /** what is under the mouse, snapped */
  _pick() {
    const cam = this.g.camera;
    this.ray.setFromCamera(this.mouse, cam);
    const t = (ZOO.y - this.ray.ray.origin.y) / this.ray.ray.direction.y;
    if (!(t > 0)) return null;
    const p = this.ray.ray.origin.clone().addScaledVector(this.ray.ray.direction, t);
    const snap = this.cat === 'path' ? 4 : this.cat === 'exhibit' ? 2 : 0.5;
    if (this.cat === 'path') { p.x = Math.round((p.x - ZOO.x) / 4) * 4 + ZOO.x; p.z = Math.round((p.z - ZOO.z) / 4) * 4 + ZOO.z; }
    else { p.x = Math.round(p.x / snap) * snap; p.z = Math.round(p.z / snap) * snap; }
    return p;
  }
  /** can it go here? returns '' if yes, else why not */
  check(p) {
    const G = this.g, W = this.W, h = this.half;
    if (this.cat === 'exhibit') {
      const w = EX_SIZES[this.size].w, r = w / 2 + 1;
      if (Math.abs(p.x - ZOO.x) > h - r + 1 || Math.abs(p.z - ZOO.z) > h - r + 1) return 'Outside your land (buy more at the Ranger Station)';
      for (const E of G.zoo.ex.values()) { const o = EX_SIZES[E.d.size].w / 2 + 1; if (Math.abs(E.d.x - p.x) < o + r && Math.abs(E.d.z - p.z) < o + r) return 'Too close to another exhibit'; }
      if (Math.abs(p.x - STATION.x) < r + 6 && Math.abs(p.z - STATION.z) < r + 6) return 'In the way of the Ranger Station';
      const gp = G.zoo.gatePos(); if (Math.abs(p.x - gp.x) < r + 6 && Math.abs(p.z - (gp.z - 6)) < r + 6) return 'Blocks the entrance';
      for (const d of W.zoo.decor) { const D = DECOR[d.k]; if (D.cat === 'shop' && Math.abs(d.x - p.x) < r + D.r && Math.abs(d.z - p.z) < r + D.r) return 'A building is in the way'; }
      if (W.money < exhibitPrice(this.hab, this.size)) return 'Not enough money';
      return '';
    }
    const D = DECOR[this.key];
    if (Math.abs(p.x - ZOO.x) > h - 1 || Math.abs(p.z - ZOO.z) > h - 1) return 'Outside your land';
    if (W.money < D.price) return 'Not enough money';
    if (D.unique && W.zoo.decor.some(d => d.k === this.key)) return 'You already have one';
    if (this.cat === 'path') { if (W.zoo.paths.some(([x, z]) => x === p.x && z === p.z)) return 'Already a path'; return ''; }
    if (D.cat === 'shop') {
      for (const E of G.zoo.ex.values()) { const o = EX_SIZES[E.d.size].w / 2 + 1; if (Math.abs(E.d.x - p.x) < o + D.r && Math.abs(E.d.z - p.z) < o + D.r) return 'Inside an exhibit'; }
      if (Math.abs(p.x - STATION.x) < 6 + D.r && Math.abs(p.z - STATION.z) < 6 + D.r) return 'In the way of the Ranger Station';
    }
    for (const d of W.zoo.decor) { const o = DECOR[d.k]; if (o.cat === 'path') continue; if (Math.hypot(d.x - p.x, d.z - p.z) < (o.r + D.r) * 0.75) return 'Something is already there'; }
    return '';
  }
  _place() {
    const G = this.g, p = this.at; if (!p) return;
    if (this.sell) { const t = this._sellTarget(p); if (t) G.act({ k: 'sellBuild', what: t.what, id: t.id }); return; }
    const why = this.check(p);
    if (why) { if (this.cat !== 'path') { G.ui.toast(why, 'warn'); G.audio.deny(); } return; }
    if (this.cat === 'exhibit') G.act({ k: 'build', what: 'exhibit', hab: this.hab, size: this.size, x: p.x, z: p.z, rot: this.rot });
    else if (this.cat === 'path') { G.act({ k: 'build', what: 'path', key: this.key, x: p.x, z: p.z }); this.lastPaint = p.x + ',' + p.z; }
    else G.act({ k: 'build', what: 'decor', key: this.key, x: p.x, z: p.z, rot: this.rot });
    G.fx.burst(p.x, ZOO.y, p.z, 'dust', 14, { scale: this.cat === 'exhibit' ? 4 : 1 });
    G.audio.coin();
  }
  _sellTarget(p) {
    const G = this.g, W = this.W;
    let best = null, bd = 3;
    for (const d of W.zoo.decor) { const dd = Math.hypot(d.x - p.x, d.z - p.z); if (dd < Math.max(bd, DECOR[d.k].r)) { bd = dd; best = { what: 'decor', id: d.id }; } }
    if (!best) for (const [x, z] of W.zoo.paths) if (Math.abs(x - p.x) < 2 && Math.abs(z - p.z) < 2) return { what: 'path', id: x + ',' + z };
    if (!best) for (const E of G.zoo.ex.values()) if (G.zoo._inside(E, p.x, p.z)) return { what: 'exhibit', id: E.d.id };
    return best;
  }

  update(dt) {
    if (!this.active) return;
    const G = this.g, I = G.input;
    if (I.pressedRaw('KeyB') || I.pressedRaw('Escape')) return this.exit();
    if (I.pressedRaw('KeyR')) { this.rot = (this.rot + Math.PI / 2) % (Math.PI * 2); G.audio.click(); }
    if (I.pressedRaw('KeyX')) { this.sell = !this.sell; this.render(); }
    // pan with WASD (relative to the view)
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)), r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const sp = this.dist * 0.9 * dt;
    if (I.keys.has('KeyW')) this.focus.addScaledVector(f, sp); if (I.keys.has('KeyS')) this.focus.addScaledVector(f, -sp);
    if (I.keys.has('KeyD')) this.focus.addScaledVector(r, sp); if (I.keys.has('KeyA')) this.focus.addScaledVector(r, -sp);
    const h = this.half + 20; this.focus.x = clamp(this.focus.x, ZOO.x - h, ZOO.x + h); this.focus.z = clamp(this.focus.z, ZOO.z - h, ZOO.z + h);
    const O = G.cam.override;
    O.pos.set(this.focus.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist, ZOO.y + Math.sin(this.pitch) * this.dist, this.focus.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist);
    O.look.copy(this.focus);
    // the ghost
    this.at = this._pick();
    if (this.sell) { this._clearGhost(); return; }
    this._makeGhost();
    if (this.ghost && this.at) {
      this.ghost.visible = true;
      this.ghost.position.set(this.at.x, ZOO.y + 0.05, this.at.z); this.ghost.rotation.y = this.rot;
      const why = this.check(this.at);
      this.ok = !why;
      for (const m of this.mats) if (m.emissive) m.emissive.set(this.ok ? '#20ff60' : '#ff2020');
      if (this.down && this.cat === 'path' && this.lastPaint !== this.at.x + ',' + this.at.z) this._place();
    } else if (this.ghost) this.ghost.visible = false;
    void damp;
  }
}
