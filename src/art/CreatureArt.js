/* CreatureArt.js - body plans: every creature in the game is drawn by one
   of these, from the numbers and feature tags in its species entry.

     theropod   two-legged: raptors, tyrants, spinosaurs, ornithopods, hadrosaurs
     quad       four-legged: ceratopsians, stegosaurs, ankylosaurs, mammals, crocs
     sauropod   the long-necks
     ptero      pterosaurs (membrane wings on the arm and the long fourth finger)
     marine     plesiosaurs, mosasaurs, ichthyosaurs, turtles
     fish       sharks and armoured fish
     dragonfly, millipede, scorpion   the giant arthropods

   A plan returns bone roles (what the animator moves) and meta (saddle,
   mouth, sizes). Proportions come from `body` in the species data with
   defaults here, so adding a creature is usually just data.

   Model space: +Z forward, +Y up, +X the creature's left. Ground at y = 0
   for walkers; swimmers and flyers have their root at the body's middle. */
import * as THREE from '../../lib/three.module.js';
import { RigBuilder, shapes, M, aim, V } from './Rig.js';
import { strSeed } from '../core/Util.js';

const C = c => new THREE.Color(c);
const mix = (a, b, t) => '#' + C(a).lerp(C(b), t).getHexString();
const dark = (a, k = 0.6) => '#' + C(a).multiplyScalar(k).getHexString();
const light = (a, k = 0.35) => mix(a, '#ffffff', k);

/* ---------------- patterns ---------------- */
export function patternFn(cols, kind) {
  const p = cols.pattern, pc = cols.patCol ? mix(cols.patCol, cols.top, 0.25) : dark(cols.top, 0.74);
  if (!p) return null;
  return (s, v, side, pos) => {
    if (v < 0.05) return null;
    if (p === 'stripes') return v > 0.2 && Math.sin(s * 58 + Math.abs(side) * 2.2) > 0.55 ? pc : null;
    if (p === 'bands') return Math.sin(s * 46) > 0.55 && v > 0.2 ? pc : null;
    if (p === 'spots') { const h = Math.sin(pos.x * 9.1 + pos.z * 3.7) * Math.sin(pos.z * 7.3 - pos.y * 5.1 + pos.x * 2); return h > 0.55 ? pc : null; }
    if (p === 'saddle') return v > 0.55 && s > 0.3 && s < 0.65 ? pc : null;
    if (p === 'tiger') return Math.sin(s * 90 + Math.abs(side) * 4) > 0.6 && v > 0.25 ? pc : null;
    if (p === 'dapple') { const h = Math.sin(pos.x * 15 + pos.z * 11) + Math.sin(pos.z * 13 - pos.y * 9); return h > 1.1 ? pc : null; }
    return null;
  };
}
function glowFn(cols) {
  if (!cols.glow) return null;
  const g = cols.glow, kind = cols.glowPat || 'stripes';
  return (s, v, side, pos) => {
    if (kind === 'stripes') return v > 0.25 && Math.sin(s * 64 + side * 2) > 0.72 ? g : null;
    if (kind === 'cracks') { const h = Math.sin(pos.x * 7 + pos.z * 5 + Math.sin(pos.z * 3) * 2) * Math.sin(pos.z * 8 - pos.y * 6); return v > -0.2 && Math.abs(h) < 0.06 ? g : null; }
    if (kind === 'spots') { const h = Math.sin(pos.x * 11 + pos.z * 4.1) * Math.sin(pos.z * 9.3 - pos.y * 6.1 + pos.x * 3); return h > 0.72 ? g : null; }
    if (kind === 'runes') return v > 0.5 && Math.sin(s * 40) > 0.85 ? g : null;
    if (kind === 'line') return Math.abs(v - 0.15) < 0.12 ? g : null;
    return null;
  };
}

/* ---------------- shared parts ---------------- */
/** an eye: sclera, iris, pupil and a highlight, looking out to the side (and a bit forward) */
function eye(R, bone, p, r, side, o) {
  const out = V(side * 0.9, 0.12, 0.42).normalize();
  R.prim(shapes.ico(1), M(p.x, p.y, p.z, 0, 0, 0, r * 2, r * 2, r * 2), '#f4efe2', bone, { jit: 0.02 });
  const ir = r * (o.big ? 0.82 : 0.68);
  const ip = p.clone().addScaledVector(out, r * 0.48);
  R.prim(shapes.ico(1), M(ip.x, ip.y, ip.z, 0, 0, 0, ir * 1.6, ir * 1.6, ir * 1.6), o.iris || '#3a2a1a', bone, { jit: 0.02 });
  const pp = p.clone().addScaledVector(out, r * 0.78);
  if (o.slit) R.prim(shapes.ico(1), M(pp.x, pp.y, pp.z, 0, 0, 0, r * 0.32, r * 1.15, r * 0.32), '#0e0a08', bone, { jit: 0 });
  else R.prim(shapes.ico(1), M(pp.x, pp.y, pp.z, 0, 0, 0, r * 0.75, r * 0.75, r * 0.75), '#0e0a08', bone, { jit: 0 });
  const hp = p.clone().addScaledVector(out, r * 0.92).add(V(0, r * 0.32, r * 0.22));
  R.prim(shapes.ico(0), M(hp.x, hp.y, hp.z, 0, 0, 0, r * 0.32, r * 0.32, r * 0.32), '#ffffff', bone, { glow: true });
  if (o.brow) {
    const bp = p.clone().add(V(-side * r * 0.1, r * 0.82, r * 0.05));
    R.prim(shapes.box(), M(bp.x, bp.y, bp.z, 0.32, side * 0.18, side * -0.22, r * 1.5, r * 0.5, r * 2.5), o.browCol || dark(o.top, 0.8), bone);
  }
}
/** a row of teeth between two points */
function teeth(R, bone, a, b, n, size, dir, side) {
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, p = a.clone().lerp(b, t);
    const s = size * (0.75 + 0.5 * Math.sin(t * Math.PI));
    R.prim(shapes.cone(4), aim(p, p.clone().add(V(side * s * 0.15, dir * s, s * 0.12)), s * 0.28), '#f6f0dc', bone, { jit: 0.03 });
  }
}
/** a pointed horn / claw / spike as a cone from base toward tip */
function spike(R, bone, base, tip, r, col, o) { R.prim(shapes.cone(o?.n || 5), aim(base, tip, r), col, bone, o); }
/** a curved horn: a few cone segments bending */
function curvedHorn(R, bone, base, dir, len, r, bend, col, n = 3) {
  let p = base.clone(), d = dir.clone().normalize();
  for (let i = 0; i < n; i++) {
    const L = len / n, q = p.clone().addScaledVector(d, L);
    const rr = r * (1 - i / n), r2 = r * (1 - (i + 1) / n) + r * 0.08;
    R.prim(shapes.cyl(6), aim(p, q, 1), col, bone, { wfn: null });
    void rr; void r2;
    p = q; d.add(bend).normalize();
  }
}
/** a tapering horn made of stacked frusta (curves by `bend` each step) */
function horn(R, bone, base, dir, len, r, bend, col, steps = 4) {
  let p = base.clone(); const d = dir.clone().normalize();
  for (let i = 0; i < steps; i++) {
    const L = len / steps, q = p.clone().addScaledVector(d, L);
    const r0 = r * (1 - i / steps), r1 = r * (1 - (i + 1) / steps);
    const g = new THREE.CylinderGeometry(Math.max(0.002, r1), r0, 1, 6).translate(0, 0.5, 0);
    const qq = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone());
    const m = new THREE.Matrix4().compose(p.clone(), qq, V(1, L, 1));
    R.prim(g, m, col, bone);
    p = q; d.add(bend).normalize();
  }
}
/** toes fanning out from a foot */
function toes(R, bone, at, fwd, n, len, r, col, clawCol, spread = 0.4, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? 0 : -spread + (2 * spread) * i / (n - 1);
    const d = fwd.clone().applyAxisAngle(V(0, 1, 0), a).normalize();
    const L = len * (n === 3 && i === 1 ? 1.15 : 0.92);
    const tip = at.clone().addScaledVector(d, L).add(V(0, -r * 0.3, 0));
    R.prim(shapes.cone(5), aim(at.clone().add(V(0, r * 0.2, 0)), tip, r), col, bone);
    if (clawCol) spike(R, bone, tip.clone().addScaledVector(d, -L * 0.12), tip.clone().addScaledVector(d, L * 0.3).add(V(0, -r * 0.4, 0)), r * 0.45, clawCol);
  }
  if (o.sickle) {
    const sp = at.clone().add(V(o.side * r * 1.4, r * 0.8, len * 0.1));
    horn(R, bone, sp, V(0, 1, 0.6), len * 0.75, r * 0.55, V(0, -0.15, 0.25), clawCol || '#2a2420', 3);
  }
}
/** a flat fan of feathers / fin rays: double-sided triangles */
function fan(R, w, root, dirs, len, col, col2) {
  for (let i = 0; i < dirs.length - 1; i++) {
    const a = root.clone().addScaledVector(dirs[i], len * (0.85 + 0.15 * Math.sin(i))), b = root.clone().addScaledVector(dirs[i + 1], len);
    R.tri(root, a, b, i % 2 ? col : (col2 || col), w, w, w, { double: true });
  }
}

/* =====================================================================
   THEROPOD - two legs, a balancing tail
   ===================================================================== */
