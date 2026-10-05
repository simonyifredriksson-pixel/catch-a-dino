/* ZooArt.js - everything built at the zoo.

   exhibitArt(ex)   ground, fence (a style per habitat: wooden rails, bamboo,
                    stone wall, logs, ice blocks, basalt and lava, an electric
                    predator fence, an aviary dome, an aquatic glass tank),
                    habitat props, a gate gap at the front and a name sign
   decorArt(key)    benches, lamps, bins, flags, statues, fountains, topiary,
                    stalls, the gift shop, the diner, restrooms, the viewing
                    deck, the photo booth, the hatchery, ponds, paths
   zooGate(), rangerStation()   the fixed buildings
   Exhibits are square, `w` metres across, local +z is the front (the gate). */
import * as THREE from '../../lib/three.module.js';
import { Mesher, geo, mat4, signMesh, vcMat, vcGlow } from './Mesher.js';
import { FLORA } from './FloraArt.js';
import { HABITATS, EX_SIZES, DECOR } from '../data/Build.js';
import { rng } from '../core/Util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const shade = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
const floraCache = {};
function flora(k, seed) { const key = k + seed; return floraCache[key] || (floraCache[key] = FLORA[k](seed)); }
/** pour a flora prop into a mesher at (x, y, z) with scale s */
function putFlora(M, k, x, y, z, s, ry) {
  const F = flora(k, 3 + (Math.abs(Math.round(x * 7 + z * 13)) % 3));
  const m = mat4(x, y, z, ry, s, s, s);
  for (let i = 0; i < F.p.length; i += 9) {
    const a = V(F.p[i], F.p[i + 1], F.p[i + 2]).applyMatrix4(m), b = V(F.p[i + 3], F.p[i + 4], F.p[i + 5]).applyMatrix4(m), c = V(F.p[i + 6], F.p[i + 7], F.p[i + 8]).applyMatrix4(m);
    M.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let j = 0; j < 9; j++) M.c.push(F.c[i + j]);
  }
  if (F.gp) { M.gp ||= []; M.gc ||= []; for (let i = 0; i < F.gp.length; i += 3) { const v = V(F.gp[i], F.gp[i + 1], F.gp[i + 2]).applyMatrix4(m); M.gp.push(v.x, v.y, v.z); } M.gc.push(...F.gc); }
}

