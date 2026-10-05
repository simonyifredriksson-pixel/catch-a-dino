/* ZooDressing.js - the fixed "theme park" dressing round your zoo.

   None of this is built by the player and none of it is saved: it is laid
   out again whenever the plot changes size (Zoo._perimeter calls it).
     the GATE      a giant T-rex skull you walk in through, jaws open, teeth,
                   glowing eyes, the sign on its forehead, two ticket huts
     the PLAZA     paved circle outside the gate: a T-rex statue in a fountain,
                   flagpoles, lamps, benches, flower beds, a welcome board
     the AVENUE    a lit, planted stone road from the plaza down to the dock
     the EDGE      a clipped hedge all round the fence, trees and flowers
     INSIDE        lamp posts with bunting along the main path
     the TOWER     a wooden lookout tower outside the north-east corner */
import * as THREE from '../../lib/three.module.js';
import { Mesher, geo, mat4, signMesh } from './Mesher.js';
import { putFlora, decorArt } from './ZooArt.js';
import { ZOO, DOCK } from '../data/Biomes.js';
import { rng } from '../core/Util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const BONE = '#efe6d2', BONE2 = '#e0d4b8', BONE3 = '#cfc2a2';
const STONE = '#b8b2a2', STONE2 = '#a8a294', STONE3 = '#c8c2b2';
const FLAGS = ['#e8503a', '#3a8ae8', '#f0c040', '#5ac05a', '#c060e0', '#ff8a3a'];

/** the entrance: a giant T-rex skull, jaws open, that you walk in through (local +z = outside) */
export function skullGate() {
  const M = new Mesher(0.04, 211), g = new THREE.Group();
  // the jaw hinges stand where the old gate posts were
  for (const s of [-1, 1]) {
    M.ico(s * 7, 0.3, -1, 3.6, 1.4, 3.8, STONE2, 0);                          // a stone footing
    M.seg(V(s * 7, 0, -1.4), V(s * 6.4, 9.2, -1.6), 1.3, 1.0, BONE2, 7);
  }
  // the skull: big tapering blocks from the cranium out to the snout tip
  M.boxc(0, 12.6, -3, 13.6, 9.4, 9, BONE);
  M.boxc(0, 16.6, -4.2, 10, 2.4, 6.4, BONE2);                                 // the crest on top
  M.boxc(0, 12.0, 4.2, 11.6, 7.6, 6.6, BONE, 0, 0.06);
  M.boxc(0, 11.4, 9.8, 9.2, 6.0, 5.8, BONE2, 0, 0.1);
  M.boxc(0, 10.9, 14.2, 6.8, 4.6, 3.8, BONE, 0, 0.14);
  M.boxc(0, 10.6, 16.6, 4.6, 3.4, 1.6, BONE2, 0, 0.18);
  for (const s of [-1, 1]) {
    // a heavy brow, a deep eye socket set into the side (it glows at night)
    M.boxc(s * 5.4, 15.8, 0.2, 3.6, 1.6, 4.2, BONE3, 0, 0, s * 0.25);
    M.boxc(s * 6.7, 13.6, 0.4, 0.4, 3.4, 3.4, '#1e140e');
    M.boxc(s * 6.85, 13.6, 0.6, 0.3, 1.5, 1.5, '#ff7a20', 0, 0, 0, { glow: true });
    // the big holes in the side of the skull, and the nostrils
    M.boxc(s * 5.85, 11.8, 5.6, 0.4, 3.8, 4.6, '#2a1c12', 0, 0.06);
    M.boxc(s * 6.85, 12.4, -5.2, 0.4, 4.4, 3.2, '#2a1c12');
    M.boxc(s * 2.4, 12.2, 16.9, 1.1, 1.0, 1.2, '#1e140e', 0, 0.18);    // horns behind the eyes
    M.add(geo.cone(5), mat4(s * 6.2, 17.2, -3, 0, 1.6, 3.2, 1.6, -0.4, s * -0.45), BONE3);
    // the upper teeth: two rows of fangs hanging over your head
    for (let i = 0; i < 8; i++) {
      const t = i / 7, x = s * (5.2 - t * 2.6), z = 0.6 + t * 15, L = 2.4 - t * 0.9 + (i % 2) * 0.5;
      M.add(geo.cone(5), mat4(x, 8.3 - t * 0.6 - L / 2, z, 0, 0.75, L, 0.75, Math.PI, 0), '#fffaf0');
    }
    // the lower jaw, dropped open: from the hinge down to the ground, teeth up
    M.seg(V(s * 6.4, 8.4, -1.6), V(s * 4.6, 2.6, 6), 0.75, 0.6, BONE2, 6);
    M.seg(V(s * 4.6, 2.6, 6), V(s * 3.4, 0.4, 13), 0.6, 0.45, BONE2, 6);
    for (let i = 0; i < 5; i++) { const t = i / 4, z = 6.5 + t * 6, x = s * (4.4 - t * 0.9), yy = 2.4 - t * 1.9; M.add(geo.cone(5), mat4(x, yy + 0.9, z, 0, 0.55, 1.5, 0.55), '#fffaf0'); }
  }
  // the front incisors
  for (const x of [-1.1, 1.1]) M.add(geo.cone(5), mat4(x, 7.6, 17, 0, 0.6, 1.8, 0.6, Math.PI, 0), '#fffaf0');  // ticket huts with striped awnings
  for (const x of [-12, 12]) {
    M.box(x, 0, 1, 3.2, 2.6, 2.6, '#f4e6c8');
    for (let i = 0; i < 6; i++) M.box(x - 1.4 + i * 0.56, 2.6, 2.0, 0.56, 0.22, 1.6, i % 2 ? '#e8503a' : '#ffffff');
    M.roof(x, 2.6, 0.6, 3.6, 2.8, 1.1, '#3a7a3a', Math.PI / 2);
    M.box(x, 1.1, 2.32, 1.7, 0.9, 0.05, '#8ad0f0');
    M.box(x, 0, 2.6, 2.4, 1.0, 0.5, '#a06a3a');
  }
  g.add(M.mesh());
  // the sign on its forehead, both ways
  const s = signMesh(['CATCH A DINO', 'ZOO'], 12, 1.6, { bg: '#ffe9b0', fg: '#3a6a2a', big: 1.2, double: true, borderColor: '#7a4a1a' });
  s.position.set(0, 19.4, 1.6); s.rotation.x = -0.2; g.add(s);
  const s2 = signMesh(['CATCH A DINO', 'ZOO'], 12, 1.6, { bg: '#ffe9b0', fg: '#3a6a2a', big: 1.2, double: true, borderColor: '#7a4a1a' });
  s2.position.set(0, 18.6, -6.4); s2.rotation.y = Math.PI; g.add(s2);
  return g;
}

