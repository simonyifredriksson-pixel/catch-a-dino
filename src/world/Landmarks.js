/* Landmarks.js - the set pieces you can see from far away, and the secrets.

   Everything here is built once from data/Places.js:
     big shapes on the horizon ("what is THAT?"): the Sunken Temple, the
       Great Ribcage, the Star Obelisk (beams at night), the World Tree, Skull
       Rock, the Frozen Titan, Starfall Crater, the Sunbeach Arches, the
       Sunken Ruins and the Drowned Colossus under the sea, Sky Mesa's nest
     ranger beacons (fast travel), dig spots (sparkling mounds), narrow cracks
       (send a tiny creature in), treasure chests, nests
     gates: boulder piles (smash) and vine curtains (cut)
     interiors: Crystal Hollow, the Temple Vault and the inside of Skull Rock,
       built out past the east edge of the map and entered through cave mouths

   Interactions are handed to the game as a list (game.interact picks the
   nearest). Discovering a place shows its title card. */
import * as THREE from '../../lib/three.module.js';
import { Mesher, geo, mat4, vcMat, vcGlow, signMesh } from '../art/Mesher.js';
import { FLORA } from '../art/FloraArt.js';
import { PLACES, BEACONS, GATES, INTERIORS, CHESTS, NESTS } from '../data/Places.js';
import { MESAS, ZOO, WORLD_HALF } from '../data/Biomes.js';
import { rng, clamp, hash3 } from '../core/Util.js';
import { Bus } from '../core/Bus.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const STONE = '#9a9888', STONE2 = '#8a887a', MOSS = '#5a8a3a', BONE = '#efe6d2';

/** where the Crystal Hollow mouth is (in the foothills of the Spine Peaks) */
export const HOLLOW_MOUTH = { x: 60, z: -548, yaw: 0 };
export const TEMPLE = { x: -160, z: -320, base: 46 };
export const SKULL = { x: -440, z: 900 };

export class Landmarks {
  /** terrain pads that have to exist before the heightfield is sampled */
  static mods(T) {
    const raw = (x, z) => T._raw(x, z).h;
    const t = raw(TEMPLE.x, TEMPLE.z);
    T.mods.push({ kind: 'flat', x: TEMPLE.x, z: TEMPLE.z, r: 40, blend: 22, y: t });
    T.mods.push({ kind: 'flat', x: -830, z: -30, r: 22, blend: 16, y: raw(-830, -30) });
    T.mods.push({ kind: 'flat', x: -610, z: 260, r: 40, blend: 20, y: raw(-610, 260) });
    const c = raw(-330, 250);
    T.mods.push({ kind: 'raise', x: -330, z: 250, r: 34, blend: 10, y: c + 3 });
    T.mods.push({ kind: 'carve', x: -330, z: 250, r: 24, blend: 10, y: c - 7 });
    for (const B of BEACONS) T.mods.push({ kind: 'flat', x: B.x, z: B.z, r: 5, blend: 6, y: raw(B.x, B.z) });
    // the ravine up to the Crystal Hollow mouth
    const h0 = raw(HOLLOW_MOUTH.x, HOLLOW_MOUTH.z + 52);
    for (let k = 0; k <= 12; k++) { const z = HOLLOW_MOUTH.z + 52 - k * 4.6; T.mods.push({ kind: 'carve', x: HOLLOW_MOUTH.x, z, r: 6.5, blend: 7, y: h0 + k * 0.25 }); }
    // and a raised back wall behind it so the mouth is in a cliff
    T.mods.push({ kind: 'raise', x: HOLLOW_MOUTH.x, z: HOLLOW_MOUTH.z - 30, r: 12, blend: 14, y: h0 + 30 });
    T.mods.push({ kind: 'flat', x: SKULL.x, z: SKULL.z + 30, r: 16, blend: 10, y: raw(SKULL.x, SKULL.z + 30) });
    T.interiors = Object.entries(INTERIORS).map(([id, I]) => ({ id, ...I }));
  }

  constructor(game) {
    this.g = game; this.T = game.terrain; this.scene = game.scene;
    this.items = [];          // interactables
    this.anim = [];           // things that move every frame
    this.gates = {}; this.portals = []; this.digs = []; this.cracks = []; this.chests = {}; this.beacons = {};
    this.beams = [];
    this.found = new Set();
  }
  get W() { return this.g.W; }
  _y(x, z) { return this.T.ground(x, z); }
  _add(M, o = {}) { if (M.empty) return null; const m = M.mesh(o); this.scene.add(m); return m; }

  build() {
    const ex = this.g.scatter.exclude;
    this._temple(); ex.push({ x: TEMPLE.x, z: TEMPLE.z, r: 42 });
    this._ribcage(); ex.push({ x: -610, z: 260, r: 40 });
    this._obelisk(); ex.push({ x: -830, z: -30, r: 20 });
    this._worldTree(); ex.push({ x: -520, z: -430, r: 22 });
    this._skull(); ex.push({ x: SKULL.x, z: SKULL.z, r: 40 });
    this._frozen(); ex.push({ x: -700, z: -760, r: 30 });
    this._crater(); ex.push({ x: -330, z: 250, r: 30 });
    this._arches();
    this._ruins();
    this._colossus();
    this._mesaNest();
    this._hollowMouth(); ex.push({ x: HOLLOW_MOUTH.x, z: HOLLOW_MOUTH.z + 20, r: 26 });
    for (const B of BEACONS) { this._beacon(B); ex.push({ x: B.x, z: B.z, r: 6 }); }
    for (const G of GATES) this._gate(G);
    for (const C of CHESTS) this._chest(C);
    this._digSpots();
    this._cracks();
    for (const [id, I] of Object.entries(INTERIORS)) this._interior(id, I);
  }