/** fence segment builders: (M, a, b) along the edge from a to b (local space) */
function fenceRun(M, style, a, b, h) {
  const d = b.clone().sub(a), L = d.length(), ry = Math.atan2(d.x, d.z), n = Math.max(1, Math.round(L / 3));
  const at = t => a.clone().addScaledVector(d, t);
  if (style === 'wood') {
    for (let i = 0; i <= n; i++) { const p = at(i / n); M.box(p.x, 0, p.z, 0.22, 1.6, 0.22, '#8a5a32'); }
    for (const y of [0.55, 1.2]) { const c = at(0.5); M.box(c.x, y, c.z, 0.12, 0.16, L, '#a06a3a', ry); }
  } else if (style === 'bamboo') {
    for (let i = 0; i <= n * 4; i++) { const p = at(i / (n * 4)); M.cyl(p.x, 0, p.z, 0.09, 2 + (i % 3) * 0.2, i % 2 ? '#a8b860' : '#98a850', 6); }
    const c = at(0.5); M.box(c.x, 1.4, c.z, 0.08, 0.08, L, '#7a6a3a', ry);
  } else if (style === 'stone') {
    for (let i = 0; i < n; i++) { const p = at((i + 0.5) / n); M.box(p.x, 0, p.z, 0.8, 1.3 + (i % 2) * 0.15, L / n + 0.05, i % 2 ? '#a8a090' : '#988f80', ry); }
  } else if (style === 'log') {
    for (const y of [0.35, 0.95, 1.55]) { const c = at(0.5); M.add(geo.cyl(7), mat4(c.x, y, c.z, ry, 0.55, L, 0.55, Math.PI / 2, 0), y > 1 ? '#7a5034' : '#6a4630'); }
    for (let i = 0; i <= n; i++) { const p = at(i / n); M.box(p.x, 0, p.z, 0.3, 2, 0.3, '#5a3a24'); }
  } else if (style === 'ice') {
    for (let i = 0; i < n; i++) { const p = at((i + 0.5) / n); M.box(p.x, 0, p.z, 0.9, 1.6 + (i % 3) * 0.3, L / n, i % 2 ? '#cfeefa' : '#b8e2f4', ry); }
  } else if (style === 'metal') {
    for (let i = 0; i <= n; i++) { const p = at(i / n); M.box(p.x, 0, p.z, 0.2, 2.2, 0.2, '#3a3436'); }
    for (const y of [0.4, 1.0, 1.6, 2.1]) { const c = at(0.5); M.box(c.x, y, c.z, 0.08, 0.08, L, '#5a5052', ry); }
    for (let i = 0; i < n; i++) { const p = at((i + 0.5) / n); M.box(p.x, 0, p.z, 0.3, 0.3, L / n * 0.6, '#ff6a2a', ry, { glow: true }); }
  } else if (style === 'electric') {
    for (let i = 0; i <= n; i++) { const p = at(i / n); M.box(p.x, 0, p.z, 0.32, 4.2, 0.32, '#5a6068'); M.box(p.x, 4.2, p.z, 0.5, 0.18, 0.5, '#f0c020'); }
    for (const y of [0.8, 1.8, 2.8, 3.8]) { const c = at(0.5); M.box(c.x, y, c.z, 0.05, 0.05, L, '#d8e0e8', ry); }
    const c = at(0.5); const s = 0.4; M.box(c.x + Math.cos(ry) * 0.2, 2.2, c.z - Math.sin(ry) * 0.2, 0.05, 0.6, 0.9, '#f0c020', ry); void s;
  } else if (style === 'glass') {
    M.box(a.x + d.x * 0.5, 0, a.z + d.z * 0.5, 0.35, 0.6, L, '#6a7a88', ry);
    M.box(a.x + d.x * 0.5, 6, a.z + d.z * 0.5, 0.3, 0.3, L, '#6a7a88', ry);
    for (let i = 0; i <= n; i++) { const p = at(i / n); M.box(p.x, 0, p.z, 0.3, 6.2, 0.3, '#6a7a88'); }
  } else if (style === 'dome') {
    for (let i = 0; i <= n; i++) { const p = at(i / n); M.box(p.x, 0, p.z, 0.18, 3, 0.18, '#4a5a4a'); }
    for (const y of [0.1, 3]) { const c = at(0.5); M.box(c.x, y, c.z, 0.1, 0.1, L, '#4a5a4a', ry); }
  }
  void h;
}

