/* Rig.js - builds a creature as ONE skinned, flat-shaded, vertex-coloured mesh.

   A body plan (art/CreatureArt.js) declares bones (joints in model space,
   +Z forward, +Y up, +X the creature's left) and pours geometry onto them:

     loft()   a smooth tube along a chain of control points (bodies, necks,
              tails, legs, snouts). Each ring is skinned to the bone that
              owns its stretch of the chain and blended into the neighbours
              near the joints, so a tail bends as one smooth curve instead
              of a row of boxes.
     prim()   a rigid primitive on one bone (horns, plates, claws, eyes).
     tri()    raw triangles with per-corner weights (wing membranes, sails).

   Every triangle gets one colour with a small random shift: the faceted,
   hand-painted low-poly look. Glowing parts go into a second, unlit group.

   The built template (geometry + bone layout) is cached per species and
   variant; instantiate() hands out fresh bones for each animal. */
import * as THREE from '../../lib/three.module.js';
import { clamp, smoothstep, rng } from '../core/Util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _a = V(), _b = V(), _c = V(), _t = V(), _u = V(), _s = V(), _q = V();
const _col = new THREE.Color(), _col2 = new THREE.Color();

let STD = null, GLOW = null;
export function creatureMats() {
  if (!STD) {
    STD = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.78, metalness: 0.02 });
    GLOW = new THREE.MeshBasicMaterial({ vertexColors: true });
  }
  return [STD, GLOW];
}

export class RigBuilder {
  constructor(seed = 1) {
    this.bones = [];           // {name, parent, p: Vector3 (model space)}
    this.byName = {};
    this.g = { p: [], c: [], si: [], sw: [] };       // standard
    this.gl = { p: [], c: [], si: [], sw: [] };      // glowing
    this.r = rng(seed);
    this.jit = 0.08;
  }

  bone(name, parent, x, y, z) {
    const i = this.bones.length;
    this.bones.push({ name, parent: parent == null ? -1 : (typeof parent === 'string' ? this.byName[parent] : parent), p: V(x, y, z) });
    this.byName[name] = i;
    return i;
  }
  B(name) { return this.byName[name]; }
  P(name) { return this.bones[this.byName[name]].p; }

  /* ---------------- raw output ---------------- */
  _vert(G, p, col, w) {
    G.p.push(p.x, p.y, p.z);
    G.c.push(col.r, col.g, col.b);
    // up to 3 influences, padded to 4
    const si = [0, 0, 0, 0], sw = [0, 0, 0, 0];
    let k = 0, tot = 0;
    for (const [b, wt] of w) { if (k < 4 && wt > 0.001) { si[k] = b; sw[k] = wt; tot += wt; k++; } }
    if (!tot) { si[0] = 0; sw[0] = 1; tot = 1; }
    for (let i = 0; i < 4; i++) sw[i] /= tot;
    G.si.push(...si); G.sw.push(...sw);
  }
  /** one triangle; w* are weight lists [[bone, w], ...]; one colour, jittered */
  tri(a, b, c, color, wa, wb = wa, wc = wa, o = {}) {
    const G = o.glow ? this.gl : this.g;
    const k = 1 + (this.r() - 0.5) * 2 * (o.jit ?? this.jit);
    _col.set(color);
    if (!o.glow) _col.multiplyScalar(k);
    this._vert(G, a, _col, wa); this._vert(G, b, _col, wb); this._vert(G, c, _col, wc);
    if (o.double) { this._vert(G, a, _col, wa); this._vert(G, c, _col, wc); this._vert(G, b, _col, wb); }
  }
  /** a rigid primitive: geometry transformed by matrix m, all on one bone */
  prim(geom, m, color, bone, o = {}) {
    const pos = geom.attributes.position, idx = geom.index;
    const n = idx ? idx.count : pos.count;
    const w = [[bone, 1]];
    for (let i = 0; i < n; i += 3) {
      const g = j => { const vi = idx ? idx.getX(i + j) : i + j; return V().fromBufferAttribute(pos, vi).applyMatrix4(m); };
      const A = g(0), Bp = g(1), C = g(2);
      let col = color;
      if (o.colorFn) col = o.colorFn(A.clone().add(Bp).add(C).multiplyScalar(1 / 3));
      this.tri(A, Bp, C, col, o.wfn ? o.wfn(A) : w, o.wfn ? o.wfn(Bp) : w, o.wfn ? o.wfn(C) : w, o);
    }
  }