function theropod(R, D, cols, sp) {
  const L = D.len, hip = D.hip;
  const torso = D.torso ?? L * 0.22, tailL = D.tail ?? L * 0.46, neckL = D.neck ?? L * 0.13, headL = D.head ?? L * 0.15;
  const bw = D.bw ?? hip * 0.27, bh = D.bh ?? hip * 0.33;
  const neckW = D.neckW ?? bw * 0.5, headH = D.headH ?? headL * 0.55, headW = D.headW ?? headL * 0.3;
  const legW = D.legW ?? hip * 0.075, armL = D.arm ?? hip * 0.45, armW = D.armW ?? legW * 0.42;
  const herb = !!D.herb, F = new Set(D.feat || []);
  const up = D.upright || 0;      // 0 horizontal .. 1 very upright (therizinosaurs)
  const neckRise = D.neckRise ?? 0.55;
  const top = cols.top, bel = cols.belly, acc = cols.accent || dark(top, 0.7);
  const pat = patternFn(cols), glow = glowFn(cols);

  R.bone('root', null, 0, 0, 0);
  R.bone('hips', 'root', 0, hip, 0);
  const cy = hip + bh * 0.05 + torso * up * 0.5;
  R.bone('spine', 'hips', 0, hip + bh * 0.04 + torso * up * 0.22, torso * 0.5 * (1 - up * 0.2));
  R.bone('chest', 'spine', 0, cy, torso * (1 - up * 0.25));
  const C0 = R.P('chest');
  const n1 = V(0, C0.y + bh * 0.42, C0.z + neckW * 0.6);
  const n2 = V(0, n1.y + neckL * neckRise * 0.62, n1.z + neckL * (1 - neckRise * 0.35) * 0.48);
  const hd = V(0, n2.y + neckL * neckRise * 0.38 - (D.headDrop || 0) * headH, n2.z + neckL * 0.48);
  R.bone('neck1', 'chest', n1.x, n1.y, n1.z);
  R.bone('neck2', 'neck1', n2.x, n2.y, n2.z);
  R.bone('head', 'neck2', hd.x, hd.y, hd.z);
  const jw = hd.clone().add(V(0, -headH * 0.3, headL * 0.06));
  R.bone('jaw', 'head', jw.x, jw.y, jw.z);
  // tail: six bones, shorter toward the tip, drooping a little
  const nT = 6, tailN = [];
  let z = 0, prev = 'hips';
  const segs = [0.24, 0.2, 0.17, 0.15, 0.13, 0.11];
  for (let i = 0; i < nT; i++) {
    z -= tailL * segs[i];
    const f = -z / tailL;
    R.bone('tail' + i, prev, 0, hip + bh * 0.1 - (D.droop ?? 0.1) * hip * f * f + (D.tailUp || 0) * f, z);
    prev = 'tail' + i; tailN.push(prev);
  }
  const tip = V(0, R.P('tail5').y - (D.droop ?? 0.1) * hip * 0.15, z - tailL * 0.08);
  // ---- the body: tail tip -> hips -> chest -> neck -> head
  const tipR = Math.max(0.02, bw * 0.06);
  const pts = [{ p: tip, w: tipR, h: tipR }];
  for (let i = nT - 1; i >= 0; i--) {
    const f = Math.pow((i + 1) / nT, 0.85);
    pts.push({ p: R.P('tail' + i), w: bw * (0.88 - 0.8 * f) + tipR, h: bh * (0.92 - 0.82 * f) * (D.tailDeep || 1) + tipR });
  }
  pts.push({ p: R.P('hips').clone().add(V(0, 0, -torso * 0.05)), w: bw, h: bh });
  pts.push({ p: R.P('spine'), w: bw * (D.belly || 1.1), h: bh * (D.belly || 1.12), dy: -bh * 0.14 });
  pts.push({ p: R.P('chest'), w: bw * 0.92, h: bh * 0.98, dy: -bh * 0.04 });
  pts.push({ p: n1.clone().lerp(C0, 0.15), w: neckW * 1.35, h: neckW * 1.5 });
  pts.push({ p: n2, w: neckW * 1.02, h: neckW * 1.12 });
  pts.push({ p: hd.clone().add(V(0, -headH * 0.05, -headL * 0.04)), w: neckW * 1.0, h: neckW * 1.15 });
  const bodyPath = [['tail5', tip], ['tail4', R.P('tail5')], ['tail3', R.P('tail4')], ['tail2', R.P('tail3')], ['tail1', R.P('tail2')], ['tail0', R.P('tail1')], ['hips', R.P('tail0')],
    ['hips', R.P('hips')], ['spine', R.P('spine')], ['chest', R.P('chest')], ['neck1', n1], ['neck2', n2], ['head', hd]].map(([b, p]) => [R.B(b), p.clone()]);
  R.loft(pts, bodyPath, { sides: 9, sub: 3, top, bellyCol: bel, pattern: pat, glowPattern: glow, belly: 0.86, capEnd: false });

  // ---- head
  const H = R.B('head'), J = R.B('jaw');
  const hp = [[H, hd.clone().add(V(0, 0, -headL * 0.15))], [H, hd.clone().add(V(0, 0, headL))]];
  const snoutDrop = D.snoutDrop ?? 0.14, longS = F.has('longsnout');
  const hpts = [
    { p: hd.clone().add(V(0, headH * 0.06, -headL * 0.12)), w: headW * 0.82, h: headH * 0.48 },
    { p: hd.clone().add(V(0, headH * 0.08, headL * 0.22)), w: headW, h: headH * 0.52 },
    { p: hd.clone().add(V(0, -headH * snoutDrop * 0.5, headL * (longS ? 0.5 : 0.58))), w: headW * (longS ? 0.45 : 0.66), h: headH * (longS ? 0.3 : 0.4) },
    { p: hd.clone().add(V(0, -headH * snoutDrop, headL * 0.97)), w: headW * (herb ? 0.36 : longS ? 0.34 : 0.42), h: headH * (herb ? 0.24 : 0.27) },
  ];
  const mouthCol = '#8e3a40';
  R.loft(hpts, hp, { sides: 8, sub: 3, top, bellyCol: herb ? bel : mouthCol, belly: 0.55, pattern: (s, v) => (v < -0.55 && !herb ? mouthCol : null), glowPattern: glow, capStart: false, capEnd: headW * 0.25 });
  // lower jaw
  const jpts = [
    { p: jw.clone().add(V(0, 0, -headL * 0.06)), w: headW * 0.72, h: headH * 0.18 },
    { p: jw.clone().add(V(0, -headH * 0.04, headL * 0.42)), w: headW * (longS ? 0.4 : 0.56), h: headH * 0.17 },
    { p: jw.clone().add(V(0, -headH * (snoutDrop - 0.25) * 0.4 - headH * 0.02, headL * 0.86)), w: headW * (herb ? 0.32 : 0.36), h: headH * 0.13 },
  ];
  R.loft(jpts, [[J, jw.clone()], [J, jw.clone().add(V(0, 0, headL))]], { sides: 7, sub: 2, top: herb ? top : '#b04a52', bellyCol: bel, belly: 1, pattern: (s, v) => (v > 0.5 ? (herb ? null : '#b85a5a') : null) });
  if (herb) {
    // a horny beak
    const bt = hd.clone().add(V(0, -headH * snoutDrop, headL * 1.0));
    R.prim(shapes.cone(6), aim(bt.clone().add(V(0, 0, -headL * 0.16)), bt.clone().add(V(0, -headH * 0.06, headL * 0.1)), headW * 0.36), cols.beak || '#e8c070', H);
    R.prim(shapes.cone(6), aim(jpts[2].p.clone().add(V(0, 0, -headL * 0.14)), jpts[2].p.clone().add(V(0, headH * 0.03, headL * 0.1)), headW * 0.28), cols.beak || '#e8c070', J);
  } else {
    const tn = Math.round(6 + headL * 2);
    for (const s of [-1, 1]) {
      teeth(R, H, hd.clone().add(V(s * headW * 0.62, -headH * 0.27, headL * 0.26)), hd.clone().add(V(s * headW * 0.33, -headH * (snoutDrop + 0.18), headL * 0.93)), tn, headH * 0.15, -1, s);
      teeth(R, J, jw.clone().add(V(s * headW * 0.5, headH * 0.08, headL * 0.22)), jw.clone().add(V(s * headW * 0.26, headH * 0.03, headL * 0.8)), tn - 1, headH * 0.11, 1, s);
    }
  }
  // eyes, nostrils
  const er = headH * (herb ? 0.2 : 0.16) * (D.eye || 1);
  for (const s of [-1, 1]) {
    eye(R, H, hd.clone().add(V(s * headW * 0.8, headH * 0.22, headL * 0.2)), er, s, { iris: cols.eye || (herb ? '#4a2e1a' : '#e8a020'), slit: !herb, brow: !herb, top, big: herb });
    R.prim(shapes.ico(0), M(s * headW * 0.24, hd.y + headH * (0.08 - snoutDrop), hd.z + headL * 0.9, 0, 0, 0, headW * 0.12, headW * 0.09, headW * 0.12), '#2a1a18', H);
  }

  // ---- legs
  const legs = [];
  for (const s of [1, -1]) {
    const nm = s > 0 ? 'L' : 'R';
    const HJ = V(s * bw * 0.72, hip - bh * 0.18, torso * 0.04);
    const K = V(s * bw * 0.9, hip * 0.55, torso * 0.04 + hip * (D.knee ?? 0.2));
    const A = V(s * bw * 0.84, hip * 0.2, -hip * 0.1);
    const Fp = V(s * bw * 0.84, legW * 0.55, hip * 0.05);
    R.bone('thigh' + nm, 'hips', HJ.x, HJ.y, HJ.z);
    R.bone('shin' + nm, 'thigh' + nm, K.x, K.y, K.z);
    R.bone('meta' + nm, 'shin' + nm, A.x, A.y, A.z);
    R.bone('foot' + nm, 'meta' + nm, Fp.x, Fp.y, Fp.z);
    const path = R.path(['thigh' + nm, 'shin' + nm, 'meta' + nm, 'foot' + nm], Fp.clone().add(V(0, -0.02, 0.05)));
    R.loft([
      { p: HJ.clone().add(V(0, bh * 0.25, -legW * 0.3)), w: legW * 2.0, h: legW * 2.4 },
      { p: HJ.clone().lerp(K, 0.45), w: legW * 1.65, h: legW * 2.0 },
      { p: K, w: legW * 0.9, h: legW * 1.0 },
      { p: K.clone().lerp(A, 0.5), w: legW * 0.62, h: legW * 0.7 },
      { p: A, w: legW * 0.48, h: legW * 0.5 },
      { p: Fp, w: legW * 0.46, h: legW * 0.4 },
    ], path, { sides: 7, sub: 2, top, bellyCol: mix(top, bel, 0.5), up: V(0, 0, 1), pattern: pat });
    toes(R, R.B('foot' + nm), Fp, V(0, 0, 1), herb && !D.claws ? 3 : 3, legW * (D.toe ?? 2.6), legW * 0.36, top, cols.claw || '#3a2e28', 0.38, { sickle: F.has('sickle'), side: -s });
    legs.push({ b: ['thigh' + nm, 'shin' + nm, 'meta' + nm, 'foot' + nm], side: s, front: false });
  }
  // ---- arms
  const arms = [];
  if (armL > 0.01) for (const s of [1, -1]) {
    const nm = s > 0 ? 'L' : 'R';
    const S = V(s * bw * 0.66, C0.y - bh * 0.38, C0.z + bh * 0.05);
    const E = S.clone().add(V(s * bw * 0.1, -armL * 0.42, -armL * 0.08 + up * armL * 0.1));
    const Hh = E.clone().add(V(0, -armL * 0.15, armL * 0.42));
    R.bone('arm' + nm, 'chest', S.x, S.y, S.z);
    R.bone('fore' + nm, 'arm' + nm, E.x, E.y, E.z);
    R.bone('hand' + nm, 'fore' + nm, Hh.x, Hh.y, Hh.z);
    R.loft([{ p: S, w: armW * 1.6, h: armW * 1.8 }, { p: E, w: armW, h: armW }, { p: Hh, w: armW * 0.8, h: armW * 0.7 }],
      R.path(['arm' + nm, 'fore' + nm, 'hand' + nm], Hh.clone().add(V(0, 0, armW))), { sides: 6, sub: 2, top, bellyCol: mix(top, bel, 0.4), up: V(0, 0, 1) });
    const cl = F.has('claws') ? 3.6 : 1;
    toes(R, R.B('hand' + nm), Hh, V(0, -0.5, 1).normalize(), D.fingers || 3, armW * 2.2 * (F.has('claws') ? 1.2 : 1), armW * 0.4, top, cols.claw || '#3a2e28', 0.3);
    if (F.has('claws')) for (let i = 0; i < 3; i++) horn(R, R.B('hand' + nm), Hh.clone().add(V(s * (i - 1) * armW * 0.6, -armW * 0.4, armW)), V(0, -0.9, 0.5), armL * 0.5 * cl * 0.3, armW * 0.42, V(0, 0.02, -0.18), '#2e2620', 4);
    if (F.has('feathers')) {
      const w = R.along(R.path(['arm' + nm, 'fore' + nm, 'hand' + nm], Hh.clone()), E.clone().lerp(Hh, 0.5));
      const dirs = []; for (let i = 0; i <= 5; i++) dirs.push(V(s * 0.25, -0.9, -0.55 + i * 0.18).normalize());
      fan(R, w, E.clone().lerp(Hh, 0.4), dirs, armL * 0.55, cols.feather || acc, dark(cols.feather || acc, 0.8));
    }
    arms.push({ b: ['arm' + nm, 'fore' + nm, 'hand' + nm], side: s });
  }
  // ---- features
  const Hb = R.B('head');
  const bodyW = q => R.along(bodyPath, q);
  if (F.has('feathers')) {
    // a tail-tip fan and a little crest of quills
    const w = [[R.B('tail5'), 1]];
    const dirs = []; for (let i = 0; i <= 6; i++) dirs.push(V(-0.9 + i * 0.3, 0.08, -1).normalize());
    fan(R, w, R.P('tail4').clone().lerp(tip, 0.4), dirs, tailL * 0.2, cols.feather || acc, dark(cols.feather || acc, 0.85));
  }
  if (F.has('quills')) {
    for (let i = 0; i < 5; i++) {
      const p = hd.clone().lerp(n1, i / 5).add(V(0, neckW * 1.05, -neckW * 0.2));
      spike(R, i < 2 ? Hb : R.B(i < 4 ? 'neck2' : 'neck1'), p, p.clone().add(V(0, neckW * (0.9 - i * 0.08), -neckW * 0.9)), neckW * 0.22, cols.feather || acc);
    }
  }
  if (F.has('sail')) {
    // a tall sail on the back, ribbed
    const n = 14, sw = cols.sail || acc;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const at = t => { const z0 = R.P('tail1').z, z1 = C0.z + neckW * 0.4; const zz = z0 + (z1 - z0) * t; const y = hip + bh * 0.8 + (C0.y - hip) * t; return V(0, y, zz); };
      const hgt = t => (D.sailH ?? hip * 0.9) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.1)), 0.8) * (0.9 + 0.1 * Math.sin(t * 40));
      const a0 = at(t0), a1 = at(t1), b0 = a0.clone().add(V(0, hgt(t0), 0)), b1 = a1.clone().add(V(0, hgt(t1), 0));
      const col = i % 3 === 0 ? dark(sw, 0.6) : i % 2 ? sw : light(sw, 0.12);
      R.tri(a0, b0, b1, col, bodyW(a0), bodyW(b0.clone().setY(a0.y)), bodyW(b1.clone().setY(a1.y)), { double: true });
      R.tri(a0, b1, a1, col, bodyW(a0), bodyW(b1.clone().setY(a1.y)), bodyW(a1), { double: true });
    }
  }
  if (F.has('crest2')) for (const s of [-1, 1]) {
    // dilophosaur double crests: thin half-discs on the skull
    const base = hd.clone().add(V(s * headW * 0.3, headH * 0.5, headL * 0.05));
    for (let i = 0; i < 5; i++) {
      const a0 = (i / 5) * Math.PI, a1 = ((i + 1) / 5) * Math.PI, r = headL * 0.42;
      const p0 = base.clone().add(V(0, Math.sin(a0) * r * 0.55, Math.cos(a0) * r * 0.75 + r * 0.25));
      const p1 = base.clone().add(V(0, Math.sin(a1) * r * 0.55, Math.cos(a1) * r * 0.75 + r * 0.25));
      R.tri(base.clone().add(V(0, 0, r * 0.25)), p0, p1, i % 2 ? cols.crest || '#e04a2a' : dark(cols.crest || '#e04a2a', 0.8), [[Hb, 1]], [[Hb, 1]], [[Hb, 1]], { double: true });
    }
  }
  if (F.has('horns2')) for (const s of [-1, 1]) horn(R, Hb, hd.clone().add(V(s * headW * 0.6, headH * 0.42, headL * 0.12)), V(s * 0.7, 0.6, -0.1), headH * 0.55, headW * 0.22, V(0, 0.05, 0.05), cols.horn || '#2a2420');
  if (F.has('browcrest')) for (const s of [-1, 1]) spike(R, Hb, hd.clone().add(V(s * headW * 0.55, headH * 0.42, headL * 0.25)), hd.clone().add(V(s * headW * 0.6, headH * 0.75, headL * 0.1)), headW * 0.2, cols.crest || '#c84a2a');
  if (F.has('dome')) {
    R.prim(shapes.ico(1), M(hd.x, hd.y + headH * 0.42, hd.z + headL * 0.08, 0, 0, 0, headW * 2.3, headH * 0.95, headL * 0.75), cols.dome || light(top, 0.4), Hb);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; R.prim(shapes.cone(4), aim(hd.clone().add(V(Math.cos(a) * headW * 0.95, headH * 0.3, headL * 0.08 + Math.sin(a) * headL * 0.32)), hd.clone().add(V(Math.cos(a) * headW * 1.25, headH * 0.42, headL * 0.08 + Math.sin(a) * headL * 0.45)), headW * 0.12), cols.horn || '#d8c8a0', Hb); }
  }
  if (F.has('tube')) horn(R, Hb, hd.clone().add(V(0, headH * 0.4, headL * 0.25)), V(0, 0.45, -1), headL * 1.35, headH * 0.22, V(0, -0.12, 0), cols.crest || '#e85a3a', 5);
  if (F.has('spines')) for (let i = 0; i < 9; i++) {
    const t = i / 8, p = R.P('tail2').clone().lerp(n1, t).add(V(0, bh * 0.85, 0));
    p.y = Math.max(p.y, hip + bh * 0.8 - (1 - t) * 0.2);
    spike(R, R.B(t < 0.2 ? 'tail1' : t < 0.45 ? 'hips' : t < 0.75 ? 'spine' : 'chest'), p, p.clone().add(V(0, bh * (0.6 + Math.sin(t * Math.PI) * 0.7), -bh * 0.25)), bh * 0.18, cols.spike || acc, { glow: !!cols.spikeGlow });
  }
  if (F.has('mane')) for (let i = 0; i < 12; i++) {
    const t = i / 12, p = n1.clone().lerp(hd, t).add(V(0, neckW * 0.6, 0));
    for (const s of [-1, 1]) spike(R, R.B(t < 0.4 ? 'neck1' : t < 0.85 ? 'neck2' : 'head'), p.clone().add(V(s * neckW * 0.5, 0, 0)), p.clone().add(V(s * neckW * 1.4, -neckW * 0.4, -neckW * 0.5)), neckW * 0.25, cols.feather || acc);
  }

  return {
    plan: 'biped', legs, arms,
    roles: { root: 'root', hips: 'hips', spine: ['spine', 'chest'], neck: ['neck1', 'neck2'], head: 'head', jaw: 'jaw', tail: tailN },
    saddle: { bone: 'spine', at: V(0, bh * 1.02 + 0.08, -torso * 0.1), seats: [V(0, bh * 0.95, -torso * 0.55)] },
    mouth: { bone: 'head', at: V(0, -headH * 0.2, headL * 0.9) },
    dims: { len: L, hip, height: Math.max(hd.y + headH, hip + bh), bw, bh, headL },
  };
}

