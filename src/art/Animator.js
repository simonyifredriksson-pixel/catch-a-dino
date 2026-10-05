/* Animator.js - procedural animation for every body plan.

   Nothing is keyframed. Each frame the animator rebuilds the pose from
   layers, each with a weight that eases in and out, so a creature slides
   from a walk into a run into a roar without a pop:

     locomotion   a gait cycle driven by real ground speed (feet don't skate
                  much), heavier animals bounce their weight down on each
                  footfall, fast ones pitch forward and stiffen their tails
     turning      lean into the turn, head leads, tail swings wide
     secondary    tails and necks lag behind with a little spring
     idle         breathing, weight shifts, a look around now and then
     actions      eat, roar, attack (bite / headbutt / tail / stomp / sting),
                  sleep (lie down and curl up), rest, jump, swim, fly / glide /
                  flap, thrash (on the end of your rope)

   Bones have no rest rotation (they were built in the bind pose), so a
   layer just adds angles. Conventions in bone space: +x rotation swings a
   downward limb backward and pitches a forward-pointing head down; +y turns
   left; +z rolls the left side up. */
import { clamp, damp, smoothstep, lerp } from '../core/Util.js';

const TAU = Math.PI * 2;
const ATTACK_STYLE = { trike: 'butt', pachy: 'butt', rhino: 'butt', proto: 'butt', stego: 'tail', ankylo: 'tail', ember: 'tail', crystal: 'tail', diplo: 'tail', brachio: 'stomp', mammoth: 'stomp', titanus: 'stomp', scorp: 'sting' };

export class Animator {
  constructor(inst, meta, sp) {
    this.i = inst; this.m = meta; this.sp = sp;
    this.by = inst.by;
    const g = n => (n ? inst.by[n] : null);
    const R = meta.roles;
    this.root = g(R.root); this.hips = g(R.hips);
    this.spine = (R.spine || []).map(g); this.neck = (R.neck || []).map(g);
    this.head = g(R.head); this.jaw = g(R.jaw); this.tail = (R.tail || []).map(g);
    this.trunk = R.trunk ? R.trunk.map(g) : null;
    this.legs = (meta.legs || []).map(L => ({ ...L, bones: L.b.map(g) }));
    this.arms = (meta.arms || []).map(L => ({ ...L, bones: L.b.map(g) }));
    this.wings = (meta.wings || []).map(L => ({ ...L, bones: L.b.map(g) }));
    this.flippers = (meta.flippers || []).map(L => ({ ...L, bones: L.b.map(g) }));
    this.fins = (meta.fins || []).map(L => ({ ...L, bones: L.b.map(g) }));
    this.all = inst.bones;
    this.rest = this.all.map(b => b.position.clone());
    this.hipRestY = this.hips ? this.hips.position.y : 0;
    this.plan = meta.plan;
    this.heavy = clamp((Math.log10(Math.max(1, sp.kg?.[1] || 100)) - 2) / 2.6, 0, 1);    // 0 small .. 1 sauropod
    this.style = ATTACK_STYLE[sp.id] || (sp.diet === 'herb' ? 'butt' : 'bite');
    this.t = Math.random() * 100; this.phase = Math.random();
    this.w = { move: 0, run: 0, eat: 0, sleep: 0, rest: 0, swim: 0, fly: 0, flap: 0, air: 0, thrash: 0, ride: 0 };
    this.act = null; this.actT = 0; this.actDur = 1;
    this.look = { y: 0, x: 0, ty: 0, tx: 0, next: 2 };
    this.turn = 0; this.lag = 0;
    this.flapPhase = Math.random();
    this.speed = 0;
  }

  /** start a one-shot action: 'roar' | 'attack' | 'chomp' */
  play(name) {
    const d = { roar: 2.2, attack: 0.9, chomp: 0.6, call: 1.6, shake: 1.0 }[name] || 1;
    this.act = name; this.actT = 0; this.actDur = d;
  }

