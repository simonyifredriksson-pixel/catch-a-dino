/* Mesher.js - static low-poly geometry.
   Primitives are poured into a Mesher and flattened into one non-indexed,
   vertex-coloured geometry; every triangle gets its own slightly shifted
   shade (the faceted, hand-painted look). Used for plants, rocks, buildings,
   fences - anything that does not bend. */
import * as THREE from '../../lib/three.module.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _v = new THREE.Vector3(), _c = new THREE.Color();

export function mat4(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
  return _m.clone().compose(_p, _q, _s);
}
const G = {};
export const geo = {
  box: () => G.box || (G.box = new THREE.BoxGeometry(1, 1, 1)),
  cyl: (n = 8) => G['c' + n] || (G['c' + n] = new THREE.CylinderGeometry(0.5, 0.5, 1, n)),
  cone: (n = 6) => G['k' + n] || (G['k' + n] = new THREE.ConeGeometry(0.5, 1, n)),
  ico: (d = 0) => G['i' + d] || (G['i' + d] = new THREE.IcosahedronGeometry(0.5, d)),
  dode: () => G.dode || (G.dode = new THREE.DodecahedronGeometry(0.5, 0)),
  oct: () => G.oct || (G.oct = new THREE.OctahedronGeometry(0.5, 0)),
  frust: (top, n = 8) => G['f' + top + n] || (G['f' + top + n] = new THREE.CylinderGeometry(0.5 * top, 0.5, 1, n)),
  tor: (n = 10, t = 0.12) => G['t' + n + t] || (G['t' + n + t] = new THREE.TorusGeometry(0.5, t, 5, n)),
  sph: (w = 8, h = 6) => G['s' + w + h] || (G['s' + w + h] = new THREE.SphereGeometry(0.5, w, h)),
};

