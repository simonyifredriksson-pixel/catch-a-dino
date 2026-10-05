/* Effects.js - particles and one-off visual events.

   One pooled InstancedMesh of faceted puffs does every particle (dust kicked
   up by feet, water splashes, leaves, embers, sparkles, rock debris, smoke,
   lasso dust...), each kind with its own colour, size, gravity and drag.
   Shockwave rings, scent trails and the light pillars that mark rare
   sightings are small pools of their own. */
import * as THREE from '../../lib/three.module.js';
import { clamp } from '../core/Util.js';

const MAX = 1800;
const KIND = {
  dust:    { c: ['#c8b48a', '#b8a47a', '#d8c8a0'], s: [0.5, 1.2], life: [0.6, 1.3], g: -1.2, drag: 2.2, v: 3, up: 1.6, grow: 1.8 },
  dirt:    { c: ['#7a5a3a', '#6a4a2a', '#8a6a4a'], s: [0.15, 0.35], life: [0.5, 1], g: 14, drag: 0.6, v: 5, up: 5, grow: 0 },
  splash:  { c: ['#e8f6ff', '#bfe6f8', '#ffffff'], s: [0.2, 0.5], life: [0.5, 1.1], g: 14, drag: 0.5, v: 4, up: 7, grow: 0.4 },
  foam:    { c: ['#ffffff', '#e8f4fa'], s: [0.6, 1.4], life: [0.8, 1.6], g: 0, drag: 2, v: 1.5, up: 0, grow: 1 },
  leaf:    { c: ['#4a9a3a', '#6aaa44', '#3a8a32'], s: [0.18, 0.32], life: [1.2, 2.4], g: 2.5, drag: 2.5, v: 4, up: 4, grow: 0, spin: true },
  ember:   { c: ['#ff7a2a', '#ffb040', '#ff5020'], s: [0.12, 0.28], life: [0.8, 1.8], g: -3, drag: 1.2, v: 3, up: 3, grow: -0.4, glow: true },
  spark:   { c: ['#fff4a0', '#ffffff', '#ffe060'], s: [0.12, 0.25], life: [0.5, 1.1], g: 2, drag: 2, v: 5, up: 3, grow: -0.5, glow: true },
  magic:   { c: ['#9af0ff', '#c8a0ff', '#ffffff'], s: [0.14, 0.3], life: [0.8, 1.6], g: -1.5, drag: 1.5, v: 2.5, up: 2, grow: -0.3, glow: true },
  debris:  { c: ['#8a8478', '#7a7468', '#9a948a'], s: [0.4, 1.0], life: [1.2, 2], g: 20, drag: 0.3, v: 9, up: 9, grow: 0, spin: true },
  smoke:   { c: ['#6a6a6a', '#5a5a5a', '#7a7470'], s: [1.2, 2.6], life: [1.6, 3], g: -2.2, drag: 0.8, v: 1.5, up: 1.5, grow: 1.4 },
  snow:    { c: ['#ffffff', '#eef4fa'], s: [0.3, 0.7], life: [0.6, 1.2], g: -0.5, drag: 2.5, v: 3, up: 1.5, grow: 1.2 },
  confetti:{ c: ['#ff5a7a', '#5ab0ff', '#ffd040', '#6ae07a', '#c070ff'], s: [0.12, 0.22], life: [1.5, 2.6], g: 4, drag: 1.6, v: 7, up: 8, grow: 0, spin: true, glow: true },
  heart:   { c: ['#ff5a7a', '#ff7a9a'], s: [0.25, 0.4], life: [1, 1.6], g: -2.5, drag: 1.5, v: 1, up: 2, grow: 0, glow: true },
  bubble:  { c: ['#dff4ff', '#bfe8ff'], s: [0.1, 0.28], life: [1, 2.2], g: -4, drag: 1.2, v: 0.8, up: 1.5, grow: 0.2 },
  scent:   { c: ['#e0ff9a', '#b8ff70'], s: [0.18, 0.3], life: [2.2, 3.2], g: -0.3, drag: 3, v: 0.4, up: 0.5, grow: -0.1, glow: true },
};

