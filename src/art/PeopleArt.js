/* PeopleArt.js - the humans: you and your friends.

   A small rigid rig (pivots for hips, chest, head, arms, forearms, legs,
   shins) built from faceted parts, with procedural poses:
     walk / run / sneak / idle, jump, swim, ride (astride a saddle), throw
     (wind-up and release), pull (leaning back on a rope), dragged (heels in,
     sliding), cheer, photo (camera up), point, ko (flat on the back), sit.
   Explorers are blocky cowboys (four looks). The random-outfit path
   (o.visitor) is left over from the old visitor crowds and is unused. */
import * as THREE from '../../lib/three.module.js';
import { geo, mat4, Mesher } from './Mesher.js';
import { clamp, damp, lerp, rng } from '../core/Util.js';

// every pivot collects its parts into one Mesher, so a whole person is ~8 draw calls
const _e = new THREE.Euler(), _q = new THREE.Quaternion();
const PM = new WeakMap();
const part = (g, c, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => ({ g, c, m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)).clone(), new THREE.Vector3(sx, sy, sz)) });
const piv = (parent, x, y, z) => {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const M = new Mesher(0.04, 7); PM.set(g, M);
  const add = g.add.bind(g);
  g.add = (o) => { if (o && o.g && o.m) { M.add(o.g, o.m, o.c); return g; } return add(o); };
  return g;
};
function bake(root) {
  root.traverse(o => { const M = PM.get(o); if (M && !M.empty) { const m = M.mesh({ dynamic: true }); m.castShadow = true; m.receiveShadow = false; o.add(m); PM.delete(o); } });
}

export const LOOKS = [
  { name: 'Wrangler', shirt: '#4a78c0', pants: '#7a5636', hat: '#8a5a34', band: '#4a2a18', skin: '#f0c09a', pack: '#7a5030', scarf: '#d03a2a', hair: '#6a4024', boots: '#5a3a22', roll: '#8a9a5a' },
  { name: 'Ranger', shirt: '#5a9a4a', pants: '#5a4a34', hat: '#c8a060', band: '#5a3a1a', skin: '#c88a5a', pack: '#6a5030', scarf: '#f0c040', hair: '#2a1a10', boots: '#4a3020', roll: '#c87a4a' },
  { name: 'Tracker', shirt: '#c85a4a', pants: '#4a4a5a', hat: '#3a3a3a', band: '#a03a2a', skin: '#8a5a3a', pack: '#5a4a3a', scarf: '#3a7ad0', hair: '#1a1210', boots: '#2a2a2a', roll: '#7a9ab0' },
  { name: 'Scout', shirt: '#e8c050', pants: '#6a4a3a', hat: '#e8dcc0', band: '#4a8a4a', skin: '#e8b48a', pack: '#8a6a40', scarf: '#8a4ac8', hair: '#c88a40', boots: '#6a3a1a', roll: '#d85a7a' },
];
const SKIN = ['#f0c8a0', '#e8b48a', '#c88a5a', '#a86a40', '#7a4a2a', '#5a3820'];
const CLOTH = ['#e85a5a', '#5a8ae8', '#5ac85a', '#f0c040', '#a05ad8', '#f08a3a', '#4ac8c8', '#e8e8e8', '#3a3a4a', '#d870a8'];
const HAIR = ['#2a1a10', '#5a3a1a', '#c89a50', '#e8d080', '#8a2a1a', '#3a3a3a', '#e8e8e8'];

