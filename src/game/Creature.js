/* Creature.js - one animal in the world: wild, in the zoo, or under a saddle.

   It owns the skinned mesh and the animator, and the movement physics that
   AI and riding share:
     stepGround()  turn toward a heading at the species' turn rate, accelerate
                   with weight (heavy things take a while to get going), climb
                   only what it can climb, wade / paddle / swim in water,
                   bump off trees and buildings, jump and fall
     stepSwim()    full 3D swimming between the sea floor and the surface,
                   with breaching
     stepFly()     lift, banking, climbing and gliding
   Whoever drives it (game/Wild.js, game/Zoo.js, game/Riding.js) only says
   where it wants to go and how fast. */
import * as THREE from '../../lib/three.module.js';
import { SP, VARIANTS, SIZE } from '../data/Species.js';
import { creatureTemplate } from '../art/CreatureArt.js';
import { instantiate } from '../art/Rig.js';
import { Animator } from '../art/Animator.js';
import { clamp, damp, dampAngle, wrapAngle, lerp } from '../core/Util.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
let NEXT = 1;

export class Creature {
  constructor(game, o) {
    this.g = game;
    this.id = o.id || 'w' + (NEXT++).toString(36);
    this.uid = o.uid || null;           // set when you own it
    this.sp = SP[o.sp]; this.spId = o.sp;
    this.v = o.v || null;
    this.size = o.size ?? 0.5;
    this.baby = !!o.baby;
    this.T = creatureTemplate(this.sp, this.v, VARIANTS);
    this.inst = instantiate(this.T);
    this.scale = (0.86 + this.size * 0.3) * (this.baby ? 0.45 : 1);
    this.inst.mesh.scale.setScalar(this.scale);
    this.group = new THREE.Group();
    this.group.add(this.inst.mesh);
    this.group.userData.creature = this;
    this.anim = new Animator(this.inst, this.T.meta, this.sp);
    const d = this.T.meta.dims;
    this.dims = d;
    this.hip = (d.hip || d.bh) * this.scale;
    this.len = d.len * this.scale;
    this.height = d.height * this.scale;
    this.radius = Math.max(0.25, Math.min(this.len * 0.22, (d.bw || 0.3) * this.scale * 1.15 + this.len * 0.05));
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.roll = 0; this.speed = 0; this.yawRate = 0;
    this.vy = 0; this.onGround = true; this.inWater = false; this.flying = this.sp.move === 'fly' ? (o.flying ?? true) : false; this.under = false;
    this.astate = null; this.flap = 0.5;
    this.stun = 0; this.lodT = 0; this.visible = true;
    this.mount = null;      // set while ridden
    this.heavy = this.anim.heavy;
    game.scene.add(this.group);
    if (this.sp.abilities.includes('glow')) {
      this.light = new THREE.PointLight(this.T.cols.glow || '#a0f0ff', 0, 26 * this.scale + 10, 1.6);
      this.light.position.set(0, this.height * 0.8, 0); this.group.add(this.light);
    }
  }
  get name() { return this.sp.name; }
  get swimmer() { return this.sp.move === 'swim'; }
  get amph() { return this.sp.move === 'amph' || this.sp.abilities.includes('swim'); }
  get flyer() { return this.sp.move === 'fly'; }
  has(a) { return this.sp.abilities.includes(a); }
  get sizeClass() { return this.sp.size; }
  get crate() { return SIZE[this.sp.size].crate; }

  dispose() { this.g.scene.remove(this.group); }