export function exhibitArt(ex) {
  const H = HABITATS[ex.hab], S = EX_SIZES[ex.size], w = S.w, h2 = w / 2;
  const M = new Mesher(0.06, 100 + w), r = rng(ex.id.length * 131 + w);
  // ground plate (raised a hair above the lawn)
  const g0 = H.ground;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const x = -h2 + (i + 0.5) * w / 8, z = -h2 + (j + 0.5) * w / 8;
    M.box(x, -0.2, z, w / 8, 0.32 + r() * 0.05, w / 8, shade(g0, 0.92 + r() * 0.16));
  }
  if (H.water) {
    // the tank: a basin full of water, glass walls
    M.box(0, -0.25, 0, w, 0.35, w, '#2a6a8a');
  }
  if (H.pond) { M.cyl(-w * 0.15, 0.08, -w * 0.12, w * 0.2, 0.05, '#3a8ab0', 18); M.add(geo.tor(18, 0.15), mat4(-w * 0.15, 0.1, -w * 0.12, 0, w * 0.4, w * 0.4, w * 0.4, Math.PI / 2, 0), '#6a5a3a'); }
  if (H.hill) { M.dode(w * 0.15, 0.4, -w * 0.15, w * 0.45, w * 0.18, w * 0.4, '#8a8478', 1); M.dode(w * 0.2, w * 0.12, -w * 0.18, w * 0.25, w * 0.15, w * 0.22, '#9a948a', 2); }
  if (ex.hab === 'volcanic') for (let i = 0; i < 3; i++) M.cyl(-w * 0.25 + i * w * 0.22, 0.08, w * 0.1 * (i % 2 ? -1 : 1), w * 0.06, 0.05, '#ff6a1a', 10, { glow: true });
  // props (keep the middle and the gate clear)
  const props = H.props, np = Math.round(w / 4.5);
  for (let i = 0; i < np; i++) {
    const a = r() * Math.PI * 2, d = h2 * (0.45 + r() * 0.45);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (z > h2 * 0.55 && Math.abs(x) < 5) continue;
    const k = props[i % props.length];
    const s = k === 'jtree' || k === 'araucaria' ? 0.55 + r() * 0.2 : 0.8 + r() * 0.4;
    putFlora(M, k, x, 0.1, z, s, r() * 6);
  }
  // fence (a gap for the gate at the middle of the front)
  const style = H.fence, fh = style === 'electric' ? 4.2 : 1.6;
  const c = [V(-h2, 0, -h2), V(h2, 0, -h2), V(h2, 0, h2), V(-h2, 0, h2)];
  fenceRun(M, style, c[0], c[1], fh); fenceRun(M, style, c[1], c[2], fh); fenceRun(M, style, c[3], c[0], fh);
  if (style === 'glass') fenceRun(M, style, c[2], c[3], fh);
  else { fenceRun(M, style, c[2], V(2.4, 0, h2), fh); fenceRun(M, style, V(-2.4, 0, h2), c[3], fh); M.box(2.6, 0, h2, 0.4, 2.6, 0.4, '#6a4a2a'); M.box(-2.6, 0, h2, 0.4, 2.6, 0.4, '#6a4a2a'); M.box(0, 2.5, h2, 5.6, 0.35, 0.35, '#6a4a2a'); }
  // the aviary dome: arched ribs
  if (style === 'dome') {
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI;
      let prev = null;
      for (let s = 0; s <= 10; s++) {
        const t = s / 10 * Math.PI, R = h2 * 1.05;
        const p = V(Math.cos(t) * R * Math.cos(a), 3 + Math.sin(t) * w * 0.55, Math.cos(t) * R * Math.sin(a));
        if (prev) M.seg(prev, p, 0.09, 0.09, '#4a5a4a', 4);
        prev = p;
      }
    }
    for (let ring = 1; ring < 4; ring++) { const y = 3 + ring * w * 0.13, R = h2 * 1.05 * Math.cos(Math.asin(Math.min(1, (y - 3) / (w * 0.55)))); M.add(geo.tor(24, 0.01), mat4(0, y, 0, 0, R * 2, R * 2, R * 2, Math.PI / 2, 0), '#4a5a4a'); }
  }
  // a little feeder trough
  M.box(-h2 * 0.6, 0, -h2 * 0.6, 2.2, 0.5, 1, '#8a6a3a'); M.box(-h2 * 0.6, 0.45, -h2 * 0.6, 2, 0.1, 0.8, '#7ab040');
  const g = new THREE.Group();
  const mesh = M.mesh({ receive: true }); g.add(mesh);
  if (H.water) {
    const water = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, 5.6, w - 0.6), new THREE.MeshStandardMaterial({ color: '#3aa0d0', transparent: true, opacity: 0.38, roughness: 0.1, depthWrite: false }));
    water.position.y = 2.9; water.renderOrder = 3; g.add(water);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(w, 6, w), new THREE.MeshStandardMaterial({ color: '#c8f0ff', transparent: true, opacity: 0.12, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide }));
    glass.position.y = 3; glass.renderOrder = 4; g.add(glass);
  }
  if (style === 'dome') {
    const net = new THREE.Mesh(new THREE.SphereGeometry(h2 * 1.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#3a4a3a', wireframe: true, transparent: true, opacity: 0.35 }));
    net.scale.y = w * 0.55 / (h2 * 1.05); net.position.y = 3; g.add(net);
  }
  // the name sign by the gate
  const sign = signMesh([ex.name || H.name], 4, 1.1, { bg: '#f6ecd0', fg: '#4a2a10', double: true });
  sign.position.set(4.6, 1.9, h2 + 0.6); g.add(sign);
  const post = new THREE.Mesh(geo.box(), new THREE.MeshStandardMaterial({ color: '#6a4a2a', flatShading: true })); post.scale.set(0.2, 1.8, 0.2); post.position.set(4.6, 0.9, h2 + 0.55); g.add(post);
  return g;
}

/* ---------------- decor ---------------- */
const DECO = {
  bench(M) { M.box(0, 0.42, 0, 1.8, 0.1, 0.55, '#a06a3a'); M.box(0, 0.75, -0.24, 1.8, 0.4, 0.08, '#a06a3a'); for (const x of [-0.75, 0.75]) M.box(x, 0, 0, 0.1, 0.45, 0.5, '#3a3a3a'); },
  lamp(M) { M.cyl(0, 0, 0, 0.08, 3.4, '#2a3a2a', 6); M.box(0, 3.3, 0, 0.5, 0.5, 0.5, '#ffe8a0', 0, { glow: true }); M.cone(0, 3.55, 0, 0.42, 0.4, '#2a3a2a', 4); },
  bin(M) { M.frust(0, 0, 0, 0.32, 0.36, 0.8, '#3a7a4a', 8); M.cyl(0, 0.8, 0, 0.38, 0.06, '#2a5a3a', 8); },
  flag(M) { M.cyl(0, 0, 0, 0.06, 5, '#d8d8d8', 6); M.tri(V(0, 4.9, 0), V(0, 3.9, 0), V(1.6, 4.4, 0), '#e8503a', { double: true }); M.tri(V(0, 4.3, 0), V(0, 3.9, 0), V(1.0, 4.1, 0), '#f0c040', { double: true }); },
  fountain(M) { M.cyl(0, 0, 0, 2.6, 0.6, '#b8b4a8', 16); M.cyl(0, 0.55, 0, 2.3, 0.05, '#4aa8d8', 16); M.cyl(0, 0, 0, 0.35, 1.8, '#a8a498', 8); M.cyl(0, 1.8, 0, 0.9, 0.2, '#b8b4a8', 10); M.cone(0, 2, 0, 0.3, 0.8, '#7ad0f0', 6); },
  balloon(M) { M.box(0, 0, 0, 1.2, 1.1, 0.8, '#f0e0c8'); M.box(0, 1.1, 0, 1.3, 0.1, 0.9, '#e85a7a'); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; M.seg(V(0, 1.2, 0), V(Math.cos(a) * 0.5, 2.6 + (i % 2) * 0.4, Math.sin(a) * 0.5), 0.01, 0.01, '#ffffff', 3); M.ico(Math.cos(a) * 0.5, 2.8 + (i % 2) * 0.4, Math.sin(a) * 0.5, 0.5, 0.6, 0.5, ['#ff5a7a', '#5ab0ff', '#ffd040', '#6ae07a', '#c070ff', '#ff9a40'][i], 1); } },
  food(M) { stall(M, '#e8503a', '#fff4e0'); },
  drinks(M) { stall(M, '#3a8ae8', '#e8f4ff'); },
  photo(M) { M.box(0, 0, 0, 1.6, 2.2, 1.4, '#f0c040'); M.box(0, 0.6, 0.71, 1.2, 1.4, 0.04, '#2a2a2a'); M.box(0, 2.2, 0, 1.8, 0.2, 1.6, '#e85a3a'); },
  toilet(M) { M.box(0, 0, 0, 4, 2.8, 3, '#d8e0e8'); M.roof(0, 2.8, 0, 4.4, 3.4, 1.2, '#4a7ab0', Math.PI / 2); for (const x of [-1, 1]) M.box(x, 0, 1.52, 0.9, 2, 0.06, '#5a6a7a'); },
  gift(M) {
    M.box(0, 0, 0, 7, 3.6, 5, '#f4e0b8'); M.roof(0, 3.6, 0, 7.6, 5.6, 2.2, '#c84a3a', Math.PI / 2);
    M.box(0, 0, 2.52, 2, 2.4, 0.06, '#6a4a2a'); for (const x of [-2.4, 2.4]) M.box(x, 0.9, 2.52, 1.6, 1.3, 0.06, '#8ad0f0');
    M.box(0, 0, 3.4, 7.2, 0.08, 1.6, '#e8b830'); for (const x of [-3.4, 3.4]) M.box(x, 0, 3.9, 0.15, 2.6, 0.15, '#6a4a2a'); M.box(0, 2.6, 3.9, 7.2, 0.25, 1.4, '#2a9a5a');
  },
  cafe(M) {
    M.box(0, 0, 0, 10, 4.2, 7, '#f0e8d8'); M.box(0, 4.2, 0, 10.6, 0.5, 7.6, '#3a8a4a');
    M.box(0, 0, 3.52, 2.4, 2.8, 0.06, '#5a3a24'); for (const x of [-3.5, 3.5]) M.box(x, 1.1, 3.52, 2.6, 1.8, 0.06, '#8ad0f0');
    for (const [x, z] of [[-3, 6], [0, 6.5], [3, 6]]) { M.cyl(x, 0, z, 0.6, 0.75, '#e8e8e8', 10); M.cyl(x, 0.75, z, 0.05, 1.6, '#c8c8c8', 4); M.cone(x, 2.2, z, 1.4, 0.6, ['#e8503a', '#f0c040', '#3a8ae8'][(x + 3) / 3], 8); }
  },
  platform(M) {
    M.box(0, 2.6, 0, 6, 0.3, 5, '#9a6a3a');
    for (const [x, z] of [[-2.8, -2.3], [2.8, -2.3], [-2.8, 2.3], [2.8, 2.3]]) M.box(x, 0, z, 0.3, 2.6, 0.3, '#7a4a2a');
    for (const z of [-2.4, 2.4]) M.box(0, 3.4, z, 6, 0.1, 0.1, '#7a4a2a'); M.box(-2.9, 3.4, 0, 0.1, 0.1, 4.8, '#7a4a2a'); M.box(2.9, 3.4, 0, 0.1, 0.1, 4.8, '#7a4a2a');
    for (let s = 0; s < 6; s++) M.box(0, s * 0.45, 2.6 + 0.5 + s * 0.5 * -1 + 3, 1.6, 0.12, 0.5, '#8a5a32');
  },
  hatchery(M) {
    M.cyl(0, 0, 0, 4, 0.6, '#c8c0b0', 16); M.cyl(0, 0.6, 0, 3.6, 2.6, '#e8e0d0', 16);
    M.add(geo.sph(16, 8), mat4(0, 3.2, 0, 0, 7.2, 4.4, 7.2), '#bfe8f8');
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; M.ico(Math.cos(a) * 2, 3.6, Math.sin(a) * 2, 0.7, 0.95, 0.7, ['#e8dcb8', '#d8e8c8', '#f0d8c8', '#e8d0e8', '#d0e0f0'][i], 1); }
    M.box(0, 0.6, 3.62, 1.6, 2.2, 0.06, '#6a4a2a'); M.box(0, 3.2, 3.6, 0.6, 0.6, 0.1, '#ffd040', 0, { glow: true });
  },
  statue(M) { M.box(0, 0, 0, 2.6, 1, 2.6, '#a8a498'); },
  topiary(M) { M.cyl(0, 0, 0, 1.2, 0.5, '#8a6a4a', 10); },
  pond(M) { M.cyl(0, 0.02, 0, 3, 0.06, '#3a8ab0', 20); M.add(geo.tor(20, 0.18), mat4(0, 0.06, 0, 0, 6.2, 6.2, 6.2, Math.PI / 2, 0), '#8a8478'); for (let i = 0; i < 4; i++) M.cyl(Math.cos(i * 1.7) * 1.6, 0.07, Math.sin(i * 1.7) * 1.6, 0.35, 0.02, '#5a9a3a', 8); },
  path(M) { M.box(0, -0.12, 0, 4, 0.2, 4, '#d8c8a0'); for (let i = 0; i < 4; i++) M.box(-1.5 + i, -0.05, (i % 2) * 0.8 - 0.4, 0.8, 0.14, 0.8, '#c8b890'); },
  path2(M) { M.box(0, -0.12, 0, 4, 0.2, 4, '#a8a498'); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) M.box(-1 + i * 2, -0.04, -1 + j * 2, 1.85, 0.14, 1.85, (i + j) % 2 ? '#b8b4a8' : '#9a968c'); },
};
function stall(M, roof, wall) {
  M.box(0, 0, 0, 3, 2.2, 2.2, wall); M.box(0, 1.0, 1.11, 2.6, 0.1, 0.3, '#a06a3a');
  for (let i = 0; i < 6; i++) M.box(-1.25 + i * 0.5, 2.2, 0.4, 0.5, 0.25, 2.8, i % 2 ? roof : '#ffffff', 0, { jit: 0.02 });
  M.box(0, 2.45, -0.6, 3.1, 0.6, 0.1, roof);
}
export function decorArt(k, game) {
  const D = DECOR[k];
  const g = new THREE.Group();
  if (D.flora) { const M = new Mesher(0.06, 9); putFlora(M, D.flora, 0, 0, 0, k === 'jtree' ? 0.6 : 1, 0); g.add(M.mesh()); return g; }
  const M = new Mesher(0.05, 11);
  (DECO[D.art] || DECO.bench)(M);
  g.add(M.mesh({ receive: true }));
  if (k === 'statue' || k === 'topiary') {
    // a real creature model as a stone statue / a hedge
    const sp = k === 'statue' ? 'trex' : 'stego';
    import('./CreatureArt.js').then(({ creatureTemplate }) => import('../data/Species.js').then(({ SP, VARIANTS }) => import('./Rig.js').then(({ instantiate }) => {
      const T = creatureTemplate(SP[sp], null, VARIANTS); const I = instantiate(T);
      I.mesh.material = new THREE.MeshStandardMaterial({ color: k === 'statue' ? '#b8b4a8' : '#3a8a3a', flatShading: true, roughness: 0.9 });
      const s = 3.0 / Math.max(T.meta.dims.len, T.meta.dims.height);
      I.mesh.scale.setScalar(s); I.mesh.position.y = k === 'statue' ? 1 : 0.5; I.mesh.rotation.y = 0.5;
      g.add(I.mesh);
    })));
  }
  if (D.cat === 'shop' && k !== 'platform' && k !== 'hatchery') {
    const txt = { food: 'SNACKS', drinks: 'DRINKS', gift: 'GIFT SHOP', cafe: 'DINO DINER', toilet: 'WC', photo: 'PHOTOS' }[k];
    if (txt) { const s = signMesh([txt], k === 'cafe' ? 5 : k === 'gift' ? 4 : 2.4, 0.8, { bg: '#fff4d8', fg: '#c83a2a', double: true }); s.position.set(0, k === 'cafe' ? 5 : k === 'gift' ? 4.6 : 3.1, k === 'cafe' ? 3.7 : k === 'gift' ? 2.7 : 1.2); g.add(s); }
  }
  void game;
  return g;
}

