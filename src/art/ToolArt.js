/* ToolArt.js - what you hold, and what you throw.

   holdModel(id)        the tool in your hand (also the inventory icon)
   projectileModel(id)  what flies: a lasso loop, a spinning bola, a net, a
                        padded harpoon, a grapnel, a lump of bait
   ADDING A TOOL'S ART: add a builder to HOLD (and PROJ if it throws
   something new); tools without one fall back to their behaviour's art. */
import * as THREE from '../../lib/three.module.js';
import { Mesher, geo, mat4 } from './Mesher.js';
import { TOOLS } from '../data/Tools.js';
import { ITEMS } from '../data/Items.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const shade = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();

const HOLD = {
  lasso(c) {
    const M = new Mesher(0.06, 3);
    M.add(geo.tor(14, 0.16), mat4(0, -0.05, 0.06, 0, 0.32, 0.32, 0.5, 0, 0), c);           // the coil
    M.add(geo.tor(14, 0.1), mat4(0, -0.06, 0.06, 0, 0.26, 0.26, 0.4, 0, 0), shade(c, 0.85));
    M.box(0, -0.1, 0.02, 0.05, 0.2, 0.05, shade(c, 0.7));
    return M;
  },
  net(c) {
    const M = new Mesher(0.06, 4);
    M.add(geo.cyl(8), mat4(0, -0.05, 0.25, 0, 0.16, 0.6, 0.16, Math.PI / 2, 0), '#4a5a3a');
    M.add(geo.frust(1.6, 8), mat4(0, -0.05, 0.6, 0, 0.18, 0.18, 0.18, Math.PI / 2, 0), '#3a4a2e');
    M.box(0, -0.18, 0.12, 0.08, 0.2, 0.1, '#2a2a2a'); M.ico(0, 0.02, 0.62, 0.22, 0.22, 0.12, c);
    return M;
  },
  bola(c) {
    const M = new Mesher(0.06, 5);
    M.box(0, -0.05, 0, 0.06, 0.25, 0.06, '#6a4a2a');
    for (const s of [-1, 1]) { M.seg(V(0, -0.15, 0), V(s * 0.18, -0.45, 0.05), 0.012, 0.012, '#d8c890', 4); M.ico(s * 0.18, -0.48, 0.05, 0.14, 0.14, 0.14, c); }
    return M;
  },
  harpoon(c) {
    const M = new Mesher(0.06, 6);
    M.add(geo.cyl(8), mat4(0, -0.04, 0.3, 0, 0.12, 0.8, 0.12, Math.PI / 2, 0), c);
    M.box(0, -0.16, 0.12, 0.07, 0.22, 0.1, '#2a2a2a'); M.box(0, -0.02, 0.0, 0.1, 0.12, 0.25, shade(c, 0.7));
    M.add(geo.cone(6), mat4(0, -0.04, 0.78, 0, 0.12, 0.2, 0.12, Math.PI / 2, 0), '#e8e0c8');
    M.add(geo.tor(10, 0.2), mat4(0, -0.04, 0.05, 0, 0.18, 0.18, 0.18, 0, 0), '#c8b890');
    return M;
  },
  skyhook(c) {
    const M = new Mesher(0.06, 7);
    M.add(geo.cyl(8), mat4(0, -0.04, 0.28, 0, 0.14, 0.7, 0.14, Math.PI / 2, 0), shade(c, 0.6));
    M.box(0, -0.17, 0.1, 0.07, 0.22, 0.1, '#2a2a2a');
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; M.seg(V(0, -0.04, 0.64), V(Math.cos(a) * 0.12, -0.04 + Math.sin(a) * 0.12, 0.74), 0.02, 0.012, c, 4); }
    return M;
  },
  scan() { const M = new Mesher(0.05, 8); for (const s of [-1, 1]) { M.add(geo.cyl(8), mat4(s * 0.06, 0, 0.08, 0, 0.09, 0.18, 0.09, Math.PI / 2, 0), '#2a2a32'); M.add(geo.cyl(8), mat4(s * 0.06, 0, 0.18, 0, 0.07, 0.02, 0.07, Math.PI / 2, 0), '#6ab0e0'); } M.box(0, 0, 0.06, 0.08, 0.05, 0.08, '#3a3a44'); return M; },
  cut(c) { const M = new Mesher(0.05, 9); M.box(0, -0.06, 0, 0.05, 0.18, 0.05, '#4a2a1a'); M.add(geo.box(), mat4(0, 0.25, 0.04, 0, 0.03, 0.5, 0.1, 0.1, 0), c); return M; },
  dig(c) { const M = new Mesher(0.05, 10); M.box(0, 0, 0, 0.04, 0.9, 0.04, '#7a5a3a'); M.box(0, -0.5, 0.0, 0.22, 0.25, 0.03, '#8a8a90'); M.box(0, 0.45, 0, 0.16, 0.05, 0.05, '#5a3a20'); void c; return M; },
  light(c) { const M = new Mesher(0.05, 11); M.box(0, -0.1, 0, 0.18, 0.04, 0.18, '#3a3a3a'); M.box(0, -0.06, 0, 0.14, 0.2, 0.14, '#ffe080', 0, { glow: true }); M.box(0, 0.06, 0, 0.18, 0.04, 0.18, '#3a3a3a'); M.add(geo.tor(8, 0.15), mat4(0, 0.13, 0, 0, 0.12, 0.12, 0.12, 0, 0), '#3a3a3a'); void c; return M; },
  photo() { const M = new Mesher(0.05, 12); M.box(0, -0.05, 0, 0.26, 0.16, 0.1, '#2a2a2e'); M.add(geo.cyl(10), mat4(0, -0.05, 0.08, 0, 0.11, 0.08, 0.11, Math.PI / 2, 0), '#4a4a5a'); M.box(0.08, 0.05, 0, 0.06, 0.04, 0.05, '#e8e8e8'); return M; },
  bait(c) { const M = new Mesher(0.08, 13); M.ico(0, 0, 0.05, 0.22, 0.2, 0.22, c, 1); M.ico(0.05, 0.08, 0.06, 0.08, 0.1, 0.06, '#4a8a3a', 0); return M; },
};
const PROJ = {
  lasso(c) { const M = new Mesher(0.05, 21); M.add(geo.tor(18, 0.07), mat4(0, 0, 0, 0, 1.6, 1.6, 1.6, Math.PI / 2, 0), c); return M; },
  bola(c) { const M = new Mesher(0.05, 22); for (const s of [-1, 1]) M.ico(s * 0.6, 0, 0, 0.26, 0.26, 0.26, c); M.box(0, 0, 0, 1.2, 0.03, 0.03, '#d8c890'); return M; },
  net(c) { const M = new Mesher(0.05, 23); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI; M.box(0, 0, 0, 2.2, 0.03, 0.03, '#d8d0a0', a); } M.add(geo.tor(12, 0.05), mat4(0, 0, 0, 0, 2.2, 2.2, 2.2, Math.PI / 2, 0), c); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; M.ico(Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1, 0.14, 0.14, 0.14, '#5a5a5a'); } return M; },
  harpoon(c) { const M = new Mesher(0.05, 24); M.add(geo.cyl(6), mat4(0, 0, 0, 0, 0.08, 1.2, 0.08, Math.PI / 2, 0), c); M.ico(0, 0, 0.65, 0.24, 0.24, 0.3, '#e8e0c8'); return M; },
  skyhook(c) { const M = new Mesher(0.05, 25); M.add(geo.cyl(6), mat4(0, 0, 0, 0, 0.07, 0.6, 0.07, Math.PI / 2, 0), '#5a5a6a'); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; M.seg(V(0, 0, 0.25), V(Math.cos(a) * 0.35, Math.sin(a) * 0.35, 0.05), 0.04, 0.03, c, 4); } return M; },
  bait(c) { const M = new Mesher(0.08, 26); M.ico(0, 0, 0, 0.4, 0.36, 0.4, c, 1); return M; },
};