  /**
   s: { speed, walk, run (species speeds), yawRate, vy, ground, water, fly, flap,
        state: 'eat'|'sleep'|'rest'|'thrash'|null, ridden, lookYaw?, lookPitch? }
  */
  update(dt, s) {
    this.t += dt;
    const W = this.w, sp = this.sp;
    const walkV = Math.max(0.5, s.walk || sp.speed.walk || 2), runV = Math.max(walkV + 1, s.run || sp.speed.run || 6);
    const speed = s.speed;
    this.speed = speed;
    const k = 1 - Math.exp(-dt * 7);
    const ease = (key, target, rate = 7) => { W[key] += (target - W[key]) * (1 - Math.exp(-dt * rate)); };
    const grounded = !s.fly && !s.water;
    ease('move', grounded && speed > 0.25 ? 1 : 0, 6);
    ease('run', smoothstep(walkV * 1.2, runV * 0.85, speed), 4);
    ease('eat', s.state === 'eat' ? 1 : 0, 4);
    ease('sleep', s.state === 'sleep' ? 1 : 0, 1.6);
    ease('rest', s.state === 'rest' ? 1 : 0, 2);
    ease('thrash', s.state === 'thrash' ? 1 : 0, 8);
    ease('swim', s.water ? 1 : 0, 4);
    ease('fly', s.fly ? 1 : 0, 3);
    ease('flap', s.fly ? clamp(s.flap ?? 0.5, 0, 1) : 0, 4);
    ease('air', !s.ground && !s.fly && !s.water ? 1 : 0, 10);
    ease('ride', s.ridden ? 1 : 0, 3);
    this.turn = damp(this.turn, clamp(s.yawRate || 0, -3, 3), 5, dt);
    // gait phase: one cycle per stride, stride scales with leg length and gait
    const leg = Math.max(0.15, this.m.dims.hip || 1);
    const cycle = leg * lerp(2.4, 4.4, W.run) * (this.plan === 'quad' ? 1.15 : 1);
    this.phase = (this.phase + (speed / cycle) * dt * (s.water ? 0 : 1)) % 1;
    // look-around when idle
    const L = this.look;
    L.next -= dt;
    if (L.next <= 0) { L.next = 2 + Math.random() * 4; const idle = speed < 0.3 && !s.state; L.ty = idle ? (Math.random() - 0.5) * 1.2 : 0; L.tx = idle ? (Math.random() - 0.5) * 0.4 : 0; }
    if (s.lookYaw != null) { L.ty = clamp(s.lookYaw, -1.2, 1.2); L.tx = clamp(s.lookPitch || 0, -0.5, 0.5); }
    L.y = damp(L.y, L.ty, 3, dt); L.x = damp(L.x, L.tx, 3, dt);
    // timeline action envelope
    let A = 0, ar = 0;
    if (this.act) {
      this.actT += dt; ar = this.actT / this.actDur;
      if (ar >= 1) { this.act = null; ar = 0; }
      else A = smoothstep(0, 0.12, ar) * smoothstep(1, 0.78, ar);
    }
    // reset pose
    for (let i = 0; i < this.all.length; i++) { this.all[i].rotation.set(0, 0, 0); this.all[i].position.copy(this.rest[i]); }
    const P = this.plan;
    if (P === 'biped') this._biped(dt, s, A, ar);
    else if (P === 'quad') this._quad(dt, s, A, ar);
    else if (P === 'ptero') this._ptero(dt, s, A, ar);
    else if (P === 'marine' || P === 'fish') this._swimmer(dt, s, A, ar);
    else if (P === 'insectfly') this._dragonfly(dt, s, A, ar);
    else if (P === 'millipede') this._millipede(dt, s, A, ar);
    else if (P === 'scorpion') this._scorpion(dt, s, A, ar);
    else if (P === 'ammonite') this._ammonite(dt, s);
    void k;
  }

  /* ---------------- shared bits ---------------- */
  _headLook(scale = 1) {
    const n = this.neck.length + 1, L = this.look;
    for (const b of this.neck) { b.rotation.y += L.y * scale / n; b.rotation.x += L.x * scale / n; }
    if (this.head) { this.head.rotation.y += L.y * scale / n; this.head.rotation.x += L.x * scale / n; }
  }
  _tailSway(amp, freq, lagK = 0.55, lift = 0) {
    const t = this.t;
    this.tail.forEach((b, i) => {
      const f = (i + 1) / this.tail.length;
      b.rotation.y += Math.sin(t * freq - i * lagK) * amp * (0.4 + f) - this.turn * 0.09 * (0.5 + f);
      b.rotation.x += lift * (0.5 + f * 0.5);
    });
  }
  _jaw(v) { if (this.jaw) this.jaw.rotation.x += v; }
  _breath(amp = 1) {
    const b = Math.sin(this.t * (1.6 - this.heavy * 0.7)) * 0.012 * amp;
    if (this.spine[0]) this.spine[0].rotation.x += b;
    if (this.neck[0]) this.neck[0].rotation.x -= b * 1.2;
  }

