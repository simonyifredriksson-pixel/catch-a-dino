/* Terrain.js - the continent as one heightfield.

   Heights are sampled once onto a 6 m grid at load (deterministic from the
   seed) and every query after that (`ground`) interpolates the SAME
   triangles the mesh draws, so feet never float or sink. The mesh is cut
   into 192 m chunks with one flat-shaded, vertex-coloured draw call each;
   every triangle gets its own slightly shifted shade, which is the
   faceted, hand-painted look.

   Shape: the biome blobs in data/Biomes.js are blended into a base height,
   then the set pieces are cut in on top: the zoo plateau, the Giant River's
   gorge, the desert mesas, Mount Cinder and its crater, the Lost Valley's
   cliff bowl and its blocked pass, the islands and the ocean trench. */
import * as THREE from '../../lib/three.module.js';
import { Noise2D } from '../core/Noise.js';
import { clamp, lerp, smoothstep, hash3 } from '../core/Util.js';
import { BIOMES, REGIONS, ZOO, RIVERS, MESAS, VOLCANO, VALLEY, ISLANDS, TRENCH, WORLD_HALF, WHITEOUT, HOME, LAGOON } from '../data/Biomes.js';
const wrapA = a => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };

export const CELL = 6;
export const N = Math.round(WORLD_HALF * 2 / CELL) + 1;
const CH = 32;   // cells per chunk side
export const BIOME_IDS = Object.keys(BIOMES);
const BI = Object.fromEntries(BIOME_IDS.map((k, i) => [k, i]));

const _c = new THREE.Color(), _c2 = new THREE.Color();

/** distance from p to a polyline, with the fraction along it */
function polyDist(px, pz, pts) {
  let best = Infinity, bt = 0, total = 0;
  const lens = [];
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); lens.push(l); total += l; }
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = clamp(((px - ax) * dx + (pz - az) * dz) / L2, 0, 1);
    const d = Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
    if (d < best) { best = d; bt = (acc + lens[i] * t) / total; }
    acc += lens[i];
  }
  return { d: best, t: bt };
}

export class Terrain {
  constructor(seed = 20261005) {
    this.n = new Noise2D(seed);
    this.n2 = new Noise2D(seed + 77);
    this.H = new Float32Array(N * N);
    this.B = new Uint8Array(N * N);       // dominant biome per vertex
    this.holes = new Set();               // quads not drawn (cave mouths): i * N + j
    this.mods = [];                       // extra flatten / carve pads from landmarks
    this.lavaPools = [];
  }

  /* ---------------- the shape ---------------- */
  /** the Lost Valley's pass: a narrow canyon from the valley south-east toward the Elderwood */
  static PASS = [[VALLEY.x + 50, VALLEY.z + 95], [VALLEY.x + 95, VALLEY.z + 150], [VALLEY.x + 150, VALLEY.z + 205]];