/* =====================================================================
   QUAD - four legs: ceratopsians, stegosaurs, ankylosaurs, mammals, crocs
   ===================================================================== */
function quad(R, D, cols, sp) {
  const L = D.len, hip = D.hip, sh = D.shoulder ?? hip * 0.92;
  const torso = D.torso ?? L * 0.36, tailL = D.tail ?? L * 0.32, neckL = D.neck ?? L * 0.08, headL = D.head ?? L * 0.18;
  const bw = D.bw ?? hip * 0.42, bh = D.bh ?? hip * 0.4;
  const neckW = D.neckW ?? bw * 0.55, headH = D.headH ?? headL * 0.5, headW = D.headW ?? headL * 0.34;
  const legW = D.legW ?? hip * 0.11, sprawl = D.sprawl || 0;
  const F = new Set(D.feat || []), herb = !!D.herb;
  const top = cols.top, bel = cols.belly, acc = cols.accent || dark(top, 0.7);
  const pat = patternFn(cols), glow = glowFn(cols);
  const head = D.headStyle || 'beak';

  R.bone('root', null, 0, 0, 0);
  R.bone('hips', 'root', 0, hip, 0);
  R.bone('spine', 'hips', 0, (hip + sh) / 2 + bh * (D.hump ?? 0.12), torso * 0.5);
  R.bone('chest', 'spine', 0, sh, torso);
  const C0 = R.P('chest');
  const hl = D.headLow ?? 0.15;   // how low the head is held
  const n1 = V(0, sh + bh * 0.1, torso + neckL * 0.45);
  const hd = V(0, sh + bh * 0.05 - hl * sh + (D.headUp || 0), torso + neckL + headL * 0.12);
  R.bone('neck1', 'chest', n1.x, n1.y, n1.z);
  R.bone('head', 'neck1', hd.x, hd.y, hd.z);
  const jw = hd.clone().add(V(0, -headH * 0.3, headL * 0.08));
  R.bone('jaw', 'head', jw.x, jw.y, jw.z);
  const nT = 5, tailN = [], segs = [0.26, 0.23, 0.2, 0.17, 0.14];
  let z = 0, prev = 'hips';
  for (let i = 0; i < nT; i++) {
    z -= tailL * segs[i];
    const f = -z / tailL;
    R.bone('tail' + i, prev, 0, hip - (D.droop ?? 0.22) * hip * f + (D.tailUp || 0) * f, z);
    prev = 'tail' + i; tailN.push(prev);
  }
  const tip = V(0, R.P('tail4').y - (D.droop ?? 0.22) * hip * 0.1, z - tailL * 0.06);
  const tipR = Math.max(0.03, bw * (D.tailTip ?? 0.05));
  const pts = [{ p: tip, w: tipR, h: tipR }];
  for (let i = nT - 1; i >= 0; i--) { const f = Math.pow((i + 1) / nT, 0.8); pts.push({ p: R.P('tail' + i), w: bw * (0.75 - 0.68 * f) + tipR, h: bh * (0.8 - 0.72 * f) + tipR }); }
  pts.push({ p: R.P('hips'), w: bw * 0.95, h: bh });
  pts.push({ p: R.P('spine'), w: bw * (D.belly || 1.08), h: bh * (D.bellyH || 1.12), dy: -bh * 0.1 });
  pts.push({ p: C0, w: bw * 0.92, h: bh * 0.95, dy: -bh * 0.05 });
  pts.push({ p: n1, w: neckW * 1.15, h: neckW * 1.25 });
  pts.push({ p: hd.clone().add(V(0, 0, -headL * 0.05)), w: neckW * 0.95, h: neckW * 1.05 });
  const bodyPath = [['tail4', tip], ['tail3', R.P('tail4')], ['tail2', R.P('tail3')], ['tail1', R.P('tail2')], ['tail0', R.P('tail1')], ['hips', R.P('tail0')],
    ['hips', R.P('hips')], ['spine', R.P('spine')], ['chest', C0], ['neck1', n1], ['head', hd]].map(([b, p]) => [R.B(b), p.clone()]);
  R.loft(pts, bodyPath, { sides: 10, sub: 3, top, bellyCol: bel, pattern: pat, glowPattern: glow, belly: D.flatBelly ?? 0.8, capEnd: false, flat: D.flatBody || 0 });
  const Hb = R.B('head'), J = R.B('jaw');
  const bodyW = q => R.along(bodyPath, q);

  // ---- head
  const hp = [[Hb, hd.clone().add(V(0, 0, -headL * 0.2))], [Hb, hd.clone().add(V(0, 0, headL))]];
  let hpts;
  if (head === 'croc') hpts = [
    { p: hd.clone().add(V(0, headH * 0.05, -headL * 0.1)), w: headW * 0.9, h: headH * 0.5 },
    { p: hd.clone().add(V(0, 0, headL * 0.2)), w: headW * 0.8, h: headH * 0.4 },
    { p: hd.clone().add(V(0, -headH * 0.12, headL * 0.65)), w: headW * 0.38, h: headH * 0.2 },
    { p: hd.clone().add(V(0, -headH * 0.12, headL * 1.0)), w: headW * 0.42, h: headH * 0.2 }];
  else if (head === 'trunk') hpts = [
    { p: hd.clone().add(V(0, headH * 0.15, -headL * 0.12)), w: headW * 0.85, h: headH * 0.65 },
    { p: hd.clone().add(V(0, headH * 0.25, headL * 0.25)), w: headW, h: headH * 0.72 },
    { p: hd.clone().add(V(0, -headH * 0.12, headL * 0.62)), w: headW * 0.7, h: headH * 0.5 },
    { p: hd.clone().add(V(0, -headH * 0.3, headL * 0.82)), w: headW * 0.42, h: headH * 0.34 }];
  else if (head === 'cat') hpts = [
    { p: hd.clone().add(V(0, headH * 0.05, -headL * 0.1)), w: headW * 0.9, h: headH * 0.55 },
    { p: hd.clone().add(V(0, headH * 0.06, headL * 0.25)), w: headW, h: headH * 0.56 },
    { p: hd.clone().add(V(0, -headH * 0.08, headL * 0.68)), w: headW * 0.62, h: headH * 0.38 },
    { p: hd.clone().add(V(0, -headH * 0.1, headL * 0.92)), w: headW * 0.46, h: headH * 0.3 }];
  else hpts = [
    { p: hd.clone().add(V(0, headH * 0.08, -headL * 0.12)), w: headW * 0.85, h: headH * 0.52 },
    { p: hd.clone().add(V(0, headH * 0.08, headL * 0.22)), w: headW, h: headH * 0.55 },
    { p: hd.clone().add(V(0, -headH * 0.12, headL * 0.62)), w: headW * 0.66, h: headH * 0.42 },
    { p: hd.clone().add(V(0, -headH * 0.22, headL * 0.95)), w: headW * (head === 'wide' ? 0.62 : 0.4), h: headH * 0.3 }];
  const mouthCol = '#8e3a40';
  R.loft(hpts, hp, { sides: 8, sub: 3, top, bellyCol: herb ? bel : mouthCol, belly: 0.6, glowPattern: glow, pattern: head === 'croc' ? pat : null, capStart: false, capEnd: headW * 0.2 });
  const jEnd = hpts[3].p.clone().add(V(0, -headH * 0.12, -headL * 0.06));
  R.loft([
    { p: jw.clone().add(V(0, 0, -headL * 0.04)), w: headW * 0.7, h: headH * 0.18 },
    { p: jw.clone().lerp(jEnd, 0.5).add(V(0, -headH * 0.04, 0)), w: headW * (head === 'croc' ? 0.36 : 0.52), h: headH * 0.16 },
    { p: jEnd, w: headW * (head === 'croc' ? 0.38 : 0.34), h: headH * 0.13 }],
    [[J, jw.clone()], [J, jEnd.clone()]], { sides: 7, sub: 2, top: herb ? top : '#b04a52', bellyCol: bel, belly: 1, pattern: (s, v) => (v > 0.5 && !herb ? '#b85a5a' : null) });
  if (!herb) for (const s of [-1, 1]) {
    teeth(R, Hb, hpts[1].p.clone().add(V(s * headW * 0.6, -headH * 0.45, 0)), hpts[3].p.clone().add(V(s * headW * 0.32, -headH * 0.22, 0)), head === 'croc' ? 14 : 7, headH * 0.15, -1, s);
    teeth(R, J, jw.clone().add(V(s * headW * 0.45, headH * 0.08, headL * 0.25)), jEnd.clone().add(V(s * headW * 0.24, headH * 0.06, 0)), head === 'croc' ? 13 : 6, headH * 0.11, 1, s);
  }
  if (herb && (head === 'beak' || head === 'wide')) {
    const bt = hpts[3].p;
    R.prim(shapes.cone(6), aim(bt.clone().add(V(0, headH * 0.05, -headL * 0.16)), bt.clone().add(V(0, -headH * 0.18, headL * 0.14)), headW * 0.32), cols.beak || '#c8a878', Hb);
  }
  const er = headH * (herb ? 0.17 : 0.14) * (D.eye || 1);
  const ez = head === 'croc' ? 0.05 : 0.22, ey = head === 'croc' ? 0.45 : 0.25;
  for (const s of [-1, 1]) {
    eye(R, Hb, hd.clone().add(V(s * headW * (head === 'croc' ? 0.55 : 0.82), headH * ey, headL * ez)), er, s, { iris: cols.eye || (herb ? '#4a2e1a' : '#e0a020'), slit: !herb, brow: !herb || head === 'croc', top, big: herb });
    R.prim(shapes.ico(0), M(s * headW * 0.2, hpts[3].p.y + headH * 0.15, hpts[3].p.z, 0, 0, 0, headW * 0.12, headW * 0.09, headW * 0.12), '#2a1a18', Hb);
  }

  // ---- legs
  const legs = [];
  for (const front of [false, true]) for (const s of [1, -1]) {
    const nm = (front ? 'F' : 'H') + (s > 0 ? 'L' : 'R');
    const baseY = front ? sh : hip, bz = front ? torso * 0.93 : torso * 0.02;
    const lw = legW * (front ? (D.frontLeg ?? 0.9) : 1);
    const U = V(s * bw * 0.72, baseY - bh * 0.3, bz);
    const K = V(s * (bw * 0.8 + sprawl * baseY * 0.6), baseY * (sprawl ? 0.35 : 0.5), bz + (front ? -baseY * 0.05 : baseY * 0.1));
    const A = V(s * (bw * 0.82 + sprawl * baseY * 0.75), baseY * 0.12, bz + (front ? baseY * 0.02 : -baseY * 0.06));
    const Fp = V(A.x, lw * 0.5, A.z + lw * 0.4);
    R.bone('leg' + nm, front ? 'chest' : 'hips', U.x, U.y, U.z);
    R.bone('knee' + nm, 'leg' + nm, K.x, K.y, K.z);
    R.bone('ank' + nm, 'knee' + nm, A.x, A.y, A.z);
    R.bone('ft' + nm, 'ank' + nm, Fp.x, Fp.y, Fp.z);
    R.loft([
      { p: U.clone().add(V(0, bh * 0.3, 0)), w: lw * 1.9, h: lw * 2.1 },
      { p: U.clone().lerp(K, 0.5), w: lw * 1.5, h: lw * 1.6 },
      { p: K, w: lw * 1.05, h: lw * 1.1 },
      { p: A, w: lw * 0.85, h: lw * 0.9 },
      { p: Fp.clone().add(V(0, lw * 0.1, -lw * 0.3)), w: lw * (D.hoof ? 0.8 : 1.0), h: lw * 0.55 },
    ], R.path(['leg' + nm, 'knee' + nm, 'ank' + nm, 'ft' + nm], Fp.clone().add(V(0, 0, lw * 0.4))), { sides: 7, sub: 2, top: F.has('fur') ? top : top, bellyCol: mix(top, bel, 0.35), up: V(0, 0, 1), pattern: pat });
    if (!D.hoof) for (let i = 0; i < (D.nails ?? 3); i++) {
      const a = -0.5 + i / Math.max(1, (D.nails ?? 3) - 1);
      const p = Fp.clone().add(V(a * lw * 0.8, -lw * 0.2, lw * 0.55));
      if (sprawl || !herb) spike(R, R.B('ft' + nm), p, p.clone().add(V(a * lw * 0.3, -lw * 0.25, lw * 0.6)), lw * 0.2, cols.claw || '#3a2e28');
      else R.prim(shapes.ico(0), M(p.x, p.y + lw * 0.05, p.z, 0, 0, 0, lw * 0.38, lw * 0.3, lw * 0.32), cols.nail || '#e8dcc0', R.B('ft' + nm));
    }
    legs.push({ b: ['leg' + nm, 'knee' + nm, 'ank' + nm, 'ft' + nm], side: s, front });
  }

  // ---- features
  if (F.has('frill')) {
    // the ceratopsian shield: a fan of triangles behind the skull, with a scalloped rim
    const c = hd.clone().add(V(0, headH * 0.35, -headL * 0.1)), rr = headL * (D.frill ?? 0.85), n = 14;
    const fc = cols.frill || light(top, 0.15), rim = cols.rim || dark(fc, 0.7);
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI * 0.62 + (i / n) * Math.PI * 1.24, a1 = -Math.PI * 0.62 + ((i + 1) / n) * Math.PI * 1.24;
      const P0 = c.clone().add(V(Math.sin(a0) * rr, Math.cos(a0) * rr * 0.85, -rr * 0.45)), P1 = c.clone().add(V(Math.sin(a1) * rr, Math.cos(a1) * rr * 0.85, -rr * 0.45));
      const col = (cols.frillPat && i % 3 === 1) ? cols.frillPat : fc;
      R.tri(c, P0, P1, col, [[Hb, 1]], [[Hb, 1]], [[Hb, 1]], { double: true });
      // rim knobs
      if (F.has('frillspikes') || i % 2 === 0) spike(R, Hb, P0, P0.clone().add(V(Math.sin(a0) * rr * 0.16, Math.cos(a0) * rr * 0.16, -rr * 0.05)), rr * 0.06, rim);
    }
    if (cols.frillEye) for (const s of [-1, 1]) R.prim(shapes.ico(0), M(c.x + s * rr * 0.45, c.y + rr * 0.42, c.z - rr * 0.42, 0, 0, 0, rr * 0.2, rr * 0.2, rr * 0.06), cols.frillEye, Hb);
  }
  if (F.has('horns3')) {
    for (const s of [-1, 1]) horn(R, Hb, hd.clone().add(V(s * headW * 0.45, headH * 0.42, headL * 0.18)), V(s * 0.12, 0.55, 1), headL * 0.85, headW * 0.16, V(0, -0.06, 0), cols.horn || '#efe4c8', 4);
    horn(R, Hb, hpts[3].p.clone().add(V(0, headH * 0.2, -headL * 0.1)), V(0, 0.9, 0.35), headL * 0.32, headW * 0.15, V(0, -0.02, 0.1), cols.horn || '#efe4c8', 3);
  }
  if (F.has('nosehorn')) {
    horn(R, Hb, hpts[3].p.clone().add(V(0, headH * 0.2, -headL * 0.12)), V(0, 1, 0.45), headL * 0.6, headW * 0.26, V(0, -0.05, -0.05), cols.horn || '#5a4a3a', 4);
    horn(R, Hb, hpts[2].p.clone().add(V(0, headH * 0.32, 0)), V(0, 1, 0.2), headL * 0.3, headW * 0.18, V(0, 0, -0.05), cols.horn || '#5a4a3a', 3);
  }
  if (F.has('plates')) {
    // stegosaur plates: two staggered rows of diamonds from neck to tail
    const n = 11;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const z0 = n1.z * 0.85, z1 = R.P('tail2').z;
      const zz = z0 + (z1 - z0) * t;
      const q = V(0, 0, zz);
      // height of the back at this z
      const by = zz > 0 ? lerpY(R.P('hips').y, C0.y, zz / torso) + bh * 0.9 : R.P('hips').y + bh * (0.9 - 0.25 * (-zz / tailL)) - (D.droop ?? 0.22) * hip * (-zz / tailL);
      const hgt = (D.plate ?? hip * 0.55) * (0.45 + 0.75 * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.05)));
      const s = i % 2 ? 1 : -1;
      const base = V(s * bw * 0.12, by - hgt * 0.15, zz);
      const pc = cols.plate || acc;
      const col2 = mix(pc, cols.plateTip || light(pc, 0.4), 0.5);
      const w = bodyW(base);
      const T = base.clone().add(V(s * hgt * 0.12, hgt, 0)), Fw = base.clone().add(V(0, hgt * 0.45, hgt * 0.42)), Bk = base.clone().add(V(0, hgt * 0.45, -hgt * 0.42));
      const glowP = !!cols.plateGlow;
      R.tri(base, Fw, T, pc, w, w, w, { double: true, glow: glowP }); R.tri(base, T, Bk, col2, w, w, w, { double: true, glow: glowP });
      void q;
    }
  }
  if (F.has('thag')) {
    const t3 = R.P('tail3'), t4 = R.P('tail4');
    for (const s of [-1, 1]) for (const k of [0.3, 0.8]) {
      const p = t3.clone().lerp(t4, k).add(V(s * bw * 0.08, bh * 0.15, 0));
      horn(R, R.B('tail3'), p, V(s * 0.9, 0.6, -0.15 - k * 0.3), hip * 0.3, bw * 0.08, V(0, 0, -0.05), cols.horn || '#efe4c8', 3);
    }
  }
  if (F.has('armor')) {
    // ankylosaur osteoderms: rows of studs over the back
    for (let i = 0; i < 9; i++) for (let k = -2; k <= 2; k++) {
      const t = i / 8, zz = lerp(n1.z * 0.8, R.P('tail0').z * 0.5, t);
      const by = (zz > 0 ? lerpY(hip, sh, zz / torso) : hip) + bh * (0.95 - Math.abs(k) * 0.16);
      const p = V(k * bw * 0.36, by, zz);
      const sz = bw * (0.13 + (k === 0 ? 0.03 : 0)) * (1 - Math.abs(k) * 0.08);
      R.prim(shapes.cone(5), aim(p, p.clone().add(V(k * sz * 0.4, sz * 1.1, 0)), sz * 0.85), (i + k) % 2 ? (cols.armor || dark(top, 0.75)) : light(cols.armor || dark(top, 0.75), 0.18), R.B(zz > torso * 0.55 ? 'chest' : zz > 0 ? 'spine' : 'hips'), { glow: !!cols.armorGlow && (i + k) % 3 === 0 });
    }
  }
  if (F.has('sidespikes')) for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
    const zz = lerp(torso * 0.9, -tailL * 0.15, i / 4), by = (zz > 0 ? lerpY(hip, sh, zz / torso) : hip) + bh * 0.1;
    const p = V(s * bw * 0.92, by, zz);
    spike(R, R.B(zz > torso * 0.55 ? 'chest' : zz > 0 ? 'spine' : zz > -tailL * 0.2 ? 'hips' : 'tail0'), p, p.clone().add(V(s * bw * 0.55, -bh * 0.05, -bw * 0.12)), bw * 0.09, cols.horn || '#e0d4b8');
  }
  if (F.has('club')) {
    const cp = tip.clone().add(V(0, 0, tailL * 0.02));
    R.prim(shapes.dode(), M(cp.x, cp.y, cp.z, 0, 0, 0, bw * 0.75, bw * 0.48, bw * 0.6), cols.club || dark(top, 0.65), R.B('tail4'));
    for (const s of [-1, 1]) R.prim(shapes.dode(), M(cp.x + s * bw * 0.3, cp.y, cp.z, 0, 0, 0, bw * 0.5, bw * 0.4, bw * 0.55), cols.club || dark(top, 0.65), R.B('tail4'));
  }
  if (F.has('sail')) {
    const n = 16, sc = cols.sail || acc;
    for (let i = 0; i < n; i++) {
      const at = t => { const zz = lerp(torso * 0.95, -tailL * 0.12, t); const y = (zz > 0 ? lerpY(hip, sh, zz / torso) : hip) + bh * 0.85; return V(0, y, zz); };
      const hg = t => (D.sailH ?? hip) * Math.pow(Math.sin(Math.PI * t), 0.7);
      const t0 = i / n, t1 = (i + 1) / n, a0 = at(t0), a1 = at(t1);
      const b0 = a0.clone().add(V(0, hg(t0), 0)), b1 = a1.clone().add(V(0, hg(t1), 0));
      const col = i % 2 ? sc : dark(sc, 0.75);
      R.tri(a0, b0, b1, col, bodyW(a0), bodyW(a0), bodyW(a1), { double: true });
      R.tri(a0, b1, a1, col, bodyW(a0), bodyW(a1), bodyW(a1), { double: true });
    }
  }
  if (F.has('scutes')) for (let i = 0; i < 16; i++) for (const s of [-1, 1]) {
    const t = i / 15, zz = lerp(torso * 0.95, tip.z * 0.85, t);
    const by = (zz > 0 ? lerpY(hip, sh, zz / torso) : hip - (D.droop ?? 0.22) * hip * (-zz / tailL)) + bh * (0.95 - Math.max(0, -zz / tailL) * 0.7);
    const p = V(s * bw * (0.25 - t * 0.18), by, zz);
    R.prim(shapes.cone(4), aim(p, p.clone().add(V(0, bw * 0.16, 0)), bw * 0.08), dark(top, 0.75), R.B(zz > torso * 0.55 ? 'chest' : zz > 0 ? 'spine' : zz > tailL * -0.26 ? 'hips' : zz > tailL * -0.49 ? 'tail0' : zz > tailL * -0.69 ? 'tail1' : 'tail2'));
  }
  if (F.has('fur')) {
    // a shaggy skirt of fur hanging from the flanks and belly
    const fc = cols.fur || dark(top, 0.85);
    for (let i = 0; i < 18; i++) for (const s of [-1, 1]) {
      const zz = lerp(-tailL * 0.05, torso * 1.02, i / 17);
      const by = lerpY(hip, sh, Math.max(0, zz / torso)) - bh * 0.55;
      const p = V(s * bw * 0.9, by, zz), q = p.clone().add(V(s * bw * 0.12, -bh * (0.55 + 0.2 * Math.sin(i * 1.7)), -bw * 0.1));
      const w = bodyW(p);
      R.tri(p, q, p.clone().add(V(0, 0, torso * 0.07)), i % 2 ? fc : dark(fc, 0.85), w, w, w, { double: true });
    }
    // a woolly dome on top of the head
    R.prim(shapes.ico(1), M(hd.x, hd.y + headH * 0.48, hd.z + headL * 0.05, 0, 0, 0, headW * 1.7, headH * 0.9, headL * 0.65), fc, Hb);
  }
  if (F.has('trunk')) {
    // an animated trunk: three bones hanging from the snout
    const t0 = hpts[3].p.clone().add(V(0, -headH * 0.05, 0));
    R.bone('trunk0', 'head', t0.x, t0.y, t0.z);
    const t1 = t0.clone().add(V(0, -headL * 0.45, headL * 0.12)); R.bone('trunk1', 'trunk0', t1.x, t1.y, t1.z);
    const t2 = t1.clone().add(V(0, -headL * 0.45, headL * 0.02)); R.bone('trunk2', 'trunk1', t2.x, t2.y, t2.z);
    const t3 = t2.clone().add(V(0, -headL * 0.35, headL * 0.12));
    R.loft([{ p: t0, w: headW * 0.4, h: headW * 0.38 }, { p: t1, w: headW * 0.3, h: headW * 0.28 }, { p: t2, w: headW * 0.22, h: headW * 0.2 }, { p: t3, w: headW * 0.17, h: headW * 0.17 }],
      R.path(['trunk0', 'trunk1', 'trunk2'], t3), { sides: 7, sub: 3, top: cols.skin || top, bellyCol: cols.skin || top, up: V(0, 0, 1), pattern: (s) => (Math.sin(s * 60) > 0.6 ? dark(cols.skin || top, 0.85) : null) });
  }
  if (F.has('tusks')) for (const s of [-1, 1]) horn(R, Hb, hpts[2].p.clone().add(V(s * headW * 0.45, -headH * 0.25, -headL * 0.05)), V(s * 0.35, -0.6, 1), headL * (D.tusk ?? 1.4), headW * 0.13, V(-s * 0.08, 0.28, -0.02), cols.tusk || '#f2ead6', 6);
  if (F.has('ears')) for (const s of [-1, 1]) R.prim(shapes.ico(0), M(hd.x + s * headW * 0.95, hd.y + headH * 0.25, hd.z - headL * 0.05, 0, s * 0.4, 0, headW * 0.25, headH * 0.6, headL * 0.32), dark(cols.skin || top, 0.8), Hb);
  if (F.has('catears')) for (const s of [-1, 1]) spike(R, Hb, hd.clone().add(V(s * headW * 0.55, headH * 0.42, -headL * 0.05)), hd.clone().add(V(s * headW * 0.75, headH * 0.85, -headL * 0.12)), headW * 0.2, dark(top, 0.85));
  if (F.has('sabers')) for (const s of [-1, 1]) horn(R, Hb, hpts[2].p.clone().add(V(s * headW * 0.32, -headH * 0.32, headL * 0.05)), V(0, -1, 0.12), headH * 1.05, headW * 0.09, V(0, 0, -0.07), '#f6efdc', 4);
  if (F.has('crystals')) for (let i = 0; i < 10; i++) {
    const t = i / 9, zz = lerp(n1.z * 0.8, R.P('tail1').z, t);
    const by = (zz > 0 ? lerpY(hip, sh, zz / torso) : hip) + bh * 0.85;
    for (const s of [-1, 1]) {
      const p = V(s * bw * 0.15, by, zz);
      spike(R, R.B(zz > torso * 0.55 ? 'chest' : zz > 0 ? 'spine' : zz > tailL * -0.26 ? 'hips' : 'tail0'), p, p.clone().add(V(s * bw * 0.3, hip * (0.3 + 0.35 * Math.sin(Math.PI * t)), (i % 2 - 0.5) * bw * 0.2)), bw * 0.12, cols.crystal || '#c070ff', { glow: true, n: 4 });
    }
  }
  if (F.has('hump')) R.prim(shapes.ico(1), M(0, sh + bh * 0.75, torso * 0.85, 0, 0, 0, bw * 1.2, bh * 0.9, torso * 0.45), cols.fur || top, R.B('chest'));
  if (F.has('mossy')) for (let i = 0; i < 26; i++) {
    const zz = lerp(n1.z, tip.z * 0.6, (i * 0.618) % 1), by = (zz > 0 ? lerpY(hip, sh, zz / torso) : hip) + bh * 0.8;
    const p = V(Math.sin(i * 2.3) * bw * 0.5, by, zz);
    R.prim(shapes.dode(), M(p.x, p.y, p.z, i, i * 2, 0, bw * 0.4, bw * 0.22, bw * 0.4), i % 3 ? cols.moss || '#6a8a3a' : '#8a8a7a', R.B(zz > torso * 0.55 ? 'chest' : zz > 0 ? 'spine' : 'hips'));
  }
  return {
    plan: 'quad', legs, arms: [],
    roles: { root: 'root', hips: 'hips', spine: ['spine', 'chest'], neck: ['neck1'], head: 'head', jaw: 'jaw', tail: tailN, trunk: F.has('trunk') ? ['trunk0', 'trunk1', 'trunk2'] : null },
    saddle: { bone: 'spine', at: V(0, bh * (D.saddleH ?? 1.08) + (F.has('plates') ? 0 : 0.05), F.has('plates') ? torso * 0.28 : 0), seats: [V(0, bh * 1.0, -torso * 0.38)] },
    mouth: { bone: 'head', at: V(0, -headH * 0.2, headL * 0.92) },
    dims: { len: L, hip, height: Math.max(hip + bh, sh + bh), bw, bh, headL },
  };
}
const lerp = (a, b, t) => a + (b - a) * t;
const lerpY = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));

