/* Fossils.js - giant bones all over the world, and the signs that say "big
   things live here".

   FOSSILS: half-buried giants, built procedurally and scattered by region:
     rex skull, sauropod spine (vertebrae arching in and out of the ground),
     neck arch (a long neck you can walk under), horned frill skull, giant
     ammonite shell, claws breaking the surface, a pterosaur wing, a plated
     back. The more dangerous the region, the more of them and the BIGGER
     they are; burnt black near the volcano, frosted in the tundra.
   DANGER SIGNS, where a dangerous region (danger 3+) begins: ranger warning
     signs, skull totems, claw-gouged boulders, bone piles, and trails of
     huge footprints leading in. Footprints also cross the mid-danger lands.
   Region danger itself (BIOMES[b].danger) is shown by the HUD and the
   region title card (see ui/UI.js). */
import * as THREE from '../../lib/three.module.js';
import { Mesher, geo, mat4, signMesh } from '../art/Mesher.js';
import { BIOMES, HOME, WORLD_HALF } from '../data/Biomes.js';
import { GATES } from '../data/Places.js';
import { rng } from '../core/Util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const PAL = {
  bone: ['#efe6d2', '#e2d6bc', '#d4c6a6'],
  burnt: ['#9a8a78', '#8a7a68', '#a89880'],
  frost: ['#eef4f8', '#dce8f0', '#cfdde8'],
  moss: ['#d8d2b2', '#c8c49e', '#a8b07a'],
};
const TYPES = ['skull', 'spine', 'arch', 'frill', 'ammo', 'claws', 'wing', 'plates'];
const BY_BIOME = {
  desert: { skull: 3, spine: 3, ammo: 2, claws: 2, plates: 1, wing: 1, frill: 1 },
  meadow: { frill: 2, plates: 2, skull: 1, ammo: 1, spine: 1 },
  jungle: { arch: 3, skull: 2, claws: 2, frill: 1, spine: 1 },
  elder: { arch: 3, spine: 2, frill: 1, plates: 1 },
  swamp: { spine: 3, frill: 2, skull: 1, arch: 1 },
  peaks: { wing: 3, skull: 2, claws: 2, spine: 1 },
  tundra: { spine: 2, skull: 2, ammo: 2, claws: 1, arch: 1 },
  volcano: { skull: 3, claws: 3, spine: 2 },
  valley: { skull: 3, arch: 2, claws: 2, spine: 2 },
  isle: { ammo: 2, wing: 1, spine: 1 },
  skull: { skull: 3, claws: 2, arch: 1 },
  beach: { ammo: 3, wing: 1, spine: 1 },
};