  /* ---------------- two legs ---------------- */
  _biped(dt, s, A, ar) {
    const W = this.w, t = this.t, ph = this.phase, hip = this.m.dims.hip, heavy = this.heavy;
    const mv = W.move * (1 - W.sleep) * (1 - W.swim * 0.6), run = W.run;
    const amp = (0.36 + 0.45 * run) * mv;
    const H = this.hips;
    // body: bob down on each footfall (harder for heavy animals), shift weight side to side
    const s2 = Math.abs(Math.sin(ph * TAU));
    H.position.y -= hip * (0.02 + 0.035 * run + heavy * 0.025) * Math.pow(s2, 1.5 - heavy * 0.7) * mv;
    H.rotation.z += 0.045 * Math.sin(ph * TAU) * mv * (1 + heavy);
    H.rotation.y += 0.05 * Math.sin(ph * TAU) * mv * (1 - run * 0.6);
    const pitch = (0.04 + 0.12 * run) * mv;
    H.rotation.x += pitch;
    H.rotation.z += clamp(-this.turn * this.speed * 0.012, -0.25, 0.25);
    // legs
    for (const Lg of this.legs) {
      const p = ph + (Lg.side > 0 ? 0 : 0.5);
      const sn = Math.sin(p * TAU), cs = Math.cos(p * TAU);
      const lift = Math.max(0, cs), plant = Math.max(0, -cs);
      const [th, sh, mt, ft] = Lg.bones;
      th.rotation.x += -amp * sn - pitch * 0.8;
      sh.rotation.x += lift * (0.55 + 0.7 * run) * mv + plant * 0.08 * mv;
      mt.rotation.x += -lift * (0.45 + 0.5 * run) * mv;
      if (ft) ft.rotation.x += (lift * 0.7 - plant * 0.15) * mv;
    }
    // arms swing a little, tucked when running
    for (const Ar of this.arms) {
      const [u, f, h] = Ar.bones;
      const p = ph + (Ar.side > 0 ? 0.5 : 0);
      u.rotation.x += 0.18 * Math.sin(p * TAU) * mv - 0.15 * run;
      f.rotation.x -= 0.25 + 0.3 * run;
      u.rotation.z += Ar.side * 0.06 * Math.sin(t * 1.3);
      void h;
    }
    // tail and neck
    this._tailSway(0.05 + 0.04 * mv * (1 - run), 1.2 + ph * 0, 0.5, -0.02 * run - pitch * 0.25);
    this.tail.forEach((b, i) => { b.rotation.y += Math.sin((ph + 0.25) * TAU - i * 0.5) * 0.05 * mv; });
    for (const b of this.neck) b.rotation.x += 0.035 * Math.cos(ph * TAU * 2) * mv - pitch * 0.35;
    if (this.head) { this.head.rotation.x -= pitch * 0.3; this.head.rotation.y += this.turn * 0.12; }
    this._breath(1 - mv * 0.7);
    this._headLook(1 - W.eat);
    // jump / fall: knees up
    if (W.air > 0.01) for (const Lg of this.legs) {
      const [th, sh, mt, ft] = Lg.bones;
      th.rotation.x -= 0.75 * W.air; sh.rotation.x += 1.1 * W.air; mt.rotation.x -= 0.65 * W.air; if (ft) ft.rotation.x += 0.5 * W.air;
    }
    if (W.air > 0.01) this.tail.forEach(b => (b.rotation.x += 0.06 * W.air));
    // eat: bend down, chomp
    if (W.eat > 0.01) {
      const e = W.eat;
      H.rotation.x += 0.32 * e;
      this.neck.forEach((b, i) => (b.rotation.x += (0.45 - i * 0.05) * e));
      if (this.head) { this.head.rotation.x += 0.25 * e; this.head.rotation.y += Math.sin(t * 3) * 0.06 * e; }
      for (const Lg of this.legs) { Lg.bones[0].rotation.x -= 0.32 * e; Lg.bones[1].rotation.x += 0.12 * e; }
      this.tail.forEach(b => (b.rotation.x -= 0.05 * e));
      this._jaw(Math.max(0, Math.sin(t * 8)) * 0.3 * e);
    }
    // sleep / rest: lie down
    const lie = Math.max(W.sleep, W.rest);
    if (lie > 0.01) {
      H.position.y -= (hip - this.m.dims.bh * 1.05) * lie;
      for (const Lg of this.legs) {
        const [th, sh, mt, ft] = Lg.bones;
        th.rotation.x -= 1.15 * lie; sh.rotation.x += 2.25 * lie; mt.rotation.x -= 1.5 * lie; if (ft) ft.rotation.x += 0.4 * lie;
        th.rotation.z += Lg.side * 0.12 * lie;
      }
      H.rotation.x -= 0.04 * lie;
      const curl = W.sleep;
      this.neck.forEach(b => { b.rotation.y += 0.42 * curl; b.rotation.x += 0.22 * curl; });
      if (this.head) { this.head.rotation.y += 0.35 * curl; this.head.rotation.x += 0.35 * curl - 0.1 * W.rest; }
      this.tail.forEach(b => (b.rotation.y -= 0.17 * curl));
      for (const Ar of this.arms) Ar.bones[1].rotation.x -= 0.5 * lie;
      const br = Math.sin(t * 0.9) * 0.02 * curl;
      if (this.spine[0]) this.spine[0].rotation.x += br;
    }
    // swimming (a land animal out of its depth)
    if (W.swim > 0.01) {
      H.position.y -= hip * 0.62 * W.swim;
      for (const Lg of this.legs) { const p = t * 5 + (Lg.side > 0 ? 0 : Math.PI); Lg.bones[0].rotation.x += Math.sin(p) * 0.55 * W.swim; Lg.bones[1].rotation.x += 0.5 * W.swim; }
      this.neck.forEach(b => (b.rotation.x -= 0.15 * W.swim));
      this.tail.forEach((b, i) => (b.rotation.y += Math.sin(t * 3 - i * 0.6) * 0.1 * W.swim));
    }
    this._action(A, ar, H);
    this._thrash(H);
  }