/* =====================================================================
   SAUROPOD - columns for legs, a crane for a neck
   ===================================================================== */
function sauropod(R, D, cols, sp) {
  const L = D.len, hip = D.hip, sh = D.shoulder ?? hip;
  const torso = D.torso ?? L * 0.24, tailL = D.tail ?? L * 0.4, neckL = D.neck ?? L * 0.32, headL = D.head ?? L * 0.045;
  const bw = D.bw ?? hip * 0.36, bh = D.bh ?? hip * 0.36;
  const neckW = D.neckW ?? bw * 0.42, headH = headL * 0.6, headW = headL * 0.42;
  const legW = D.legW ?? hip * 0.12;
  const ang = D.neckAngle ?? 0.9;    // radians above horizontal
  const F = new Set(D.feat || []);
  const top = cols.top, bel = cols.belly;
  const pat = patternFn(cols), glow = glowFn(cols);
  R.bone('root', null, 0, 0, 0);
  R.bone('hips', 'root', 0, hip, 0);
  R.bone('spine', 'hips', 0, (hip + sh) / 2 + bh * 0.1, torso * 0.5);
  R.bone('chest', 'spine', 0, sh, torso);
  const C0 = R.P('chest');
  const nN = 5, neckN = [];
  let p = C0.clone().add(V(0, bh * 0.4, bh * 0.4)), prev = 'chest';
  for (let i = 0; i < nN; i++) {
    R.bone('neck' + i, prev, p.x, p.y, p.z); neckN.push('neck' + i); prev = 'neck' + i;
    const a = ang * (1 - i * 0.12) + (i === nN - 1 ? -0.2 : 0);
    p = p.clone().add(V(0, Math.sin(a) * neckL / nN, Math.cos(a) * neckL / nN));
  }
  const hd = p.clone();
  R.bone('head', prev, hd.x, hd.y, hd.z);
  const jw = hd.clone().add(V(0, -headH * 0.3, headL * 0.1));
  R.bone('jaw', 'head', jw.x, jw.y, jw.z);
  const nT = 7, tailN = [];
  let z = 0; prev = 'hips';
  for (let i = 0; i < nT; i++) { z -= tailL / nT * (1.25 - i * 0.07); const f = -z / tailL; R.bone('tail' + i, prev, 0, hip + bh * 0.1 - hip * 0.3 * f + hip * 0.1 * f * f, z); prev = 'tail' + i; tailN.push(prev); }
  const tip = V(0, R.P('tail6').y, z - tailL * 0.08);
  const pts = [{ p: tip, w: 0.04, h: 0.04 }];
  for (let i = nT - 1; i >= 0; i--) { const f = Math.pow((i + 1) / nT, 0.75); pts.push({ p: R.P('tail' + i), w: bw * (0.8 - 0.76 * f) + 0.04, h: bh * (0.85 - 0.8 * f) + 0.04 }); }
  pts.push({ p: R.P('hips'), w: bw, h: bh });
  pts.push({ p: R.P('spine'), w: bw * 1.12, h: bh * 1.14, dy: -bh * 0.12 });
  pts.push({ p: C0, w: bw, h: bh, dy: -bh * 0.05 });
  for (let i = 0; i < nN; i++) { const f = i / nN; pts.push({ p: R.P('neck' + i), w: neckW * (1.6 - f * 0.75), h: neckW * (1.8 - f * 0.8) }); }
  pts.push({ p: hd.clone().add(V(0, 0, -headL * 0.1)), w: neckW * 0.75, h: neckW * 0.85 });
  const path = [['tail6', tip]];
  for (let i = nT - 1; i >= 1; i--) path.push(['tail' + (i - 1), R.P('tail' + i)]);
  path.push(['hips', R.P('tail0')], ['hips', R.P('hips')], ['spine', R.P('spine')], ['chest', C0]);
  for (let i = 0; i < nN; i++) path.push(['neck' + i, R.P('neck' + i)]);
  path.push(['head', hd]);
  const bodyPath = path.map(([b, q]) => [R.B(b), q.clone()]);
  R.loft(pts, bodyPath, { sides: 10, sub: 3, top, bellyCol: bel, pattern: pat, glowPattern: glow, belly: 0.82, capEnd: false });
  const Hb = R.B('head'), J = R.B('jaw');
  R.loft([
    { p: hd.clone().add(V(0, headH * 0.1, -headL * 0.15)), w: headW * 0.8, h: headH * 0.5 },
    { p: hd.clone().add(V(0, headH * 0.15, headL * 0.3)), w: headW, h: headH * 0.58 },
    { p: hd.clone().add(V(0, -headH * 0.05, headL * 0.95)), w: headW * 0.7, h: headH * 0.36 }],
    [[Hb, hd.clone()], [Hb, hd.clone().add(V(0, 0, headL))]], { sides: 8, sub: 3, top, bellyCol: bel, belly: 0.6, capStart: false });
  R.loft([{ p: jw, w: headW * 0.6, h: headH * 0.16 }, { p: jw.clone().add(V(0, -headH * 0.02, headL * 0.82)), w: headW * 0.5, h: headH * 0.14 }], [[J, jw.clone()], [J, jw.clone().add(V(0, 0, headL))]], { sides: 7, sub: 2, top, bellyCol: bel });
  for (const s of [-1, 1]) eye(R, Hb, hd.clone().add(V(s * headW * 0.82, headH * 0.32, headL * 0.25)), headH * 0.22, s, { iris: cols.eye || '#3a2a1a', big: true, top });
  if (F.has('nasal')) R.prim(shapes.ico(1), M(hd.x, hd.y + headH * 0.5, hd.z + headL * 0.3, 0, 0, 0, headW * 1.2, headH * 0.9, headL * 0.6), top, Hb);
  if (F.has('spines')) for (let i = 0; i < 20; i++) {
    const t = i / 19, q = R.P('neck3').clone().lerp(R.P('tail4'), t);
    const b = R.along(bodyPath, q);
    q.y += neckW * 1.4 * (t < 0.3 ? 0.9 : 1.6) + (t > 0.3 && t < 0.7 ? bh * 0.3 : 0);
    spike(R, b[0][0], q, q.clone().add(V(0, bw * 0.28, -bw * 0.12)), bw * 0.08, cols.spike || dark(top, 0.7));
  }
  if (F.has('mossy')) for (let i = 0; i < 30; i++) {
    const t = (i * 0.618) % 1, q = R.P('neck1').clone().lerp(R.P('tail2'), t);
    const b = R.along(bodyPath, q); q.y += bh * 0.8; q.x += Math.sin(i * 2.4) * bw * 0.45;
    R.prim(shapes.dode(), M(q.x, q.y, q.z, i, i * 2, 0, bw * 0.4, bw * 0.24, bw * 0.4), i % 3 ? cols.moss || '#6a8a3a' : cols.stone || '#8a8a7a', b[0][0]);
  }
  const legs = [];
  for (const front of [false, true]) for (const s of [1, -1]) {
    const nm = (front ? 'F' : 'H') + (s > 0 ? 'L' : 'R');
    const baseY = front ? sh : hip, bz = front ? torso * 0.9 : torso * 0.05;
    const U = V(s * bw * 0.72, baseY - bh * 0.35, bz), K = V(s * bw * 0.76, baseY * 0.5, bz + (front ? -0.02 : 0.06) * baseY), A = V(s * bw * 0.76, baseY * 0.1, bz), Fp = V(A.x, legW * 0.5, A.z + legW * 0.2);
    R.bone('leg' + nm, front ? 'chest' : 'hips', U.x, U.y, U.z); R.bone('knee' + nm, 'leg' + nm, K.x, K.y, K.z); R.bone('ank' + nm, 'knee' + nm, A.x, A.y, A.z); R.bone('ft' + nm, 'ank' + nm, Fp.x, Fp.y, Fp.z);
    R.loft([{ p: U.clone().add(V(0, bh * 0.35, 0)), w: legW * 1.9, h: legW * 2.0 }, { p: U.clone().lerp(K, 0.5), w: legW * 1.5, h: legW * 1.55 }, { p: K, w: legW * 1.15, h: legW * 1.2 }, { p: A, w: legW * 1.0, h: legW * 1.0 }, { p: Fp.clone().add(V(0, 0, -legW * 0.2)), w: legW * 1.15, h: legW * 0.6 }],
      R.path(['leg' + nm, 'knee' + nm, 'ank' + nm, 'ft' + nm], Fp.clone().add(V(0, 0, legW * 0.3))), { sides: 8, sub: 2, top, bellyCol: mix(top, bel, 0.35), up: V(0, 0, 1), pattern: pat });
    for (let i = 0; i < 3; i++) { const a = -0.5 + i * 0.5; const q = Fp.clone().add(V(a * legW * 0.9, -legW * 0.25, legW * 0.85)); R.prim(shapes.ico(0), M(q.x, q.y, q.z, 0, 0, 0, legW * 0.42, legW * 0.3, legW * 0.36), '#e0d6c0', R.B('ft' + nm)); }
    legs.push({ b: ['leg' + nm, 'knee' + nm, 'ank' + nm, 'ft' + nm], side: s, front });
  }
  return {
    plan: 'quad', heavy: true, legs, arms: [],
    roles: { root: 'root', hips: 'hips', spine: ['spine', 'chest'], neck: neckN, head: 'head', jaw: 'jaw', tail: tailN },
    saddle: { bone: 'chest', at: V(0, bh * 1.02, -torso * 0.05), seats: [V(0, bh * 1.1, -torso * 0.5), V(0, bh * 1.05, -torso * 0.95), V(0, bh * 0.95, -torso * 1.35)] },
    mouth: { bone: 'head', at: V(0, -headH * 0.2, headL * 0.9) },
    dims: { len: L, hip, height: hd.y + headH, bw, bh, headL },
  };
}