  /** where the mainland starts at bearing th (0 north, +pi/2 east), and how open to the sea that side is */
  shoreAt(th) {
    const n = this.n, nA = n.noise(Math.cos(th) * 2.2 + 5, Math.sin(th) * 2.2 - 3), nB = this.n2.noise(Math.cos(th) * 6 + 1, Math.sin(th) * 6 + 4);
    const open = Math.exp(-Math.pow(wrapA(th + Math.PI / 2) / 0.75, 2));
    return { rc: LAGOON.r + 70 * nA + 30 * nB + open * 1300, open };
  }
  _raw(x, z) {
    const n = this.n, n2 = this.n2;
    const wx = x + n.noise(x * 0.0021, z * 0.0021) * 70, wz = z + n.noise(x * 0.0021 + 50, z * 0.0021 - 30) * 70;
    const f = n.fbm(x * 0.006, z * 0.006, 4);
    const rd = n2.ridged(x * 0.0042, z * 0.0042, 5);
    const dn = Math.sin((x * 0.6 + z * 0.8) * 0.045 + n.noise(x * 0.01, z * 0.01) * 2.5) * 0.6 + n2.fbm(x * 0.015, z * 0.015, 2) * 0.4;
    let sw = 0, sh = 0;
    let wBest = 0, bBest = 'meadow';
    for (const [b, cx, cz, r, h, a, kind, sx = 1] of REGIONS) {
      if (r < 2) continue;
      const d = Math.hypot((wx - cx) / sx, wz - cz) / r;
      const w = Math.exp(-d * d * 2.4) + 1e-6;
      let det;
      if (kind === 'roll') det = f * a;
      else if (kind === 'hill') det = (f * 0.6 + rd * 0.7 - 0.25) * a;
      else if (kind === 'dune') det = (dn * 0.7 + f * 0.3) * a;
      else if (kind === 'ridge') det = (Math.pow(rd, 1.6) - 0.15) * a + f * 18;
      else det = f * a;
      sw += w; sh += w * (h + det);
      if (w > wBest) { wBest = w; bBest = b; }
    }
    const landH = sh / sw;
    let biome = bBest;
    // ---- the mainland begins at the lagoon's far shore (open to the sea in the west)
    const d0 = Math.hypot(x - HOME.x, z - HOME.z), th = Math.atan2(x - HOME.x, -(z - HOME.z));
    const { rc, open } = this.shoreAt(th);
    const main = smoothstep(rc - 30, rc + 40, d0);
    const ramp = smoothstep(rc - 10, rc + 170, d0);
    const mainH = 2.2 + (landH - 2.2) * ramp + f * 2 * ramp;
    // ---- the water: the lagoon is shallow by the shores and deepest mid-way; the open sea gets deep fast
    let sea = -5 - 19 * smoothstep(HOME.r + 15, HOME.r + 120, d0) * (1 - smoothstep(Math.min(rc, LAGOON.r + 60) - 130, Math.min(rc, LAGOON.r + 60) - 20, d0)) + f * 3;
    const ocean = -22 - 70 * smoothstep(LAGOON.r + 150, 950, d0) + f * 6;
    const toSea = smoothstep(LAGOON.r - 40, LAGOON.r + 220, d0) * smoothstep(0.15, 0.6, open);
    sea = lerp(sea, ocean, toSea);
    const edge = Math.max(Math.abs(x), Math.abs(z));
    sea -= 40 * smoothstep(1100, 1190, edge);
    const td = Math.hypot((x - TRENCH.x) / TRENCH.a, (z - TRENCH.z) / TRENCH.b);
    if (td < 1.4) sea = lerp(sea, TRENCH.depth + f * 10, smoothstep(1.4, 0.55, td));
    let h = lerp(sea, mainH, main);
    if (main < 0.5) biome = toSea > 0.5 ? (h < -45 ? 'deep' : 'ocean') : 'lake';
    else if (main < 0.985 && h < 3.2 && h > -3 && biome !== 'swamp') biome = 'beach';
    if (biome === 'beach' && h > 3.2) biome = 'meadow';
    // ---- Home Island: a big round island in the middle of the lagoon
    {
      const di = d0 + n.noise(x * 0.009 + 11, z * 0.009) * 24;
      const isl = smoothstep(HOME.r + 12, HOME.r - 42, di);
      if (isl > 0) {
        const ih = 2.5 + 10 * smoothstep(HOME.r, HOME.r * 0.45, di) + f * 3 + rd * 5 * smoothstep(HOME.r * 0.95, HOME.r * 0.55, di);
        h = lerp(h, Math.max(h, ih), isl);
        if (isl > 0.5) biome = h < 3.2 ? 'beach' : 'home';
      }
    }
    // islands
    for (const I of ISLANDS) {
      const d = Math.hypot(x - I.x, z - I.z) / I.r;
      if (d < 2.2) {
        const bump = I.h * Math.exp(-d * d * 1.6) + f * 3 * smoothstep(1.2, 0.2, d);
        const isle = lerp(h, Math.max(h, -4 + bump + 4 * smoothstep(1.4, 0.7, d)), smoothstep(2.2, 0.9, d));
        h = Math.max(h, isle);
        if (d < 1.05) biome = h < 3.2 ? 'beach' : I.id === 'reef' ? 'beach' : I.id;
      }
    }
    // Skull Isle: a jagged crown of rock in the middle
    { const S = ISLANDS[1], d = Math.hypot(x - S.x, z - S.z); if (d < 60) h += Math.pow(smoothstep(60, 10, d), 2) * (28 + rd * 30); }
    // the zoo plateau: a flat, rounded square
    {
      const dx = Math.max(0, Math.abs(x - ZOO.x) - ZOO.half), dz = Math.max(0, Math.abs(z - ZOO.z) - ZOO.half);
      const d = Math.hypot(dx, dz);
      h = lerp(ZOO.y, h, smoothstep(0, 70, d));
      if (d < 4) biome = 'home';
    }
    // rivers: from the regions down into the lagoon (deep enough to swim up)
    for (const RV of RIVERS) {
      const { d, t } = polyDist(x, z, RV.pts);
      const w = lerp(RV.w0, RV.w1, t * t) + n.noise(x * 0.01, z * 0.01) * 5;
      const bank = 14 + 30 * (1 - t) + Math.max(0, h) * 0.25;
      if (d < w + bank) {
        const bed = -4.5 - 3 * smoothstep(w, 0, d);
        const k = smoothstep(w * 0.5 + bank, w * 0.5, d);
        h = lerp(h, Math.min(h, bed), k);
      }
    }
    // desert mesas: cliffs with flat tops
    for (const [mx, mz, mr, mh] of MESAS) {
      const d = Math.hypot(x - mx, z - mz) + n.noise(x * 0.05, z * 0.05) * 5;
      if (d < mr + 14) {
        const k = smoothstep(mr + 6, mr - 3, d);
        const top = ZOO.y + mh + f * 2;
        h = Math.max(h, lerp(h, top, k));
        // a scree skirt at the bottom
        h += smoothstep(mr + 14, mr + 4, d) * (1 - k) * 6;
      }
    }
    // Mount Cinder
    {
      const V = VOLCANO, d = Math.hypot(x - V.x, z - V.z);
      if (d < V.r) {
        const cone = V.h * Math.pow(1 - d / V.r, 1.25) + rd * 14 * (d / V.r);
        h = Math.max(h, lerp(h, cone, smoothstep(V.r, V.r * 0.55, d)));
        if (d < V.crater * 1.4) h = lerp(h, V.lava - 8 + d * 0.15, smoothstep(V.crater * 1.25, V.crater * 0.8, d));
        if (d < V.r * 0.8) biome = 'volcano';
      }
    }
    // the Lost Valley: a deep bowl in the peaks, one blocked pass to the south
    {
      const L = VALLEY, d = Math.hypot(x - L.x, z - L.z) + n.noise(x * 0.03, z * 0.03) * 8;
      if (d < L.r + 40) {
        const k = smoothstep(L.r + 4, L.r - 18, d);
        const rim = 95 + rd * 30;
        h = lerp(Math.max(h, rim * smoothstep(L.r + 40, L.r + 6, d) + h * (1 - smoothstep(L.r + 40, L.r + 6, d))), L.floor + f * 5, k);
        if (d < L.r - 6) biome = 'valley';
      }
      const P = polyDist(x, z, Terrain.PASS);
      if (P.d < 22 && d > L.r - 30) {
        const floor = lerp(L.floor + 2, 26, P.t);
        h = lerp(h, Math.min(h, floor), smoothstep(16, 7, P.d));
      }
    }
    // landmark pads
    for (const m of this.mods) {
      const d = Math.hypot(x - m.x, z - m.z);
      if (d < m.r + m.blend) {
        const k = smoothstep(m.r + m.blend, m.r, d);
        if (m.kind === 'flat') h = lerp(h, m.y, k);
        else if (m.kind === 'raise') h = Math.max(h, lerp(h, m.y, k));
        else if (m.kind === 'carve') h = Math.min(h, lerp(h, m.y, k));
      }
    }
    return { h, biome };
  }