  /* ---------------- four legs ---------------- */
  _quad(dt, s, A, ar) {
    const W = this.w, t = this.t, ph = this.phase, hip = this.m.dims.hip, heavy = this.heavy;
    const mv = W.move * (1 - Math.max(W.sleep, W.rest)) * (1 - W.swim * 0.6), run = W.run;
    const sprawl = (this.sp.body.sprawl || 0) > 0.3;
    const amp = (0.3 + 0.35 * run) * mv * (sprawl ? 0.7 : 1);
    const H = this.hips;
    const s2 = Math.abs(Math.sin(ph * TAU * 2));
    H.position.y -= hip * (0.012 + 0.03 * run + heavy * 0.012) * Math.pow(s2, 1.2) * mv;
    H.rotation.z += (0.025 + heavy * 0.03) * Math.sin(ph * TAU) * mv;
    H.rotation.x += Math.sin(ph * TAU * 2) * 0.02 * run * mv;
    H.rotation.z += clamp(-this.turn * this.speed * 0.01, -0.2, 0.2);
    // walk: lateral sequence; run: a trot blending into a bounding gallop for the quick ones
    const gallop = run * (this.sp.speed.run > 11 ? 1 : 0);
    const off = (front, side) => {
      const walk = front ? (side > 0 ? 0.25 : 0.75) : (side > 0 ? 0 : 0.5);
      const trot = front ? (side > 0 ? 0.5 : 0) : (side > 0 ? 0 : 0.5);
      const gal = front ? (side > 0 ? 0.55 : 0.65) : (side > 0 ? 0 : 0.1);
      return lerp(lerp(walk, trot, run), gal, gallop);
    };
    for (const Lg of this.legs) {
      const p = ph + off(Lg.front, Lg.side);
      const sn = Math.sin(p * TAU), cs = Math.cos(p * TAU);
      const lift = Math.max(0, cs);
      const [u, k, a, f] = Lg.bones;
      if (sprawl) {
        u.rotation.y += Lg.side * amp * sn * 1.1;
        u.rotation.z += Lg.side * lift * 0.35 * mv;
        a.rotation.z -= Lg.side * lift * 0.2 * mv;
      } else {
        u.rotation.x += -amp * sn;
        if (Lg.front) { k.rotation.x -= lift * 0.2 * mv; a.rotation.x += lift * (0.8 + run * 0.5) * mv; }
        else { k.rotation.x += lift * (0.55 + run * 0.4) * mv; a.rotation.x -= lift * (0.5 + run * 0.3) * mv; }
        if (f) f.rotation.x += lift * 0.4 * mv;
      }
    }
    if (sprawl) {
      // lizard wiggle: the spine bends side to side with the stride
      H.rotation.y += Math.sin(ph * TAU) * 0.14 * mv;
      this.spine.forEach(b => (b.rotation.y -= Math.sin(ph * TAU) * 0.1 * mv));
    }
    this._tailSway(0.05 + 0.06 * mv + (sprawl ? 0.1 * mv : 0), sprawl ? TAU * 0 + 2 : 1.1, 0.5, 0);
    if (sprawl) this.tail.forEach((b, i) => (b.rotation.y += Math.sin(ph * TAU - i * 0.7) * 0.12 * mv));
    for (const b of this.neck) b.rotation.x += 0.04 * Math.cos(ph * TAU * 2) * mv;
    if (this.head) this.head.rotation.y += this.turn * 0.1;
    if (this.trunk) this.trunk.forEach((b, i) => { b.rotation.x += Math.sin(t * 1.3 + i * 0.8) * 0.12 + Math.sin(ph * TAU * 2) * 0.06 * mv; b.rotation.y += Math.sin(t * 0.9 + i) * 0.1; });
    this._breath(1 - mv * 0.6);
    this._headLook(1 - W.eat);
    // sauropod necks sway slowly
    if (this.neck.length > 2) this.neck.forEach((b, i) => { b.rotation.y += Math.sin(t * 0.5 + i * 0.4) * 0.03; b.rotation.x += Math.sin(t * 0.37 + i * 0.3) * 0.015; });
    if (W.eat > 0.01) {
      const e = W.eat, up = this.neck.length > 2 && (this.sp.body.neckAngle || 0) > 0.6;
      if (up) { this.neck.forEach((b, i) => (b.rotation.x -= 0.06 * e * (i + 1) / this.neck.length)); if (this.head) this.head.rotation.x += 0.4 * e; }
      else { this.neck.forEach((b, i) => (b.rotation.x += (this.neck.length > 2 ? 0.16 : 0.42) * e)); if (this.head) this.head.rotation.x += 0.35 * e; H.rotation.x += 0.05 * e; }
      if (this.head) this.head.rotation.y += Math.sin(t * 2.5) * 0.06 * e;
      if (this.trunk) this.trunk.forEach((b, i) => (b.rotation.x -= (0.5 + Math.sin(t * 3) * 0.3) * e * (i ? 1 : 0.5)));
      this._jaw(Math.max(0, Math.sin(t * 7)) * 0.22 * e);
    }
    const lie = Math.max(W.sleep, W.rest);
    if (lie > 0.01) {
      H.position.y -= (hip - this.m.dims.bh * 1.0) * lie;
      const sh = this.spine[1];
      if (sh) sh.position.y -= ((this.sp.body.shoulder ?? hip) - hip) * 0.6 * lie;
      for (const Lg of this.legs) {
        const [u, k, a] = Lg.bones;
        if (sprawl) { u.rotation.z += Lg.side * 0.5 * lie; continue; }
        if (Lg.front) { u.rotation.x += 0.35 * lie; k.rotation.x -= 0.25 * lie; a.rotation.x += 1.5 * lie; }
        else { u.rotation.x -= 0.95 * lie; k.rotation.x += 1.7 * lie; a.rotation.x -= 0.9 * lie; }
        u.rotation.z += Lg.side * 0.18 * lie;
      }
      const curl = W.sleep;
      this.neck.forEach(b => { b.rotation.y += (this.neck.length > 2 ? 0.22 : 0.3) * curl; b.rotation.x += (this.neck.length > 2 ? 0.22 : 0.25) * curl; });
      if (this.head) this.head.rotation.x += 0.25 * curl;
      this.tail.forEach(b => (b.rotation.y -= 0.14 * curl));
      if (this.spine[0]) this.spine[0].rotation.x += Math.sin(t * 0.8) * 0.02 * curl;
    }
    if (W.swim > 0.01) {
      H.position.y -= hip * 0.6 * W.swim;
      for (const Lg of this.legs) { const p = t * 4 + (Lg.front ? 0 : 1.5) + (Lg.side > 0 ? 0 : Math.PI); Lg.bones[0].rotation.x += Math.sin(p) * 0.5 * W.swim; }
      this.neck.forEach(b => (b.rotation.x -= 0.12 * W.swim));
      this.tail.forEach((b, i) => (b.rotation.y += Math.sin(t * 3 - i * 0.6) * 0.16 * W.swim));
    }
    this._action(A, ar, H);
    this._thrash(H);
  }