  /* =================== the set pieces =================== */
  _temple() {
    const { x, z } = TEMPLE, y = this._y(x, z), M = new Mesher(0.06, 11), G = this.g.colliders;
    const tiers = 5, base = TEMPLE.base, th = 4.4;
    for (let i = 0; i < tiers; i++) {
      const w = base - i * 8, yy = y + i * th;
      M.box(x, yy - 0.5, z, w, th + 0.5, w, i % 2 ? STONE : STONE2);
      M.box(x, yy + th - 0.05, z, w + 0.4, 0.35, w + 0.4, MOSS);   // mossy rim
      G.box(x, z, w / 2, w / 2, 0, y - 2, yy + th, 'temple', true);
      // carved bands
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; M.box(x + Math.sin(a) * (w / 2 + 0.05), yy + th * 0.45, z + Math.cos(a) * (w / 2 + 0.05), Math.cos(a) !== 0 ? w * 0.7 : 0.3, 0.5, Math.cos(a) !== 0 ? 0.3 : w * 0.7, '#7a7868'); }
    }
    // the staircase up the north face
    const steps = tiers * 9, sw = 7;
    for (let s = 0; s < steps; s++) {
      const sy = y + (s + 1) * (th / 9), sz = z - base / 2 - 3 + s * (base / 2 - 4) / steps * 1.0;
      M.box(x, sy - th / 9, sz, sw, th / 9, 1.4, s % 2 ? '#a8a696' : STONE);
      G.box(x, sz, sw / 2, 0.75, 0, y - 1, sy, 'stairs', true);
    }
    // the shrine on top, with glowing runes
    const top = y + tiers * th, tw = base - tiers * 8 + 6;
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.box(x + px * tw * 0.35, top, z + pz * tw * 0.35, 1.4, 5, 1.4, STONE2);
    M.box(x, top + 5, z, tw * 0.95, 1, tw * 0.95, STONE);
    M.roof(x, top + 6, z, tw * 0.9, tw * 0.9, 2.5, '#6a7a5a');
    M.add(geo.tor(16, 0.08), mat4(x, top + 0.2, z, 0, 5, 5, 5, Math.PI / 2, 0), '#5affc8', { glow: true });
    // the doorway on the south face (the vine gate covers it)
    M.box(x, y, z + base / 2 + 0.02, 6, 6.5, 0.6, '#1a1612');
    M.box(x, y + 6.5, z + base / 2 + 0.3, 8, 1.2, 1.2, STONE2);
    // vines hanging off the tiers
    const r = rng(5);
    for (let i = 0; i < 60; i++) {
      const tier = Math.floor(r() * tiers), w = base - tier * 8, a = Math.floor(r() * 4) * Math.PI / 2, along = (r() - 0.5) * w * 0.9, L = 2 + r() * 4;
      const vx = x + Math.sin(a) * (w / 2 + 0.15) + Math.cos(a) * along, vz = z + Math.cos(a) * (w / 2 + 0.15) - Math.sin(a) * along;
      M.box(vx, y + tier * th + th - L, vz, Math.cos(a) !== 0 ? 0.5 : 0.12, L, Math.cos(a) !== 0 ? 0.12 : 0.5, r() < 0.5 ? '#3a7a2a' : '#4a8a34');
    }
    this._add(M);
    this.portals.push({ id: 'vault', x, z: z + base / 2 + 1.2, y, r: 3, to: 'vault', gate: 'g_temple', back: { x, z: z + base / 2 + 6, yaw: 0 } });
    this.templeTop = { x, y: top, z };
  }
  _ribcage() {
    const x = -610, z = 260, y = this._y(x, z), M = new Mesher(0.05, 12), G = this.g.colliders;
    const L = 60, n = 14;
    // spine
    for (let i = 0; i < n + 6; i++) { const t = i / (n + 5), zz = z - L / 2 + t * L * 1.1, yy = y + 12 + Math.sin(t * Math.PI) * 6 - t * 4; M.ico(x, yy, zz, 3.4, 2.6, 3.2, i % 2 ? BONE : '#e2d8c0', 0); }
    // ribs: big arcs out of the sand
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), zz = z - L / 2 + 4 + t * L * 0.8, R = 9 + Math.sin(t * Math.PI) * 6;
      for (const s of [-1, 1]) {
        let prev = V(x, y + 12 + Math.sin(t * Math.PI) * 6, zz);
        for (let k = 1; k <= 7; k++) {
          const a = k / 7 * Math.PI * 0.62;
          const p = V(x + s * Math.sin(a) * R * 1.1, y + 12 + Math.sin(t * Math.PI) * 6 - (1 - Math.cos(a)) * R * 1.35, zz - k * 0.4);
          M.seg(prev, p, 0.9 - k * 0.07, 0.8 - k * 0.07, k % 2 ? BONE : '#e8dec8', 6);
          prev = p;
        }
        G.circle(prev.x, prev.z, 1.2, y - 2, y + 20, 'rib');
      }
    }
    // the skull lying at the front
    const sx = x, sz = z + L / 2 + 12, sy = y + 4;
    M.ico(sx, sy + 3, sz, 14, 10, 16, BONE, 1);
    for (const s of [-1, 1]) { M.ico(sx + s * 4.2, sy + 5, sz + 4, 3.6, 3.6, 3.6, '#2a2018', 0); M.ico(sx + s * 2, sy + 1, sz + 7.5, 1.6, 1.6, 1.6, '#3a2a20', 0); }
    M.ico(sx, sy - 1, sz + 3, 12, 4, 14, '#e2d8c0', 1);
    for (let i = 0; i < 12; i++) { const a = -0.9 + i / 11 * 1.8; M.cone(sx + Math.sin(a) * 6, sy - 1.5, sz + 2 + Math.cos(a) * 6.5, 0.5, 2.6, '#f8f0e0', 5, undefined, Math.PI); }
    G.circle(sx, sz, 8, y - 2, y + 14, 'skull');
    this._add(M);
  }
  _obelisk() {
    const x = -830, z = -30, y = this._y(x, z), M = new Mesher(0.04, 13), G = this.g.colliders;
    M.frust(x, y, z, 3.4, 1.8, 34, '#6a6878', 4);
    M.cone(x, y + 34, z, 1.9, 4, '#5a5868', 4);
    for (let i = 0; i < 6; i++) M.box(x, y + 6 + i * 4.6, z, 3.6 - i * 0.28, 0.4, 3.6 - i * 0.28, '#3af0ff', 0.785, { glow: true });
    M.add(geo.oct(), mat4(x, y + 40, z, 0, 3, 4.5, 3), '#9af8ff', { glow: true });
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, d = 12 + (i % 3) * 2; M.box(x + Math.cos(a) * d, y - 0.5, z + Math.sin(a) * d, 2.2, 3 + (i % 3) * 2, 1.4, '#7a7888', a); }
    G.circle(x, z, 3.6, y - 2, y + 40, 'obelisk');
    const m = this._add(M);
    this.obeliskTop = V(x, y + 40, z);
    this._beam(x, y + 40, z, '#7af0ff', 'obelisk', 4);
    const crystal = new THREE.PointLight('#7af0ff', 0, 70, 1.5); crystal.position.copy(this.obeliskTop); this.scene.add(crystal); this.obeliskLight = crystal;
    void m;
  }
  _worldTree() {
    const x = -520, z = -430, y = this._y(x, z), M = new Mesher(0.06, 14), G = this.g.colliders;
    let p = V(x, y - 2, z);
    for (let i = 0; i < 10; i++) { const q = p.clone().add(V(Math.sin(i * 0.7) * 1.5, 13, Math.cos(i * 0.5) * 1.5)); M.seg(p, q, 9 - i * 0.55, 9 - (i + 1) * 0.55, i % 2 ? '#7a4a2e' : '#8a5434', 10); p = q; }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; M.seg(V(x + Math.cos(a) * 16, y - 1, z + Math.sin(a) * 16), V(x + Math.cos(a) * 5, y + 14, z + Math.sin(a) * 5), 3, 1.4, '#7a4228', 6); }
    const top = p.clone();
    for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + k, d = 16 + k * 6, yy = top.y - 20 + k * 6;
      M.seg(V(top.x, yy - 6, top.z), V(top.x + Math.cos(a) * d * 0.7, yy, top.z + Math.sin(a) * d * 0.7), 1.6, 0.8, '#7a4a2e', 5);
      M.ico(top.x + Math.cos(a) * d, yy + 3, top.z + Math.sin(a) * d, 22, 10, 22, k % 2 ? '#2e6a34' : '#367a3a', 1);
    }
    // the nest at the very top
    const ny = top.y + 4;
    M.add(geo.tor(14, 0.35), mat4(top.x, ny, top.z, 0, 9, 9, 9, Math.PI / 2, 0), '#8a6a3a');
    M.cyl(top.x, ny - 1.2, top.z, 4.2, 1, '#7a5a30', 12);
    G.box(top.x, top.z, 4.6, 4.6, 0, ny - 30, ny - 0.2, 'nest', true);
    G.circle(x, z, 9, y - 4, y + 140, 'worldtree');
    this._add(M);
    this.treeTop = V(top.x, ny - 0.2, top.z);
    this._nest(NESTS.find(n => n.tree), this.treeTop);
  }
  _skull() {
    const { x, z } = SKULL, y = this._y(x, z + 30), M = new Mesher(0.06, 15), G = this.g.colliders;
    const c = '#8a8a7a', c2 = '#7a7a6a';
    M.ico(x, y + 22, z, 46, 40, 44, c, 1);
    M.ico(x, y + 8, z + 10, 40, 22, 40, c2, 1);
    for (const s of [-1, 1]) M.ico(x + s * 10, y + 26, z + 19, 12, 13, 8, '#14100c', 1);
    M.ico(x, y + 15, z + 21, 6, 6, 5, '#1a1410', 0);
    // the mouth (a cave), with teeth
    M.box(x, y - 0.4, z + 20, 16, 9, 5, '#0e0c0a');
    for (let i = 0; i < 9; i++) { const tx = x - 8 + i * 2; M.cone(tx, y + 6.5, z + 22.6, 0.8, 3.2, '#d8d0bc', 5, undefined, Math.PI); }
    for (let i = 0; i < 6; i++) { const ang = i / 6 * Math.PI * 2; M.dode(x + Math.cos(ang) * 30, y + 2, z + Math.sin(ang) * 26, 8, 6, 8, c2, ang); }
    G.circle(x, z - 4, 22, y - 2, y + 50, 'skull');
    G.box(x - 13, z + 18, 4, 6, 0, y - 2, y + 30); G.box(x + 13, z + 18, 4, 6, 0, y - 2, y + 30);
    this._add(M);
    this.portals.push({ id: 'skullcave', x, z: z + 20, y, r: 4, to: 'skullcave', back: { x, z: z + 30, yaw: 0 } });
  }
  _frozen() {
    const x = -700, z = -760, y = this._y(x, z), M = new Mesher(0.04, 16), G = this.g.colliders;
    M.add(geo.box(), mat4(x, y + 7, z, 0.3, 34, 16, 20), '#bfe8f8', {});
    for (let i = 0; i < 9; i++) { const zz = z - 14 + i * 3.4; for (const s of [-1, 1]) M.seg(V(x + s * 2, y + 14, zz), V(x + s * 9, y + 3 + i * 0.2, zz + 1), 0.7, 0.5, BONE, 6); }
    M.ico(x + 4, y + 13, z + 18, 10, 8, 12, BONE, 1);
    for (const s of [-1, 1]) M.ico(x + 4 + s * 3, y + 15, z + 22, 2.4, 2.4, 2.4, '#2a2a30', 0);
    G.box(x, z, 17, 10, 0.3, y - 2, y + 15, 'ice', true);
    this._add(M);
  }
  _crater() {
    const x = -330, z = 250, y = this._y(x, z), M = new Mesher(0.05, 17);
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, d = 3 + (i % 4) * 2.5; M.add(geo.oct(), mat4(x + Math.cos(a) * d, y + 1.5, z + Math.sin(a) * d, a, 1.2, 3 + (i % 3) * 1.5, 1.2, 0.3, 0.2), i % 2 ? '#9a7aff' : '#7af0ff', { glow: true }); }
    M.dode(x, y + 1.2, z, 6, 3.6, 5, '#2a2430', 0);
    this._add(M);
    this.craterPos = V(x, y, z);
  }
  _arches() {
    const M = new Mesher(0.06, 18);
    for (const [x, z, s, ry] of [[-220, 578, 1, 0.3], [-245, 590, 0.6, 1.2], [272, 588, 0.85, -0.4]]) {
      const y = Math.max(0, this._y(x, z));
      M.add(geo.tor(12, 0.22), mat4(x, y - 2, z, ry, 26 * s, 30 * s, 26 * s, 0, 0), '#c8a070', { deform: v => { if (v.y < -0.1) v.y = -0.1; } });
      this.g.colliders.circle(x - Math.cos(ry) * 12 * s, z + Math.sin(ry) * 12 * s, 3 * s, y - 3, y + 20 * s);
      this.g.colliders.circle(x + Math.cos(ry) * 12 * s, z - Math.sin(ry) * 12 * s, 3 * s, y - 3, y + 20 * s);
    }
    this._add(M);
  }
  _ruins() {
    const cx = 150, cz = 720, M = new Mesher(0.06, 19), r = rng(19), G = this.g.colliders;
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2, d = 6 + r() * 34, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, y = this._y(x, z);
      const h = r() < 0.4 ? 3 + r() * 4 : 9 + r() * 7;
      M.cyl(x, y - 0.5, z, 1.2, h, r() < 0.5 ? '#c8c4b0' : '#b8b4a0', 10);
      M.box(x, y + h - 0.5, z, 3, 0.8, 3, '#d8d4c0');
      if (r() < 0.5) M.box(x, y - 0.3, z, 4.5, 0.6, 4.5, '#a8a490');
      M.ico(x, y + h * 0.3, z, 2.6, 0.5, 2.6, '#5a9a6a');
      G.circle(x, z, 1.3, y - 1, y + h);
    }
    for (const [x, z, ry] of [[cx - 10, cz + 8, 0.3], [cx + 14, cz - 10, 1.4]]) { const y = this._y(x, z); M.add(geo.tor(10, 0.18), mat4(x, y - 1, z, ry, 16, 16, 16, 0, 0), '#c8c4b0', { deform: v => { if (v.y < -0.05) v.y = -0.05; } }); }
    // a toppled statue of a long-neck
    const sx = cx + 4, sz = cz + 22, sy = this._y(sx, sz);
    M.box(sx, sy - 0.5, sz, 10, 2, 5, '#b8b4a0'); M.add(geo.cyl(8), mat4(sx + 5, sy + 1.5, sz, 0, 1.6, 12, 1.6, 0, 1.2), '#c8c4b0');
    this._add(M);
  }
  _colossus() {
    const x = -160, z = 965, M = new Mesher(0.05, 20), G = this.g.colliders;
    const y = this._y(x, z);
    for (let i = 0; i < 30; i++) { const t = i / 29, zz = z - 40 + t * 80, yy = this._y(x, zz) + 3 + Math.sin(t * Math.PI) * 4; M.ico(x + Math.sin(t * 5) * 3, yy, zz, 3.2, 2.6, 3, BONE, 0); if (i % 3 === 0 && t < 0.8) for (const s of [-1, 1]) { const p0 = V(x + Math.sin(t * 5) * 3, yy, zz); M.seg(p0, V(p0.x + s * 12, this._y(p0.x + s * 12, zz) + 1, zz + 2), 0.9, 0.6, BONE, 6); } }
    M.ico(x + 3, y + 6, z + 46, 14, 10, 22, BONE, 1);
    for (let i = 0; i < 14; i++) M.cone(x + 3 + (i - 7) * 1.6, y + 1, z + 54, 0.6, 3, '#f0e8d8', 5, undefined, Math.PI);
    G.circle(x + 3, z + 46, 9, y - 2, y + 14);
    this._add(M);
  }
  _mesaNest() {
    const [mx, mz, mr, mh] = MESAS[0], y = this._y(mx, mz);
    const M = new Mesher(0.06, 21);
    M.add(geo.tor(14, 0.32), mat4(mx, y + 0.5, mz, 0, 8, 8, 8, Math.PI / 2, 0), '#8a6a3a');
    M.cyl(mx, y, mz, 3.6, 0.6, '#7a5a30', 12);
    for (let i = 0; i < 8; i++) M.ico(mx + Math.cos(i) * 10, y + 0.5, mz + Math.sin(i) * 10, 2, 1.4, 2, '#8a8478', 0);
    this._add(M);
    this._nest(NESTS.find(n => n.top), V(mx, y + 0.6, mz));
    void mr; void mh;
  }
  _hollowMouth() {
    const { x, z } = HOLLOW_MOUTH, y = this._y(x, z + 4), M = new Mesher(0.06, 22);
    // a heavy rock arch around a black opening, set into the cliff
    M.add(geo.tor(10, 0.3), mat4(x, y - 1, z, 0, 14, 15, 14, 0, 0), '#6a6860', { deform: v => { if (v.y < -0.1) v.y = -0.1; } });
    M.box(x, y - 1, z - 1.5, 10, 9, 2, '#08080c');
    for (let i = 0; i < 6; i++) M.dode(x + (i - 2.5) * 4, y + 9 + (i % 2) * 2, z - 3, 6, 4, 5, '#7a7870', i);
    for (let i = 0; i < 5; i++) M.add(geo.oct(), mat4(x - 4 + i * 2, y + 0.6, z + 1 + (i % 2), i, 0.4, 1.2, 0.4), '#c070ff', { glow: true });
    this.g.colliders.box(x - 7.5, z, 2, 3, 0, y - 2, y + 12); this.g.colliders.box(x + 7.5, z, 2, 3, 0, y - 2, y + 12);
    this._add(M);
    const G = GATES.find(g => g.id === 'g_hollow'); G.x = x; G.z = z + 4;
    this.portals.push({ id: 'hollow', x, z: z - 0.5, y, r: 3.5, to: 'hollow', gate: 'g_hollow', back: { x, z: z + 8, yaw: 0 } });
  }

  /* =================== small things =================== */
  _beam(x, y, z, color, key, w = 3) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(w, w * 0.6, 400, 10, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    m.position.set(x, y + 200, z); m.userData.key = key; this.scene.add(m); this.beams.push(m);
    return m;
  }
  _beacon(B) {
    const y = this._y(B.x, B.z), M = new Mesher(0.06, 31);
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.seg(V(B.x + px * 1.6, y, B.z + pz * 1.6), V(B.x + px * 0.6, y + 7, B.z + pz * 0.6), 0.2, 0.15, '#7a5a3a', 5);
    M.box(B.x, y + 2.5, B.z, 2.6, 0.2, 2.6, '#6a4a2a'); M.box(B.x, y + 7, B.z, 2, 0.3, 2, '#6a4a2a');
    M.roof(B.x, y + 8.6, B.z, 2.6, 2.6, 1.4, '#c84a3a');
    const m = this._add(M);
    const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), new THREE.MeshBasicMaterial({ color: '#5a5a5a' }));
    lamp.position.set(B.x, y + 7.9, B.z); this.scene.add(lamp);
    this.g.colliders.circle(B.x, B.z, 1.5, y - 1, y + 9);
    const beam = this._beam(B.x, y + 8, B.z, '#7aff9a', 'beacon:' + B.id, 0.8);
    this.beacons[B.id] = { B, lamp, beam, y };
    this.items.push({ id: 'beacon:' + B.id, x: B.x, y: y + 1, z: B.z, r: 4,
      label: () => (this.W.beacons[B.id] ? B.name + (this.W.upg.beacon ? ' - fast travel from the map (M)' : ' - lit') : 'Light the ' + B.name),
      act: () => this.g.act({ k: 'beacon', id: B.id }) });
    void m;
  }
  _gate(G) {
    const M = new Mesher(0.06, 41), y = this._y(G.x, G.z);
    let col;
    if (G.kind === 'boulder') {
      const r = rng(hash3(G.x | 0, G.z | 0) * 1e9);
      for (let i = 0; i < 9; i++) M.dode(G.x + (r() - 0.5) * G.r * 1.6, y + 1 + r() * 4 + (i > 5 ? 4 : 0), G.z + (r() - 0.5) * 3, 4 + r() * 3, 3.5 + r() * 2, 3.5 + r() * 2, r() < 0.5 ? '#8a8478' : '#7a7468', r() * 3);
      for (let i = 0; i < 4; i++) M.box(G.x + (i - 1.5) * 2.4, y + 2 + i % 2, G.z + 2.2, 0.15, 1.4, 0.05, '#2a2a2a', 0.3);  // cracks
      col = this.g.colliders.box(G.x, G.z, G.r, 3, 0, y - 2, y + 12, 'gate');
    } else {
      for (let i = 0; i < 26; i++) { const vx = G.x - 3 + i * 0.24, L = 5 + Math.sin(i * 1.7) * 1.2; M.box(vx, y + 6.4 - L, G.z, 0.22, L, 0.2, i % 2 ? '#3a7a2a' : '#4a8a34'); }
      for (let i = 0; i < 12; i++) M.ico(G.x - 3 + i * 0.55, y + 5.5 - (i % 3), G.z + 0.2, 0.6, 0.4, 0.4, '#5a9a3a', 0);
      col = this.g.colliders.box(G.x, G.z, G.r, 0.8, 0, y - 1, y + 7, 'gate');
    }
    const mesh = this._add(M, { dynamic: true });
    this.gates[G.id] = { G, mesh, col, open: false, y };
    this.items.push({ id: 'gate:' + G.id, x: G.x, y: y + 1, z: G.z + (G.kind === 'vines' ? 1.5 : 4), r: G.kind === 'vines' ? 4 : 8, gate: G.id,
      when: () => !this.gates[G.id].open,
      label: () => G.name + (G.kind === 'vines' ? ' - needs a Machete or a creature that slashes' : ' - needs a creature that smashes'),
      act: () => this.g.abilities.tryGate(G.id) });
  }
  openGate(id, fx = true) {
    const S = this.gates[id]; if (!S || S.open) return;
    S.open = true;
    if (S.mesh) { this.scene.remove(S.mesh); }
    this.g.colliders.remove(S.col);
    if (fx) {
      const G = S.G;
      this.g.fx.burst(G.x, S.y + 3, G.z, G.kind === 'vines' ? 'leaf' : 'dust', 40);
      if (G.kind === 'boulder') { this.g.fx.debris(G.x, S.y + 3, G.z, 14); this.g.audio.crash(V(G.x, S.y, G.z)); this.g.cam.shake(0.6); }
      else this.g.audio.slash();
    }
  }
  _chest(C) {
    let x = C.x, z = C.z;
    if (C.interior) { const I = INTERIORS[C.interior]; x = I.x + C.ox; z = I.z + C.oz; }
    const y = this._y(x, z);
    const g = new THREE.Group(); g.position.set(x, y, z);
    const M = new Mesher(0.05, 51);
    M.box(0, 0, 0, 1.6, 0.8, 1, '#7a4a2a'); M.box(0, 0.25, 0.51, 1.62, 0.12, 0.04, '#e8b830'); M.box(0, 0.35, 0.53, 0.25, 0.25, 0.06, '#e8b830');
    const body = M.mesh({ dynamic: true }); g.add(body);
    const L = new Mesher(0.05, 52); L.box(0, 0, -0.5, 1.6, 0.36, 1, '#8a5a32'); L.box(0, 0.12, 0.01, 1.62, 0.1, 0.04, '#e8b830');
    const lid = L.mesh({ dynamic: true }); lid.position.set(0, 0.8, 0.5); g.add(lid);
    const glow = new THREE.PointLight('#ffd060', 1.2, 8, 2); glow.position.set(0, 1.2, 0); g.add(glow);
    this.scene.add(g);
    this.chests[C.id] = { C, g, lid, glow, x, y, z };
    this.items.push({ id: 'chest:' + C.id, x, y: y + 0.5, z, r: 3, when: () => !this.W.found[C.id], label: () => 'Open the chest', act: () => this.g.act({ k: 'chest', id: C.id }) });
  }
  _nest(N, at) {
    const g = new THREE.Group(); g.position.copy(at);
    const eggs = [];
    for (let i = 0; i < 3; i++) { const e = new THREE.Mesh(geo.ico(1), new THREE.MeshStandardMaterial({ color: ['#e8dcb8', '#d8e8c8', '#f0d8c8'][i], flatShading: true, roughness: 0.6 })); e.scale.set(0.8, 1.05, 0.8); e.position.set(Math.cos(i * 2.1) * 1.2, 0.5, Math.sin(i * 2.1) * 1.2); e.castShadow = true; g.add(e); eggs.push(e); }
    this.scene.add(g);
    this.chests[N.id] = { C: N, g, eggs, x: at.x, y: at.y, z: at.z, nest: true };
    this.items.push({ id: 'nest:' + N.id, x: at.x, y: at.y, z: at.z, r: 4, when: () => !this.W.found[N.id], label: () => 'Take the eggs from the ' + N.name, act: () => this.g.act({ k: 'chest', id: N.id }) });
  }
  _digSpots() {
    // deterministic spots on dry, gentle ground in every biome
    const r = rng(777), T = this.T;
    const want = { meadow: 7, jungle: 6, elder: 5, desert: 8, swamp: 4, peaks: 3, tundra: 4, volcano: 4, beach: 4, valley: 3, isle: 2, skull: 2 };
    const have = {};
    let tries = 0;
    while (this.digs.length < 52 && tries++ < 6000) {
      const x = (r() - 0.5) * 2 * (WORLD_HALF - 80), z = (r() - 0.5) * 2 * (WORLD_HALF - 80);
      const b = T.biome(x, z), h = T.ground(x, z);
      if (!want[b] || (have[b] || 0) >= want[b] || h < 1 || T.slope(x, z) > 0.2) continue;
      if (Math.abs(x - ZOO.x) < ZOO.half + 30 && Math.abs(z - ZOO.z) < ZOO.half + 30) continue;
      have[b] = (have[b] || 0) + 1;
      this.digs.push({ i: this.digs.length, x, z, y: h, biome: b });
    }
    // ribcage and crater always have one
    for (const [x, z, b] of [[-600, 240, 'desert'], [-620, 285, 'desert'], [-330, 250, 'crater']]) this.digs.push({ i: this.digs.length, x, z, y: T.ground(x, z), biome: b });
    const mound = new Mesher(0.08, 61); mound.dode(0, 0.1, 0, 2.4, 0.9, 2.2, '#8a6a4a'); mound.dode(0.4, 0.3, 0.2, 1.2, 0.6, 1.1, '#7a5a3a');
    const mg = mound.geometry();
    this.digMesh = new THREE.InstancedMesh(mg, [vcMat(), vcGlow()], this.digs.length);
    const sp = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: '#fff0a0' }), this.digs.length * 3);
    this.digMesh.receiveShadow = true; this.scene.add(this.digMesh); this.scene.add(sp); this.sparkles = sp;
    this.digs.forEach(d => this.items.push({ id: 'dig:' + d.i, x: d.x, y: d.y, z: d.z, r: 3, dig: d.i, when: () => this.digReady(d.i), label: () => 'Dig here (Shovel, or a creature that digs)', act: () => this.g.abilities.tryDig(d.i) }));
    this._digDraw();
  }
  digReady(i) { const t = this.W?.found?.['dig' + i]; return !t || Date.now() - t > 12 * 60 * 1000; }
  _digDraw() {
    const m4 = new THREE.Matrix4(), hide = new THREE.Matrix4().makeScale(0, 0, 0);
    this.digs.forEach((d, i) => { this.digMesh.setMatrixAt(i, this.digReady(i) ? m4.makeTranslation(d.x, d.y, d.z) : hide); });
    this.digMesh.instanceMatrix.needsUpdate = true; this.digMesh.computeBoundingSphere();
  }
  _cracks() {
    // narrow cracks in big rocks: only a tiny creature from your crate fits
    const spots = [[-80, -210, 'jungle'], [-260, -420, 'elder'], [-700, 140, 'desert'], [-540, 330, 'desert'], [600, -200, 'swamp'], [90, -470, 'peaks'], [-600, -700, 'tundra'], [560, -600, 'volcano'], [-120, 430, 'meadow'], [230, 120, 'meadow'], [-420, 860, 'skull'], [380, 840, 'isle'], [-150, -560, 'valley'], [160, -330, 'jungle']];
    const M = new Mesher(0.07, 71);
    spots.forEach(([x, z, b], i) => {
      const y = this.T.ground(x, z);
      M.dode(x, y + 2.6, z, 7, 6, 5, '#7a7870', i); M.dode(x + 2.6, y + 1.4, z - 0.5, 4, 3.4, 3.6, '#8a8880', i + 1);
      M.box(x, y, z + 2.45, 0.5, 4.4, 0.3, '#08080a', 0);
      this.g.colliders.circle(x, z, 3.4, y - 1, y + 6);
      this.cracks.push({ i, x, z: z + 3.2, y, biome: b });
      this.items.push({ id: 'crack:' + i, x, y: y + 1, z: z + 3.2, r: 3.2, when: () => this.crackReady(i), label: () => 'A narrow crack - send a tiny creature in', act: () => this.g.abilities.tryScout(i) });
      this.g.scatter.exclude.push({ x, z, r: 6 });
    });
    this._add(M);
  }
  crackReady(i) { const t = this.W?.found?.['crack' + i]; return !t || Date.now() - t > 15 * 60 * 1000; }

  /* =================== interiors =================== */
  _interior(id, I) {
    const r = rng(id.length * 977), M = new Mesher(0.07, 80 + id.length);
    const fy = I.floor;
    // the shell: a squashed, lumpy dome seen from inside
    const shell = new THREE.IcosahedronGeometry(1, 3);
    M.add(shell, mat4(I.x, fy - 2, I.z, 0, I.r + 6, I.r * 0.42 + 8, I.r + 6), id === 'vault' ? '#5a5648' : '#3e3a4a', { deform: v => { const k = 1 + Math.sin(v.x * 9) * Math.sin(v.z * 7) * 0.08 + Math.sin(v.y * 11) * 0.05; v.multiplyScalar(k); } });
    // flip it inside out: we are looking at it from the inside
    const P = M.p; for (let i = 0; i < P.length; i += 9) { for (let k = 0; k < 3; k++) { const t = P[i + 3 + k]; P[i + 3 + k] = P[i + 6 + k]; P[i + 6 + k] = t; } }
    // floor
    M.add(geo.cyl(24), mat4(I.x, fy - 1.5, I.z, 0, (I.r + 4) * 2, 3, (I.r + 4) * 2), id === 'vault' ? '#7a7464' : '#4a4658');
    if (id === 'vault') {
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; M.box(I.x + Math.cos(a) * 18, fy, I.z + Math.sin(a) * 18, 2, 14, 2, '#8a8474', a); this.g.colliders.circle(I.x + Math.cos(a) * 18, I.z + Math.sin(a) * 18, 1.4, fy - 1, fy + 14); }
      M.box(I.x, fy, I.z - 16, 4, 1.4, 3, '#6a6454');
      M.add(geo.tor(18, 0.06), mat4(I.x, fy + 0.1, I.z, 0, 12, 12, 12, Math.PI / 2, 0), '#5affc8', { glow: true });
      const murals = [['THE GIANT WALKS', 'WHEN THE GROUND', 'SHAKES'], ['FOLLOW', 'THE TREMOR'], ['IT GROWS', 'MOSS', 'AND STONE'], ['THE OLD ONE', 'IS GENTLE'], ['BRING', 'THE STRONGEST', 'ROPE'], ['WE KEPT', 'THEM ALL']];
      murals.forEach((lines, i) => { const a = i / 6 * Math.PI * 2 + 0.3; const s = signMesh(lines, 5, 3, { bg: '#5a5444', fg: '#b8f0d8', borderColor: '#3a3428' }); s.position.set(I.x + Math.cos(a) * 23, fy + 4, I.z + Math.sin(a) * 23); s.lookAt(I.x, fy + 4, I.z); this.scene.add(s); });
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.78; const L = new THREE.PointLight('#ffb050', 2.2, 26, 1.6); L.position.set(I.x + Math.cos(a) * 15, fy + 5, I.z + Math.sin(a) * 15); this.scene.add(L); M.cyl(L.position.x, fy, L.position.z, 0.3, 4.4, '#5a4a3a', 6); M.ico(L.position.x, fy + 4.8, L.position.z, 0.6, 0.9, 0.6, '#ffb050', 0, { glow: true }); }
    } else {
      // crystal clusters, mushrooms, stalagmites
      const cg = FLORA.crystal(5), mg = FLORA.mushroom(9);
      for (let i = 0; i < 34; i++) {
        const a = r() * Math.PI * 2, d = 8 + r() * (I.r - 14), x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d;
        if (Math.hypot(x - I.x, z - (I.z + I.r - 10)) < 10) continue;   // keep the exit clear
        const k = r();
        if (k < 0.4) { M.add(geo.cone(6), mat4(x, fy + 3, z, r(), 2 + r() * 2, 6 + r() * 8, 2 + r() * 2), '#4a465a'); this.g.colliders.circle(x, z, 1.6, fy - 1, fy + 12); }
        else if (k < 0.75) { const s = 0.8 + r() * 1.4; const m = new THREE.Mesh(cg.geometry(), [vcMat(), vcGlow()]); m.position.set(x, this.T.ground(x, z), z); m.scale.setScalar(s); m.rotation.y = r() * 6; this.scene.add(m); this.g.colliders.circle(x, z, 1.2 * s, fy - 1, fy + 4); }
        else { const m = new THREE.Mesh(mg.geometry(), [vcMat(), vcGlow()]); m.position.set(x, this.T.ground(x, z), z); m.scale.setScalar(0.8 + r()); this.scene.add(m); }
      }
      for (let i = 0; i < 18; i++) { const a = r() * Math.PI * 2, d = r() * (I.r - 6); M.add(geo.cone(5), mat4(I.x + Math.cos(a) * d, fy + I.r * 0.42 + 2, I.z + Math.sin(a) * d, r(), 1.5 + r(), 6 + r() * 6, 1.5 + r(), Math.PI, 0), '#3a3648'); }
      const L = new THREE.PointLight(id === 'hollow' ? '#c080ff' : '#80ffb0', 2.5, I.r * 2.2, 1.2); L.position.set(I.x, fy + 14, I.z); this.scene.add(L);
    }
    // the way out
    const ex = I.x, ez = I.z + I.r - 6;
    M.box(ex, fy - 0.5, ez + 3, 8, 8, 1, '#f0e8c0', 0, { glow: true });
    this._add(M, { cast: false });
    const exit = GATES.find(g => g.cave === id);
    void exit;
    this.portals.push({ id: id + ':exit', x: ex, z: ez + 1.5, y: fy, r: 3.5, out: id });
    this.g.places?.register?.(id, I);
  }
  /** the portal you are standing in (or null) */
  portalAt(p) {
    for (const P of this.portals) {
      if (Math.hypot(p.x - P.x, p.z - P.z) < P.r && Math.abs(p.y - (P.y ?? p.y)) < 6) {
        if (P.gate && this.gates[P.gate] && !this.gates[P.gate].open) continue;
        return P;
      }
    }
    return null;
  }
  /** where a portal leads: {x, z, yaw, interior?} */
  portalTarget(P) {
    if (P.to) { const I = INTERIORS[P.to]; return { x: I.x, z: I.z + I.r - 14, yaw: Math.PI, interior: P.to }; }
    const back = this.portals.find(q => q.to === P.out);
    return { x: back.back.x, z: back.back.z, yaw: back.back.yaw, interior: null };
  }

  /* =================== per frame =================== */
  update(dt, t, night) {
    // sparkles over the dig spots
    if (this.sparkles) {
      const m4 = new THREE.Matrix4(), hide = new THREE.Matrix4().makeScale(0, 0, 0), q = new THREE.Quaternion(), e = new THREE.Euler();
      this.digs.forEach((d, i) => {
        const ok = this.digReady(i) && Math.hypot(d.x - this.g.camera.position.x, d.z - this.g.camera.position.z) < 160;
        for (let k = 0; k < 3; k++) {
          if (!ok) { this.sparkles.setMatrixAt(i * 3 + k, hide); continue; }
          const a = t * 1.5 + k * 2.1 + i, s = 0.5 + 0.5 * Math.sin(t * 4 + k * 2 + i);
          e.set(t * 2, a, 0); q.setFromEuler(e);
          m4.compose(V(d.x + Math.cos(a) * 0.8, d.y + 1.2 + Math.sin(t * 2 + k) * 0.4, d.z + Math.sin(a) * 0.8), q, V(s, s, s));
          this.sparkles.setMatrixAt(i * 3 + k, m4);
        }
      });
      this.sparkles.instanceMatrix.needsUpdate = true; this.sparkles.computeBoundingSphere();
    }
    if ((this._digT = (this._digT || 0) - dt) <= 0) { this._digT = 5; this._digDraw(); }
    // beams: the obelisk at night, lit beacons always (fainter by day)
    for (const b of this.beams) {
      const k = b.userData.key;
      let want = 0;
      if (k === 'obelisk') want = night * 0.35;
      else if (k.startsWith('beacon:')) want = this.W?.beacons?.[k.slice(7)] ? 0.1 + night * 0.25 : 0;
      b.material.opacity += (want - b.material.opacity) * Math.min(1, dt * 2);
      b.visible = b.material.opacity > 0.01;
    }
    if (this.obeliskLight) this.obeliskLight.intensity = night * 4;
    for (const id in this.beacons) { const S = this.beacons[id]; S.lamp.material.color.set(this.W?.beacons?.[id] ? '#7aff9a' : '#5a5a5a'); S.lamp.rotation.y += dt; }
    for (const id in this.chests) {
      const S = this.chests[id], open = !!this.W?.found?.[id];
      if (S.lid) { S.lid.rotation.x += ((open ? -1.9 : 0) - S.lid.rotation.x) * Math.min(1, dt * 4); S.glow.intensity = open ? 0 : 1.2 + Math.sin(t * 3) * 0.4; }
      if (S.eggs) S.eggs.forEach(e => (e.visible = !open));
    }
    for (const id in this.gates) if (this.W?.gates?.[id] && !this.gates[id].open) this.openGate(id, false);
  }
  /** a place you are in for the first time? */
  discover(p) {
    for (const P of PLACES) {
      if (this.W.flags['seen:' + P.id]) continue;
      if (Math.hypot(p.x - P.x, p.z - P.z) < P.r && (!P.minY || p.y > P.minY)) return P;
    }
    return null;
  }
}
void clamp; void Bus;
