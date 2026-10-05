/* Camera.js - the third-person camera.

   An orbit on a spring arm around your head (or your mount's saddle): mouse
   turns it, V cycles the distance, aiming pulls it in over the shoulder.
   Bigger mounts push it back; flying pushes it further. It never goes into
   the ground and never sits exactly on the water surface. Shake is trauma
   based (it eases off on its own); `override` lets cinematics take over. */
import * as THREE from '../../lib/three.module.js';
import { clamp, damp, lerp } from '../core/Util.js';

const _v = new THREE.Vector3(), _f = new THREE.Vector3();
const PRESETS = [0.75, 1, 1.45];

export class CameraRig {
  constructor(game, camera) {
    this.g = game; this.cam = camera;
    this.yaw = Math.PI; this.pitch = 0.18; this.dist = 6; this.preset = 1;
    this.focus = new THREE.Vector3(); this.trauma = 0; this.override = null; this.fovKick = 0;
    this.baseFov = 70;
  }
  shake(t) { this.trauma = Math.min(1, this.trauma + t); }
  /** the direction the camera looks (unit) */
  forward(out = new THREE.Vector3()) { return this.cam.getWorldDirection(out); }
  update(dt, input) {
    const G = this.g, P = G.player;
    const L = input.look();
    if (!this.override) { this.yaw -= L.x; this.pitch = clamp(this.pitch + L.y, -1.15, 1.35); }
    if (input.pressed('KeyV')) this.preset = (this.preset + 1) % PRESETS.length;
    if (this.override) {
      const O = this.override;
      O.t = (O.t || 0) + dt;
      this.cam.position.lerp(O.pos, 1 - Math.exp(-dt * (O.rate || 3)));
      this.cam.lookAt(O.look);
      if (O.dur && O.t > O.dur) this.override = null;
      return;
    }
    // what we orbit, and how far
    const m = P.mount || (P.ride && G.riding.mountOf(P.ride.owner));
    let want, dist;
    if (m) {
      m.saddle(_f); want = _f.add(_v.set(0, 1.4, 0));
      dist = Math.max(5.5, m.len * 0.72 + 3.2) * (m.flying ? 1.35 : 1);
    } else {
      want = _f.copy(P.pos).add(_v.set(0, P.mode === 'swim' ? 0.6 : 1.55, 0));
      dist = 5.4;
    }
    const aiming = G.catching.aiming || input.btn(2);
    if (aiming) dist *= 0.62;
    if (G.catching.fighting) dist *= 1.15;
    dist *= PRESETS[this.preset];
    this.dist = damp(this.dist, dist, 4, dt);
    this.focus.x = damp(this.focus.x, want.x, 14, dt); this.focus.z = damp(this.focus.z, want.z, 14, dt);
    this.focus.y = damp(this.focus.y, want.y, m ? 6 : 12, dt);
    // spherical offset (yaw 0 = camera south of the target looking north)
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const off = _v.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
    let d = this.dist;
    // pull in if the ground is in the way
    const T = G.terrain;
    for (let i = 1; i <= 8; i++) {
      const t = d * i / 8, x = this.focus.x + off.x * t, y = this.focus.y + off.y * t, z = this.focus.z + off.z * t;
      if (T.ground(x, z) + 0.45 > y && !(G.inCave)) { d = Math.max(1.2, t - 0.6); break; }
    }
    const pos = this.cam.position.copy(this.focus).addScaledVector(off, d);
    // over the shoulder while aiming
    if (aiming) { const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw); pos.x += rx * 0.9; pos.z += rz * 0.9; }
    const gy = T.ground(pos.x, pos.z) + 0.4;
    if (pos.y < gy) pos.y = gy;
    if (Math.abs(pos.y) < 0.35 && T.ground(pos.x, pos.z) < 0) pos.y = pos.y < 0 ? -0.35 : 0.35;
    this.cam.lookAt(this.focus.x + (aiming ? Math.cos(this.yaw) * 0.9 : 0), this.focus.y + (aiming ? 0.1 : 0), this.focus.z + (aiming ? -Math.sin(this.yaw) * 0.9 : 0));
    // shake
    if (this.trauma > 0) {
      const s = this.trauma * this.trauma * 0.35;
      this.cam.position.x += (Math.random() - 0.5) * s; this.cam.position.y += (Math.random() - 0.5) * s; this.cam.position.z += (Math.random() - 0.5) * s;
      this.trauma = Math.max(0, this.trauma - dt * 1.4);
    }
    // field of view: a kick when you go fast
    const fast = m ? clamp((m.speed - (m.sp.speed.walk || 2) * 2) / ((m.sp.speed.run || m.sp.speed.fly || 10) * 1.2), 0, 1) : clamp((Math.hypot(P.vel.x, P.vel.z) - 6) / 4, 0, 1);
    this.fovKick = damp(this.fovKick, fast * 10 + (aiming ? -8 : 0), 3, dt);
    const fov = this.baseFov + this.fovKick;
    if (Math.abs(this.cam.fov - fov) > 0.05) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
    void lerp;
  }
}