export class Effects {
  constructor(game) {
    this.g = game;
    this.mat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, transparent: false });
    this.glowMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), this.mat, MAX);
    this.glow = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.5, 0), this.glowMat, 600);
    for (const m of [this.mesh, this.glow]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); game.scene.add(m); }
    this.mesh.setColorAt(0, new THREE.Color()); this.glow.setColorAt(0, new THREE.Color());
    this.p = []; this.pg = [];
    this.rings = [];
    this.pillars = [];
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._v = new THREE.Vector3(); this._c = new THREE.Color(); this._e = new THREE.Euler();
  }
  /** n particles of a kind at a point (o: scale, dir {x,y,z} bias, spread) */
  burst(x, y, z, kind = 'dust', n = 10, o = {}) {
    const K = KIND[kind] || KIND.dust, list = K.glow ? this.pg : this.p, cap = K.glow ? 600 : MAX;
    const sc = o.scale ?? 1;
    for (let i = 0; i < n; i++) {
      if (list.length >= cap) list.shift();
      const a = Math.random() * Math.PI * 2, sp = K.v * (0.4 + Math.random() * 0.8) * (o.speed ?? 1) * Math.sqrt(sc);
      const vx = Math.cos(a) * sp + (o.dir?.x || 0), vz = Math.sin(a) * sp + (o.dir?.z || 0), vy = K.up * (0.5 + Math.random() * 0.8) * (o.speed ?? 1) + (o.dir?.y || 0);
      list.push({ x: x + (Math.random() - 0.5) * (o.spread || 0.4) * sc, y, z: z + (Math.random() - 0.5) * (o.spread || 0.4) * sc, vx, vy, vz,
        life: K.life[0] + Math.random() * (K.life[1] - K.life[0]), age: 0, s: (K.s[0] + Math.random() * (K.s[1] - K.s[0])) * sc, K, col: K.c[Math.floor(Math.random() * K.c.length)], rx: Math.random() * 6, ry: Math.random() * 6 });
    }
  }
  splash(x, y, z, s = 1) { this.burst(x, y, z, 'splash', Math.round(8 + s * 10), { scale: s }); this.burst(x, y + 0.1, z, 'foam', Math.round(3 + s * 3), { scale: s, spread: 1.5 }); this.ring(x, y + 0.05, z, 1 + s * 2, '#ffffff', 0.9); }
  dust(x, y, z, s = 1) { this.burst(x, y, z, 'dust', Math.round(4 + s * 6), { scale: s }); }
  debris(x, y, z, n = 10) { this.burst(x, y, z, 'debris', n, { scale: 1.2 }); this.burst(x, y, z, 'dust', n * 2, { scale: 2.2, spread: 3 }); }
  /** a flat shockwave ring */
  ring(x, y, z, r = 4, color = '#ffffff', dur = 0.6) {
    let R = this.rings.find(q => !q.on);
    if (!R) { R = { m: new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })) }; this.g.scene.add(R.m); this.rings.push(R); }
    R.on = true; R.t = 0; R.dur = dur; R.r = r; R.m.position.set(x, y, z); R.m.material.color.set(color); R.m.visible = true;
  }
  /** a pillar of light marking something special far away; returns a handle with .remove() */
  pillar(x, y, z, color = '#ffd860', h = 160) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.4, h, 10, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    m.position.set(x, y + h / 2, z); this.g.scene.add(m);
    const P = { m, on: true, target: 0.32, follow: null, remove: () => { P.on = false; } };
    this.pillars.push(P);
    return P;
  }
  update(dt) {
    const m = this._m, q = this._q, s = this._s, c = this._c, e = this._e;
    for (const [list, mesh] of [[this.p, this.mesh], [this.pg, this.glow]]) {
      let n = 0;
      for (let i = list.length - 1; i >= 0; i--) {
        const P = list[i]; P.age += dt;
        if (P.age >= P.life) { list.splice(i, 1); continue; }
        const K = P.K;
        P.vy -= K.g * dt;
        const d = Math.exp(-K.drag * dt); P.vx *= d; P.vz *= d; if (K.g < 0) P.vy *= d;
        P.x += P.vx * dt; P.y += P.vy * dt; P.z += P.vz * dt;
        const ground = this.g.terrain.ground(P.x, P.z);
        if (K.g > 0 && P.y < Math.max(ground, -0.05) && P.vy < 0) { if (P.K === KIND.splash) { P.age = P.life; continue; } P.y = Math.max(ground, P.y); P.vy *= -0.3; P.vx *= 0.6; P.vz *= 0.6; }
      }
      for (let i = 0; i < list.length && n < (mesh === this.mesh ? MAX : 600); i++) {
        const P = list[i], f = P.age / P.life;
        const sz = Math.max(0.001, P.s * (1 + P.K.grow * f) * (f > 0.75 ? (1 - f) / 0.25 : 1));
        if (P.K.spin) { P.rx += dt * 6; P.ry += dt * 4; }
        e.set(P.rx, P.ry, 0); q.setFromEuler(e);
        m.compose(this._v.set(P.x, P.y, P.z), q, s.set(sz, P.K === KIND.leaf || P.K === KIND.confetti ? sz * 0.15 : sz, sz));
        mesh.setMatrixAt(n, m);
        c.set(P.col); mesh.setColorAt(n, c);
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    for (const R of this.rings) {
      if (!R.on) continue;
      R.t += dt; const f = R.t / R.dur;
      if (f >= 1) { R.on = false; R.m.visible = false; continue; }
      R.m.scale.setScalar(R.r * (0.3 + f * 0.9)); R.m.material.opacity = (1 - f) * 0.8;
    }
    for (let i = this.pillars.length - 1; i >= 0; i--) {
      const P = this.pillars[i];
      if (P.follow) { P.m.position.x = P.follow.x; P.m.position.z = P.follow.z; }
      const want = P.on ? P.target : 0;
      P.m.material.opacity += (want - P.m.material.opacity) * Math.min(1, dt * 1.5);
      if (!P.on && P.m.material.opacity < 0.01) { this.g.scene.remove(P.m); this.pillars.splice(i, 1); }
    }
    void clamp;
  }
}