  /* ---------------- presentation ---------------- */
  place() {
    this.group.position.copy(this.pos);
    this.group.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
  }
  animate(dt, extra) {
    const s = {
      speed: this.speed, walk: this.sp.speed.walk, run: this.sp.speed.run, yawRate: this.yawRate,
      ground: this.onGround, water: this.under || (this.inWater && !this.onGround) || (this.swimmer), fly: this.flying, flap: this.flap,
      state: this.astate, pitch: this.pitch, ridden: !!this.mount, climb: this._climbing,
      ...extra,
    };
    this.anim.update(dt, s);
    if (this.light) this.light.intensity = damp(this.light.intensity, (this.g.sky?.state.night || 0) > 0.3 || this.g.inCave ? 2.2 : 0.3, 2, dt);
  }
  /** world position of a point on a bone (offset in the bind-pose frame) */
  bonePoint(name, at, out = new THREE.Vector3()) {
    const b = this.inst.by[name] || this.inst.bones[0];
    this.group.updateMatrixWorld(true);
    return out.copy(at).applyMatrix4(b.matrixWorld);
  }
  saddle(out) { const S = this.T.meta.saddle; return this.bonePoint(S.bone, S.at, out); }
  seat(i, out) { const S = this.T.meta.saddle; return this.bonePoint(S.bone, S.seats[i] || S.at, out); }
  get seats() { return this.T.meta.saddle.seats.length; }
  mouth(out) { const S = this.T.meta.mouth; return this.bonePoint(S.bone, S.at, out); }
  centre(out = new THREE.Vector3()) { return out.copy(this.pos).add(_w.set(0, this.flyer || this.swimmer ? 0 : this.height * 0.5, 0)); }

