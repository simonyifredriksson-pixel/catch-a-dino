/* Player.js - you, on foot (riding is game/Riding.js).

   Third person, movement relative to the camera. Walk, SHIFT sprint
   (stamina), C sneak (creatures notice you much later), SPACE jump - and with
   the Leaf Glider, hold SPACE while falling to glide. Deep water means
   swimming: CTRL dives, SPACE surfaces, and breath runs out underwater.
   The world bites back: lava burns, the Whiteout freezes you without a coat
   or a warm-blooded mount, predators knock you down. Run out of hearts and
   the rangers carry you home. */
import * as THREE from '../../lib/three.module.js';
import { makeHuman } from '../art/PeopleArt.js';
import { clamp, damp, dampAngle, lerp } from '../core/Util.js';
import { UPGRADES } from '../data/Items.js';
import { lavaAt } from '../world/Water.js';
import { Bus } from '../core/Bus.js';

const _v = new THREE.Vector3();
export const HEARTS = 5;

export class Player {
  constructor(game, look = 0) {
    this.g = game;
    this.look = look;
    this._mk();
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.onGround = true; this.mode = 'foot';
    this.stamina = 1; this.breath = 15; this.hearts = HEARTS; this.hurtT = 0; this.cold = 0; this.heat = 0;
    this.crouch = false; this.gliding = false;
    this.mount = null; this.ride = null;  // ride: { owner, seat } when you sit behind someone else
    this.A = { throw: 0, charge: 0, pull: 0, tension: 0, cheer: 0, photo: 0, point: 0, drag: 0, spin: false };
    this.cheerT = 0; this.koT = 0; this.knock = new THREE.Vector3();
    this.airT = 0;
  }
  _mk() {
    if (this.rig) this.g.scene.remove(this.rig.root);
    this.rig = makeHuman({ look: this.look });
    this.g.scene.add(this.rig.root);
  }
  get head() { return _v.copy(this.pos).add(new THREE.Vector3(0, this.mode === 'swim' ? 0.4 : 1.6, 0)); }
  get riding() { return !!this.mount || !!this.ride; }
  upg(k) { return UPGRADES[k].levels[this.g.W.upg[k] || 0]; }

  /** take a hit: knock back, lose a heart (sturdy mounts and short invulnerability protect you) */
  hit(dir, force = 6, hearts = 1, why = '') {
    if (this.hurtT > 0 || this.koT > 0) return false;
    this.hurtT = 1.2;
    if (this.mount && !this.mount.has('sturdy') && force > 5) { this.g.riding.dismount(true); }
    if (!this.riding) { this.knock.copy(dir).setY(0).normalize().multiplyScalar(force); this.vel.y = Math.min(8, force * 0.6); this.onGround = false; }
    this.hearts = Math.max(0, this.hearts - hearts);
    this.g.cam.shake(0.5);
    this.g.audio.hurt();
    this.g.ui.hurt();
    if (why) this.g.ui.toast(why, 'bad');
    if (this.hearts <= 0) this.faint();
    return true;
  }
  faint() {
    if (this.koT > 0) return;
    this.koT = 3.2;
    this.g.catching.cancel(true);
    if (this.mount) this.g.riding.dismount(true);
    this.g.ui.fade('Knocked out...', 'The rangers found you and carried you home.', 3);
    Bus.emit('player:ko', {});
  }