/* =====================================================================
   PTERO - membrane wings. Built wings-out (the flight pose); on the
   ground the animator folds them and the animal walks on its knuckles.
   ===================================================================== */
function ptero(R, D, cols, sp) {
  const span = D.span, bodyL = D.body ?? span * 0.16, bw = D.bw ?? bodyL * 0.22, bh = D.bh ?? bodyL * 0.24;
  const neckL = D.neck ?? bodyL * 0.6, headL = D.head ?? bodyL * 0.95, headH = D.headH ?? headL * 0.22, headW = headL * 0.14;
  const F = new Set(D.feat || []);
  const top = cols.top, bel = cols.belly, mem = cols.membrane || dark(top, 0.8);
  const pat = patternFn(cols), glow = glowFn(cols);
  R.bone('root', null, 0, 0, 0);
  R.bone('hips', 'root', 0, 0, -bodyL * 0.35);
  R.bone('chest', 'hips', 0, bh * 0.15, bodyL * 0.45);
  const C0 = R.P('chest');
  const n1 = C0.clone().add(V(0, bh * 0.4, bh * 0.5)), n2 = n1.clone().add(V(0, neckL * 0.35, neckL * 0.45)), hd = n2.clone().add(V(0, neckL * 0.12, neckL * 0.5));
  R.bone('neck1', 'chest', n1.x, n1.y, n1.z); R.bone('neck2', 'neck1', n2.x, n2.y, n2.z); R.bone('head', 'neck2', hd.x, hd.y, hd.z);
  const jw = hd.clone().add(V(0, -headH * 0.32, headL * 0.05)); R.bone('jaw', 'head', jw.x, jw.y, jw.z);
  const tl = F.has('longtail') ? bodyL * 1.4 : bodyL * 0.3;
  R.bone('tail0', 'hips', 0, 0, -bodyL * 0.25); R.bone('tail1', 'tail0', 0, -bh * 0.05, -bodyL * 0.25 - tl * 0.5);
  const tip = V(0, -bh * 0.1, -bodyL * 0.25 - tl);
  const bodyPath = [['tail1', tip], ['tail0', R.P('tail1')], ['hips', R.P('tail0')], ['hips', R.P('hips')], ['chest', C0], ['neck1', n1], ['neck2', n2], ['head', hd]].map(([b, q]) => [R.B(b), q.clone()]);
  R.loft([
    { p: tip, w: 0.02, h: 0.02 }, { p: R.P('tail1'), w: bw * 0.18, h: bh * 0.18 }, { p: R.P('tail0'), w: bw * 0.55, h: bh * 0.55 },
    { p: R.P('hips'), w: bw * 0.85, h: bh * 0.85 }, { p: C0, w: bw, h: bh, dy: -bh * 0.1 }, { p: n1, w: bw * 0.55, h: bh * 0.6 },
    { p: n2, w: bw * 0.35, h: bh * 0.38 }, { p: hd.clone().add(V(0, 0, -headL * 0.05)), w: bw * 0.36, h: bh * 0.42 }],
    bodyPath, { sides: 8, sub: 3, top, bellyCol: bel, pattern: pat, glowPattern: glow, capEnd: false });
  const Hb = R.B('head'), J = R.B('jaw');
  // the long beak
  R.loft([
    { p: hd.clone().add(V(0, headH * 0.05, -headL * 0.1)), w: headW * 1.1, h: headH * 0.55 },
    { p: hd.clone().add(V(0, 0, headL * 0.2)), w: headW, h: headH * 0.5 },
    { p: hd.clone().add(V(0, -headH * 0.15, headL * 0.7)), w: headW * 0.5, h: headH * 0.3 },
    { p: hd.clone().add(V(0, -headH * 0.3, headL * 1.0)), w: headW * 0.12, h: headH * 0.08 }],
    [[Hb, hd.clone()], [Hb, hd.clone().add(V(0, 0, headL))]], { sides: 7, sub: 3, top: cols.beak ? mix(top, cols.beak, 0.4) : top, bellyCol: cols.beak || bel, belly: 0.6, capStart: false, capEnd: headW * 0.2, pattern: (s) => (s > 0.4 && cols.beak ? cols.beak : null) });
  R.loft([{ p: jw, w: headW * 0.8, h: headH * 0.16 }, { p: jw.clone().add(V(0, -headH * 0.1, headL * 0.6)), w: headW * 0.4, h: headH * 0.12 }, { p: jw.clone().add(V(0, -headH * 0.02, headL * 0.92)), w: headW * 0.1, h: headH * 0.06 }],
    [[J, jw.clone()], [J, jw.clone().add(V(0, 0, headL))]], { sides: 6, sub: 2, top: cols.beak || bel, bellyCol: cols.beak || bel });
  if (F.has('teeth')) for (const s of [-1, 1]) teeth(R, Hb, hd.clone().add(V(s * headW * 0.6, -headH * 0.32, headL * 0.25)), hd.clone().add(V(s * headW * 0.2, -headH * 0.38, headL * 0.8)), 6, headH * 0.2, -1, s);
  for (const s of [-1, 1]) eye(R, Hb, hd.clone().add(V(s * headW * 0.9, headH * 0.22, headL * 0.08)), headH * 0.2, s, { iris: cols.eye || '#e0a020', top, brow: !!D.fierce });
  // crests
  if (F.has('crestBack')) R.prim(shapes.cone(5), aim(hd.clone().add(V(0, headH * 0.3, 0)), hd.clone().add(V(0, headH * 0.9, -headL * 0.85)), headW * 0.55), cols.crest || '#d84a2a', Hb);
  if (F.has('crestSail')) for (let i = 0; i < 6; i++) {
    const a0 = i / 6 * Math.PI, a1 = (i + 1) / 6 * Math.PI, rr = headL * 0.62, base = hd.clone().add(V(0, headH * 0.35, headL * 0.25));
    R.tri(base, base.clone().add(V(0, Math.sin(a0) * rr, Math.cos(a0) * rr * 0.7 - rr * 0.1)), base.clone().add(V(0, Math.sin(a1) * rr, Math.cos(a1) * rr * 0.7 - rr * 0.1)), i % 2 ? cols.crest || '#ff5a3a' : dark(cols.crest || '#ff5a3a', 0.8), [[Hb, 1]], [[Hb, 1]], [[Hb, 1]], { double: true });
  }
  if (F.has('crestSmall')) R.prim(shapes.cone(5), aim(hd.clone().add(V(0, headH * 0.35, headL * 0.1)), hd.clone().add(V(0, headH * 0.85, -headL * 0.15)), headW * 0.4), cols.crest || '#d84a2a', Hb);
  if (F.has('longtail')) {
    const w = [[R.B('tail1'), 1]];
    R.tri(tip.clone().add(V(0, 0, bodyL * 0.15)), tip.clone().add(V(bodyL * 0.12, 0, -bodyL * 0.05)), tip.clone().add(V(0, 0, -bodyL * 0.2)), cols.crest || '#d84a2a', w, w, w, { double: true });
    R.tri(tip.clone().add(V(0, 0, bodyL * 0.15)), tip.clone().add(V(0, 0, -bodyL * 0.2)), tip.clone().add(V(-bodyL * 0.12, 0, -bodyL * 0.05)), cols.crest || '#d84a2a', w, w, w, { double: true });
  }
  // wings
  const wings = [];
  const half = span / 2 - bw;
  for (const s of [1, -1]) {
    const nm = s > 0 ? 'L' : 'R';
    const S = V(s * bw * 0.7, C0.y + bh * 0.3, C0.z - bh * 0.1);
    const E = S.clone().add(V(s * half * 0.2, 0, -half * 0.03));
    const W = E.clone().add(V(s * half * 0.26, 0, half * 0.04));
    const T = W.clone().add(V(s * half * 0.54, -half * 0.02, -half * 0.2));
    R.bone('sh' + nm, 'chest', S.x, S.y, S.z); R.bone('el' + nm, 'sh' + nm, E.x, E.y, E.z); R.bone('wr' + nm, 'el' + nm, W.x, W.y, W.z);
    const F1 = W.clone().lerp(T, 0.5);
    R.bone('fi' + nm, 'wr' + nm, W.x, W.y, W.z);
    R.bone('ft' + nm, 'fi' + nm, F1.x, F1.y, F1.z);   // outer half of the wing finger
    const wb = R.path(['sh' + nm, 'el' + nm, 'wr' + nm, 'ft' + nm], T);
    R.loft([{ p: S, w: bw * 0.3, h: bw * 0.3 }, { p: E, w: bw * 0.2, h: bw * 0.2 }, { p: W, w: bw * 0.15, h: bw * 0.15 }, { p: F1, w: bw * 0.09, h: bw * 0.09 }, { p: T, w: 0.02, h: 0.02 }], wb, { sides: 5, sub: 2, top, bellyCol: bel });
    // membrane: leading edge along the arm, trailing edge to the hind leg
    const chord = bodyL * 1.45 + span * 0.04;
    const Hp = V(s * bw * 0.6, 0, R.P('hips').z - bodyL * 0.05);
    const lead = [S, E, W, W.clone().lerp(T, 0.35), F1, W.clone().lerp(T, 0.78), T];
    const trail = [Hp, E.clone().add(V(s * half * 0.04, -0.02, -chord * 0.95)), W.clone().add(V(s * half * 0.06, -0.02, -chord * 0.85)), W.clone().lerp(T, 0.35).add(V(0, -0.02, -chord * 0.68)), F1.clone().add(V(0, -0.02, -chord * 0.5)), W.clone().lerp(T, 0.78).add(V(0, 0, -chord * 0.25)), T];
    const bS = R.B('sh' + nm), bE = R.B('el' + nm), bW = R.B('wr' + nm), bF = R.B('fi' + nm), bT = R.B('ft' + nm), bH = R.B('hips'), bC = R.B('chest');
    const lw = [[[bC, 0.6], [bS, 0.4]], [[bS, 0.5], [bE, 0.5]], [[bE, 0.5], [bW, 0.5]], [[bF, 1]], [[bF, 0.5], [bT, 0.5]], [[bT, 1]], [[bT, 1]]];
    const tw = [[[bH, 1]], [[bS, 0.55], [bH, 0.45]], [[bE, 0.6], [bH, 0.15], [bW, 0.25]], [[bF, 0.85], [bW, 0.15]], [[bF, 0.5], [bT, 0.5]], [[bT, 1]], [[bT, 1]]];
    for (let i = 0; i < lead.length - 1; i++) {
      const c1 = i % 2 ? mem : light(mem, 0.1), c2 = cols.memGlow && i === 3 ? cols.memGlow : dark(mem, 0.9);
      const gl = !!(cols.memGlow && i === 3);
      R.tri(lead[i], trail[i], trail[i + 1], c1, lw[i], tw[i], tw[i + 1], { double: true });
      R.tri(lead[i], trail[i + 1], lead[i + 1], c2, lw[i], tw[i + 1], lw[i + 1], { double: true, glow: gl });
    }
    // the three little hand claws at the wrist
    for (let k = 0; k < 3; k++) spike(R, bW, W, W.clone().add(V(s * 0.02, -bw * 0.1, bw * (0.35 + k * 0.08))), bw * 0.05, '#3a3028');
    wings.push({ b: ['sh' + nm, 'el' + nm, 'wr' + nm, 'fi' + nm, 'ft' + nm], side: s });
  }
  // small hind legs
  const legs = [];
  for (const s of [1, -1]) {
    const nm = s > 0 ? 'L' : 'R';
    const U = V(s * bw * 0.55, -bh * 0.3, R.P('hips').z), K = U.clone().add(V(s * bw * 0.1, -bodyL * 0.28, bodyL * 0.08)), A = K.clone().add(V(0, -bodyL * 0.26, -bodyL * 0.06));
    R.bone('thigh' + nm, 'hips', U.x, U.y, U.z); R.bone('shin' + nm, 'thigh' + nm, K.x, K.y, K.z); R.bone('foot' + nm, 'shin' + nm, A.x, A.y, A.z);
    R.loft([{ p: U, w: bw * 0.26, h: bw * 0.28 }, { p: K, w: bw * 0.15, h: bw * 0.15 }, { p: A, w: bw * 0.1, h: bw * 0.1 }], R.path(['thigh' + nm, 'shin' + nm, 'foot' + nm], A.clone().add(V(0, -0.02, 0.02))), { sides: 5, sub: 2, top, bellyCol: bel, up: V(0, 0, 1) });
    toes(R, R.B('foot' + nm), A, V(0, 0, 1), 3, bw * 0.4, bw * 0.06, top, '#3a3028', 0.3);
    legs.push({ b: ['thigh' + nm, 'shin' + nm, 'foot' + nm], side: s, front: false });
  }
  const groundH = bodyL * 0.5;
  return {
    plan: 'ptero', legs, arms: [], wings,
    roles: { root: 'root', hips: 'hips', spine: ['chest'], neck: ['neck1', 'neck2'], head: 'head', jaw: 'jaw', tail: ['tail0', 'tail1'] },
    saddle: { bone: 'chest', at: V(0, bh * 1.05, -bodyL * 0.15), seats: span > 9 ? [V(0, bh * 0.95, -bodyL * 0.55)] : [] },
    mouth: { bone: 'head', at: V(0, -headH * 0.2, headL * 0.95) },
    dims: { len: bodyL + neckL + headL, hip: groundH, height: groundH + bh * 2, bw, bh, headL, span, groundH },
  };
}