  /* ---------------- build ---------------- */
  generate() {
    const H = this.H, B = this.B;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = -WORLD_HALF + i * CELL, z = -WORLD_HALF + j * CELL;
      const r = this._raw(x, z);
      H[i * N + j] = r.h; B[i * N + j] = BI[r.biome];
    }
  }

  /** the exact height of the drawn triangles (or a cave floor, out past the map edge) */
  ground(x, z) {
    if (x > WORLD_HALF + 200) return this.caveFloor(x, z);
    const gx = (x + WORLD_HALF) / CELL, gz = (z + WORLD_HALF) / CELL;
    let i = Math.floor(gx), j = Math.floor(gz);
    if (i < 0 || j < 0 || i >= N - 1 || j >= N - 1) return -60;
    const fx = gx - i, fz = gz - j, H = this.H;
    const a = H[i * N + j], b = H[(i + 1) * N + j], c = H[i * N + j + 1], d = H[(i + 1) * N + j + 1];
    return fx > fz ? a + (b - a) * fx + (d - b) * fz : a + (c - a) * fz + (d - c) * fx;
  }
  /** ground normal (approx, from neighbours) */
  normal(x, z, out = new THREE.Vector3()) {
    const e = 2.5;
    const hx = this.ground(x + e, z) - this.ground(x - e, z), hz = this.ground(x, z + e) - this.ground(x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  }
  slope(x, z) { return 1 - this.normal(x, z, _n).y; }
  /** interiors (caves, vaults) live out past the east edge; their floors rise into walls at the rim */
  caveFloor(x, z) {
    for (const I of this.interiors || []) {
      const d = Math.hypot(x - I.x, z - I.z);
      if (d < I.r + 30) {
        const bump = this.n.noise(x * 0.09, z * 0.09) * 0.5;
        return I.floor + bump + (d > I.r - 5 ? (d - (I.r - 5)) * 4 : 0);
      }
    }
    return 300;
  }
  interiorAt(x, z) {
    if (x < WORLD_HALF + 200) return null;
    for (const I of this.interiors || []) if (Math.hypot(x - I.x, z - I.z) < I.r + 30) return I;
    return null;
  }
  biome(x, z) {
    if (x > WORLD_HALF + 200) return 'cave';
    const i = clamp(Math.round((x + WORLD_HALF) / CELL), 0, N - 1), j = clamp(Math.round((z + WORLD_HALF) / CELL), 0, N - 1);
    return BIOME_IDS[this.B[i * N + j]];
  }
  /** surface of the water here, or -Infinity if this is dry land */
  waterAt(x, z) { return this.ground(x, z) < 0.05 ? 0 : -Infinity; }
  depth(x, z) { return Math.max(0, -this.ground(x, z)); }
  inWhiteout(x, z) { return Math.hypot(x - WHITEOUT.x, z - WHITEOUT.z) < WHITEOUT.r; }

  /* ---------------- colour ---------------- */
  _color(i, j, out) {
    const H = this.H, h = H[i * N + j];
    const x = -WORLD_HALF + i * CELL, z = -WORLD_HALF + j * CELL;
    const b = BIOME_IDS[this.B[i * N + j]];
    const at = (a, c) => H[clamp(a, 0, N - 1) * N + clamp(c, 0, N - 1)];
    const sl = Math.hypot(at(i + 1, j) - at(i - 1, j), at(i, j + 1) - at(i, j - 1)) / (2 * CELL);
    const G = BIOMES[b].ground;
    out.set(G[Math.floor(hash3(i, j, 3) * 3)]);
    // blend toward neighbouring biomes a little for soft borders
    const bn = BIOME_IDS[this.B[clamp(i + 3, 0, N - 1) * N + clamp(j + 2, 0, N - 1)]];
    if (bn !== b) out.lerp(_c2.set(BIOMES[bn].ground[0]), 0.35);
    const nz = this.n.noise(x * 0.02, z * 0.02);
    if (b === 'meadow' || b === 'home' || b === 'jungle' || b === 'valley' || b === 'isle') {
      out.offsetHSL(nz * 0.03, 0, nz * 0.04);
      // big soft patches: darker clover, sun-bleached grass, the odd flower field
      const pz = this.n2.noise(x * 0.008 + 3, z * 0.008 - 7);
      if (pz > 0.35) out.lerp(_c2.set('#6aa040'), (pz - 0.35) * 0.8);
      else if (pz < -0.4) out.lerp(_c2.set('#b8c868'), (-0.4 - pz) * 0.7);
    }
    // sea bed: sand in the shallows going blue-grey in the deep
    if (h < -0.5) {
      out.set(h > -10 ? '#e2d29a' : h > -40 ? '#b8b090' : '#4a6078');
      if (h < -10 && h > -40) out.lerp(_c2.set('#7a9a8a'), smoothstep(-10, -40, h));
      if (h < -120) out.lerp(_c2.set('#22344a'), smoothstep(-120, -220, h));
    } else if (h < 1.6 && b !== 'swamp') out.lerp(_c2.set('#efd99c'), 0.85);   // shore sand
    if (b === 'swamp' && h < 1.2) out.lerp(_c2.set('#4a5530'), 0.6);
    // cliffs: rock, and in the desert, layered red strata
    if (sl > 0.75 && h > 1) {
      if (b === 'desert' || (Math.abs(x - 760) < 300 && Math.abs(z - 160) < 300)) {
        const band = Math.floor((h + nz * 2) / 3.2) % 4;
        out.set(['#c8844e', '#b66e40', '#d8a066', '#a85e3a'][band]);
      } else if (b === 'volcano') out.set(hash3(i, j) < 0.5 ? '#2e2624' : '#3a302c');
      else if (b === 'tundra') out.set(hash3(i, j) < 0.5 ? '#9aa8b4' : '#b8c4cc');
      else out.lerp(_c2.set(hash3(i, j, 9) < 0.5 ? '#7d7a72' : '#8d887e'), smoothstep(0.75, 1.3, sl));
    }
    // snow on the high peaks (and everywhere in the tundra)
    if (h > 150 + nz * 20 && sl < 1.4) out.lerp(_c2.set('#f4f8fb'), smoothstep(150, 175, h + nz * 20));
    // the volcano's upper slopes are ash; the crater glows
    if (b === 'volcano') {
      const d = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
      if (d < VOLCANO.crater * 1.3) out.lerp(_c2.set('#5a2a1a'), 0.6);
    }
    // the zoo plateau gets a neat lawn
    if (Math.abs(x - ZOO.x) < ZOO.half + 2 && Math.abs(z - ZOO.z) < ZOO.half + 2) out.set(hash3(i, j, 5) < 0.5 ? '#92ca5c' : '#8ac255');
    return out;
  }

  buildMeshes(scene) {
    this.chunks = [];
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0 });
    this.material = mat;
    const C = new Float32Array(N * N * 3);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { this._color(i, j, _c); C[(i * N + j) * 3] = _c.r; C[(i * N + j) * 3 + 1] = _c.g; C[(i * N + j) * 3 + 2] = _c.b; }
    const H = this.H;
    const nc = Math.ceil((N - 1) / CH);
    for (let ci = 0; ci < nc; ci++) for (let cj = 0; cj < nc; cj++) {
      const pos = [], col = [];
      const i0 = ci * CH, j0 = cj * CH, i1 = Math.min(N - 1, i0 + CH), j1 = Math.min(N - 1, j0 + CH);
      let minY = Infinity, maxY = -Infinity;
      const put = (i, j, k) => {
        pos.push(-WORLD_HALF + i * CELL, H[i * N + j], -WORLD_HALF + j * CELL);
        col.push(C[(i * N + j) * 3] * k, C[(i * N + j) * 3 + 1] * k, C[(i * N + j) * 3 + 2] * k);
      };
      for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) {
        if (this.holes.has(i * N + j)) continue;
        // each triangle gets one colour (the average of its corners, jittered): the faceted look
        const tri = (a, b, c, salt) => {
          const k = 0.93 + hash3(i, j, salt) * 0.14;
          const idx = [a, b, c];
          let r = 0, g = 0, bl = 0;
          for (const [ii, jj] of idx) { r += C[(ii * N + jj) * 3]; g += C[(ii * N + jj) * 3 + 1]; bl += C[(ii * N + jj) * 3 + 2]; }
          for (const [ii, jj] of idx) {
            pos.push(-WORLD_HALF + ii * CELL, H[ii * N + jj], -WORLD_HALF + jj * CELL);
            col.push(r / 3 * k, g / 3 * k, bl / 3 * k);
            const y = H[ii * N + jj]; if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        };
        // split along the a-d diagonal, matching ground()
        tri([i, j], [i, j + 1], [i + 1, j + 1], 1);
        tri([i, j], [i + 1, j + 1], [i + 1, j], 2);
      }
      void put;
      if (!pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.computeVertexNormals();
      g.computeBoundingSphere(); g.computeBoundingBox();
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true; m.castShadow = true;
      m.matrixAutoUpdate = false; m.updateMatrix();
      m.userData.cx = -WORLD_HALF + (i0 + i1) / 2 * CELL; m.userData.cz = -WORLD_HALF + (j0 + j1) / 2 * CELL;
      scene.add(m);
      this.chunks.push(m);
    }
  }

  /** cut a hole in the drawn ground (a cave mouth) - quads whose centre is inside the circle */
  hole(x, z, r) {
    for (let i = 0; i < N - 1; i++) for (let j = 0; j < N - 1; j++) {
      const cx = -WORLD_HALF + (i + 0.5) * CELL, cz = -WORLD_HALF + (j + 0.5) * CELL;
      if (Math.hypot(cx - x, cz - z) < r) this.holes.add(i * N + j);
    }
  }

  /** hide chunks far from the camera (fog hides the edge) */
  cull(cam, far) {
    for (const m of this.chunks) m.visible = Math.hypot(m.userData.cx - cam.x, m.userData.cz - cam.z) < far + 140;
  }
}
const _n = new THREE.Vector3();