  /* ---------------- one-shot actions (roar, attack) for walkers ---------------- */
  _action(A, ar, H) {
    if (!this.act || A <= 0) return;
    const t = this.t, a = this.act;
    if (a === 'roar' || a === 'call') {
      const big = a === 'roar' ? 1 : 0.6;
      H.rotation.x -= 0.1 * A * big;
      if (this.neck[0]) this.neck[0].rotation.x -= 0.3 * A * big;
      if (this.neck.length > 1) this.neck[1].rotation.x += 0.12 * A;
      if (this.head) { this.head.rotation.x -= 0.28 * A * big; this.head.rotation.y += Math.sin(t * 22) * 0.035 * A * big; }
      this._jaw((a === 'roar' ? 0.8 : 0.35) * A);
      for (const Ar of this.arms) Ar.bones[0].rotation.z += Ar.side * 0.45 * A;
      this.tail.forEach(b => (b.rotation.x += 0.05 * A));
      if (this.trunk) this.trunk.forEach((b, i) => (b.rotation.x -= 0.9 * A * (i ? 1 : 0.6)));
      return;
    }
    if (a === 'chomp') { this._jaw(Math.sin(ar * Math.PI * 3) > 0 ? 0.5 * A : 0); return; }
    if (a === 'shake') { if (this.head) this.head.rotation.y += Math.sin(t * 25) * 0.25 * A; this.neck.forEach(b => (b.rotation.y += Math.sin(t * 25 + 1) * 0.12 * A)); return; }
    // attack: windup then strike
    const wind = smoothstep(0, 0.35, ar) * (1 - smoothstep(0.35, 0.5, ar));
    const hit = smoothstep(0.35, 0.5, ar) * (1 - smoothstep(0.6, 1, ar));
    const st = this.style;
    if (st === 'bite') {
      H.rotation.x += -0.08 * wind + 0.2 * hit;
      this.neck.forEach(b => (b.rotation.x += -0.25 * wind + 0.28 * hit));
      if (this.head) this.head.rotation.x += -0.2 * wind + 0.1 * hit;
      this._jaw(0.7 * wind + 0.7 * hit * (ar < 0.45 ? 1 : 0.1));
      for (const Lg of this.legs) { Lg.bones[0].rotation.x -= 0.15 * hit; }
    } else if (st === 'butt') {
      H.rotation.x += 0.12 * wind + 0.08 * hit;
      this.neck.forEach(b => (b.rotation.x += 0.35 * wind - 0.1 * hit));
      if (this.head) this.head.rotation.x += 0.35 * wind - 0.45 * hit;
      H.position.z += 0.25 * hit * this.m.dims.hip;
    } else if (st === 'tail') {
      const sw = Math.sin(ar * Math.PI * 2);
      H.rotation.y -= 0.2 * sw * A;
      this.tail.forEach((b, i) => (b.rotation.y += sw * 0.35 * A * (0.5 + i * 0.2)));
    } else if (st === 'stomp') {
      H.rotation.x -= 0.32 * A;
      for (const Lg of this.legs) if (Lg.front) { Lg.bones[0].rotation.x -= 0.6 * A; Lg.bones[1].rotation.x += 0.4 * A; }
      if (this.neck[0]) this.neck[0].rotation.x -= 0.2 * A;
      this._jaw(0.4 * A);
    }
  }
  _thrash(H) {
    const W = this.w; if (W.thrash < 0.01) return;
    const e = W.thrash, t = this.t;
    H.rotation.z += Math.sin(t * 9) * 0.1 * e;
    H.rotation.x -= (0.5 + 0.5 * Math.sin(t * 3.1)) * 0.12 * e;
    H.rotation.y += Math.sin(t * 6.3) * 0.12 * e;
    this.neck.forEach((b, i) => { b.rotation.y += Math.sin(t * 13 + i) * 0.22 * e; b.rotation.x -= 0.1 * e; });
    if (this.head) this.head.rotation.y += Math.sin(t * 15) * 0.3 * e;
    this._jaw((0.4 + 0.4 * Math.sin(t * 11)) * 0.6 * e);
    this.tail.forEach((b, i) => (b.rotation.y += Math.sin(t * 10 - i * 0.7) * 0.22 * e));
    for (const Lg of this.legs) Lg.bones[0].rotation.x += Math.sin(t * 12 + Lg.side * 2 + (Lg.front ? 1 : 0)) * 0.35 * e;
    for (const Ar of this.arms) Ar.bones[0].rotation.x += Math.sin(t * 14 + Ar.side) * 0.4 * e;
    if (this.trunk) this.trunk.forEach((b, i) => (b.rotation.x -= (0.6 + Math.sin(t * 8) * 0.3) * e * (i ? 1 : 0.5)));
  }

