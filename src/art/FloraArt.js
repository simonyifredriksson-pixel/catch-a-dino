/* FloraArt.js - the plants, rocks and odds and ends of the prehistoric world.
   Each builder returns a Mesher at natural size, base at y = 0. Scatter.js
   makes a few variants of each (different seeds) and instances them.
   Prehistoric flora: tree ferns, cycads, horsetails, araucarias, giant
   redwoods, ginkgos, palms - no grass lawns outside the zoo, just ferns. */
import * as THREE from '../../lib/three.module.js';
import { Mesher, geo, mat4 } from './Mesher.js';
import { rng } from '../core/Util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const shade = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();

/** a bent trunk from segments; returns the top point and direction */
function trunk(M, r, h, r0, r1, col, n = 5, bend = 0.15, sides = 7) {
  let p = V(0, 0, 0), d = V(0, 1, 0);
  const ax = r() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const q = p.clone().addScaledVector(d, h / n);
    M.seg(p, q, r0 + (r1 - r0) * (i / n), r0 + (r1 - r0) * ((i + 1) / n), shade(col, 0.9 + (i % 2) * 0.1), sides, { grad: [0, h * 0.5] });
    p = q; d.add(V(Math.cos(ax) * bend / n, 0, Math.sin(ax) * bend / n)).normalize();
  }
  return { top: p, dir: d };
}
/** a leaf blade: a flat, slightly folded diamond from a point outward, drooping */
function blade(M, at, dir, len, w, col, droop = 0.4, segs = 3) {
  const side = V().crossVectors(dir, V(0, 1, 0)).normalize().multiplyScalar(w);
  let p = at.clone(), d = dir.clone();
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const q = p.clone().addScaledVector(d, len / segs);
    const w0 = Math.sin(Math.PI * Math.max(0.05, t0)) * 1, w1 = Math.sin(Math.PI * Math.min(0.95, t1));
    const c = shade(col, 0.9 + 0.12 * (i % 2));
    M.tri(p.clone().addScaledVector(side, w0), q.clone().addScaledVector(side, w1), q, c, { double: true });
    M.tri(p, p.clone().addScaledVector(side, w0), q, shade(c, 0.92), { double: true });
    M.tri(p, q, q.clone().addScaledVector(side, -w1), shade(c, 0.86), { double: true });
    M.tri(p, q.clone().addScaledVector(side, -w1), p.clone().addScaledVector(side, -w0), shade(c, 0.95), { double: true });
    p = q; d.y -= droop / segs; d.normalize();
  }
}
export const FLORA = {
  palm(seed) {
    const M = new Mesher(0.08, seed), r = rng(seed), h = 7 + r() * 5;
    const { top, dir } = trunk(M, r, h, 0.32, 0.22, '#9a7a52', 7, 0.9, 6);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + r(); blade(M, top, V(Math.cos(a), 0.35 + r() * 0.3, Math.sin(a)).normalize(), 3.4 + r(), 0.55, i % 2 ? '#4f9a36' : '#5aaa3e', 1.2, 4); }
    for (let i = 0; i < 3; i++) M.ico(top.x + Math.cos(i * 2) * 0.3, top.y - 0.3, top.z + Math.sin(i * 2) * 0.3, 0.38, 0.38, 0.38, '#6a4a2a');
    void dir; return M;
  },
  jtree(seed) {
    const M = new Mesher(0.08, seed), r = rng(seed), h = 11 + r() * 8;
    const { top } = trunk(M, r, h, 0.7, 0.35, '#6a5038', 5, 0.25, 7);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; M.seg(V(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4), V(Math.cos(a) * 0.35, 2.2, Math.sin(a) * 0.35), 0.28, 0.12, '#5a4430', 5); }
    const cs = ['#2f7a34', '#3a8a3a', '#2a6a30'];
    for (let i = 0; i < 6; i++) { const a = r() * Math.PI * 2, d = r() * 3.2; M.ico(top.x + Math.cos(a) * d, top.y + (r() - 0.3) * 2.2, top.z + Math.sin(a) * d, 5 + r() * 3, 3 + r() * 1.6, 5 + r() * 3, cs[i % 3], 1); }
    for (let i = 0; i < 5; i++) { const a = r() * Math.PI * 2, d = 2 + r() * 3, L = 3 + r() * 5; M.box(top.x + Math.cos(a) * d, top.y - L - 0.5, top.z + Math.sin(a) * d, 0.08, L, 0.08, '#3a6a2a'); }
    return M;
  },
  tfern(seed) {
    const M = new Mesher(0.08, seed), r = rng(seed), h = 3 + r() * 3;
    const { top } = trunk(M, r, h, 0.22, 0.16, '#5a4632', 4, 0.4, 6);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + r() * 0.3; blade(M, top, V(Math.cos(a), 0.55, Math.sin(a)).normalize(), 2.6 + r() * 0.8, 0.42, i % 2 ? '#4a9a3a' : '#3e8a32', 1.3, 4); }
    return M;
  },
  cycad(seed) {
    const M = new Mesher(0.08, seed), r = rng(seed), h = 0.8 + r() * 1.2;
    M.frust(0, 0, 0, 0.45, 0.32, h, '#7a6040', 7, { grad: [0, h] });
    for (let i = 0; i < 6; i++) M.boxc(0, h * (0.2 + i * 0.13), 0, 0.82 - i * 0.05, 0.08, 0.82 - i * 0.05, '#6a5236', i * 0.5);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; blade(M, V(0, h, 0), V(Math.cos(a), 0.7, Math.sin(a)).normalize(), 1.9 + r() * 0.5, 0.25, i % 2 ? '#5a9a3e' : '#4a8a36', 0.7, 3); }
    return M;
  },
  fern(seed) {
    const M = new Mesher(0.1, seed), r = rng(seed), n = 6 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + r() * 0.4; blade(M, V(0, 0.05, 0), V(Math.cos(a), 0.9, Math.sin(a)).normalize(), 1.1 + r() * 0.5, 0.22, i % 2 ? '#4a9a3a' : '#5aaa44', 1.4, 3); }
    return M;
  },
  bush(seed) {
    const M = new Mesher(0.1, seed), r = rng(seed);
    for (let i = 0; i < 4; i++) M.ico((r() - 0.5) * 1.6, 0.6 + r() * 0.5, (r() - 0.5) * 1.6, 1.4 + r() * 0.8, 1.1 + r() * 0.5, 1.4 + r() * 0.8, i % 2 ? '#3f8a34' : '#4a9a3c');
    if (r() < 0.5) for (let i = 0; i < 6; i++) M.ico((r() - 0.5) * 2, 0.9 + r() * 0.6, (r() - 0.5) * 2, 0.16, 0.16, 0.16, r() < 0.5 ? '#e04a5a' : '#f0c040');
    return M;
  },
  flowers(seed) {
    const M = new Mesher(0.12, seed), r = rng(seed), cols = ['#f05a7a', '#f0c040', '#9a6af0', '#ffffff', '#f08a3a'], c = cols[Math.floor(r() * cols.length)];
    for (let i = 0; i < 7; i++) { const x = (r() - 0.5) * 1.4, z = (r() - 0.5) * 1.4, h = 0.3 + r() * 0.4; M.box(x, 0, z, 0.04, h, 0.04, '#3a7a2a'); M.ico(x, h, z, 0.2, 0.12, 0.2, c); M.ico(x, h + 0.04, z, 0.07, 0.07, 0.07, '#f8e070'); }
    return M;
  },
  grass(seed) {
    const M = new Mesher(0.12, seed), r = rng(seed);
    for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, x = Math.cos(a) * r() * 0.5, z = Math.sin(a) * r() * 0.5, h = 0.4 + r() * 0.5, lean = (r() - 0.5) * 0.4; M.tri(V(x - 0.06, 0, z), V(x + 0.06, 0, z), V(x + lean, h, z + lean * 0.5), r() < 0.5 ? '#6aac44' : '#7aba4c', { double: true }); }
    return M;
  },
  rock(seed) {
    const M = new Mesher(0.08, seed), r = rng(seed), s = 1.2 + r() * 2.2, c = r() < 0.5 ? '#8a8a82' : '#7a7a74';
    M.dode(0, s * 0.35, 0, s * 1.6, s, s * 1.3, c, r() * 3);
    if (r() < 0.6) M.dode(s * 0.7, s * 0.2, s * 0.3, s * 0.8, s * 0.6, s * 0.7, shade(c, 0.92), r() * 3);
    if (r() < 0.4) M.ico(-s * 0.2, s * 0.85, 0, s * 0.9, s * 0.25, s * 0.8, '#6a9a4a');   // moss cap
    return M;
  },
  sandrock(seed) {
    const M = new Mesher(0.08, seed), r = rng(seed), s = 1.2 + r() * 2.4, c = r() < 0.5 ? '#c8945a' : '#b8844e';
    M.dode(0, s * 0.3, 0, s * 1.7, s * 0.9, s * 1.3, c, r() * 3);
    if (r() < 0.6) M.dode(s * 0.8, s * 0.15, s * 0.2, s * 0.9, s * 0.5, s * 0.8, shade(c, 0.9), r() * 3);
    M.box(0, s * 0.55, 0, s * 1.3, s * 0.05, s * 1.0, shade(c, 1.15), r() * 3);
    return M;
  },
  pebbles(seed) {
    const M = new Mesher(0.1, seed), r = rng(seed);
    for (let i = 0; i < 5; i++) M.dode((r() - 0.5) * 2, 0.12, (r() - 0.5) * 2, 0.3 + r() * 0.4, 0.2 + r() * 0.2, 0.3 + r() * 0.3, r() < 0.5 ? '#8a8680' : '#9a968e', r() * 3);
    return M;
  },
  redwood(seed) {
    const M = new Mesher(0.07, seed), r = rng(seed), h = 34 + r() * 22;
    const { top } = trunk(M, r, h, 1.9 + r() * 0.8, 0.7, '#8a4a2e', 6, 0.08, 9);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; M.seg(V(Math.cos(a) * 3, 0, Math.sin(a) * 3), V(Math.cos(a) * 1.2, 4, Math.sin(a) * 1.2), 0.9, 0.4, '#7a4228', 5); }
    for (let i = 0; i < 6; i++) { const y = h * (0.45 + i * 0.1), rr = 8 - i * 1.1; M.cone(top.x * (y / h), y, top.z * (y / h), rr, rr * 1.25, i % 2 ? '#2e6a3a' : '#357440', 8); }
    return M;
  },
  araucaria(seed) {
    const M = new Mesher(0.08, seed), r = rng(seed), h = 14 + r() * 8;
    const { top } = trunk(M, r, h, 0.5, 0.3, '#6a5040', 4, 0.1, 6);
    for (let k = 0; k < 4; k++) {
      const y = h * (0.55 + k * 0.13), L = 4.5 - k * 0.8;
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + k; const e = V(Math.cos(a) * L, y + 0.6, Math.sin(a) * L); M.seg(V(0, y, 0), e, 0.14, 0.08, '#6a5040', 4); M.ico(e.x, e.y + 0.3, e.z, 2.6, 1.3, 2.6, k % 2 ? '#2f6a34' : '#3a7a3a'); }
    }
    M.ico(top.x, top.y + 0.6, top.z, 2.2, 1.6, 2.2, '#2f6a34');
    return M;
  },
  ginkgo(seed) {
    const M = new Mesher(0.08, seed), r = rng(seed), h = 9 + r() * 5;
    const { top } = trunk(M, r, h, 0.45, 0.25, '#7a6a5a', 4, 0.2, 6);
    const c = r() < 0.3 ? '#e8c040' : '#7ab048';
    for (let i = 0; i < 5; i++) M.ico(top.x + (r() - 0.5) * 4, top.y - 1 + r() * 2.5, top.z + (r() - 0.5) * 4, 4 + r() * 2, 3 + r(), 4 + r() * 2, i % 2 ? c : shade(c, 0.9), 1);
    return M;
  },
  deadtree(seed) {
    const M = new Mesher(0.08, seed), r = rng(seed), h = 4 + r() * 4;
    const { top } = trunk(M, r, h, 0.32, 0.12, '#8a7258', 4, 0.6, 6);
    for (let i = 0; i < 4; i++) { const a = r() * Math.PI * 2, y = h * (0.5 + r() * 0.4); M.seg(V(top.x * y / h, y, top.z * y / h), V(Math.cos(a) * 2, y + 1.5 + r(), Math.sin(a) * 2), 0.12, 0.04, '#8a7258', 4); }
    return M;
  },
  succulent(seed) {
    const M = new Mesher(0.1, seed), r = rng(seed);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, L = 0.9 + r() * 0.5; M.add(geo.cone(4), mat4(Math.cos(a) * 0.25, L * 0.4, Math.sin(a) * 0.25, -a + Math.PI / 2, 0.3, L, 0.12, 0, 0.7), i % 2 ? '#7a9a5a' : '#8aaa6a'); }
    if (r() < 0.4) { M.box(0, 0, 0, 0.06, 1.8, 0.06, '#7a8a4a'); M.ico(0, 1.85, 0, 0.3, 0.3, 0.3, '#f07a3a'); }
    return M;
  },
  bones(seed) {
    const M = new Mesher(0.06, seed), r = rng(seed), bone = '#efe6d2';
    const n = 4 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) { const z = (i - n / 2) * 0.55; M.add(geo.tor(10, 0.1), mat4(0, 0.2, z, Math.PI / 2, 2.2, 2.4, 2.2, 0, 0), bone); }
    M.boxc(0, 0.25, 0, 0.3, 0.25, n * 0.6, shade(bone, 0.9));
    if (r() < 0.5) M.ico(0, 0.4, n * 0.36 + 0.6, 0.9, 0.7, 1.3, bone);
    return M;
  },
  reeds(seed) {
    const M = new Mesher(0.1, seed), r = rng(seed);
    for (let i = 0; i < 12; i++) { const x = (r() - 0.5) * 1.6, z = (r() - 0.5) * 1.6, h = 1.6 + r() * 1.4; M.box(x, -0.5, z, 0.05, h + 0.5, 0.05, '#7a9a4a'); if (r() < 0.6) M.add(geo.cyl(5), mat4(x, h - 0.2, z, 0, 0.12, 0.45, 0.12), '#6a4a2a'); }
    return M;
  },
  horsetail(seed) {
    const M = new Mesher(0.1, seed), r = rng(seed);
    for (let i = 0; i < 6; i++) {
      const x = (r() - 0.5) * 1.4, z = (r() - 0.5) * 1.4, h = 2 + r() * 2;
      for (let k = 0; k < 5; k++) { M.cyl(x, k * h / 5, z, 0.07, h / 5, k % 2 ? '#5a8a3a' : '#4a7a32', 6); M.add(geo.cone(6), mat4(x, (k + 1) * h / 5 - 0.05, z, 0, 0.5, 0.18, 0.5), '#3a6a2a'); }
      M.cone(x, h, z, 0.1, 0.35, '#7a6a3a', 6);
    }
    return M;
  },
  swamptree(seed) {
    const M = new Mesher(0.08, seed), r = rng(seed), h = 8 + r() * 5;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; M.seg(V(Math.cos(a) * 2.2, -0.6, Math.sin(a) * 2.2), V(Math.cos(a) * 0.4, 2.4, Math.sin(a) * 0.4), 0.16, 0.12, '#5a4a36', 5); }
    const { top } = trunk(M, r, h, 0.5, 0.3, '#5a4a36', 4, 0.3, 6);
    for (let i = 0; i < 4; i++) M.ico(top.x + (r() - 0.5) * 3, top.y + r(), top.z + (r() - 0.5) * 3, 4.5, 2.4, 4.5, i % 2 ? '#5a7a34' : '#4a6a2e');
    for (let i = 0; i < 8; i++) { const a = r() * Math.PI * 2, d = 1.5 + r() * 2.5, L = 2 + r() * 3; M.box(top.x + Math.cos(a) * d, top.y - L, top.z + Math.sin(a) * d, 0.3, L, 0.05, '#8a9a5a'); }
    return M;
  },
  mushroom(seed) {
    const M = new Mesher(0.08, seed), r = rng(seed), h = 2 + r() * 3, cap = ['#d84a3a', '#e8a040', '#9a6ad8'][Math.floor(r() * 3)];
    M.frust(0, 0, 0, 0.35, 0.25, h, '#efe4cc', 7);
    M.add(geo.sph(10, 5), mat4(0, h, 0, 0, 2.6 + r(), 1.1, 2.6 + r()), cap);
    for (let i = 0; i < 6; i++) { const a = r() * Math.PI * 2; M.ico(Math.cos(a) * 0.9, h + 0.45, Math.sin(a) * 0.9, 0.25, 0.12, 0.25, '#fff4e0'); }
    return M;
  },
  snowpine(seed) {
    const M = new Mesher(0.06, seed), r = rng(seed), h = 8 + r() * 6;
    M.cyl(0, 0, 0, 0.3, h * 0.4, '#5a4434', 6);
    for (let i = 0; i < 4; i++) { const y = h * (0.2 + i * 0.18), rr = 3 - i * 0.6; M.cone(0, y, 0, rr, rr * 1.4, '#2e5a44', 7); M.cone(0, y + rr * 0.55, 0, rr * 0.75, rr * 0.75, '#f2f6f8', 7); }
    return M;
  },
  icespire(seed) {
    const M = new Mesher(0.05, seed), r = rng(seed);
    for (let i = 0; i < 4; i++) { const h = 3 + r() * 6; M.add(geo.cone(5), mat4((r() - 0.5) * 2, h / 2, (r() - 0.5) * 2, r() * 3, 0.9 + r() * 0.6, h, 0.9 + r() * 0.6, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3), i % 2 ? '#bfe6f4' : '#a8d8ee'); }
    return M;
  },
  lavarock(seed) {
    const M = new Mesher(0.08, seed), r = rng(seed), s = 1.5 + r() * 2;
    M.dode(0, s * 0.3, 0, s * 1.5, s, s * 1.3, '#2e2624', r() * 3);
    for (let i = 0; i < 3; i++) M.box((r() - 0.5) * s, s * (0.4 + r() * 0.3), (r() - 0.5) * s, s * 0.9, 0.06, 0.06, '#ff7a2a', r() * 3, { glow: true });
    return M;
  },
  coral(seed) {
    const M = new Mesher(0.12, seed), r = rng(seed), c = ['#f07a8a', '#f0a050', '#c070e0', '#50c0d0'][Math.floor(r() * 4)];
    for (let i = 0; i < 6; i++) { const a = r() * Math.PI * 2, d = r() * 1.2; M.seg(V(Math.cos(a) * d * 0.3, 0, Math.sin(a) * d * 0.3), V(Math.cos(a) * d, 1 + r() * 1.5, Math.sin(a) * d), 0.2, 0.08, i % 2 ? c : shade(c, 0.85), 5); }
    M.ico(0, 0.3, 0, 1.6, 0.6, 1.6, shade(c, 0.8));
    return M;
  },
  kelp(seed) {
    const M = new Mesher(0.1, seed), r = rng(seed);
    for (let i = 0; i < 4; i++) { const x = (r() - 0.5) * 2, z = (r() - 0.5) * 2, h = 6 + r() * 9; let p = V(x, 0, z); for (let k = 0; k < 6; k++) { const q = p.clone().add(V(Math.sin(k + i) * 0.4, h / 6, Math.cos(k * 1.3) * 0.3)); M.seg(p, q, 0.08, 0.06, '#4a7a3a', 4); blade(M, q, V(Math.sin(k * 2), 0.4, Math.cos(k * 2)).normalize(), 0.9, 0.22, '#5a8a3a', 0.5, 2); p = q; } }
    return M;
  },
  log(seed) {
    const M = new Mesher(0.08, seed), r = rng(seed), L = 5 + r() * 4;
    M.add(geo.cyl(7), mat4(0, 0.55, 0, r() * 3, 1.1, L, 1.1, Math.PI / 2, 0), '#6a5038');
    M.ico(0, 1.0, 0, 1.2, 0.3, L * 0.6, '#5a8a3a');
    return M;
  },
  crystal(seed) {
    const M = new Mesher(0.04, seed), r = rng(seed), c = r() < 0.5 ? '#c070ff' : '#70d8ff';
    for (let i = 0; i < 5; i++) { const h = 1 + r() * 3; M.add(geo.oct(), mat4((r() - 0.5) * 1.5, h * 0.4, (r() - 0.5) * 1.5, r() * 3, 0.5 + r() * 0.4, h, 0.5 + r() * 0.4, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5), c, { glow: true }); }
    M.dode(0, 0.2, 0, 2, 0.6, 2, '#3a3448');
    return M;
  },
};

/** colliders (radius at scale 1) for the solid props; the rest you walk through */
export const SOLID = { palm: 0.4, jtree: 1.0, tfern: 0.3, redwood: 2.6, araucaria: 0.6, ginkgo: 0.5, deadtree: 0.35, swamptree: 0.6, mushroom: 0.4, snowpine: 0.4, rock: 1.6, sandrock: 1.6, lavarock: 1.6, icespire: 1.3, log: 0.9, crystal: 1.0, cycad: 0.4 };
/** big things stay visible far away; small ones only near the camera */
export const SMALL = new Set(['fern', 'flowers', 'grass', 'pebbles', 'succulent', 'bush', 'reeds', 'horsetail', 'cycad', 'coral', 'kelp', 'bones']);