/**
 o: { look (LOOKS index) | visitor: seed, kid, explorer: true }
 returns { root, P (pivots), anim(dt, s), hand (right hand group, tools hang here) }
*/
export function makeHuman(o = {}) {
  const r = rng(o.seed || 7);
  const L = o.visitor ? null : LOOKS[(o.look || 0) % LOOKS.length];
  const skin = L ? L.skin : SKIN[Math.floor(r() * SKIN.length)];
  const shirt = L ? L.shirt : CLOTH[Math.floor(r() * CLOTH.length)];
  const pants = L ? L.pants : ['#3a4a6a', '#4a3a2a', '#2a2a32', '#6a6a7a', '#8a6a4a'][Math.floor(r() * 5)];
  const hair = HAIR[Math.floor(r() * HAIR.length)];
  const s = o.kid ? 0.62 : 1;
  const root = new THREE.Group();
  const body = piv(root, 0, 0, 0); body.scale.setScalar(s);
  const P = {};
  if (L) return finish(cowboy(body, P, L), root, P, s, L);
  P.hips = piv(body, 0, 0.92, 0);
  P.hips.add(part(geo.box(), pants, 0, 0.02, 0, 0.36, 0.2, 0.22));
  P.chest = piv(P.hips, 0, 0.1, 0);
  P.chest.add(part(geo.box(), shirt, 0, 0.27, 0, 0.42, 0.5, 0.25));
  P.chest.add(part(geo.box(), shirt, 0, 0.5, 0, 0.32, 0.1, 0.22));
  if (L) {
    P.chest.add(part(geo.box(), '#5a4a30', 0, 0.12, 0.13, 0.43, 0.06, 0.02));      // belt strap
    P.chest.add(part(geo.box(), L.scarf, 0, 0.53, 0.06, 0.26, 0.08, 0.16));
    for (const sx of [-1, 1]) P.chest.add(part(geo.box(), '#7a6040', sx * 0.11, 0.33, 0.13, 0.1, 0.1, 0.03));  // pockets
    // the crate pack on the back
    const pk = piv(P.chest, 0, 0.3, -0.24); P.pack = pk;
    pk.add(part(geo.box(), L.pack, 0, 0, 0, 0.38, 0.44, 0.22));
    pk.add(part(geo.box(), '#3a2a1a', 0, 0.12, -0.115, 0.4, 0.04, 0.02));
    pk.add(part(geo.box(), '#3a2a1a', 0, -0.12, -0.115, 0.4, 0.04, 0.02));
    pk.add(part(geo.cyl(8), '#c8a060', 0, 0.28, 0, 0.12, 0.42, 0.12, 0, 0, Math.PI / 2));   // a rolled bedroll / rope coil
  } else if (r() < 0.35) P.chest.add(part(geo.box(), CLOTH[Math.floor(r() * CLOTH.length)], 0, 0.3, -0.16, 0.3, 0.34, 0.12));
  P.head = piv(P.chest, 0, 0.56, 0);
  P.head.add(part(geo.box(), skin, 0, 0.05, 0, 0.12, 0.1, 0.12));                  // neck
  P.head.add(part(geo.ico(1), skin, 0, 0.24, 0.01, 0.36, 0.38, 0.34));
  P.head.add(part(geo.ico(0), skin, 0, 0.21, 0.18, 0.07, 0.08, 0.07));               // nose
  for (const sx of [-1, 1]) {
    P.head.add(part(geo.ico(1), '#ffffff', sx * 0.075, 0.27, 0.15, 0.085, 0.09, 0.05));
    P.head.add(part(geo.ico(0), '#1a1410', sx * 0.075, 0.27, 0.172, 0.045, 0.05, 0.03));
    P.head.add(part(geo.box(), L ? '#4a3020' : hair, sx * 0.075, 0.345, 0.16, 0.08, 0.02, 0.02, 0, 0, sx * -0.1));  // brows
  }
  if (L) {
    // safari hat
    P.head.add(part(geo.cyl(12), L.hat, 0, 0.4, 0, 0.62, 0.03, 0.62));
    P.head.add(part(geo.frust(0.85, 10), L.hat, 0, 0.47, 0, 0.36, 0.14, 0.36));
    P.head.add(part(geo.cyl(10), L.band, 0, 0.43, 0, 0.37, 0.04, 0.37));
  } else {
    const hs = r();
    if (hs < 0.4) P.head.add(part(geo.ico(1), hair, 0, 0.34, -0.03, 0.38, 0.22, 0.36));
    else if (hs < 0.65) { P.head.add(part(geo.ico(1), hair, 0, 0.33, -0.04, 0.38, 0.22, 0.36)); P.head.add(part(geo.ico(1), hair, 0, 0.18, -0.15, 0.3, 0.32, 0.12)); }
    else if (hs < 0.85) { const c = CLOTH[Math.floor(r() * CLOTH.length)]; P.head.add(part(geo.ico(1), c, 0, 0.36, -0.01, 0.38, 0.18, 0.37)); P.head.add(part(geo.box(), c, 0, 0.33, 0.17, 0.3, 0.03, 0.16)); }   // cap
    else P.head.add(part(geo.ico(1), hair, 0, 0.36, -0.03, 0.34, 0.16, 0.33));
  }
  // arms
  for (const sd of [1, -1]) {
    const k = sd > 0 ? 'L' : 'R';
    const a = piv(P.chest, sd * 0.26, 0.48, 0); P['arm' + k] = a;
    a.add(part(geo.box(), shirt, 0, -0.13, 0, 0.13, 0.28, 0.13));
    const f = piv(a, 0, -0.28, 0); P['fore' + k] = f;
    f.add(part(geo.box(), skin, 0, -0.12, 0, 0.11, 0.25, 0.11));
    const h = piv(f, 0, -0.27, 0); P['hand' + k] = h;
    h.add(part(geo.ico(0), skin, 0, -0.02, 0, 0.13, 0.13, 0.11));
  }
  if (!L && r() < 0.3) { const cam = piv(P.handR, 0, 0, 0); cam.add(part(geo.box(), '#2a2a32', 0, 0, 0.06, 0.16, 0.1, 0.07)); cam.add(part(geo.cyl(8), '#4a4a5a', 0, 0, 0.12, 0.06, 0.06, 0.06, Math.PI / 2)); P.camera = cam; cam.visible = false; }
  // legs
  for (const sd of [1, -1]) {
    const k = sd > 0 ? 'L' : 'R';
    const l = piv(P.hips, sd * 0.1, -0.02, 0); P['leg' + k] = l;
    l.add(part(geo.box(), pants, 0, -0.2, 0, 0.15, 0.42, 0.16));
    const sh = piv(l, 0, -0.42, 0); P['shin' + k] = sh;
    sh.add(part(geo.box(), pants, 0, -0.18, 0, 0.13, 0.38, 0.14));
    sh.add(part(geo.box(), L ? '#4a3420' : ['#2a2a2a', '#e8e8e8', '#8a4a2a', '#3a5aa8'][Math.floor(r() * 4)], 0, -0.4, 0.04, 0.15, 0.1, 0.24));
  }
  return finish(null, root, P, s, L);
}