export class Mesher {
  constructor(jitter = 0.07, seed = 1) { this.p = []; this.c = []; this.g = []; this.jit = jitter; this.s = seed >>> 0 || 1; }
  _r() { this.s ^= this.s << 13; this.s >>>= 0; this.s ^= this.s >> 17; this.s ^= this.s << 5; this.s >>>= 0; return this.s / 4294967296; }
  /** add a geometry under matrix m; o.glow puts it in the unlit group; o.deform(v) can bend vertices */
  add(g, m, color, o = {}) {
    const pos = g.attributes.position, idx = g.index;
    const n = idx ? idx.count : pos.count;
    _c.set(color);
    const jit = o.jit ?? this.jit;
    const P = o.glow ? (this.gp || (this.gp = [])) : this.p, C = o.glow ? (this.gc || (this.gc = [])) : this.c;
    for (let i = 0; i < n; i += 3) {
      const k = 1 + (this._r() - 0.5) * 2 * jit;
      let cr = _c.r * k, cg = _c.g * k, cb = _c.b * k;
      if (o.grad) { // darken toward the bottom: a cheap ambient occlusion
        _v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m);
        const f = Math.min(1, Math.max(0, (_v.y - o.grad[0]) / (o.grad[1] - o.grad[0])));
        const d = 0.7 + 0.3 * f; cr *= d; cg *= d; cb *= d;
      }
      for (let j = 0; j < 3; j++) {
        const vi = idx ? idx.getX(i + j) : i + j;
        _v.fromBufferAttribute(pos, vi);
        if (o.deform) o.deform(_v);
        _v.applyMatrix4(m);
        P.push(_v.x, _v.y, _v.z);
        C.push(cr, cg, cb);
      }
    }
    return this;
  }
  tri(a, b, c, color, o = {}) {
    _c.set(color); const k = 1 + (this._r() - 0.5) * 2 * (o.jit ?? this.jit);
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let j = 0; j < 3; j++) this.c.push(_c.r * k, _c.g * k, _c.b * k);
    if (o.double) { this.p.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z); for (let j = 0; j < 3; j++) this.c.push(_c.r * k, _c.g * k, _c.b * k); }
    return this;
  }
  box(x, y, z, w, h, d, color, ry = 0, o) { return this.add(geo.box(), mat4(x, y + h / 2, z, ry, w, h, d), color, o); }
  boxc(x, y, z, w, h, d, color, ry = 0, rx = 0, rz = 0, o) { return this.add(geo.box(), mat4(x, y, z, ry, w, h, d, rx, rz), color, o); }
  cyl(x, y, z, r, h, color, n = 8, o) { return this.add(geo.cyl(n), mat4(x, y + h / 2, z, 0, r * 2, h, r * 2), color, o); }
  frust(x, y, z, r0, r1, h, color, n = 8, o, rx = 0, rz = 0, ry = 0) { return this.add(geo.frust(r1 / r0, n), mat4(x, y + h / 2, z, ry, r0 * 2, h, r0 * 2, rx, rz), color, o); }
  cone(x, y, z, r, h, color, n = 6, o, rx = 0, rz = 0, ry = 0) { return this.add(geo.cone(n), mat4(x, y + h / 2, z, ry, r * 2, h, r * 2, rx, rz), color, o); }
  ico(x, y, z, sx, sy, sz, color, d = 0, o, ry = 0) { return this.add(geo.ico(d), mat4(x, y, z, ry, sx, sy, sz), color, o); }
  dode(x, y, z, sx, sy, sz, color, ry = 0, o) { return this.add(geo.dode(), mat4(x, y, z, ry, sx, sy, sz), color, o); }
  /** a cylinder segment between two points */
  seg(a, b, r0, r1, color, n = 6, o) {
    const d = _v.subVectors(b, a), L = d.length();
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    const m = new THREE.Matrix4().compose(a.clone().addScaledVector(d, 0.5), _q, new THREE.Vector3(r0 * 2, L, r0 * 2));
    return this.add(geo.frust(r1 / r0, n), m, color, o);
  }
  roof(x, y, z, w, d, h, color, ry = 0, o) {
    const g = G.roof || (G.roof = (() => { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.lineTo(-0.5, 0); const e = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); e.translate(0, 0, -0.5); return e; })());
    return this.add(g, mat4(x, y, z, ry, w, h, d), color, o);
  }
  get empty() { return !this.p.length && !(this.gp && this.gp.length); }
  geometry() {
    const g = new THREE.BufferGeometry();
    const n0 = this.p.length / 3, gp = this.gp || [], gc = this.gc || [];
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p.concat(gp), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c.concat(gc), 3));
    g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox();
    g.addGroup(0, n0, 0); if (gp.length) g.addGroup(n0, gp.length / 3, 1);
    return g;
  }
  mesh(o = {}) {
    const m = new THREE.Mesh(this.geometry(), o.material || [vcMat(), vcGlow()]);
    m.castShadow = o.cast !== false; m.receiveShadow = o.receive !== false;
    if (!o.dynamic) { m.matrixAutoUpdate = false; m.updateMatrix(); }
    return m;
  }
}
let _vc = null, _vg = null;
export function vcMat() { return _vc || (_vc = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.86, metalness: 0 })); }
export function vcGlow() { return _vg || (_vg = new THREE.MeshBasicMaterial({ vertexColors: true })); }

/* ---------------- text on canvas: signs and labels ---------------- */
const TEX = new Map();
export function textTexture(lines, o = {}) {
  const key = JSON.stringify([lines, o]);
  if (TEX.has(key)) return TEX.get(key);
  const W = o.w || 512, H = o.h || 256;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = o.bg || '#f6ecd0'; g.fillRect(0, 0, W, H);
  if (o.border !== false) { g.strokeStyle = o.borderColor || '#5a3a1a'; g.lineWidth = W * 0.03; g.strokeRect(W * 0.03, H * 0.05, W * 0.94, H * 0.9); }
  g.fillStyle = o.fg || '#3a2410'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const n = lines.length;
  const size = o.size || Math.min(H / (n + 0.7), W / Math.max(...lines.map(l => l.length)) * 1.7);
  lines.forEach((l, i) => {
    const s = i === 0 && o.big ? size * o.big : size;
    g.font = `${Math.floor(s)}px ${o.font || '"Lilita One", "Luckiest Guy", Impact, sans-serif'}`;
    g.fillText(l, W / 2, H / 2 + (i - (n - 1) / 2) * size * 1.08);
  });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  TEX.set(key, t);
  return t;
}
export function signMesh(lines, w, h, o = {}) {
  const px = Math.max(128, Math.min(1024, Math.round(256 * w / h)));
  const t = textTexture(lines, { w: px, h: Math.round(px * h / w), ...o });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: o.double ? THREE.DoubleSide : THREE.FrontSide }));
}