/* ---------------- the fixed buildings ---------------- */
export function zooGate() {
  const M = new Mesher(0.05, 201);
  for (const x of [-7, 7]) { M.box(x, 0, 0, 2.2, 8, 2.2, '#8a5a32'); M.cone(x, 8, 0, 1.8, 2.4, '#3a8a4a', 6); }
  M.box(0, 6.4, 0, 16, 1.6, 1.2, '#a06a3a');
  // a big brachiosaurus-shaped silhouette on top
  M.box(0, 8, 0, 4, 1.6, 0.4, '#3a6a3a'); M.seg(V(1.6, 8.8, 0), V(3.6, 12, 0), 0.4, 0.3, '#3a6a3a', 6); M.ico(3.9, 12.2, 0, 1.2, 0.7, 0.6, '#3a6a3a'); M.seg(V(-1.8, 8.6, 0), V(-4.4, 7.6, 0), 0.35, 0.1, '#3a6a3a', 5);
  for (const x of [-1.2, 1.2]) M.box(x, 7.2, 0, 0.4, 1, 0.4, '#3a6a3a');
  // ticket booths
  for (const x of [-11, 11]) { M.box(x, 0, 1, 3, 2.6, 2.4, '#f0e0c0'); M.roof(x, 2.6, 1, 3.4, 2.8, 1.2, '#c84a3a', Math.PI / 2); M.box(x, 1.1, 2.22, 1.6, 0.9, 0.05, '#8ad0f0'); }
  const g = new THREE.Group(); g.add(M.mesh());
  const s = signMesh(['CATCH A DINO', 'ZOO'], 13, 1.5, { bg: '#ffe9b0', fg: '#3a6a2a', big: 1.2, double: true, borderColor: '#7a4a1a' });
  s.position.set(0, 6.4, 0.65); g.add(s);
  const s2 = s.clone(); s2.position.z = -0.65; s2.rotation.y = Math.PI; g.add(s2);
  return g;
}
export function rangerStation() {
  const M = new Mesher(0.05, 202);
  M.box(0, 0, 0, 9, 0.6, 7, '#7a5a3a');
  M.box(0, 0.6, 0, 8, 3.4, 6, '#a07048');
  for (let i = 0; i < 6; i++) M.box(-4.02, 0.8 + i * 0.55, 0, 0.06, 0.06, 6, '#7a5030');
  M.roof(0, 4, 0, 9.4, 7.6, 2.6, '#4a7a3a', Math.PI / 2);
  M.box(0, 0.6, 3.02, 1.8, 2.5, 0.06, '#5a3a24'); for (const x of [-2.6, 2.6]) M.box(x, 1.6, 3.02, 1.8, 1.2, 0.06, '#8ad0f0');
  M.box(0, 0.6, 4.6, 9, 0.2, 3, '#8a6a42'); for (const x of [-4.2, 4.2]) M.box(x, 0.6, 5.8, 0.2, 2.6, 0.2, '#6a4a2a'); M.box(0, 3.1, 5.4, 9, 0.2, 2, '#4a7a3a');
  M.box(3.6, 0.8, 5.2, 1.2, 0.9, 0.8, '#7a4a2a'); M.box(3.6, 1.7, 5.2, 1.0, 0.5, 0.6, '#c8a060');   // crates
  const g = new THREE.Group(); g.add(M.mesh());
  const s = signMesh(['RANGER STATION'], 6, 1, { bg: '#f6ecd0', fg: '#2a5a2a', double: true }); s.position.set(0, 4.2, 6.3); g.add(s);
  return g;
}
export { putFlora, vcMat, vcGlow };