const cache = new Map();
/** a fresh group with the held model of a tool or item id */
export function holdModel(id) {
  const T = TOOLS[id], I = ITEMS[id];
  const key = 'h:' + id;
  let g = cache.get(key);
  if (!g) {
    const fn = (T && (HOLD[T.model] || HOLD[T.behavior])) || (I && HOLD.bait);
    const M = fn ? fn(T?.color || I?.color || '#888') : new Mesher();
    g = M.geometry(); cache.set(key, g);
  }
  const m = new THREE.Mesh(g, [new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7 }), new THREE.MeshBasicMaterial({ vertexColors: true })]);
  m.castShadow = true;
  return m;
}
export function projectileModel(id) {
  const T = TOOLS[id], I = ITEMS[id];
  const key = 'p:' + id;
  let g = cache.get(key);
  if (!g) { const fn = (T && (PROJ[T.model] || PROJ[T.behavior])) || PROJ.bait; g = fn(T?.color || I?.color || '#c8a060').geometry(); cache.set(key, g); }
  const m = new THREE.Mesh(g, [new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7 }), new THREE.MeshBasicMaterial({ vertexColors: true })]);
  m.castShadow = true;
  return m;
}

/** a rope: a camera-facing ribbon through N points (sagging between two ends) */
export class Rope {
  constructor(scene, color = '#c8a878', width = 0.06, N = 26) {
    this.N = N; this.w = width;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    const idx = []; for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.visible = false;
    scene.add(this.mesh);
    this.pts = Array.from({ length: N }, () => new THREE.Vector3());
  }
  set color(c) { this.mesh.material.color.set(c); }
  /** draw from a to b with `sag` metres of droop in the middle, a little wobble when taut */
  draw(a, b, sag, cam, wobble = 0, t = 0) {
    const N = this.N, P = this.pts;
    for (let i = 0; i < N; i++) {
      const f = i / (N - 1);
      P[i].lerpVectors(a, b, f);
      P[i].y -= Math.sin(f * Math.PI) * sag;
      if (wobble) { P[i].x += Math.sin(f * 9 + t * 30) * wobble * Math.sin(f * Math.PI); P[i].y += Math.cos(f * 7 + t * 26) * wobble * Math.sin(f * Math.PI); }
    }
    const pos = this.mesh.geometry.attributes.position.array, side = new THREE.Vector3(), dir = new THREE.Vector3(), toCam = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const p = P[i], q = P[Math.min(N - 1, i + 1)], o = P[Math.max(0, i - 1)];
      dir.subVectors(q, o).normalize(); toCam.subVectors(cam, p).normalize();
      side.crossVectors(dir, toCam).normalize().multiplyScalar(this.w * 0.5);
      pos[i * 6] = p.x + side.x; pos[i * 6 + 1] = p.y + side.y; pos[i * 6 + 2] = p.z + side.z;
      pos[i * 6 + 3] = p.x - side.x; pos[i * 6 + 4] = p.y - side.y; pos[i * 6 + 5] = p.z - side.z;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.visible = true;
  }
  hide() { this.mesh.visible = false; }
}