export class Fossils {
  constructor(game) { this.g = game; this.list = []; this.signs = []; }
  build() {
    const G = this.g, T = G.terrain, r = rng(20251005), ex = G.scatter.exclude;
    const busy = (x, z, rad) => ex.some(e => Math.hypot(e.x - x, e.z - z) < e.r + rad) || GATES.some(q => Math.hypot(q.x - x, q.z - z) < 40) || this.list.some(f => Math.hypot(f.x - x, f.z - z) < f.r + rad);
    const danger = (x, z) => BIOMES[T.biome(x, z)]?.danger ?? 1;
    const STEP = 64;
    let nF = 0;
    // visit the cells in a shuffled order so the caps do not favour one side of the map
    const cells = [];
    for (let gx = -WORLD_HALF + 40; gx < WORLD_HALF - 40; gx += STEP) for (let gz = -WORLD_HALF + 40; gz < WORLD_HALF - 40; gz += STEP) cells.push([gx, gz]);
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    const nearSign = (x, z, d, kind) => this.signs.some(q => (!kind || q.kind === kind) && Math.hypot(q.x - x, q.z - z) < d);
    for (const [gx, gz] of cells) {
      const x = gx + (r() - 0.5) * STEP * 0.8, z = gz + (r() - 0.5) * STEP * 0.8;
      const full = this.signs.length >= 64;
      if (Math.hypot(x - HOME.x, z - HOME.z) < 470) continue;                 // keep the lagoon clear
      const h = T.ground(x, z); if (h < 1.2) continue;
      const b = T.biome(x, z), D = danger(x, z);
      if (b === 'cave' || b === 'ocean' || b === 'deep' || b === 'lake') continue;
      // the edge of a dangerous region (the land toward home is safer): warn people
      if (D >= 3) {
        const k = 70 / Math.hypot(x - HOME.x, z - HOME.z), sx = x + (HOME.x - x) * k, sz = z + (HOME.z - z) * k;
        if (!full && danger(sx, sz) <= 2 && r() < 0.65 && !nearSign(x, z, 170, 'warn') && !busy(x, z, 8)) { this._warning(x, z, Math.atan2(sx - x, sz - z), D, r); continue; }
        if (!full && r() < 0.16 && !nearSign(x, z, 110, 'mark') && !busy(x, z, 6)) { (r() < 0.5 ? this._clawRock : this._bonePile).call(this, x, z, D, r); continue; }
      }
      if (!full && D >= 2 && r() < 0.05 + (D - 2) * 0.04 && !nearSign(x, z, 120, 'feet') && !busy(x, z, 10)) { this._footprints(x, z, r() * Math.PI * 2, D, r); continue; }
      // a fossil
      if (nF > 75 || r() > 0.05 + D * 0.04) continue;
      const w = BY_BIOME[b] || { skull: 1, spine: 1, ammo: 1 };
      const kinds = Object.entries(w), tot = kinds.reduce((s, [, v]) => s + v, 0);
      let pick = r() * tot, kind = kinds[0][0];
      for (const [k, v] of kinds) { pick -= v; if (pick <= 0) { kind = k; break; } }
      const s = (0.7 + D * 0.38) * (0.8 + r() * 0.5);
      const rad = { skull: 9, spine: 26, arch: 16, frill: 8, ammo: 7, claws: 6, wing: 18, plates: 14 }[kind] * s;
      if (busy(x, z, rad)) continue;
      const pal = b === 'volcano' ? PAL.burnt : b === 'tundra' || b === 'peaks' ? PAL.frost : b === 'swamp' || b === 'jungle' || b === 'elder' ? PAL.moss : PAL.bone;
      this._fossil(kind, x, z, r() * Math.PI * 2, s, pal, r);
      this.list.push({ x, z, r: rad, kind, s });
      ex.push({ x, z, r: rad * 0.8 });
      nF++;
    }
  }