  update(dt, input, cam) {
    const G = this.g, T = G.terrain;
    this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.koT > 0) {
      this.koT -= dt;
      this.rig.anim(dt, { ko: true });
      if (this.koT <= 0) { G.respawn(); this.hearts = HEARTS; this.cold = 0; this.heat = 0; }
      return;
    }
    // slowly heal when nothing is biting
    if (this.hurtT <= 0 && this.hearts < HEARTS) { this.healT = (this.healT || 0) + dt; if (this.healT > 14) { this.healT = 0; this.hearts++; } }
    if (this.riding) { this._hazards(dt, true); return; }   // riding.js moves us
    const fwd = cam.yaw;
    const mx = input.axis('KeyA', 'KeyD'), mz = input.axis('KeyS', 'KeyW');
    const wish = new THREE.Vector3(mx, 0, mz);
    if (wish.lengthSq() > 1) wish.normalize();
    // camera-relative: the camera looks along (-sin yaw, -cos yaw); its right is (cos yaw, -sin yaw)
    const sx = Math.sin(fwd), cz = Math.cos(fwd);
    const wx = -sx * wish.z + cz * wish.x, wz = -cz * wish.z - sx * wish.x;
    const moving = Math.hypot(wx, wz) > 0.01;
    this.crouch = input.held('KeyC') && this.mode === 'foot';
    const boots = this.upg('boots').stam;
    const sprint = input.held('ShiftLeft') && moving && this.stamina > 0.02 && !this.crouch;
    const depth = -T.ground(this.pos.x, this.pos.z);
    const swim = depth > 1.25;
    this.mode = swim ? 'swim' : 'foot';
    let speed = swim ? (sprint ? 4.6 : 3.2) : this.crouch ? 2.2 : sprint ? 8.2 : 4.7;
    if (G.catching.busy) speed *= G.catching.moveMul;
    if (this.cold > 0.5) speed *= 0.75;
    if (sprint) this.stamina = Math.max(0, this.stamina - dt * 0.17 / boots); else this.stamina = Math.min(1, this.stamina + dt * 0.22);
    const tvx = wx * speed, tvz = wz * speed;
    const acc = this.onGround || swim ? 28 : 6;
    this.vel.x = damp(this.vel.x, tvx, acc * 0.3, dt); this.vel.z = damp(this.vel.z, tvz, acc * 0.3, dt);
    // knockback decays
    this.vel.x += this.knock.x; this.vel.z += this.knock.z; this.knock.multiplyScalar(Math.exp(-dt * 6));
    if (this.knock.lengthSq() < 0.01) this.knock.set(0, 0, 0);
    // facing: toward movement, or the camera when aiming
    const aiming = G.catching.aiming || input.btn(2);
    if (aiming) this.yaw = dampAngle(this.yaw, fwd + Math.PI, 16, dt);
    else if (moving) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 10, dt);
    // vertical
    const ground = Math.max(T.ground(this.pos.x, this.pos.z), G.colliders.floorAt(this.pos.x, this.pos.z, this.pos.y, 0.7));
    if (swim) {
      const surf = -1.15;
      let ty = this.pos.y;
      if (input.held('ControlLeft') || input.held('KeyQ')) ty -= 4 * dt; else if (input.held('Space') || this.pos.y > surf - 0.2) ty = damp(ty, surf, 3, dt);
      else ty = damp(ty, surf, 0.8, dt);
      this.pos.y = Math.max(ground + 0.3, ty);
      this.vel.y = 0; this.onGround = false;
      const under = this.pos.y < surf - 0.6;
      const maxAir = this.upg('helmet').air;
      if (under) { this.breath -= dt; if (this.breath <= 0) { this.breath = 0; this.drownT = (this.drownT || 0) + dt; if (this.drownT > 2.5) { this.drownT = 0; this.hit(new THREE.Vector3(0, 1, 0), 0, 1, 'Out of air!'); } } }
      else this.breath = Math.min(maxAir, this.breath + dt * 6);
      this.under = under;
    } else {
      this.under = false;
      this.breath = Math.min(this.upg('helmet').air, this.breath + dt * 6);
      if (this.onGround && input.pressed('Space') && !G.catching.busy) { this.vel.y = 7.4; this.onGround = false; G.audio.jump(); }
      if (!this.onGround) {
        this.gliding = this.vel.y < -2 && input.held('Space') && this.upg('glider').glide > 0;
        this.vel.y -= 22 * dt;
        if (this.gliding) { this.vel.y = Math.max(this.vel.y, -2.6); const f = 11; this.vel.x = damp(this.vel.x, Math.sin(this.yaw) * f + tvx * 0.3, 2, dt); this.vel.z = damp(this.vel.z, Math.cos(this.yaw) * f + tvz * 0.3, 2, dt); }
        this.pos.y += this.vel.y * dt;
        this.airT += dt;
        if (this.pos.y <= ground) {
          this.pos.y = ground;
          if (this.vel.y < -19 && !this.gliding) this.hit(new THREE.Vector3(0, 1, 0), 0, 1, 'Ouch! That was a long way down.');
          this.vel.y = 0; this.onGround = true; this.gliding = false; this.airT = 0;
        }
      } else {
        if (ground < this.pos.y - 0.9) { this.onGround = false; this.vel.y = 0; }
        else this.pos.y = ground;
        // too steep: slide down
        const n = T.normal(this.pos.x, this.pos.z, _v);
        if (n.y < 0.62 && ground === T.ground(this.pos.x, this.pos.z)) { this.vel.x += n.x * 22 * dt; this.vel.z += n.z * 22 * dt; }
      }
    }
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    // uphill too steep to walk (not jumping)
    if (this.onGround && !swim) {
      const g1 = T.ground(this.pos.x, this.pos.z), g0 = T.ground(ox, oz), d = Math.hypot(this.pos.x - ox, this.pos.z - oz);
      if (d > 1e-4 && (g1 - g0) / d > 1.25 && g1 > this.pos.y + 0.4) { this.pos.x = ox; this.pos.z = oz; }
    }
    G.colliders.push(this.pos, 0.38, 1.8);
    G.zoo?.blockPlayer?.(this.pos, ox, oz);
    G.world.clampBounds(this.pos);
    this._hazards(dt, false);
    // animation
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.cheerT = Math.max(0, this.cheerT - dt);
    this.rig.anim(dt, { speed: sp, air: !this.onGround && !swim && this.airT > 0.12, swim, crouch: this.crouch, ...this._A(), cheer: this.cheerT > 0, lookPitch: -cam.pitch * 0.4 });
    this.place();
  }
  _A() { const A = this.A; return { throw: A.throw, charge: A.charge, pull: A.pull, tension: A.tension, photo: A.photo, point: A.point, drag: A.drag, spin: A.spin }; }
  place() {
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.set(0, this.yaw, 0);
  }
  /** lava, cold, heat */
  _hazards(dt, riding) {
    const G = this.g, p = this.pos, m = this.mount || (this.ride && G.riding.mountOf(this.ride.owner));
    const heatproof = m && m.has('heatproof'), warm = (m && m.has('warm')) || this.upg('coat').cold > 0;
    // lava
    if (lavaAt(p.x, p.z, G.world.lavaFlows) && p.y < G.world.lavaY(p.x, p.z) + 1.5 && !heatproof) {
      this.hit(new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5), 10, 1, 'LAVA! That is very hot!');
      if (riding && this.mount) { this.mount.vy = 8; this.mount.onGround = false; }
      G.fx.burst(p.x, p.y + 0.5, p.z, 'ember', 14);
    }
    // the Whiteout: cold builds up without protection
    const inW = G.terrain.inWhiteout(p.x, p.z);
    if (inW && !warm) {
      this.cold = Math.min(1, this.cold + dt / 22);
      if (this.cold >= 1) { this.coldT = (this.coldT || 0) + dt; if (this.coldT > 4) { this.coldT = 0; this.hit(new THREE.Vector3(0, 1, 0), 0, 1, 'Freezing! You need a Fur Coat or a warm-blooded mount.'); } }
    } else this.cold = Math.max(0, this.cold - dt / 6);
    if (inW && !warm && !this._coldWarned) { this._coldWarned = true; G.ui.toast('It is bitterly cold in here...', 'warn'); }
    if (!inW) this._coldWarned = false;
  }
}
void clamp; void lerp;