/* ---------------- the explorer: a blocky cowboy wrangler ----------------
   Square head under a big dented hat, angry brows, a red bandana, a denim
   shirt with pockets, a belt with a dino buckle, a holster, a coiled lasso on
   the hip, and a pack with a bedroll and a canteen. */
function cowboy(body, P, L) {
  const B = geo.box(), dk = (c, k = 0.75) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
  P.hips = piv(body, 0, 0.9, 0);
  P.hips.add(part(B, L.pants, 0, 0.02, 0, 0.38, 0.22, 0.24));
  P.hips.add(part(B, '#4a2e18', 0, 0.1, 0, 0.4, 0.07, 0.26));                         // belt
  P.hips.add(part(B, '#e8b830', 0, 0.1, 0.13, 0.1, 0.07, 0.02));                      // buckle
  P.hips.add(part(B, '#6a9a3a', 0, 0.1, 0.142, 0.06, 0.03, 0.01));                    // a little dino on it
  for (const x of [-0.12, 0.13]) P.hips.add(part(B, '#7a5a3a', x, 0.1, 0.132, 0.04, 0.06, 0.02));   // belt pouches
  P.hips.add(part(B, '#6a3e20', -0.215, -0.02, 0.02, 0.07, 0.24, 0.12));              // holster (right hip)
  P.hips.add(part(B, '#3a2414', -0.215, 0.1, 0.02, 0.05, 0.06, 0.08));
  P.hips.add(part(geo.tor(12, 0.16), '#c8a060', 0.235, -0.04, 0.01, 0.24, 0.24, 0.24, 0, Math.PI / 2, 0));   // lasso coil (left hip)
  P.hips.add(part(B, '#8a6a3a', 0.235, -0.18, 0.01, 0.03, 0.12, 0.03));
  P.chest = piv(P.hips, 0, 0.12, 0);
  P.chest.add(part(B, L.shirt, 0, 0.25, 0, 0.44, 0.46, 0.26));
  P.chest.add(part(B, dk(L.shirt, 0.92), 0, 0.03, 0, 0.42, 0.06, 0.25));             // shirt tucked in
  for (const sx of [-1, 1]) {
    P.chest.add(part(B, dk(L.shirt, 0.82), sx * 0.11, 0.27, 0.132, 0.12, 0.11, 0.02));   // pockets
    P.chest.add(part(B, dk(L.shirt, 0.7), sx * 0.11, 0.325, 0.135, 0.13, 0.03, 0.02));
    P.chest.add(part(B, L.pack, sx * 0.13, 0.25, 0.135, 0.045, 0.46, 0.02));            // pack straps
  }
  for (let i = 0; i < 3; i++) P.chest.add(part(B, '#e8e0d0', 0, 0.12 + i * 0.07, 0.133, 0.02, 0.02, 0.01));
  // the bandana: a knot around the neck and a triangle down the chest
  P.chest.add(part(B, L.scarf, 0, 0.47, 0.02, 0.32, 0.07, 0.28));
  P.chest.add(part(geo.cone(4), L.scarf, 0, 0.36, 0.14, 0.3, 0.22, 0.05, Math.PI, Math.PI / 4, 0));
  // the pack: body, bedroll on top, canteen on the back
  const pk = piv(P.chest, 0, 0.27, -0.21); P.pack = pk;
  pk.add(part(B, L.pack, 0, -0.02, 0, 0.4, 0.42, 0.17));
  pk.add(part(B, dk(L.pack, 0.7), 0, 0.12, -0.09, 0.41, 0.04, 0.02));
  pk.add(part(geo.cyl(8), L.roll, 0, 0.25, -0.02, 0.2, 0.62, 0.2, 0, 0, Math.PI / 2));
  for (const x of [-0.17, 0.17]) pk.add(part(B, '#4a2e18', x, 0.25, -0.02, 0.04, 0.22, 0.22));
  pk.add(part(geo.cyl(10), '#9a9a90', 0, -0.02, -0.11, 0.22, 0.07, 0.22, Math.PI / 2, 0, 0));
  pk.add(part(B, '#6a4a2a', 0, -0.02, -0.15, 0.04, 0.24, 0.02));
  pk.add(part(B, '#6a4a2a', 0, -0.02, -0.15, 0.24, 0.04, 0.02));
  pk.add(part(B, '#5a5a54', 0, 0.12, -0.11, 0.05, 0.05, 0.05));
  // the head: a big square block
  P.head = piv(P.chest, 0, 0.5, 0);
  P.head.add(part(B, L.skin, 0, 0.25, 0.01, 0.42, 0.4, 0.38));
  P.head.add(part(B, L.hair, 0, 0.27, -0.17, 0.44, 0.36, 0.08));                       // hair at the back
  for (const sx of [-1, 1]) {
    P.head.add(part(B, L.hair, sx * 0.215, 0.32, -0.05, 0.04, 0.22, 0.28));            // sideburns
    P.head.add(part(B, dk(L.skin, 0.9), sx * 0.22, 0.24, 0.0, 0.03, 0.09, 0.07));      // ears
    P.head.add(part(B, '#ffffff', sx * 0.09, 0.27, 0.198, 0.085, 0.07, 0.02));          // eyes
    P.head.add(part(B, '#2a1a10', sx * 0.075, 0.265, 0.206, 0.045, 0.06, 0.02));
    P.head.add(part(B, '#3a2414', sx * 0.09, 0.335, 0.2, 0.12, 0.035, 0.02, 0, 0, sx * 0.38));   // angry brows
  }
  P.head.add(part(B, dk(L.skin, 0.88), 0, 0.2, 0.205, 0.06, 0.07, 0.04));              // nose
  P.head.add(part(B, L.hair, 0, 0.43, 0.12, 0.42, 0.05, 0.14));                        // fringe under the hat
  // the hat: wide brim curling up at the sides, a dented crown, a band
  P.head.add(part(B, L.hat, 0, 0.465, -0.01, 0.62, 0.05, 0.68));
  for (const sx of [-1, 1]) P.head.add(part(B, L.hat, sx * 0.36, 0.5, -0.01, 0.14, 0.05, 0.6, 0, 0, sx * 0.45));
  P.head.add(part(B, L.hat, 0, 0.6, -0.01, 0.44, 0.22, 0.42));
  P.head.add(part(B, dk(L.hat, 0.85), 0, 0.715, -0.01, 0.2, 0.03, 0.34));             // the dent
  P.head.add(part(B, L.band, 0, 0.51, -0.01, 0.45, 0.05, 0.43));
  P.head.add(part(B, dk(L.hat, 1.15), 0.14, 0.66, 0.2, 0.06, 0.06, 0.02));            // a patch
  // arms: denim to the wrist, square hands
  for (const sd of [1, -1]) {
    const k = sd > 0 ? 'L' : 'R';
    const a = piv(P.chest, sd * 0.28, 0.44, 0); P['arm' + k] = a;
    a.add(part(B, L.shirt, 0, -0.13, 0, 0.14, 0.3, 0.14));
    const f = piv(a, 0, -0.28, 0); P['fore' + k] = f;
    f.add(part(B, dk(L.shirt, 0.95), 0, -0.1, 0, 0.13, 0.22, 0.13));
    f.add(part(B, dk(L.shirt, 0.8), 0, -0.2, 0, 0.14, 0.04, 0.14));                    // cuff
    const h = piv(f, 0, -0.26, 0); P['hand' + k] = h;
    h.add(part(B, L.skin, 0, -0.02, 0, 0.12, 0.12, 0.12));
  }
  // legs: brown trousers into boots
  for (const sd of [1, -1]) {
    const k = sd > 0 ? 'L' : 'R';
    const l = piv(P.hips, sd * 0.1, -0.02, 0); P['leg' + k] = l;
    l.add(part(B, L.pants, 0, -0.2, 0, 0.16, 0.42, 0.17));
    const sh = piv(l, 0, -0.42, 0); P['shin' + k] = sh;
    sh.add(part(B, L.pants, 0, -0.1, 0, 0.15, 0.2, 0.16));
    sh.add(part(B, L.boots, 0, -0.3, 0.02, 0.17, 0.24, 0.2));
    sh.add(part(B, dk(L.boots, 1.25), 0, -0.19, 0.02, 0.18, 0.04, 0.21));             // boot cuff
    sh.add(part(B, L.boots, 0, -0.42, 0.06, 0.17, 0.08, 0.28));                        // toe
  }
  return { mouthY: 0.14, mouthZ: 0.2 };
}