  /* ---------------- the giants ---------------- */
  _fossil(kind, x, z, yaw, s, pal, r) {
    const G = this.g, T = G.terrain, M = new Mesher(0.06, 500 + this.list.length), C = G.colliders;
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    const base = T.ground(x, z);
    // local (lx, ly, lz) in metres x s -> world, following the ground under it
    const P = (lx, ly, lz) => { const wx = x + (lx * c + lz * sn) * s, wz = z + (-lx * sn + lz * c) * s; return V(wx, Math.min(T.ground(wx, wz), base + 2) + ly * s, wz); };
    const ball = (lx, ly, lz, sx, sy, sz, col, d = 0) => { const p = P(lx, ly, lz); M.add(geo.ico(d), mat4(p.x, p.y, p.z, yaw, sx * s, sy * s, sz * s), col); return p; };
    const bone = (a, b, r0, r1, col) => M.seg(a, b, r0 * s, r1 * s, col, 6);
    const tooth = (lx, ly, lz, L, down, col = '#fffaf0') => { const p = P(lx, ly, lz); M.add(geo.cone(5), mat4(p.x, p.y + (down ? -L / 2 : L / 2) * s, p.z, yaw, 0.5 * s, L * s, 0.5 * s, down ? Math.PI : 0, 0), col); };
    const [B0, B1, B2] = pal, DARK = '#2a1e16';
    const col = (lx, lz, rad, h = 8) => { const p = P(lx, 0, lz); C.circle(p.x, p.z, rad * s, p.y - 3, p.y + h * s, 'fossil'); };
    switch (kind) {
      case 'skull': {
        // a tyrant skull, tipped on its side and half sunk, jaw open
        ball(0, 2.2, -1, 7, 5.5, 7.5, B0, 1); ball(0, 2, 4, 5.4, 4.2, 6, B1, 1); ball(0, 1.6, 7.6, 3.8, 3.2, 3.6, B0, 1);
        for (const k of [-1, 1]) { ball(k * 2.6, 3.4, 0.6, 2.2, 2.2, 2, DARK); ball(k * 3.2, 2.2, 3.6, 1.4, 1.8, 2.6, '#3a2a1c'); }
        for (let i = 0; i < 6; i++) for (const k of [-1, 1]) tooth(k * (2.3 - i * 0.25), 0.2, 1.5 + i * 1.2, 1.3 - i * 0.08, true);
        bone(P(-2.4, 0.2, -1.5), P(-1.6, -0.3, 8.5), 0.9, 0.6, B2); bone(P(2.4, 0.2, -1.5), P(1.6, -0.3, 8.5), 0.9, 0.6, B2);
        for (let i = 0; i < 4; i++) for (const k of [-1, 1]) tooth(k * (2 - i * 0.15), 0.1, 3 + i * 1.3, 1, false);
        col(0, 1, 4.5, 7); col(0, 6, 3, 5);
        break;
      }
      case 'spine': {
        // a sauropod back: vertebrae diving in and out of the ground, ribs
        const n = 26;
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1), lz = -24 + t * 48, ly = Math.sin(t * Math.PI * 1.6) * 4 + 1.5 - t * 1.2;
          if (ly < -1.2) continue;
          const w = 1.7 + Math.sin(t * Math.PI) * 1.2;
          ball(0, ly, lz, w, w * 0.8, 1.8, i % 2 ? B0 : B1);
          const top = P(0, ly + w * 0.5, lz), tip = P(0, ly + w * 0.5 + 1.4 + Math.sin(t * Math.PI) * 1.4, lz - 0.4);
          bone(top, tip, 0.35, 0.08, B2);
          if (i % 3 === 0 && ly > 0.5) for (const k of [-1, 1]) { const a = P(0, ly, lz), m = P(k * 3.2, ly - 1, lz + 0.6), e = P(k * 4.2, -1.5, lz + 1.2); bone(a, m, 0.35, 0.3, B1); bone(m, e, 0.3, 0.2, B1); }
          if (ly > 0 && i % 4 === 0) col(0, lz, w * 0.8, ly + 3);
        }
        break;
      }
      case 'arch': {
        // a long neck rising out of the ground and diving back in: walk under it
        const R = 13, n = 22;
        let prev = null;
        for (let i = 0; i <= n; i++) {
          const a = i / n * Math.PI, lz = -Math.cos(a) * R, ly = Math.sin(a) * R * 0.95 - 1.5, w = 2.6 - i / n * 1.4;
          const p = ball(0, ly, lz, w, w, w * 0.9, i % 2 ? B0 : B1);
          if (prev) bone(prev, p, w * 0.32, w * 0.3, B2);
          prev = p;
        }
        // the head lying at the far end
        ball(0, 0.8, R + 3, 3, 2.2, 4.2, B0, 1); ball(1.1, 1.3, R + 3.6, 0.8, 0.8, 0.8, DARK); ball(-1.1, 1.3, R + 3.6, 0.8, 0.8, 0.8, DARK);
        col(0, -R + 1, 2.2, 6); col(0, R - 1, 1.8, 5);
        break;
      }
      case 'frill': {
        // a horned skull with its great frill raised behind it
        ball(0, 1.6, 1, 4, 3.2, 5.4, B0, 1); ball(0, 1.2, 4.4, 2.2, 2, 2.6, B1, 1);
        const f = P(0, 4.2, -2.4); M.add(geo.cyl(12), mat4(f.x, f.y, f.z, yaw, 9 * s, 0.8 * s, 7.5 * s, -1.05, 0), B1);
        for (let i = 0; i < 10; i++) { const a = -0.9 * Math.PI + i / 9 * 0.8 * Math.PI, p = P(Math.cos(a) * 4.4, 4.2 + Math.sin(-a) * 3.4 + 0.6, -2.4 - Math.sin(-a) * 1.6); M.add(geo.cone(5), mat4(p.x, p.y, p.z, yaw, 0.7 * s, 1.3 * s, 0.7 * s), B2); }
        for (const k of [-1, 1]) { const a = P(k * 1.3, 3, 2), b = P(k * 1.8, 7.4, 6.6); bone(a, b, 0.6, 0.06, '#f4ecd8'); ball(k * 1.7, 2.4, 2.4, 1.1, 1.1, 1.1, DARK); }
        bone(P(0, 2.4, 4.8), P(0, 4.2, 6.6), 0.4, 0.05, '#f4ecd8');
        ball(0, 0.6, 5.8, 1.4, 1.2, 1.6, B2);
        col(0, 0, 4, 7);
        break;
      }
      case 'ammo': {
        // a giant ammonite shell standing on edge
        const n = 46;
        for (let i = 0; i < n; i++) {
          const a = i * 0.24, rad = 0.4 * Math.exp(a * 0.19), w = 0.35 + rad * 0.42;
          const lx = Math.cos(a) * rad, ly = Math.sin(a) * rad + 4.2;
          if (ly < -0.6) continue;
          ball(0, ly, lx, w * 1.4, w, w, i % 2 ? B0 : B1);
          if (i % 3 === 0) ball(0, ly, lx, w * 1.6, w * 0.3, w * 1.1, B2);
        }
        col(0, 0, 3.4, 9);
        break;
      }
      case 'claws': {
        // three huge curved claws breaking up through the ground
        for (let k = -1; k <= 1; k++) {
          let prev = P(k * 2.4, -1, k * 0.8);
          for (let i = 1; i <= 7; i++) {
            const t = i / 7, p = P(k * 2.4 + k * t * 0.8, t * 7.5 * (1 - t * 0.25) - 1, k * 0.8 + t * t * 4.5);
            bone(prev, p, 0.9 - t * 0.55 + 0.25, 0.9 - (t + 0.14) * 0.55 + 0.2, i > 5 ? '#3a3028' : B0);
            prev = p;
          }
          col(k * 2.4, k * 0.8, 1.2, 7);
        }
        break;
      }
      case 'wing': {
        // a pterosaur wing spread out on the rock
        const sh = P(0, 0.6, 0), el = P(5, 0.7, -2), wr = P(10, 0.8, -1), tip = P(28, 0.4, 3);
        bone(sh, el, 0.7, 0.55, B0); bone(el, wr, 0.55, 0.45, B1);
        bone(wr, P(18, 0.6, 1), 0.45, 0.35, B0); bone(P(18, 0.6, 1), tip, 0.35, 0.1, B1);
        for (let i = 0; i < 3; i++) bone(wr, P(11 + i * 0.6, 0.5, 1 + i * 1.3), 0.15, 0.05, B2);
        ball(-2.5, 1.2, 1, 3, 2, 5.6, B0, 1); bone(P(-2.5, 1.6, 3.5), P(-2.8, 2.2, 7.5), 0.4, 0.1, B1);        // the skull and its crest
        col(-2.5, 1, 2.4, 3);
        break;
      }
      case 'plates': {
        // a plated back and a spiked tail
        for (let i = 0; i < 9; i++) {
          const t = i / 8, lz = -10 + t * 20, ly = 1 + Math.sin(t * Math.PI) * 1.2, h = 2.5 + Math.sin(t * Math.PI) * 2.8;
          ball(0, ly, lz, 1.4, 1.2, 1.6, B1);
          for (const k of [-1, 1]) { const p = P(k * 0.5, ly + h / 2 + 0.5, lz + k * 0.6); M.add(geo.ico(0), mat4(p.x, p.y, p.z, yaw, 0.4 * s, h * s, h * 0.8 * s, 0, k * 0.15), i % 2 ? B0 : B2); }
        }
        for (const [a, b] of [[-1, 0.7], [1, 0.7], [-1, -0.7], [1, -0.7]]) bone(P(0, 1, 12), P(a * 2.6, 2 + b, 13 + b), 0.35, 0.05, B0);
        col(0, -4, 2.4, 6); col(0, 4, 2.4, 6);
        break;
      }
    }
    if (!M.empty) G.scene.add(M.mesh());
  }

  /* ---------------- the warnings ---------------- */
  _warning(x, z, faceHome, D, r) {
    const G = this.g, T = G.terrain, M = new Mesher(0.06, 900 + this.signs.length);
    const y = T.ground(x, z);
    // a skull totem
    M.cyl(x, y - 0.5, z, 0.22, 5.6, '#5a3a24', 6);
    M.ico(x, y + 5.4, z, 1.6, 1.3, 2, '#efe6d2', 1);
    for (const k of [-1, 1]) { M.ico(x + k * 0.45, y + 5.6, z + 0.6, 0.45, 0.45, 0.4, '#1e140e'); M.add(geo.cone(5), mat4(x + k * 0.8, y + 6.3, z, 0, 0.35, 1.2, 0.35, 0, k * -0.6), '#e2d6bc'); }
    M.tri(V(x, y + 4.6, z), V(x, y + 3.2, z), V(x + 1.6, y + 3.5, z + 0.4), '#c8302a', { double: true });
    M.tri(V(x, y + 4.4, z), V(x, y + 3.0, z), V(x - 1.3, y + 3.3, z - 0.3), '#a8282a', { double: true });
    // and next to it a ranger warning sign, facing the way people come from
    const sx = x + Math.sin(faceHome + 1.2) * 3.4, sz = z + Math.cos(faceHome + 1.2) * 3.4, sy = T.ground(sx, sz);
    M.box(sx, sy - 0.4, sz, 0.22, 3.2, 0.22, '#6a4a2a');
    G.scene.add(M.mesh());
    const lines = D >= 4 ? ['DANGER!', 'Huge predators.', 'Turn back unless', 'you are ready.'] : ['WARNING', 'Big dinosaurs', 'ahead.'];
    const sg = signMesh(lines, 3, 1.9, { bg: D >= 4 ? '#ffd8c8' : '#fff0b0', fg: '#a8201a', double: true, borderColor: '#3a2a1a' });
    sg.position.set(sx, sy + 2.4, sz); sg.rotation.y = faceHome; G.scene.add(sg);
    G.colliders.circle(x, z, 0.5, y - 1, y + 6, 'totem');
    this.signs.push({ x, z, D, kind: 'warn' });
    G.scatter.exclude.push({ x, z, r: 6 });
    void r;
  }
  _clawRock(x, z, D, r) {
    const G = this.g, T = G.terrain, M = new Mesher(0.06, 1200 + this.signs.length), y = T.ground(x, z), s = 1 + (D - 3) * 0.4 + r() * 0.4;
    M.dode(x, y + 2 * s, z, 6 * s, 4.6 * s, 5 * s, '#8a867a', r() * 6);
    const a = r() * 6.28, cx = Math.sin(a) * 2.6 * s, cz = Math.cos(a) * 2.6 * s;
    for (let k = -1; k <= 1; k++) M.boxc(x + cx + Math.cos(a) * k * 0.9 * s, y + 2.4 * s, z + cz - Math.sin(a) * k * 0.9 * s, 0.35 * s, 3.6 * s, 0.5 * s, '#3a3430', a, 0, 0.5);
    G.scene.add(M.mesh());
    G.colliders.circle(x, z, 2.6 * s, y - 1, y + 4.5 * s, 'rock');
    this.signs.push({ x, z, D, kind: 'mark' }); G.scatter.exclude.push({ x, z, r: 5 * s });
  }
  _bonePile(x, z, D, r) {
    const G = this.g, T = G.terrain, M = new Mesher(0.06, 1500 + this.signs.length), y = T.ground(x, z);
    for (let i = 0; i < 9; i++) {
      const a = r() * 6.28, d = r() * 3, L = 1.2 + r() * 2.4, b = r() * 6.28, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d, py = T.ground(px, pz) + 0.25;
      M.seg(V(px, py, pz), V(px + Math.cos(b) * L, py + 0.1, pz + Math.sin(b) * L), 0.18, 0.15, '#e8dcc4', 5);
      M.ico(px, py, pz, 0.5, 0.4, 0.5, '#efe6d2');
    }
    M.ico(x, y + 0.6, z, 1.6, 1.2, 2, '#efe6d2', 1); M.ico(x + 0.4, y + 0.9, z + 0.6, 0.4, 0.4, 0.4, '#1e140e'); M.ico(x - 0.4, y + 0.9, z + 0.6, 0.4, 0.4, 0.4, '#1e140e');
    G.scene.add(M.mesh());
    this.signs.push({ x, z, D, kind: 'mark' });
  }
  /** a trail of huge three-toed footprints */
  _footprints(x, z, dir, D, r) {
    const G = this.g, T = G.terrain, M = new Mesher(0.04, 1800 + this.signs.length);
    const s = 0.8 + (D - 2) * 0.5 + r() * 0.3, n = 7 + Math.floor(r() * 5), step = 5.5 * s;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, wob = Math.sin(i * 0.7) * 0.25;
      const fx = x + Math.sin(dir + wob) * step * i + Math.cos(dir) * side * 1.3 * s, fz = z + Math.cos(dir + wob) * step * i - Math.sin(dir) * side * 1.3 * s;
      const h = T.ground(fx, fz); if (h < 0.3) break;
      M.add(geo.cyl(10), mat4(fx, h + 0.04, fz, dir, 2.2 * s, 0.1, 2.0 * s), '#5a4a34');
      for (const t of [-0.55, 0, 0.55]) { const a = dir + t, tx = fx + Math.sin(a) * 1.9 * s, tz = fz + Math.cos(a) * 1.9 * s; M.add(geo.ico(0), mat4(tx, T.ground(tx, tz) + 0.05, tz, a, 0.7 * s, 0.1, 1.8 * s), '#4a3c2a'); }
      if (i % 3 === 1) M.add(geo.cyl(8), mat4(fx, h + 0.1, fz, dir, 1.4 * s, 0.04, 1.2 * s), '#4a8aa8');
    }
    G.scene.add(M.mesh({ cast: false }));
    this.signs.push({ x, z, D, kind: 'feet' });
  }
}
void TYPES;