  /* ---------------- skinning along a bone path ---------------- */
  /** weights for a point near a chain of joints [[bone, Vector3], ...]:
      the owner of the nearest segment, blended into its neighbours near
      the joints (a soft elbow rather than a hinge). */
  along(path, q) {
    let best = Infinity, bm = 0, bf = 0;
    for (let m = 0; m < path.length - 1; m++) {
      const A = path[m][1], Bp = path[m + 1][1];
      _a.subVectors(Bp, A); const L2 = _a.lengthSq() || 1e-6;
      let f = _b.subVectors(q, A).dot(_a) / L2;
      const fc = clamp(f, 0, 1);
      const d = _c.copy(A).addScaledVector(_a, fc).distanceToSquared(q);
      if (d < best - 1e-9) { best = d; bm = m; bf = f; }
    }
    const own = path[bm][0];
    const out = [[own, 1]];
    const fc = clamp(bf, 0, 1.5);
    if (fc > 0.5 && bm + 1 < path.length - 1) {
      const w = 0.5 * smoothstep(0.5, 1, fc);
      out[0][1] = 1 - w; out.push([path[bm + 1][0], w]);
    } else if (fc < 0.5 && bm > 0) {
      const w = 0.5 * smoothstep(0.5, 0, fc);
      out[0][1] = 1 - w; out.push([path[bm - 1][0], w]);
    }
    return out;
  }
  /** a bone path from bone names (joint positions), ending at an optional tip point */
  path(names, tip) {
    const p = names.map(n => [this.B(n), this.P(n).clone()]);
    if (tip) p.push([this.B(names[names.length - 1]), tip.clone()]);
    return p;
  }

  /* ---------------- the loft ---------------- */
  /**
   pts:  [{p: Vector3, w, h, dy?}]  control points (w,h half sizes)
   path: bone path for skinning
   o:    sides, sub (rings per segment), top/belly colours, pattern(s, v, side, pos) -> colour|null,
         glowPattern(s, v, side) -> colour|null, belly (squash of the lower half), capStart/capEnd,
         up (initial up vector), flat (0..1 makes the cross-section a lens: fins, flippers)
  */
  loft(pts, path, o = {}) {
    const sides = o.sides || 8, sub = o.sub || 3;
    // sample the centre line with Catmull-Rom, radii with smoothstep
    const rings = [];
    const P = i => pts[clamp(i, 0, pts.length - 1)].p;
    for (let i = 0; i < pts.length - 1; i++) {
      const n = i === pts.length - 2 ? sub + 1 : sub;
      for (let k = 0; k < n; k++) {
        const t = k / sub;
        const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
        const t2 = t * t, t3 = t2 * t;
        const c = V(
          0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
          0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3));
        const e = t * t * (3 - 2 * t);
        const A = pts[i], Bq = pts[i + 1];
        rings.push({ c, w: A.w + (Bq.w - A.w) * e, h: A.h + (Bq.h - A.h) * e, dy: (A.dy || 0) + ((Bq.dy || 0) - (A.dy || 0)) * e, s: (i + t) / (pts.length - 1) });
      }
    }
    // frames by parallel transport (no twisting along a neck that curls up)
    let up = (o.up || V(0, 1, 0)).clone();
    for (let i = 0; i < rings.length; i++) {
      const a = rings[Math.max(0, i - 1)].c, b = rings[Math.min(rings.length - 1, i + 1)].c;
      const T = V().subVectors(b, a).normalize();
      if (Math.abs(T.dot(up)) > 0.98) up = Math.abs(T.y) > 0.9 ? V(0, 0, -Math.sign(T.y)) : V(0, 1, 0);
      const S = V().crossVectors(T, up).normalize();
      up = V().crossVectors(S, T).normalize();
      rings[i].T = T; rings[i].S = S; rings[i].U = up.clone();
    }
    // vertices
    const flat = o.flat || 0, belly = o.belly ?? 0.88;
    for (const R of rings) {
      R.v = [];
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2 + (o.rot || 0);
        let cx = Math.cos(a), sy = Math.sin(a);
        if (flat) { sy *= 1 - flat; }
        const hh = sy < 0 ? R.h * belly : R.h;
        const p = V().copy(R.c).addScaledVector(R.S, cx * R.w).addScaledVector(R.U, sy * hh + R.dy);
        R.v.push({ p, sy: Math.sin(a), cx, w: this.along(path, p) });
      }
    }
    const top = o.top || '#888', bel = o.bellyCol || top;
    const shade = (s, v, side, pos) => {
      if (o.glowPattern) { const g = o.glowPattern(s, v, side, pos); if (g) return { c: g, glow: true }; }
      if (o.pattern) { const pc = o.pattern(s, v, side, pos); if (pc) return { c: pc }; }
      // top colour fading to the belly colour underneath
      const k = smoothstep(0.15, -0.55, v);
      return { c: '#' + _col2.set(top).lerp(_col.set(bel), k).getHexString() };
    };
    for (let i = 0; i < rings.length - 1; i++) {
      const A = rings[i], Bq = rings[i + 1];
      for (let k = 0; k < sides; k++) {
        const k2 = (k + 1) % sides;
        const a0 = A.v[k], a1 = A.v[k2], b0 = Bq.v[k], b1 = Bq.v[k2];
        const s = (A.s + Bq.s) / 2;
        const v = (a0.sy + a1.sy) / 2, side = (a0.cx + a1.cx) / 2;
        _q.copy(a0.p).add(b1.p).multiplyScalar(0.5);
        const S1 = shade(s, v, side, _q);
        this.tri(a0.p, b0.p, b1.p, S1.c, a0.w, b0.w, b1.w, { glow: S1.glow });
        this.tri(a0.p, b1.p, a1.p, S1.c, a0.w, b1.w, a1.w, { glow: S1.glow });
      }
    }
    // caps: a little dome on each end
    const cap = (R, dir, tipLen, col) => {
      const tip = V().copy(R.c).addScaledVector(R.T, dir * tipLen).addScaledVector(R.U, R.dy);
      const wt = this.along(path, tip);
      for (let k = 0; k < sides; k++) {
        const a0 = R.v[k], a1 = R.v[(k + 1) % sides];
        const S1 = shade(dir > 0 ? 1 : 0, (a0.sy + a1.sy) / 2, 0, tip);
        if (dir > 0) this.tri(a0.p, tip, a1.p, col || S1.c, a0.w, wt, a1.w, { glow: S1.glow });
        else this.tri(a0.p, a1.p, tip, col || S1.c, a0.w, a1.w, wt, { glow: S1.glow });
      }
    };
    if (o.capStart !== false) cap(rings[0], -1, o.capStart ?? Math.min(rings[0].w, rings[0].h) * 0.6, o.capStartCol);
    if (o.capEnd !== false) cap(rings[rings.length - 1], 1, o.capEnd ?? Math.min(rings[rings.length - 1].w, rings[rings.length - 1].h) * 0.6, o.capEndCol);
    return rings;
  }

  /* ---------------- finish ---------------- */
  build() {
    const geo = new THREE.BufferGeometry();
    const n0 = this.g.p.length / 3, n1 = this.gl.p.length / 3;
    const pos = new Float32Array((n0 + n1) * 3), col = new Float32Array((n0 + n1) * 3);
    const si = new Uint16Array((n0 + n1) * 4), sw = new Float32Array((n0 + n1) * 4);
    pos.set(this.g.p); pos.set(this.gl.p, n0 * 3);
    col.set(this.g.c); col.set(this.gl.c, n0 * 3);
    si.set(this.g.si); si.set(this.gl.si, n0 * 4);
    sw.set(this.g.sw); sw.set(this.gl.sw, n0 * 4);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    geo.addGroup(0, n0, 0);
    if (n1) geo.addGroup(n0, n1, 1);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const inv = this.bones.map(b => new THREE.Matrix4().makeTranslation(-b.p.x, -b.p.y, -b.p.z));
    return { geo, bones: this.bones.map(b => ({ name: b.name, parent: b.parent, p: b.p.clone() })), inv, byName: { ...this.byName }, tris: (n0 + n1) / 3 };
  }
}