/** a real creature model as a stone statue (or a green hedge sculpture) */
function dinoStatue(parent, sp, x, y, z, size, ry, color) {
  import('./CreatureArt.js').then(({ creatureTemplate }) => import('../data/Species.js').then(({ SP, VARIANTS }) => import('./Rig.js').then(({ instantiate }) => {
    const T = creatureTemplate(SP[sp], null, VARIANTS), I = instantiate(T);
    I.mesh.material = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });
    I.mesh.scale.setScalar(size / Math.max(T.meta.dims.len, T.meta.dims.height)); I.mesh.position.set(x, y, z); I.mesh.rotation.y = ry;
    I.mesh.castShadow = true; parent.add(I.mesh);
  }))).catch(() => {});
}

/** everything round the zoo that comes with the plot size */
export function buildDressing(G, half) {
  const T = G.terrain, C = G.colliders, y = ZOO.y, r = rng(4242);
  const root = new THREE.Group(), cols = [], items = [];
  const M = new Mesher(0.05, 400), F = new Mesher(0.06, 401);
  const gy = (x, z) => T.ground(x, z);
  const x0 = ZOO.x - half, x1 = ZOO.x + half, z0 = ZOO.z - half, z1 = ZOO.z + half;
  const add = (o, x, yy, z, s = 1, ry = 0) => { o.position.set(x, yy, z); o.scale.setScalar(s); o.rotation.y = ry; root.add(o); return o; };
  const lamp = (x, z, h = 4.4) => {
    const b = gy(x, z);
    M.cyl(x, b, z, 0.12, h, '#2a3a2a', 6); M.cyl(x, b, z, 0.3, 0.5, '#3a4a3a', 6);
    M.box(x, b + h - 0.1, z, 0.42, 0.5, 0.42, '#ffe8a0', 0, { glow: true }); M.cone(x, b + h + 0.38, z, 0.42, 0.42, '#2a3a2a', 4);
  };
  const flagpole = (x, z, c1, c2, h = 9) => {
    const b = gy(x, z);
    M.cyl(x, b, z, 0.1, h, '#e0e0e0', 6); M.ico(x, b + h + 0.1, z, 0.35, 0.35, 0.35, '#f0c040', 0);
    M.tri(V(x, b + h - 0.2, z), V(x, b + h - 2.2, z), V(x + 3.4, b + h - 1.2, z + 0.4), c1, { double: true });
    M.tri(V(x, b + h - 1.2, z), V(x, b + h - 2.2, z), V(x + 2.0, b + h - 1.8, z + 0.2), c2, { double: true });
  };
  const bunting = (a, b, sag = 1.2) => {
    const n = Math.max(4, Math.round(a.distanceTo(b) / 1.1));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * sag;
      const q = a.clone().lerp(b, t + 0.6 / n); q.y -= Math.sin((t + 0.6 / n) * Math.PI) * sag;
      M.tri(p, q, V((p.x + q.x) / 2, p.y - 0.7, (p.z + q.z) / 2), FLAGS[i % FLAGS.length], { double: true });
    }
    for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n; const p = a.clone().lerp(b, t0); p.y -= Math.sin(t0 * Math.PI) * sag; const q = a.clone().lerp(b, t1); q.y -= Math.sin(t1 * Math.PI) * sag; M.seg(p, q, 0.03, 0.03, '#f4f0e8', 3); }
  };

  /* ---- the plaza outside the gate ---- */
  const px = ZOO.x, pz = z1 + 19, PR = 15;
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
    const x = px + i * 2.6, z = pz + j * 2.6, d = Math.hypot(i * 2.6, j * 2.6);
    if (d > PR) continue;
    const ring = Math.floor(d / 4.2) % 2;
    M.box(x, gy(x, z) - 0.12, z, 2.55, 0.3, 2.55, ring ? STONE2 : (i + j) % 2 ? STONE : STONE3);
  }
  // a path of tiles from the gate to the plaza
  for (let z = z1 + 1; z < pz - PR + 2; z += 2.6) for (const x of [-2.6, 0, 2.6]) M.box(px + x, gy(px + x, z) - 0.12, z, 2.55, 0.3, 2.55, (Math.round(z) + x) % 2 ? STONE : STONE3);
  // the fountain with a T-rex statue in the middle
  const fy = gy(px, pz);
  M.cyl(px, fy, pz, 6.2, 0.9, '#a8a294', 20); M.cyl(px, fy + 0.85, pz, 5.7, 0.06, '#4aa8d8', 20);
  M.cyl(px, fy, pz, 1.8, 2.4, '#b8b2a2', 10);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; M.add(geo.cone(5), mat4(px + Math.cos(a) * 4.6, fy + 1.2, pz + Math.sin(a) * 4.6, 0, 0.3, 1.3, 0.3), '#9ae0ff', { glow: true }); }
  M.cyl(px, fy + 2.3, pz, 2.4, 0.5, '#c8c2b2', 10);
  dinoStatue(root, 'trex', px, fy + 2.8, pz, 7.5, Math.PI * 0.85, '#c8c2b2');
  for (const [sp, a] of [['trike', 0.6], ['stego', 2.4], ['para', 4.0]]) { const sx = px + Math.cos(a) * (PR + 7), sz = pz + Math.sin(a) * (PR + 7); if (sz < pz - PR) continue; M.cyl(sx, gy(sx, sz) - 0.3, sz, 2.2, 1.2, STONE2, 8); dinoStatue(root, sp, sx, gy(sx, sz) + 0.9, sz, 4.2, a + Math.PI, '#5a9a40'); }
  cols.push(C.circle(px, pz, 6.2, fy - 1, fy + 9, 'fountain'));
  // flagpoles, lamps and benches round the edge
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8, x = px + Math.cos(a) * (PR - 1.5), z = pz + Math.sin(a) * (PR - 1.5);
    if (i % 2) flagpole(x, z, FLAGS[i % 6], FLAGS[(i + 3) % 6]); else lamp(x, z);
    const bx = px + Math.cos(a + 0.4) * (PR - 4.5), bz = pz + Math.sin(a + 0.4) * (PR - 4.5);
    if (Math.abs(bx - px) > 3.5 || bz > pz) add(decorArt('bench', G), bx, gy(bx, bz), bz, 1, -a - 0.4 + Math.PI / 2);
  }
  // flower beds and topiary dinosaurs round the outside
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, x = px + Math.cos(a) * (PR + 2.5), z = pz + Math.sin(a) * (PR + 2.5);
    if (z < pz - PR + 3 && Math.abs(x - px) < 6) continue;
    M.cyl(x, gy(x, z) - 0.2, z, 1.6, 0.5, '#7a5a3a', 10);
    putFlora(F, 'flowers', x, gy(x, z) + 0.2, z, 1.4, a);
    if (i % 4 === 1) add(decorArt('topiary', G), x + Math.cos(a) * 3.5, gy(x, z), z + Math.sin(a) * 3.5, 1.3, a);
  }
  // the welcome board
  const wb = signMesh(['WELCOME TO', 'CATCH A DINO ZOO', 'Home Island'], 7, 3, { bg: '#fff4d8', fg: '#3a6a2a', double: true, borderColor: '#7a4a1a' });
  const wx = px + 11, wz = pz + 9; M.box(wx - 3, gy(wx, wz), wz, 0.3, 4.2, 0.3, '#6a4a2a'); M.box(wx + 3, gy(wx, wz), wz, 0.3, 4.2, 0.3, '#6a4a2a');
  wb.position.set(wx, gy(wx, wz) + 3.4, wz); wb.rotation.y = -0.5; root.add(wb);
  G.scatter?.exclude.push({ x: px, z: pz, r: PR + 8 });

  /* ---- the avenue down to the dock ---- */
  const D = G.landmarks?.dock, ex = DOCK.x, ez = D ? D.z0 : DOCK.z - 10;
  const A = V(px, 0, pz + PR - 1), B = V(ex, 0, ez - 1), Cc = V(px + 4, 0, (pz + ez) / 2);
  const bez = t => V((1 - t) * (1 - t) * A.x + 2 * (1 - t) * t * Cc.x + t * t * B.x, 0, (1 - t) * (1 - t) * A.z + 2 * (1 - t) * t * Cc.z + t * t * B.z);
  const L = A.distanceTo(B), steps = Math.ceil(L / 2.2);
  let lastLamp = -99;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, p = bez(t), q = bez(Math.min(1, t + 0.01)), ry = Math.atan2(q.x - p.x, q.z - p.z);
    const nx = Math.cos(ry), nz = -Math.sin(ry);
    for (const o of [-1.8, 0, 1.8]) { const x = p.x + nx * o, z = p.z + nz * o; const b = gy(x, z); if (b < 0.4) continue; M.box(x, b - 0.12, z, 2.0, 0.3, 2.4, (i + Math.round(o)) % 3 ? STONE : STONE3, ry); }
    const along = t * L;
    if (along - lastLamp > 11) {
      lastLamp = along;
      for (const s of [-1, 1]) {
        const x = p.x + nx * s * 3.6, z = p.z + nz * s * 3.6; if (gy(x, z) < 0.6) continue;
        lamp(x, z, 3.8);
        const fx = p.x + nx * s * 5.6, fz = p.z + nz * s * 5.6;
        if (gy(fx, fz) > 0.8) putFlora(F, i % 3 ? 'flowers' : 'palm', fx, gy(fx, fz), fz, i % 3 ? 1.2 : 0.9, r() * 6);
      }
    }
    G.scatter?.exclude.push({ x: p.x, z: p.z, r: 5 });
  }
  // a sign where the avenue meets the pier
  const ds = signMesh(['TO THE DOCK', 'fishing & sea rides'], 4, 1.4, { bg: '#f6ecd0', fg: '#2a5a8a', double: true });
  const dp = bez(0.82); ds.position.set(dp.x - 4.5, gy(dp.x - 4.5, dp.z) + 2.4, dp.z); root.add(ds); M.box(dp.x - 4.5, gy(dp.x - 4.5, dp.z), dp.z, 0.25, 2.2, 0.25, '#6a4a2a');

  /* ---- a clipped hedge and trees all round the fence ---- */
  const hedge = (ax, az, bx, bz) => {
    const L2 = Math.hypot(bx - ax, bz - az), n = Math.round(L2 / 3), ry = Math.atan2(bx - ax, bz - az);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      M.box(x, gy(x, z) - 0.2, z, 1.5, 1.9 + (i % 2) * 0.15, 3.1, i % 2 ? '#3f8a38' : '#4a9a40', ry);
    }
  };
  const o = 2.2;
  hedge(x0 - o, z0 - o, x1 + o, z0 - o); hedge(x1 + o, z0 - o, x1 + o, z1 + o); hedge(x0 - o, z1 + o, x0 - o, z0 - o);
  hedge(x0 - o, z1 + o, ZOO.x - 16, z1 + o); hedge(ZOO.x + 16, z1 + o, x1 + o, z1 + o);
  // trees just outside the hedge
  const trees = ['palm', 'ginkgo', 'jtree', 'palm', 'araucaria'];
  const tree = (x, z, k) => { if (gy(x, z) < 1) return; putFlora(F, k, x, gy(x, z), z, 0.9 + r() * 0.4, r() * 6); G.scatter?.exclude.push({ x, z, r: 3 }); };
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    tree(x0 - 7, z0 + (z1 - z0) * t, trees[i % 5]); tree(x1 + 7, z0 + (z1 - z0) * t, trees[(i + 2) % 5]);
    tree(x0 + (x1 - x0) * t, z0 - 7, trees[(i + 1) % 5]);
    const bx = x0 + (x1 - x0) * t; if (Math.abs(bx - ZOO.x) > 24) tree(bx, z1 + 7, trees[(i + 3) % 5]);
  }

  /* ---- inside: lamps and bunting along the main path ---- */
  const gz = z1, topZ = ZOO.z + 6;
  const lampsIn = [];
  for (let z = gz - 6; z > topZ; z -= 10) for (const s of [-1, 1]) { lamp(ZOO.x + s * 3.4, z, 4.2); lampsIn.push(V(ZOO.x + s * 3.4, y + 4.0, z)); }
  for (let i = 0; i + 1 < lampsIn.length; i += 2) bunting(lampsIn[i], lampsIn[i + 1], 0.6);
  for (let i = 0; i + 2 < lampsIn.length; i++) bunting(lampsIn[i], lampsIn[i + 2], 0.9);
  // bunting from the skull's teeth to the ticket huts
  bunting(V(ZOO.x - 6, y + 9, gz + 3), V(ZOO.x - 12, y + 3, gz + 2), 0.5); bunting(V(ZOO.x + 6, y + 9, gz + 3), V(ZOO.x + 12, y + 3, gz + 2), 0.5);

  /* ---- the lookout tower outside the north-east corner ---- */
  const tx = x1 + 14, tz = z0 - 10, tb = gy(tx, tz), TH = 13;
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.seg(V(tx + a * 2.6, tb - 0.5, tz + b * 2.6), V(tx + a * 1.7, tb + TH, tz + b * 1.7), 0.3, 0.24, '#7a5030', 6);
  for (let k = 1; k < 4; k++) { const hh = tb + k * TH / 4, w = 2.6 - k * 0.22; for (const [a, b, c, d] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) M.seg(V(tx + a * w, hh, tz + b * w), V(tx + c * w, hh, tz + d * w), 0.12, 0.12, '#8a6038', 4); }
  M.box(tx, tb + TH, tz, 5, 0.4, 5, '#a07048');
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) M.box(tx + a * 2.3, tb + TH + 0.4, tz + b * 2.3, 0.22, 2.4, 0.22, '#6a4a2a');
  M.roof(tx, tb + TH + 2.8, tz, 6, 6, 2.2, '#c84a3a', 0);
  flagpole(tx, tz, '#f0c040', '#3a8ae8', TH + 8);
  cols.push(C.box(tx, tz, 2.6, 2.6, 0, tb - 1, tb + TH + 4, 'tower'));

  root.add(M.mesh({ receive: true }));
  if (F.p.length) root.add(F.mesh());
  return { root, cols, items };
}