  /* ---------------- pterosaurs ---------------- */
  _ptero(dt, s, A, ar) {
    const W = this.w, t = this.t, H = this.hips;
    const fly = W.fly, gnd = 1 - fly;
    const big = clamp((this.m.dims.span || 4) / 12, 0, 1);
    // flap frequency: small ones flutter, giants row slowly
    this.flapPhase = (this.flapPhase + dt * lerp(3.4, 1.1, big) * (0.5 + W.flap * 0.8)) % 1;
    const fp = this.flapPhase * TAU;
    const flap = W.flap * fly;
    for (const Wg of this.wings) {
      const [sh, el, wr, fi, ft] = Wg.bones, sd = Wg.side;
      // flight: down-stroke is quicker than the up-stroke
      const st = Math.sin(fp) + 0.25 * Math.sin(fp * 2);
      sh.rotation.z += sd * (0.1 + 0.55 * st * flap + 0.06 * (1 - W.flap)) * fly;
      sh.rotation.y += sd * (-0.05 + 0.12 * Math.cos(fp) * flap) * fly;
      el.rotation.y += sd * 0.3 * Math.max(0, Math.cos(fp)) * flap;
      wr.rotation.z += sd * -0.22 * Math.sin(fp - 0.6) * flap;
      if (ft) ft.rotation.z += sd * -0.18 * Math.sin(fp - 1.0) * flap + sd * Math.sin(t * 2.2) * 0.03 * fly;
      // glide: a gentle ripple on the tips
      sh.rotation.z += sd * Math.sin(t * 1.7 + sd) * 0.03 * fly * (1 - W.flap);
      // on the ground: wings folded up against the body, walking on the knuckles
      const walk = W.move * gnd, p = this.phase + (sd > 0 ? 0 : 0.5);
      sh.rotation.z += sd * -0.85 * gnd; sh.rotation.x += 0.15 * gnd; sh.rotation.y += sd * 0.35 * gnd;
      el.rotation.y += sd * 2.35 * gnd; el.rotation.z += sd * 0.35 * gnd;
      wr.rotation.y += sd * -2.55 * gnd; wr.rotation.z += sd * -0.5 * gnd;
      if (ft) ft.rotation.y += sd * -0.25 * gnd;
      sh.rotation.x += Math.sin(p * TAU) * 0.3 * walk;
      if (W.thrash > 0.01) { sh.rotation.z += sd * Math.sin(t * 9 + sd) * 0.5 * W.thrash; el.rotation.y -= sd * Math.sin(t * 7) * 0.4 * W.thrash; }
    }
    // body: nose up on the ground (it stands on folded wings), level in the air
    H.rotation.x -= 0.35 * gnd;
    H.position.y += this.m.dims.groundH * gnd;
    H.position.y += Math.sin(this.flapPhase * TAU) * -0.04 * flap * (this.m.dims.span || 4) * 0.1;
    this.neck.forEach(b => (b.rotation.x += 0.22 * gnd));
    if (this.head) this.head.rotation.x += 0.12 * gnd - (s.pitch || 0) * 0.4 * fly;
    for (const Lg of this.legs) {
      const p = this.phase + (Lg.side > 0 ? 0.5 : 0);
      Lg.bones[0].rotation.x += (1.25 * fly) + Math.sin(p * TAU) * 0.4 * W.move * gnd + 0.3 * gnd;
      Lg.bones[1].rotation.x += 0.3 * fly + 0.05 * gnd;
    }
    this.tail.forEach((b, i) => (b.rotation.y += Math.sin(t * 2 - i) * 0.08));
    this._headLook(1);
    if (W.eat > 0.01) { this.neck.forEach(b => (b.rotation.x += 0.45 * W.eat)); this._jaw(Math.max(0, Math.sin(t * 8)) * 0.35 * W.eat); }
    if (this.act && A > 0) {
      if (this.act === 'roar' || this.act === 'call') { this.neck.forEach(b => (b.rotation.x -= 0.25 * A)); this._jaw(0.75 * A); for (const Wg of this.wings) Wg.bones[0].rotation.z += Wg.side * 0.5 * A * gnd; }
      else { this.neck.forEach(b => (b.rotation.x += 0.3 * A)); this._jaw(0.6 * A); }
    }
    if (W.thrash > 0.01) { this.neck.forEach((b, i) => (b.rotation.y += Math.sin(t * 12 + i) * 0.3 * W.thrash)); this._jaw(0.5 * W.thrash); }
    const lie = Math.max(W.sleep, W.rest) * gnd;
    if (lie > 0.01) { H.position.y -= this.m.dims.groundH * 0.55 * lie; this.neck.forEach(b => (b.rotation.y += 0.5 * W.sleep)); if (this.head) this.head.rotation.x += 0.3 * W.sleep; }
  }