/** a fresh animal from a template: its own bones, the shared geometry */
export function instantiate(T) {
  const bones = T.bones.map(d => { const b = new THREE.Bone(); b.name = d.name; return b; });
  T.bones.forEach((d, i) => {
    const pp = d.parent >= 0 ? T.bones[d.parent].p : V();
    bones[i].position.set(d.p.x - pp.x, d.p.y - pp.y, d.p.z - pp.z);
    if (d.parent >= 0) bones[d.parent].add(bones[i]);
  });
  const mesh = new THREE.SkinnedMesh(T.geo, creatureMats());
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones, T.inv), new THREE.Matrix4());
  mesh.castShadow = true; mesh.receiveShadow = false;
  // skinned meshes cull by a sphere computed once; give it room for flailing limbs
  mesh.boundingSphere = T.geo.boundingSphere.clone(); mesh.boundingSphere.radius *= 1.35;
  mesh.boundingBox = T.geo.boundingBox.clone();
  const by = {};
  bones.forEach((b, i) => { by[T.bones[i].name] = b; });
  return { mesh, bones, by };
}

/* ---------------- shared little shapes ---------------- */
const GC = {};
export const shapes = {
  ico: (d = 0) => GC['i' + d] || (GC['i' + d] = new THREE.IcosahedronGeometry(0.5, d)),
  cone: (n = 6) => GC['c' + n] || (GC['c' + n] = new THREE.ConeGeometry(0.5, 1, n).translate(0, 0.5, 0)),
  box: () => GC.box || (GC.box = new THREE.BoxGeometry(1, 1, 1)),
  cyl: (n = 8) => GC['y' + n] || (GC['y' + n] = new THREE.CylinderGeometry(0.5, 0.5, 1, n)),
  oct: () => GC.oct || (GC.oct = new THREE.OctahedronGeometry(0.5, 0)),
  dode: () => GC.dode || (GC.dode = new THREE.DodecahedronGeometry(0.5, 0)),
  disc: (n = 10) => GC['d' + n] || (GC['d' + n] = new THREE.CylinderGeometry(0.5, 0.5, 1, n)),
};
const _m = new THREE.Matrix4(), _qq = new THREE.Quaternion(), _e = new THREE.Euler(), _sc = V();
/** matrix from position, euler rotation and scale */
export function M(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz, 'YXZ'); _qq.setFromEuler(_e);
  return _m.clone().compose(V(x, y, z), _qq, _sc.set(sx, sy, sz));
}
/** matrix that stands a unit cone (base at 0, tip at +Y) on `from`, pointing at `to` */
export function aim(from, to, r) {
  const d = V().subVectors(to, from), L = d.length();
  _qq.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return _m.clone().compose(from.clone(), _qq.clone(), V(r * 2, L, r * 2));
}
export { V };