/* =====================================================================
   MARINE - plesiosaurs, mosasaurs, ichthyosaurs, pliosaurs, turtles
   ===================================================================== */
function marine(R, D, cols, sp) {
  const L = D.len, bw = D.bw ?? L * 0.1, bh = D.bh ?? L * 0.085;
  const torso = D.torso ?? L * 0.3, tailL = D.tail ?? L * 0.32, neckL = D.neck ?? L * 0.08, headL = D.head ?? L * 0.16;
  const headH = D.headH ?? headL * 0.42, headW = D.headW ?? headL * 0.3;
  const F = new Set(D.feat || []);
  const top = cols.top, bel = cols.belly;
  const pat = patternFn(cols), glow = glowFn(cols);
  R.bone('root', null, 0, 0, 0);
  R.bone('hips', 'root', 0, 0, -torso * 0.45);
  R.bone('spine', 'hips', 0, bh * 0.05, 0);
  R.bone('chest', 'spine', 0, 0, torso * 0.45);
  const C0 = R.P('chest');
  const nN = D.neckBones ?? (neckL > L * 0.2 ? 5 : 1), neckN = [];
  let prev = 'chest', p = C0.clone().add(V(0, 0, bw * 0.4));
  for (let i = 0; i < nN; i++) { R.bone('neck' + i, prev, p.x, p.y, p.z); neckN.push('neck' + i); prev = 'neck' + i; p = p.clone().add(V(0, neckL * 0.02, neckL / nN)); }
  const hd = p.clone();
  R.bone('head', prev, hd.x, hd.y, hd.z);
  const jw = hd.clone().add(V(0, -headH * 0.28, headL * 0.06)); R.bone('jaw', 'head', jw.x, jw.y, jw.z);
  const nT = 5, tailN = []; let z = R.P('hips').z; prev = 'hips';
  for (let i = 0; i < nT; i++) { z -= tailL / nT * (1.2 - i * 0.1); R.bone('tail' + i, prev, 0, 0, z); prev = 'tail' + i; tailN.push(prev); }
  const tip = V(0, 0, z - tailL * 0.1);
  const pts = [{ p: tip, w: 0.03, h: 0.03 }];
  for (let i = nT - 1; i >= 0; i--) { const f = Math.pow((i + 1) / nT, 0.8); pts.push({ p: R.P('tail' + i), w: bw * (0.72 - 0.66 * f) + 0.03, h: bh * (0.8 - 0.7 * f) * (F.has('fluke') ? 1.1 : 1) + 0.03 }); }
  pts.push({ p: R.P('hips'), w: bw * 0.92, h: bh * 0.95 });
  pts.push({ p: R.P('spine'), w: bw * 1.05, h: bh * 1.05, dy: -bh * 0.05 });
  pts.push({ p: C0, w: bw * 0.95, h: bh * 0.95 });
  for (let i = 0; i < nN; i++) { const f = (i + 1) / (nN + 1); pts.push({ p: R.P('neck' + i).clone().add(V(0, 0, nN === 1 ? -neckL * 0.1 : 0)), w: lerp(bw * 0.7, headW * 0.95, f), h: lerp(bh * 0.75, headH * 0.55, f) }); }
  pts.push({ p: hd.clone().add(V(0, 0, -headL * 0.04)), w: headW * 0.95, h: headH * 0.52 });
  const path = [['tail4', tip]];
  for (let i = nT - 1; i >= 1; i--) path.push(['tail' + (i - 1), R.P('tail' + i)]);
  path.push(['hips', R.P('tail0')], ['hips', R.P('hips')], ['spine', R.P('spine')], ['chest', C0]);
  for (let i = 0; i < nN; i++) path.push(['neck' + i, R.P('neck' + i)]);
  path.push(['head', hd]);
  const bodyPath = path.map(([b, q]) => [R.B(b), q.clone()]);
  R.loft(pts, bodyPath, { sides: 10, sub: 3, top, bellyCol: bel, pattern: pat, glowPattern: glow, belly: 0.9, capEnd: false, flat: D.flat || 0 });
  const Hb = R.B('head'), J = R.B('jaw');
  const snout = D.snout ?? 1;
  R.loft([
    { p: hd.clone().add(V(0, headH * 0.04, -headL * 0.1)), w: headW, h: headH * 0.55 },
    { p: hd.clone().add(V(0, headH * 0.04, headL * 0.25)), w: headW * 0.95, h: headH * 0.52 },
    { p: hd.clone().add(V(0, -headH * 0.06, headL * 0.65 * snout)), w: headW * (snout > 1.3 ? 0.28 : 0.6), h: headH * (snout > 1.3 ? 0.2 : 0.36) },
    { p: hd.clone().add(V(0, -headH * 0.1, headL * snout)), w: headW * (snout > 1.3 ? 0.14 : 0.4), h: headH * (snout > 1.3 ? 0.12 : 0.26) }],
    [[Hb, hd.clone()], [Hb, hd.clone().add(V(0, 0, headL * snout))]], { sides: 8, sub: 3, top, bellyCol: '#8e3a40', belly: 0.6, pattern: (s, v) => (v < -0.55 ? '#8e3a40' : null), glowPattern: glow, capStart: false, capEnd: headW * 0.2 });
  const jEnd = hd.clone().add(V(0, -headH * 0.3, headL * snout * 0.95));
  R.loft([{ p: jw, w: headW * 0.8, h: headH * 0.17 }, { p: jw.clone().lerp(jEnd, 0.5), w: headW * (snout > 1.3 ? 0.3 : 0.55), h: headH * 0.15 }, { p: jEnd, w: headW * (snout > 1.3 ? 0.12 : 0.36), h: headH * 0.11 }],
    [[J, jw.clone()], [J, jEnd.clone()]], { sides: 7, sub: 2, top: '#b04a52', bellyCol: bel, pattern: (s, v) => (v > 0.5 ? '#b85a5a' : null) });
  if (!F.has('beak')) for (const s of [-1, 1]) {
    teeth(R, Hb, hd.clone().add(V(s * headW * 0.7, -headH * 0.27, headL * 0.2)), hd.clone().add(V(s * headW * 0.2, -headH * 0.2, headL * snout * 0.94)), snout > 1.3 ? 14 : 9, headH * (snout > 1.3 ? 0.1 : 0.17), -1, s);
    teeth(R, J, jw.clone().add(V(s * headW * 0.55, headH * 0.07, headL * 0.2)), jEnd.clone().add(V(s * headW * 0.15, headH * 0.05, 0)), snout > 1.3 ? 13 : 8, headH * (snout > 1.3 ? 0.09 : 0.14), 1, s);
  } else {
    R.prim(shapes.cone(6), aim(hd.clone().add(V(0, -headH * 0.05, headL * 0.8)), hd.clone().add(V(0, -headH * 0.32, headL * 1.08)), headW * 0.45), cols.beak || '#c8b080', Hb);
  }
  for (const s of [-1, 1]) eye(R, Hb, hd.clone().add(V(s * headW * 0.82, headH * 0.18, headL * 0.18)), headH * 0.2 * (D.eye || 1), s, { iris: cols.eye || '#e0a020', slit: !F.has('beak'), brow: !!D.fierce, top, big: !!D.bigEye });
  // flippers: two bones each, flat lofts swept back
  const flippers = [];
  for (const front of [true, false]) for (const s of [1, -1]) {
    const nm = (front ? 'F' : 'H') + (s > 0 ? 'L' : 'R');
    const fl = (front ? D.flipF : D.flipH) ?? L * 0.18;
    if (fl <= 0) continue;
    const base = (front ? C0 : R.P('hips')).clone().add(V(s * bw * 0.75, -bh * 0.35, front ? -bw * 0.1 : 0));
    const mid = base.clone().add(V(s * fl * 0.48, -fl * 0.06, -fl * 0.12)), end = base.clone().add(V(s * fl, -fl * 0.08, -fl * 0.42));
    R.bone('fl' + nm, front ? 'chest' : 'hips', base.x, base.y, base.z); R.bone('fl2' + nm, 'fl' + nm, mid.x, mid.y, mid.z);
    R.loft([{ p: base, w: fl * 0.16, h: fl * 0.16 }, { p: mid, w: fl * 0.2, h: fl * 0.2 }, { p: end, w: 0.02, h: 0.02 }],
      R.path(['fl' + nm, 'fl2' + nm], end), { sides: 8, sub: 3, top, bellyCol: bel, flat: 0.78, up: V(0, 1, 0), capEnd: false });
    flippers.push({ b: ['fl' + nm, 'fl2' + nm], side: s, front });
  }
  // tail fin
  if (F.has('fluke') || F.has('crescent')) {
    const tb = [[R.B('tail4'), 1]];
    const t0 = R.P('tail4'), hgt = (D.fin ?? L * 0.14);
    const up = F.has('crescent') ? 1 : 0.35, dn = F.has('crescent') ? 1 : 1.1;
    const a = t0.clone().add(V(0, 0, tailL * 0.06)), b = tip.clone().add(V(0, hgt * up, -hgt * 0.35)), c = tip.clone().add(V(0, -hgt * dn, -hgt * 0.4)), m = tip.clone();
    R.tri(a, b, m, dark(top, 0.85), tb, tb, tb, { double: true });
    R.tri(a, m, c, top, tb, tb, tb, { double: true });
  }
  if (F.has('dorsal')) {
    const w = R.along(bodyPath, R.P('spine'));
    const a = R.P('spine').clone().add(V(0, bh * 0.85, bw * 0.4)), b = R.P('spine').clone().add(V(0, bh * 0.85 + (D.dorsal ?? L * 0.08), -bw * 0.6)), c = R.P('hips').clone().add(V(0, bh * 0.75, 0));
    R.tri(a, b, c, dark(top, 0.85), w, w, w, { double: true });
  }
  if (F.has('shell')) {
    const s0 = R.P('spine');
    R.prim(shapes.ico(1), M(s0.x, s0.y + bh * 0.25, s0.z, 0, 0, 0, bw * 2.5, bh * 1.6, torso * 1.25), cols.shell || dark(top, 0.8), R.B('spine'), { colorFn: q => (Math.sin(q.x * 6 / L * 4) * Math.sin(q.z * 6 / L * 4) > 0.2 ? light(cols.shell || dark(top, 0.8), 0.15) : cols.shell || dark(top, 0.8)) });
    for (let i = 0; i < 5; i++) R.prim(shapes.cone(4), aim(V(0, s0.y + bh * 1.02, s0.z + torso * (0.4 - i * 0.2)), V(0, s0.y + bh * 1.2, s0.z + torso * (0.35 - i * 0.2)), bw * 0.12), dark(cols.shell || top, 0.7), R.B('spine'));
  }
  if (F.has('lure')) {
    const a = hd.clone().add(V(0, headH * 0.45, headL * 0.1));
    R.bone('lure', 'head', a.x, a.y, a.z);
    const b = a.clone().add(V(0, headL * 0.5, headL * 0.5));
    R.prim(shapes.cyl(5), aim(a, b, headW * 0.05), top, R.B('lure'));
    R.prim(shapes.ico(1), M(b.x, b.y, b.z, 0, 0, 0, headW * 0.35, headW * 0.35, headW * 0.35), cols.glow || '#40ffd0', R.B('lure'), { glow: true });
  }
  return {
    plan: 'marine', legs: [], arms: [], flippers,
    roles: { root: 'root', hips: 'hips', spine: ['spine', 'chest'], neck: neckN, head: 'head', jaw: 'jaw', tail: tailN },
    saddle: { bone: 'spine', at: V(0, bh * (F.has('shell') ? 1.55 : 1.0), torso * 0.1), seats: L > 8 ? [V(0, bh * 0.95, -torso * 0.35)] : [] },
    mouth: { bone: 'head', at: V(0, -headH * 0.15, headL * snout * 0.9) },
    dims: { len: L, hip: 0, height: bh * 2, bw, bh, headL },
  };
}