  /* ---------------- swimmers ---------------- */
  _swimmer(dt, s, A, ar) {
    const W = this.w, t = this.t, H = this.hips;
    const sp = Math.max(0.6, this.speed);
    this.phase = (this.phase + dt * (0.35 + sp * 0.09)) % 1;
    const fp = this.phase * TAU;
    const plesio = this.neck.length > 2, turtle = (this.sp.body.feat || []).includes('shell');
    const tailDrive = !plesio && !turtle;
    const amp = (tailDrive ? 0.12 : 0.04) * (0.6 + Math.min(1, sp / 8) * 0.6) + W.thrash * 0.25;
    // the travelling wave down the body
    const chain = [...this.spine.slice().reverse(), ...(this.hips && this.plan === 'marine' ? [] : []), ...this.tail];
    chain.forEach((b, i) => { const f = (i + 1) / chain.length; b.rotation.y += Math.sin(fp - i * 0.65) * amp * (0.25 + f * f * 1.2) - this.turn * 0.06 * f; });
    if (this.plan === 'marine') H.rotation.y += Math.sin(fp + 0.6) * amp * 0.3;
    // pitch the tail with climbing / diving
    this.tail.forEach(b => (b.rotation.x += (s.pitch || 0) * -0.08));
    for (const Fl of this.flippers) {
      const [a, b] = Fl.bones, sd = Fl.side;
      const ph = fp * (plesio || turtle ? 1 : 0.5) + (Fl.front ? 0 : Math.PI * 0.5);
      const k = plesio || turtle ? (Fl.front || plesio ? 0.55 : 0.3) : 0.15;
      a.rotation.z += sd * Math.sin(ph) * k;
      a.rotation.x += Math.cos(ph) * k * 0.6;
      b.rotation.z += sd * Math.sin(ph - 0.7) * k * 0.6;
      a.rotation.y += sd * 0.1;
    }
    for (const Fn of this.fins) Fn.bones[0].rotation.z += Fn.side * (0.15 + Math.sin(t * 2 + Fn.side) * 0.08);
    if (plesio) this.neck.forEach((b, i) => { b.rotation.y += Math.sin(t * 0.8 + i * 0.5) * 0.06 + this.turn * 0.05; b.rotation.x += Math.sin(t * 0.6 + i) * 0.03 + (s.pitch || 0) * -0.05; });
    this._headLook(0.6);
    if (W.eat > 0.01) this._jaw(Math.max(0, Math.sin(t * 6)) * 0.4 * W.eat);
    if (this.act && A > 0) {
      if (this.act === 'attack') { this._jaw(0.8 * (ar < 0.5 ? smoothstep(0, 0.4, ar) : 1 - smoothstep(0.5, 0.6, ar))); if (this.head) this.head.rotation.x -= 0.2 * A; }
      else { this._jaw(0.7 * A); if (this.head) this.head.rotation.x -= 0.25 * A; }
    }
    if (W.thrash > 0.01) { if (this.head) this.head.rotation.y += Math.sin(t * 12) * 0.35 * W.thrash; this._jaw((0.5 + 0.5 * Math.sin(t * 10)) * 0.5 * W.thrash); H.rotation.z += Math.sin(t * 7) * 0.25 * W.thrash; }
    if (this.sp.body.feat?.includes('lure') && this.by.lure) { this.by.lure.rotation.x += Math.sin(t * 1.6) * 0.2; this.by.lure.rotation.y += Math.sin(t * 1.1) * 0.25; }
  }