  /* ---------------- physics ---------------- */
  _slopeLimit() { return this.has('wallclimb') ? 6 : this.has('climb') ? 1.6 : 0.85 - this.heavy * 0.15; }
  /** heading, speed: where it wants to go; o.jump (m/s up), o.avoidWater (AI), o.block (callback: true = can't step there) */
  stepGround(dt, heading, want, o = {}) {
    const T = this.g.terrain, sp = this.sp;
    const turn = (sp.speed.turn || 2) * (o.turnMul || 1) * (this.speed > sp.speed.walk * 1.5 ? 0.8 : 1);
    const dy = wrapAngle(heading - this.yaw);
    const step = clamp(dy, -turn * dt, turn * dt);
    this.yaw = wrapAngle(this.yaw + step);
    this.yawRate = damp(this.yawRate, step / Math.max(dt, 1e-4), 8, dt);
    // a creature can't sprint straight through a hairpin
    const facing = Math.cos(dy);
    let target = want * (facing > 0 ? 0.35 + 0.65 * facing : 0.25);
    const accel = lerp(16, 3.2, this.heavy) * (o.accelMul || 1);
    this.speed = this.speed < target ? Math.min(target, this.speed + accel * dt) : Math.max(target, this.speed - accel * 1.6 * dt);
    if (this.stun > 0) this.speed *= 0.4;
    // water: wade, paddle or swim
    const g0 = T.ground(this.pos.x, this.pos.z);
    const depth = Math.max(0, -g0);
    const wadeTo = this.has('wade') ? this.hip * 2.2 : this.hip * 0.95;
    const deep = depth > wadeTo;
    this.inWater = depth > 0.2;
    const swimming = deep && !this.flying;
    let v = this.speed;
    if (swimming) v = this.amph ? Math.min(this.speed, sp.speed.swim || 6) : this.speed * 0.38;
    else if (this.inWater) v *= 1 - Math.min(0.45, depth / Math.max(0.5, this.hip) * 0.4);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const nx = this.pos.x + fx * v * dt, nz = this.pos.z + fz * v * dt;
    const g1 = T.ground(nx, nz);
    // slopes: steep uphill stops you (unless you climb)
    const rise = (g1 - g0) / Math.max(0.01, v * dt);
    this._climbing = rise > 0.9 && this.has('wallclimb');
    let ok = !(rise > this._slopeLimit() && this.onGround && g1 > 0.3);
    if (o.avoidWater && -g1 > wadeTo && !this.amph) ok = false;
    if (o.block && o.block(nx, nz)) ok = false;
    if (ok) { this.pos.x = nx; this.pos.z = nz; }
    else { this.speed *= 0.3; if (o.onBlocked) o.onBlocked(); }
    // solid things
    const ignore = o.ignore;
    if (this.g.colliders.push(this.pos, this.radius, this.height, ignore) && o.onBump) o.onBump();
    // vertical
    const gh = this._floor(this.pos.x, this.pos.z);
    if (o.jump && this.onGround && !swimming) { this.vy = o.jump; this.onGround = false; }
    if (swimming) {
      this.pos.y = damp(this.pos.y, Math.max(gh, -0.15) + Math.sin(this.g.time * 1.6 + this.pos.x) * 0.05, 6, dt);
      this.onGround = true; this.vy = 0;
    } else if (!this.onGround) {
      this.vy -= 24 * dt * (this.vy < 0 && o.glide ? 0.25 : 1);
      this.pos.y += this.vy * dt;
      if (this.pos.y <= gh) { this.pos.y = gh; this.onGround = true; if (this.vy < -14 && o.onLand) o.onLand(-this.vy); this.vy = 0; }
    } else {
      // stick to the ground going down a slope; walk off a cliff and you fall
      if (gh < this.pos.y - Math.max(1.4, v * dt * 2.5)) { this.onGround = false; this.vy = 0; }
      else this.pos.y = gh;
    }
    this.under = swimming && this.amph;
    this._tilt(dt, swimming);
    this.vel.set(fx * v, this.vy, fz * v);
  }
  _floor(x, z) {
    const g = this.g.terrain.ground(x, z);
    const f = this.g.colliders.floorAt(x, z, this.pos.y, 0.8);
    return Math.max(g, f);
  }
  /** lean the body into the slope (and into turns when fast) */
  _tilt(dt, swim) {
    const T = this.g.terrain, L = Math.max(0.6, this.len * 0.32), fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    let p = 0, r = 0;
    if (!swim && this.onGround) {
      const a = T.ground(this.pos.x + fx * L, this.pos.z + fz * L), b = T.ground(this.pos.x - fx * L, this.pos.z - fz * L);
      p = -Math.atan2(a - b, 2 * L) * (this.has('wallclimb') ? 1 : 0.75);
      const W = Math.max(0.4, this.radius);
      const c = T.ground(this.pos.x + fz * W, this.pos.z - fx * W), d = T.ground(this.pos.x - fz * W, this.pos.z + fx * W);
      r = Math.atan2(c - d, 2 * W) * 0.4;
    }
    r += clamp(-this.yawRate * this.speed * 0.01, -0.2, 0.2);
    this.pitch = damp(this.pitch, clamp(p, -1.2, 1.2), 6, dt);
    this.roll = damp(this.roll, r, 6, dt);
  }
  /** dir: wanted direction (unit, 3D), want: speed. Stays between the sea floor and the surface (o.breach allows leaving it). */
  stepSwim(dt, dir, want, o = {}) {
    const sp = this.sp, T = this.g.terrain;
    const turn = (sp.speed.turn || 1.6) * (o.turnMul || 1);
    const tyaw = Math.atan2(dir.x, dir.z), tpitch = -Math.asin(clamp(dir.y, -1, 1));
    const dy = wrapAngle(tyaw - this.yaw), stepY = clamp(dy, -turn * dt, turn * dt);
    this.yaw = wrapAngle(this.yaw + stepY);
    this.yawRate = damp(this.yawRate, stepY / Math.max(dt, 1e-4), 8, dt);
    this.pitch = dampAngle(this.pitch, clamp(tpitch, -1.1, 1.1), 2.5, dt);
    const accel = lerp(10, 2.5, this.heavy);
    const target = want * (0.4 + 0.6 * Math.max(0, Math.cos(dy)));
    this.speed = this.speed < target ? Math.min(target, this.speed + accel * dt) : Math.max(target, this.speed - accel * dt);
    if (this.stun > 0) this.speed *= 0.4;
    const cp = Math.cos(this.pitch);
    _v.set(Math.sin(this.yaw) * cp, -Math.sin(this.pitch), Math.cos(this.yaw) * cp).multiplyScalar(this.speed);
    if (this.airborne) {
      // a breach: ballistic until it splashes back down
      this.vel.y -= 22 * dt;
      this.pos.addScaledVector(this.vel, dt);
      this.pitch = damp(this.pitch, -Math.atan2(this.vel.y, Math.hypot(this.vel.x, this.vel.z)), 6, dt);
      if (this.pos.y < -0.2 && this.vel.y < 0) { this.airborne = false; if (o.onSplash) o.onSplash(); }
      return;
    }
    this.vel.copy(_v);
    this.pos.addScaledVector(_v, dt);
    const g = T.ground(this.pos.x, this.pos.z);
    const bh = Math.max(0.3, this.height * 0.5);
    const top = -bh * 0.7, floor = g + bh;
    if (o.maxDepth != null && this.pos.y < -o.maxDepth) { this.pos.y = -o.maxDepth; if (o.onTooDeep) o.onTooDeep(); }
    if (this.pos.y > top) {
      if (o.breach && this.speed > (sp.speed.swim || 8) * 0.7 && dir.y > 0.2) { this.airborne = true; this.vel.y = Math.max(this.vel.y, 7 + this.speed * 0.25); if (o.onBreach) o.onBreach(); }
      else this.pos.y = damp(this.pos.y, top, 5, dt);
    }
    if (this.pos.y < floor) this.pos.y = floor;
    if (g > -bh * 1.3) {  // too shallow: push back out to sea
      const n = T.normal(this.pos.x, this.pos.z, _w);
      this.pos.x += n.x * 4 * dt; this.pos.z += n.z * 4 * dt; this.speed *= 0.96;
      if (o.onShallow) o.onShallow();
    }
    this.under = this.pos.y < -0.4;
    this.inWater = true; this.onGround = false;
    this.roll = damp(this.roll, clamp(-this.yawRate * 0.25, -0.5, 0.5), 4, dt);
  }
  /** flight: heading + wanted climb rate. o.land asks it to settle onto the ground. Returns false when it lands. */
  stepFly(dt, heading, want, climb, o = {}) {
    const sp = this.sp, T = this.g.terrain;
    const turn = (sp.speed.turn || 1.8) * (o.turnMul || 1);
    const dy = wrapAngle(heading - this.yaw), stepY = clamp(dy, -turn * dt, turn * dt);
    this.yaw = wrapAngle(this.yaw + stepY);
    this.yawRate = damp(this.yawRate, stepY / Math.max(dt, 1e-4), 6, dt);
    const accel = lerp(12, 4, this.heavy);
    this.speed = this.speed < want ? Math.min(want, this.speed + accel * dt) : Math.max(want, this.speed - accel * 0.6 * dt);
    if (this.stun > 0) this.speed *= 0.5;
    this.vy = damp(this.vy, climb, 2.5, dt);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    this.pos.x += fx * this.speed * dt; this.pos.z += fz * this.speed * dt; this.pos.y += this.vy * dt;
    const g = Math.max(T.ground(this.pos.x, this.pos.z), 0.6);
    const clear = this.height * 0.6 + 0.6;
    if (this.pos.y < g + clear) {
      if (o.land || this.speed < 2) { this.pos.y = g; this.flying = false; this.onGround = true; this.vy = 0; return false; }
      this.pos.y = g + clear; this.vy = Math.max(this.vy, 0);
    }
    this.pos.y = Math.min(this.pos.y, 330);
    this.g.colliders.push(this.pos, this.radius * 0.6, this.height);
    // flap hard when climbing or slow, glide when diving or cruising
    this.flap = damp(this.flap, clamp(0.25 + climb * 0.12 + (1 - this.speed / Math.max(1, sp.speed.fly)) * 0.7, 0, 1), 3, dt);
    this.pitch = damp(this.pitch, clamp(-this.vy * 0.05, -0.6, 0.5), 3, dt);
    this.roll = damp(this.roll, clamp(-this.yawRate * 0.5, -0.9, 0.9), 3, dt);
    this.vel.set(fx * this.speed, this.vy, fz * this.speed);
    this.onGround = false; this.flying = true; this.inWater = false; this.under = false;
    return true;
  }
  /** take off from the ground */
  takeOff() { if (this.flyer && !this.flying) { this.flying = true; this.onGround = false; this.vy = 6; this.speed = Math.max(this.speed, 3); this.pos.y += 0.5; } }
}