/** bake the parts, add the mouth and the animator */
function finish(o, root, P, s, L) {
  const st0 = o || { mouthY: 0.15, mouthZ: 0.165 };
  // the mouth is its own tiny mesh (it opens when they cheer or scream)
  bake(root);
  const mouth = new THREE.Mesh(geo.box(), new THREE.MeshStandardMaterial({ color: '#6a2a20', flatShading: true }));
  mouth.position.set(0, st0.mouthY, st0.mouthZ); mouth.scale.set(0.09, 0.02, 0.02); P.head.add(mouth); P.mouth = mouth;
  const st ={ ph: Math.random(), t: Math.random() * 10, w: { move: 0, run: 0, air: 0, swim: 0, ride: 0, throw: 0, pull: 0, drag: 0, cheer: 0, photo: 0, ko: 0, crouch: 0, sit: 0, point: 0, wave: 0, scared: 0 } };
  const pv = Object.values(P).filter(x => x && x.isGroup);
  const anim = (dt, S) => {
    st.t += dt;
    const W = st.w, e = (k, v, rate = 8) => { W[k] = damp(W[k], v ? (v === true ? 1 : v) : 0, rate, dt); };
    const sp = S.speed || 0;
    e('move', sp > 0.3 && !S.ride && !S.swim && !S.ko && !S.sit); e('run', clamp((sp - 4) / 3.5, 0, 1)); e('air', S.air); e('swim', S.swim); e('ride', S.ride, 10);
    e('throw', S.throw > 0 ? 1 : 0, 14); e('pull', S.pull, 8); e('drag', S.drag, 6); e('cheer', S.cheer, 6); e('photo', S.photo, 6); e('ko', S.ko, 6); e('crouch', S.crouch, 8); e('sit', S.sit, 5); e('point', S.point, 6); e('wave', S.wave, 6); e('scared', S.scared, 8);
    for (const p of pv) p.rotation.set(0, 0, 0);
    P.hips.position.set(0, 0.92, 0);
    const mv = W.move * (1 - W.swim) * (1 - W.ride);
    st.ph = (st.ph + sp * dt / lerp(1.5, 2.3, W.run)) % 1;
    const a = Math.sin(st.ph * Math.PI * 2), c = Math.cos(st.ph * Math.PI * 2);
    const A = (0.55 + 0.35 * W.run) * mv * (1 - W.crouch * 0.4);
    P.legL.rotation.x = -a * A; P.legR.rotation.x = a * A;
    P.shinL.rotation.x = Math.max(0, -c) * 0.9 * mv + 0.1 * mv; P.shinR.rotation.x = Math.max(0, c) * 0.9 * mv + 0.1 * mv;
    P.armL.rotation.x = a * A * 0.8; P.armR.rotation.x = -a * A * 0.8;
    P.foreL.rotation.x = -0.3 * mv - 0.5 * W.run; P.foreR.rotation.x = -0.3 * mv - 0.5 * W.run;
    P.hips.position.y += Math.abs(c) * 0.05 * mv - W.crouch * 0.25;
    P.chest.rotation.x = 0.08 * W.run + W.crouch * 0.4 + Math.sin(st.t * 1.6) * 0.012;
    P.chest.rotation.y = a * 0.08 * mv;
    P.head.rotation.x = -W.crouch * 0.3 + (S.lookPitch || 0) * 0.5;
    P.head.rotation.y = (S.lookYaw || 0);
    if (W.crouch > 0.01) { P.legL.rotation.x -= 0.7 * W.crouch; P.legR.rotation.x -= 0.7 * W.crouch; P.shinL.rotation.x += 1.0 * W.crouch; P.shinR.rotation.x += 1.0 * W.crouch; }
    // air: knees up, arms out
    if (W.air > 0.01) { P.legL.rotation.x -= 0.5 * W.air; P.shinL.rotation.x += 0.8 * W.air; P.legR.rotation.x += 0.2 * W.air; P.shinR.rotation.x += 0.4 * W.air; P.armL.rotation.z += 0.8 * W.air; P.armR.rotation.z -= 0.8 * W.air; }
    // swim: horizontal, crawl strokes
    if (W.swim > 0.01) {
      const sw = W.swim, t = st.t * 3.5;
      P.hips.rotation.x += 1.2 * sw * (sp > 0.5 ? 1 : 0.3); P.hips.position.y -= 0.4 * sw;
      P.armL.rotation.x += Math.sin(t) * 2.4 * sw - 1.2 * sw; P.armR.rotation.x += Math.sin(t + Math.PI) * 2.4 * sw - 1.2 * sw;
      P.legL.rotation.x += Math.sin(t * 2) * 0.4 * sw; P.legR.rotation.x -= Math.sin(t * 2) * 0.4 * sw;
      P.head.rotation.x -= 0.9 * sw * (sp > 0.5 ? 1 : 0.3);
    }
    // ride: astride, knees bent out, leaning with the mount
    if (W.ride > 0.01) {
      const R = W.ride;
      P.hips.position.y = lerp(P.hips.position.y, 0.05, R);
      P.legL.rotation.set(-1.2 * R, 0, 0.55 * R); P.legR.rotation.set(-1.2 * R, 0, -0.55 * R);
      P.shinL.rotation.x = 1.3 * R; P.shinR.rotation.x = 1.3 * R;
      P.chest.rotation.x += (S.lean || 0) * 0.3 * R + Math.sin(st.t * 8) * 0.02 * (S.bounce || 0);
      P.armL.rotation.x = -0.7 * R; P.armR.rotation.x = -0.7 * R; P.foreL.rotation.x = -0.6 * R; P.foreR.rotation.x = -0.6 * R;
      P.armL.rotation.z = 0.15 * R; P.armR.rotation.z = -0.15 * R;
    }
    if (W.sit > 0.01) { const R = W.sit; P.hips.position.y = lerp(P.hips.position.y, 0.48, R); P.legL.rotation.x = -1.5 * R; P.legR.rotation.x = -1.5 * R; P.shinL.rotation.x = 1.5 * R; P.shinR.rotation.x = 1.5 * R; }
    // throw: hold the arm back while charging, whip forward on release
    if (W.throw > 0.01) {
      const T = W.throw, ch = clamp(S.charge || 0, 0, 1), rel = S.throw === 2;
      if (!rel) { P.armR.rotation.x = lerp(P.armR.rotation.x, -2.4 - ch * 0.4, T); P.armR.rotation.z = -0.35 * T; P.foreR.rotation.x = -0.9 * T; P.chest.rotation.y -= 0.35 * T * ch; P.armL.rotation.x = lerp(P.armL.rotation.x, -1.1, T); }
      else { P.armR.rotation.x = lerp(P.armR.rotation.x, -0.9, T); P.foreR.rotation.x = -0.1; P.chest.rotation.y += 0.25 * T; P.chest.rotation.x += 0.15 * T; }
      // the lasso loop whirls overhead while charging
      if (!rel && S.spin) P.handR.rotation.y = st.t * 14;
    }
    // pull: lean back, both hands on the rope in front
    if (W.pull > 0.01) {
      const T = W.pull, k = clamp(S.tension || 0.5, 0, 1);
      P.chest.rotation.x -= (0.25 + k * 0.3) * T * (1 - W.ride * 0.5);
      P.armL.rotation.x = lerp(P.armL.rotation.x, -1.3, T); P.armR.rotation.x = lerp(P.armR.rotation.x, -1.2, T);
      P.foreL.rotation.x = -0.4 * T; P.foreR.rotation.x = -0.5 * T;
      P.armL.rotation.z = -0.25 * T; P.armR.rotation.z = 0.25 * T;
      if (!W.ride) { P.legL.rotation.x += 0.35 * T; P.legR.rotation.x -= 0.25 * T; P.shinL.rotation.x += 0.2 * T; P.hips.position.y -= 0.08 * T; }
      P.chest.rotation.z += Math.sin(st.t * 11) * 0.04 * T * k;
    }
    if (W.drag > 0.01) { const T = W.drag; P.chest.rotation.x -= 0.5 * T; P.legL.rotation.x += 0.7 * T; P.legR.rotation.x += 0.6 * T; P.hips.position.y -= 0.2 * T; }
    if (W.cheer > 0.01) { const T = W.cheer, j = Math.abs(Math.sin(st.t * 7)); P.armL.rotation.x = lerp(P.armL.rotation.x, -2.9, T); P.armR.rotation.x = lerp(P.armR.rotation.x, -2.9, T); P.armL.rotation.z = 0.3 * T; P.armR.rotation.z = -0.3 * T; P.hips.position.y += j * 0.12 * T * (W.ride > 0.5 ? 0 : 1); }
    if (W.wave > 0.01) { const T = W.wave; P.armR.rotation.x = lerp(P.armR.rotation.x, -2.7, T); P.armR.rotation.z = -0.4 * T + Math.sin(st.t * 9) * 0.35 * T; }
    if (W.point > 0.01) { const T = W.point; P.armR.rotation.x = lerp(P.armR.rotation.x, -1.6, T); P.foreR.rotation.x = 0; }
    if (W.photo > 0.01) { const T = W.photo; P.armL.rotation.x = lerp(P.armL.rotation.x, -1.5, T); P.armR.rotation.x = lerp(P.armR.rotation.x, -1.5, T); P.foreL.rotation.x = -1.2 * T; P.foreR.rotation.x = -1.2 * T; P.armL.rotation.z = -0.4 * T; P.armR.rotation.z = 0.4 * T; if (P.camera) P.camera.visible = T > 0.5; }
    else if (P.camera) P.camera.visible = false;
    if (W.scared > 0.01) { const T = W.scared; P.armL.rotation.x = lerp(P.armL.rotation.x, -2.6, T); P.armR.rotation.x = lerp(P.armR.rotation.x, -2.6, T); P.armL.rotation.z = 0.6 * T; P.armR.rotation.z = -0.6 * T; }
    if (W.ko > 0.01) { const T = W.ko; P.hips.position.y = lerp(P.hips.position.y, 0.15, T); P.hips.rotation.x = -1.5 * T; P.armL.rotation.z = 1.2 * T; P.armR.rotation.z = -1.2 * T; P.legL.rotation.z = 0.2 * T; P.legR.rotation.z = -0.2 * T; }
    P.mouth.scale.y = 0.02 * (1 + (W.cheer + W.scared) * 3);
  };
  anim(0.016, {});
  return { root, P, anim, hand: P.handR, scale: s, look: L };
}
void mat4;