/* =====================================================================
   FISH - sharks and armoured fish
   ===================================================================== */
function fish(R, D, cols, sp) {
  const L = D.len, bw = D.bw ?? L * 0.1, bh = D.bh ?? L * 0.12;
  const F = new Set(D.feat || []);
  const top = cols.top, bel = cols.belly;
  const pat = patternFn(cols), glow = glowFn(cols);
  R.bone('root', null, 0, 0, 0);
  R.bone('spine', 'root', 0, 0, 0);
  R.bone('head', 'spine', 0, 0, L * 0.22);
  const hd = R.P('head');
  const jw = hd.clone().add(V(0, -bh * 0.35, L * 0.05)); R.bone('jaw', 'head', jw.x, jw.y, jw.z);
  R.bone('tail0', 'spine', 0, 0, -L * 0.15); R.bone('tail1', 'tail0', 0, bh * 0.02, -L * 0.3); R.bone('tail2', 'tail1', 0, bh * 0.04, -L * 0.44);
  const tip = V(0, bh * 0.05, -L * 0.55);
  const bodyPath = [['tail2', tip], ['tail1', R.P('tail2')], ['tail0', R.P('tail1')], ['spine', R.P('tail0')], ['spine', R.P('spine')], ['head', hd], ['head', V(0, 0, L * 0.45)]].map(([b, q]) => [R.B(b), q.clone()]);
  const armor = F.has('armor');
  R.loft([
    { p: tip, w: bw * 0.1, h: bh * 0.12 }, { p: R.P('tail2'), w: bw * 0.2, h: bh * 0.25 }, { p: R.P('tail1'), w: bw * 0.5, h: bh * 0.55 }, { p: R.P('tail0'), w: bw * 0.85, h: bh * 0.88 },
    { p: R.P('spine'), w: bw, h: bh, dy: -bh * 0.05 }, { p: hd, w: bw * 0.88, h: bh * 0.85 }, { p: V(0, -bh * 0.05, L * 0.38), w: bw * 0.6, h: bh * 0.55 }, { p: V(0, -bh * 0.1, L * 0.45), w: bw * 0.25, h: bh * 0.25 }],
    bodyPath, { sides: 10, sub: 3, top, bellyCol: bel, pattern: pat, glowPattern: glow, belly: 0.85, capStart: false });
  const Hb = R.B('head'), J = R.B('jaw');
  // lower jaw with a gaping mouth
  R.loft([{ p: jw, w: bw * 0.65, h: bh * 0.2 }, { p: jw.clone().add(V(0, -bh * 0.02, L * 0.12)), w: bw * 0.5, h: bh * 0.16 }, { p: jw.clone().add(V(0, bh * 0.04, L * 0.17)), w: bw * 0.3, h: bh * 0.1 }],
    [[J, jw.clone()], [J, jw.clone().add(V(0, 0, L * 0.2))]], { sides: 8, sub: 2, top: armor ? (cols.plate || '#8a8070') : '#a84a50', bellyCol: bel, pattern: (s, v) => (v > 0.5 && !armor ? '#b85a5a' : null) });
  if (!armor) for (const s of [-1, 1]) {
    teeth(R, Hb, V(s * bw * 0.55, -bh * 0.4, L * 0.28), V(s * bw * 0.2, -bh * 0.3, L * 0.42), 7, bh * 0.16, -1, s);
    teeth(R, J, jw.clone().add(V(s * bw * 0.45, bh * 0.1, L * 0.04)), jw.clone().add(V(s * bw * 0.2, bh * 0.08, L * 0.15)), 6, bh * 0.13, 1, s);
  } else {
    // dunkleosteus: bony plates over the head and a beak-like blade
    R.prim(shapes.ico(1), M(0, bh * 0.1, L * 0.3, 0, 0, 0, bw * 2.05, bh * 1.85, L * 0.32), cols.plate || '#8a8070', Hb, { colorFn: q => (Math.sin(q.z * 30 / L) > 0.6 ? dark(cols.plate || '#8a8070', 0.8) : cols.plate || '#8a8070') });
    for (const s of [-1, 1]) spike(R, Hb, V(s * bw * 0.3, -bh * 0.38, L * 0.4), V(s * bw * 0.15, -bh * 0.62, L * 0.44), bw * 0.1, '#e0d8c0');
  }
  for (const s of [-1, 1]) eye(R, Hb, V(s * bw * 0.72, bh * 0.2, L * 0.33), bh * 0.11 * (D.eye || 1), s, { iris: cols.eye || '#1a1a1a', top });
  const finC = cols.fin || dark(top, 0.85);
  const sp0 = [[R.B('spine'), 1]];
  // dorsal
  R.tri(V(0, bh * 0.9, L * 0.06), V(0, bh * 0.9 + (D.dorsal ?? L * 0.13), -L * 0.04), V(0, bh * 0.75, -L * 0.12), finC, sp0, sp0, sp0, { double: true });
  // tail fin (heterocercal for sharks)
  const tb = [[R.B('tail2'), 1]];
  const th = D.tailFin ?? L * 0.22;
  R.tri(R.P('tail2'), tip.clone().add(V(0, th, -th * 0.55)), tip, finC, tb, tb, tb, { double: true });
  R.tri(R.P('tail2'), tip, tip.clone().add(V(0, -th * 0.65, -th * 0.35)), dark(finC, 0.9), tb, tb, tb, { double: true });
  // pectoral fins
  const fins = [];
  for (const s of [1, -1]) {
    const nm = s > 0 ? 'L' : 'R';
    const b = V(s * bw * 0.8, -bh * 0.45, L * 0.12);
    R.bone('pec' + nm, 'spine', b.x, b.y, b.z);
    const w = [[R.B('pec' + nm), 1]];
    R.tri(b, b.clone().add(V(s * L * 0.18, -L * 0.06, -L * 0.12)), b.clone().add(V(0, 0, -L * 0.1)), finC, w, w, w, { double: true });
    fins.push({ b: ['pec' + nm], side: s });
  }
  if (!armor) for (const s of [-1, 1]) for (let k = 0; k < 4; k++) R.prim(shapes.box(), M(s * bw * 0.86, -bh * 0.05, L * (0.24 - k * 0.025), 0, 0, 0.1, bw * 0.04, bh * 0.45, L * 0.006), dark(top, 0.6), Hb);
  return {
    plan: 'fish', legs: [], arms: [], fins,
    roles: { root: 'root', hips: 'spine', spine: ['spine'], neck: [], head: 'head', jaw: 'jaw', tail: ['tail0', 'tail1', 'tail2'] },
    saddle: { bone: 'spine', at: V(0, bh * 1.0, -L * 0.02), seats: L > 12 ? [V(0, bh * 0.85, -L * 0.14)] : [] },
    mouth: { bone: 'head', at: V(0, -bh * 0.3, L * 0.2) },
    dims: { len: L, hip: 0, height: bh * 2, bw, bh, headL: L * 0.2 },
  };
}