  /* ---------------- arthropods ---------------- */
  _dragonfly(dt, s, A) {
    const t = this.t;
    for (const Wg of this.wings) { const b = Wg.bones[0]; b.rotation.z += Wg.side * (0.1 + Math.sin(t * 62 + (b.name.includes('1') ? 1.6 : 0)) * 0.55); }
    this.tail.forEach((b, i) => (b.rotation.x += Math.sin(t * 2 + i) * 0.04 + 0.02));
    this.hips.position.y += Math.sin(t * 3) * 0.03;
    for (const Lg of this.legs) Lg.bones[0].rotation.x += 0.3;
    if (this.w.thrash > 0.01) this.tail.forEach((b, i) => (b.rotation.y += Math.sin(t * 15 - i) * 0.3 * this.w.thrash));
    void A;
  }
  _ammonite(dt, s) {
    const t = this.t, jet = Math.max(0, Math.sin(t * 2.2)), w = this.w.thrash;
    this.hips.position.y += Math.sin(t * 1.3) * 0.05;
    this.hips.rotation.x += Math.sin(t * 0.9) * 0.08 + w * Math.sin(t * 9) * 0.3;
    this.hips.rotation.z += w * Math.sin(t * 7) * 0.4;
    this.tail.forEach((b, i) => { const a = i / this.tail.length * Math.PI * 2; b.rotation.x += Math.sin(t * 3 + a) * 0.25 + jet * 0.3 + w * Math.sin(t * 12 + i) * 0.4; b.rotation.y += Math.cos(t * 2.4 + a) * 0.2; });
  }
  _millipede(dt, s) {
    const t = this.t, mv = this.w.move, ph = this.phase * TAU * 3;
    this.spine.forEach((b, i) => { if (i) b.rotation.y += Math.sin(ph - i * 0.6) * 0.07 * (0.3 + mv) + Math.sin(t * 0.7 + i * 0.4) * 0.03 - this.turn * 0.02; });
    for (const Lg of this.legs) { const p = ph - Lg.seg * 0.8 + (Lg.side > 0 ? 0 : Math.PI); Lg.bones[0].rotation.y += Lg.side * Math.sin(p) * 0.45 * mv; Lg.bones[0].rotation.z += Lg.side * Math.max(0, Math.cos(p)) * 0.35 * mv; }
    if (this.w.thrash > 0.01) this.spine.forEach((b, i) => (b.rotation.y += Math.sin(t * 10 - i * 0.6) * 0.15 * this.w.thrash));
    // climbing: curl the front up (the mount controller pitches the whole body)
    if (s.climb) this.spine.slice(0, 3).forEach(b => (b.rotation.x -= 0.08));
  }
  _scorpion(dt, s, A, ar) {
    const t = this.t, mv = this.w.move, ph = this.phase * TAU * 2;
    for (const Lg of this.legs) { const p = ph + Lg.seg * Math.PI / 2 + (Lg.side > 0 ? 0 : Math.PI); Lg.bones[0].rotation.y += Lg.side * Math.sin(p) * 0.4 * mv; Lg.bones[0].rotation.z += Lg.side * Math.max(0, Math.cos(p)) * 0.3 * mv; }
    this.tail.forEach((b, i) => { b.rotation.x -= (0.12 + Math.sin(t * 1.5) * 0.03) * (i < 3 ? 1 : 0.6); b.rotation.y += Math.sin(t * 1.2 + i) * 0.04; });
    for (const Ar of this.arms) { Ar.bones[0].rotation.y += Ar.side * (0.15 + Math.sin(t * 1.1 + Ar.side) * 0.08); Ar.bones[2].rotation.y += Ar.side * Math.max(0, Math.sin(t * 2.3)) * 0.15; }
    if (this.act && A > 0) { const hit = smoothstep(0.3, 0.5, ar) * (1 - smoothstep(0.6, 1, ar)); this.tail.forEach(b => (b.rotation.x -= 0.3 * hit)); for (const Ar of this.arms) Ar.bones[0].rotation.y -= Ar.side * 0.4 * A; }
    if (this.w.thrash > 0.01) { this.hips.rotation.z += Math.sin(t * 9) * 0.15 * this.w.thrash; this.tail.forEach(b => (b.rotation.x += Math.sin(t * 11) * 0.3 * this.w.thrash)); }
  }
}