/* =====================================================================
   ARTHROPODS
   ===================================================================== */
function dragonfly(R, D, cols) {
  const L = D.len, top = cols.top, wing = cols.wing || '#cfe8f4';
  R.bone('root', null, 0, 0, 0);
  R.bone('thorax', 'root', 0, 0, 0);
  R.bone('head', 'thorax', 0, 0.02 * L, L * 0.16);
  const ab = []; let prev = 'thorax';
  for (let i = 0; i < 5; i++) { R.bone('ab' + i, prev, 0, 0, -L * (0.08 + i * 0.13)); prev = 'ab' + i; ab.push(prev); }
  const tip = V(0, 0, -L * 0.72);
  const path = [['ab4', tip], ['ab3', R.P('ab4')], ['ab2', R.P('ab3')], ['ab1', R.P('ab2')], ['ab0', R.P('ab1')], ['thorax', R.P('ab0')], ['thorax', V()], ['head', R.P('head')]].map(([b, q]) => [R.B(b), q.clone()]);
  R.loft([{ p: tip, w: L * 0.012, h: L * 0.012 }, { p: R.P('ab3'), w: L * 0.025, h: L * 0.028 }, { p: R.P('ab1'), w: L * 0.032, h: L * 0.035 }, { p: R.P('ab0'), w: L * 0.04, h: L * 0.045 }, { p: V(), w: L * 0.07, h: L * 0.075 }, { p: V(0, 0.01 * L, L * 0.12), w: L * 0.05, h: L * 0.05 }],
    path, { sides: 7, sub: 2, top, bellyCol: cols.belly || top, pattern: (s) => (Math.sin(s * 50) > 0.7 ? cols.accent || '#e0e060' : null), glowPattern: glowFn(cols) });
  const H = R.B('head'), hp = R.P('head');
  R.prim(shapes.ico(1), M(hp.x, hp.y, hp.z + L * 0.02, 0, 0, 0, L * 0.08, L * 0.07, L * 0.07), top, H);
  for (const s of [-1, 1]) R.prim(shapes.ico(1), M(s * L * 0.04, hp.y + L * 0.015, hp.z + L * 0.03, 0, 0, 0, L * 0.06, L * 0.065, L * 0.06), cols.eye || '#40c070', H, { jit: 0.15 });
  const wings = [];
  for (const [k, zo] of [[0, 0.03], [1, -0.04]]) for (const s of [1, -1]) {
    const nm = 'w' + k + (s > 0 ? 'L' : 'R');
    const b = V(s * L * 0.03, L * 0.04, L * zo); R.bone(nm, 'thorax', b.x, b.y, b.z);
    const w = [[R.B(nm), 1]], span = L * (k ? 0.6 : 0.65);
    const pts = [b, b.clone().add(V(s * span * 0.3, 0, L * 0.05)), b.clone().add(V(s * span, 0, L * 0.02)), b.clone().add(V(s * span * 0.95, 0, -L * 0.06)), b.clone().add(V(s * span * 0.4, 0, -L * 0.09))];
    for (let i = 1; i < pts.length - 1; i++) R.tri(pts[0], pts[i], pts[i + 1], i % 2 ? wing : mix(wing, '#ffffff', 0.3), w, w, w, { double: true, glow: !!cols.wingGlow });
    wings.push({ b: [nm], side: s, insect: true });
  }
  const legs = [];
  for (let i = 0; i < 3; i++) for (const s of [1, -1]) {
    const nm = 'lg' + i + (s > 0 ? 'L' : 'R');
    const b = V(s * L * 0.03, -L * 0.04, L * (0.04 - i * 0.04)); R.bone(nm, 'thorax', b.x, b.y, b.z);
    R.prim(shapes.cyl(4), aim(b, b.clone().add(V(s * L * 0.07, -L * 0.08, L * 0.03 * (1 - i))), L * 0.006), dark(top, 0.6), R.B(nm));
    legs.push({ b: [nm], side: s, insect: true });
  }
  return { plan: 'insectfly', legs, wings, arms: [], roles: { root: 'root', hips: 'thorax', spine: ['thorax'], neck: [], head: 'head', jaw: null, tail: ab },
    saddle: { bone: 'thorax', at: V(0, L * 0.1, 0), seats: [] }, mouth: { bone: 'head', at: V(0, 0, L * 0.06) }, dims: { len: L, hip: 0, height: L * 0.15, bw: L * 0.07, bh: L * 0.075, headL: L * 0.1 } };
}

function millipede(R, D, cols) {
  const L = D.len, n = D.segs ?? 12, seg = L / n, w = D.w ?? L * 0.08, hgt = D.hip ?? L * 0.06;
  const top = cols.top, rim = cols.accent || light(top, 0.35);
  R.bone('root', null, 0, 0, 0);
  const segs = []; let prev = 'root';
  for (let i = 0; i < n; i++) { const z = L * 0.45 - i * seg; R.bone('s' + i, prev, 0, hgt, z); prev = 's' + i; segs.push(prev); }
  const legs = [];
  for (let i = 0; i < n; i++) {
    const p = R.P('s' + i), b = R.B('s' + i);
    const ww = w * (i === 0 ? 0.8 : i > n - 3 ? 0.75 : 1);
    R.prim(shapes.ico(1), M(p.x, p.y + hgt * 0.05, p.z - seg * 0.45, 0, 0, 0, ww * 2.1, hgt * 1.3, seg * 1.25), i % 2 ? top : dark(top, 0.88), b);
    R.prim(shapes.box(), M(p.x, p.y + hgt * 0.55, p.z - seg * 0.45, 0, 0, 0, ww * 1.6, hgt * 0.2, seg * 0.3), rim, b);
    if (i === 0) {
      for (const s of [-1, 1]) { R.prim(shapes.ico(0), M(s * ww * 0.45, p.y + hgt * 0.2, p.z + seg * 0.1, 0, 0, 0, w * 0.25, w * 0.25, w * 0.25), '#101010', b); spike(R, b, V(s * ww * 0.3, p.y, p.z + seg * 0.2), V(s * ww * 0.9, p.y + hgt * 0.4, p.z + seg * 1.4), w * 0.05, dark(top, 0.6)); }
      continue;
    }
    for (const s of [1, -1]) {
      const nm = 'lg' + i + (s > 0 ? 'L' : 'R');
      const b0 = V(s * ww * 0.8, hgt * 0.8, p.z - seg * 0.45); R.bone(nm, 's' + i, b0.x, b0.y, b0.z);
      const knee = b0.clone().add(V(s * w * 0.6, hgt * 0.25, 0)), ft = V(s * (ww + w * 1.0), 0.02, p.z - seg * 0.45);
      R.prim(shapes.cyl(4), aim(b0, knee, w * 0.07), rim, R.B(nm)); R.prim(shapes.cyl(4), aim(knee, ft, w * 0.06), rim, R.B(nm));
      legs.push({ b: [nm], side: s, seg: i, insect: true });
    }
  }
  return { plan: 'millipede', legs, arms: [], roles: { root: 'root', hips: 's0', spine: segs, neck: [], head: 's0', jaw: null, tail: [] },
    saddle: { bone: 's' + Math.floor(n * 0.35), at: V(0, hgt * 0.8, 0), seats: [V(0, hgt * 0.8, -seg * 3)] }, mouth: { bone: 's0', at: V(0, 0, seg) }, dims: { len: L, hip: hgt, height: hgt * 2, bw: w, bh: hgt, headL: seg } };
}

function scorpion(R, D, cols) {
  const L = D.len, w = D.w ?? L * 0.13, hgt = D.hip ?? L * 0.1, top = cols.top, acc = cols.accent || dark(top, 0.75);
  R.bone('root', null, 0, 0, 0);
  R.bone('body', 'root', 0, hgt, 0);
  const tail = []; let prev = 'body', p = V(0, hgt + w * 0.25, -L * 0.24);
  // the tail arches up and over the back in five segments
  const seg = L * 0.085, angs = [0.25, 0.75, 1.25, 1.75, 2.3];
  for (let i = 0; i < 5; i++) { R.bone('t' + i, prev, p.x, p.y, p.z); prev = 't' + i; tail.push(prev); p = p.clone().add(V(0, Math.sin(angs[i]) * seg, -Math.cos(angs[i]) * seg)); }
  const st = p.clone();
  R.bone('sting', prev, st.x, st.y, st.z);
  const B = R.B('body');
  for (let i = 0; i < 5; i++) R.prim(shapes.ico(1), M(0, hgt + w * 0.1, L * (0.14 - i * 0.085), 0, 0, 0, w * 2 * (1 - i * 0.09), w * 0.95, L * 0.12), i % 2 ? top : dark(top, 0.88), B);
  R.prim(shapes.ico(1), M(0, hgt + w * 0.14, L * 0.22, 0, 0, 0, w * 1.6, w * 0.8, L * 0.14), dark(top, 0.85), B);
  for (let i = 0; i < 5; i++) {
    const q = R.P('t' + i), nx = i < 4 ? R.P('t' + (i + 1)) : st, mid = q.clone().lerp(nx, 0.5);
    const g = shapes.ico(1), qq = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), nx.clone().sub(q).normalize());
    R.prim(g, new THREE.Matrix4().compose(mid, qq, V(w * 0.95 * (1 - i * 0.08), w * 0.8 * (1 - i * 0.06), seg * 1.35)), i % 2 ? top : acc, R.B('t' + i));
  }
  R.prim(shapes.ico(1), M(st.x, st.y, st.z, 0, 0, 0, w * 0.6, w * 0.6, w * 0.8), cols.sting || '#d8a040', R.B('sting'), { glow: !!cols.stingGlow });
  spike(R, R.B('sting'), st.clone().add(V(0, -w * 0.1, w * 0.2)), st.clone().add(V(0, -w * 0.5, w * 0.7)), w * 0.12, '#1a1410');
  for (const s of [-1, 1]) eye(R, B, V(s * w * 0.25, hgt + w * 0.5, L * 0.26), w * 0.1, s, { iris: '#101010', top });
  const arms = [];
  for (const s of [1, -1]) {
    const nm = s > 0 ? 'L' : 'R';
    const a = V(s * w * 0.6, hgt, L * 0.25), b = a.clone().add(V(s * L * 0.14, 0.02, L * 0.08)), c = b.clone().add(V(-s * L * 0.02, 0, L * 0.12));
    R.bone('arm' + nm, 'body', a.x, a.y, a.z); R.bone('fore' + nm, 'arm' + nm, b.x, b.y, b.z); R.bone('claw' + nm, 'fore' + nm, c.x, c.y, c.z);
    R.prim(shapes.cyl(5), aim(a, b, w * 0.18), top, R.B('arm' + nm)); R.prim(shapes.cyl(5), aim(b, c, w * 0.2), top, R.B('fore' + nm));
    R.prim(shapes.ico(1), M(c.x, c.y, c.z + L * 0.03, 0, 0, 0, w * 0.7, w * 0.45, L * 0.1), acc, R.B('claw' + nm));
    spike(R, R.B('claw' + nm), c.clone().add(V(s * w * 0.15, 0, L * 0.06)), c.clone().add(V(s * w * 0.1, 0, L * 0.16)), w * 0.12, dark(acc, 0.7));
    spike(R, R.B('claw' + nm), c.clone().add(V(-s * w * 0.15, 0, L * 0.06)), c.clone().add(V(-s * w * 0.05, 0, L * 0.15)), w * 0.1, dark(acc, 0.7));
    arms.push({ b: ['arm' + nm, 'fore' + nm, 'claw' + nm], side: s });
  }
  const legs = [];
  for (let i = 0; i < 4; i++) for (const s of [1, -1]) {
    const nm = 'lg' + i + (s > 0 ? 'L' : 'R');
    const z = L * (0.12 - i * 0.09);
    const a = V(s * w * 0.8, hgt, z); R.bone(nm, 'body', a.x, a.y, a.z);
    const k = a.clone().add(V(s * L * 0.12, hgt * 0.55, (1.5 - i) * L * 0.03)), f = V(s * (w + L * 0.2), 0.02, z + (1.5 - i) * L * 0.06);
    R.prim(shapes.cyl(5), aim(a, k, w * 0.14), top, R.B(nm)); R.prim(shapes.cone(5), aim(k, f, w * 0.12), dark(top, 0.85), R.B(nm));
    legs.push({ b: [nm], side: s, seg: i, insect: true });
  }
  return { plan: 'scorpion', legs, arms, roles: { root: 'root', hips: 'body', spine: ['body'], neck: [], head: 'body', jaw: null, tail },
    saddle: { bone: 'body', at: V(0, w * 0.75, 0), seats: [] }, mouth: { bone: 'body', at: V(0, 0, L * 0.3) }, dims: { len: L, hip: hgt, height: hgt + w, bw: w, bh: w * 0.5, headL: L * 0.1 } };
}

const PLANS = { theropod, quad, sauropod, ptero, marine, fish, dragonfly, millipede, scorpion };

/* ---------------- templates (cached per species + variant) ---------------- */
const CACHE = new Map();
export function creatureTemplate(sp, variant, VARIANTS) {
  const key = sp.id + ':' + (variant || '');
  if (CACHE.has(key)) return CACHE.get(key);
  const V0 = variant && VARIANTS ? VARIANTS[variant] : null;
  let cols = { ...sp.cols };
  if (V0 && V0.cols) cols = typeof V0.cols === 'function' ? V0.cols(cols, sp) : { ...cols, ...V0.cols };
  const R = new RigBuilder(strSeed(key));
  const meta = PLANS[sp.body.plan](R, sp.body, cols, sp);
  const T = R.build();
  T.meta = meta; T.cols = cols;
  CACHE.set(key, T);
  return T;
}
export { mix, dark, light };
