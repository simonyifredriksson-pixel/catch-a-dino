/* Riding.js - your active creature: under the saddle, or trotting along behind you.

   Summon a creature from your crate (its hotbar slot, or the inventory) and it
   bursts out next to you; E to climb on, E to get off. Off the saddle it
   follows you around like a companion; walk off too far and it goes back in
   the crate. Only one creature is out at a time.

   GROUND  W moves toward where the camera looks, SHIFT sprints (stamina - the
           Sprint ability goes flat out), SPACE jumps if it can, F uses its
           ability. Heavy animals take a while to get going and to turn.
   FLY     SPACE takes off and climbs, W flies where you look (look up to
           climb), CTRL dives, no W glides. Land by flying low and slow (S).
   SWIM    W swims where you look (diving if it can dive), SPACE up, CTRL down,
           SPACE at speed near the surface breaches. Each swimmer has a depth
           limit, and you need breath (a Dive Helmet) to go under.
   Big mounts have seats: friends press E to ride behind you. */
import * as THREE from '../../lib/three.module.js';
import { Creature } from './Creature.js';
import { SP } from '../data/Species.js';
import { UPGRADES } from '../data/Items.js';
import { clamp, damp, wrapAngle, lerp } from '../core/Util.js';
import { Bus } from '../core/Bus.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();

export class Riding {
  constructor(game) {
    this.g = game;
    this.c = null;            // your creature that is out (ridden or following)
    this.stamina = 1; this.cd = 0; this.charging = 0; this.dashT = 0;
    this.remote = new Map();  // pid -> Creature (other players' mounts, drawn from their state)
    this.stompT = 0;
  }
  get P() { return this.g.player; }
  get mount() { return this.P.mount; }
  mountOf(pid) { return pid === this.g.me ? this.P.mount : this.remote.get(pid) || null; }
  saddleMul() { return UPGRADES.saddle.levels[this.g.W.upg.saddle || 0].stam; }

  /** bring a creature out of your crate */
  summon(uid) {
    const G = this.g, rec = G.W.creatures[uid];
    if (!rec) return;
    const sp = SP[rec.sp];
    if (this.c && this.c.uid === uid) { if (!this.P.mount) this.mountOn(this.c); return; }
    if (G.catching.busy) return G.ui.toast('Not while you are catching something!', 'warn');
    if (this.c) this.recall(true);
    const P = this.P;
    // swimmers need water, flyers and walkers need ground
    const fx = P.pos.x + Math.sin(P.yaw) * 3, fz = P.pos.z + Math.cos(P.yaw) * 3;
    const depth = -G.terrain.ground(fx, fz);
    if (sp.move === 'swim' && depth < 2) return G.ui.toast(sp.name + ' needs deep water. Get into the sea first.', 'warn');
    if (G.inInterior && (sp.size === 'XL') ) return G.ui.toast('Too big to bring out in here.', 'warn');
    const c = new Creature(G, { sp: rec.sp, v: rec.v, size: rec.size, uid, flying: false, baby: rec.baby });
    c.pos.set(fx, 0, fz);
    c.pos.y = sp.move === 'swim' ? -1.2 : Math.max(G.terrain.ground(fx, fz), sp.move === 'fly' ? G.terrain.ground(fx, fz) : -0.15);
    c.yaw = P.yaw; c.flying = false; c.onGround = sp.move !== 'swim';
    c.place();
    this.c = c;
    G.fx.burst(fx, c.pos.y + 0.5, fz, 'magic', 26, { scale: Math.max(1, c.height * 0.4) });
    G.fx.ring(fx, c.pos.y + 0.1, fz, Math.max(2, c.len * 0.6), '#9af0ff');
    G.audio.roar(c.pos, Math.min(1, c.height / 6) * 0.6, sp.move === 'fly' ? 'screech' : sp.id === 'para' ? 'honk' : 'roar');
    c.anim.play('roar');
    if (sp.ride !== false) this.mountOn(c);
    else G.ui.toast(sp.name + ' is too small to ride - it will tag along.', 'info');
    Bus.emit('mount:summon', { sp: rec.sp });
  }
  /** back in the crate */
  recall(quiet) {
    const G = this.g, c = this.c; if (!c) return;
    if (this.P.mount === c) this.dismount(false, true);
    if (!quiet) { G.fx.burst(c.pos.x, c.pos.y + c.height * 0.5, c.pos.z, 'magic', 20, { scale: Math.max(1, c.height * 0.4) }); G.audio.open(); }
    c.dispose(); this.c = null;
  }
  mountOn(c) {
    const G = this.g, P = this.P;
    if (c.sp.ride === false) return G.ui.toast('Too small to ride.', 'warn');
    P.mount = c; c.mount = P; P.mode = 'ride';
    if (G.catching.busy) G.catching.cancel(true);
    G.audio.jump();
    G.ui.mountHint(c);
    Bus.emit('mount:on', { sp: c.spId });
  }
  dismount(knocked = false, quiet = false) {
    const G = this.g, P = this.P, c = P.mount;
    if (!c) return;
    P.mount = null; c.mount = null; P.mode = 'foot';
    c.saddle(_v);
    const side = Math.max(1.2, c.radius + 0.8);
    P.pos.set(c.pos.x + Math.cos(c.yaw) * side, 0, c.pos.z - Math.sin(c.yaw) * side);
    P.pos.y = Math.max(G.terrain.ground(P.pos.x, P.pos.z), c.flying ? _v.y - 1 : G.terrain.ground(P.pos.x, P.pos.z));
    if (c.under || c.swimmer) P.pos.y = Math.max(G.terrain.ground(P.pos.x, P.pos.z), -1.1);
    P.vel.set(0, knocked ? 6 : 2, 0); P.onGround = false;
    if (knocked) { P.knock.set(Math.cos(c.yaw) * 5, 0, -Math.sin(c.yaw) * 5); G.ui.toast('You were knocked off!', 'bad'); }
    if (c.flying && !knocked) { c.flying = true; }
    if (!quiet) G.audio.jump();
    Bus.emit('mount:off', {});
  }

  /* ---------------- per frame ---------------- */
  update(dt, input, blocked) {
    const G = this.g, P = this.P, c = this.c;
    this.cd = Math.max(0, this.cd - dt);
    if (P.ride) this._passenger(dt, input);
    if (c) {
      if (P.mount === c) this._ride(dt, input, blocked);
      else this._follow(dt);
      c.stun = Math.max(0, c.stun - dt);
      c.place();
      c.animate(dt, { lookYaw: P.mount === c ? clamp(wrapAngle(G.cam.yaw + Math.PI - c.yaw), -1, 1) * 0.6 : undefined });
      // heavy footfalls you can feel
      if (c.onGround && c.speed > 1 && c.heavy > 0.55) {
        this.stompT -= dt * c.speed / Math.max(1, c.hip);
        if (this.stompT <= 0) { this.stompT = 1.1; G.audio.stomp(c.pos, c.heavy); if (P.mount === c) G.cam.shake(0.05 + c.heavy * 0.12); G.fx.dust(c.pos.x, c.pos.y, c.pos.z, c.heavy * 1.5); }
      }
    }
    for (const m of this.remote.values()) { m.place(); }
  }
  _ride(dt, input, blocked) {
    const G = this.g, P = this.P, c = this.c, sp = c.sp, cam = G.cam;
    const fwdYaw = cam.yaw + Math.PI;           // the direction the camera looks
    const mx = blocked ? 0 : input.axis('KeyA', 'KeyD'), mz = blocked ? 0 : input.axis('KeyS', 'KeyW');
    const moving = mx !== 0 || mz !== 0;
    const heading = Math.atan2(-Math.sin(cam.yaw) * mz + Math.cos(cam.yaw) * mx, -Math.cos(cam.yaw) * mz - Math.sin(cam.yaw) * mx);
    const sprintKey = !blocked && input.held('ShiftLeft') && moving;
    const fighting = G.catching.fighting;
    const stamMul = this.saddleMul();
    if (input.pressed('KeyE') && !blocked && !fighting) { this.dismount(); return; }
    if (input.pressed('KeyF') && !blocked) G.abilities.use(c);
    this.charging = Math.max(0, this.charging - dt); this.dashT = Math.max(0, this.dashT - dt);
    // ---- swimmers
    if (c.swimmer || (c.amph && c.has('dive') && c.under && G.terrain.ground(c.pos.x, c.pos.z) < -c.hip * 1.4)) {
      const look = G.camera.getWorldDirection(_w);
      const dir = _v.set(0, 0, 0);
      if (mz > 0) dir.copy(look); else if (mz < 0) dir.copy(look).multiplyScalar(-0.3);
      if (mx) { dir.x += Math.cos(cam.yaw) * mx * 0.7; dir.z += -Math.sin(cam.yaw) * mx * 0.7; }
      if (!blocked && input.held('Space')) dir.y += 0.9;
      if (!blocked && (input.held('ControlLeft') || input.held('KeyQ'))) dir.y -= 0.9;
      const can = c.has('dive') ? 1 : 0;
      if (!can && dir.y < 0) dir.y = 0;
      if (dir.lengthSq() < 0.01) dir.set(Math.sin(c.yaw), 0, Math.cos(c.yaw));
      dir.normalize();
      const sprint = sprintKey && this.stamina > 0.05;
      if (sprint) this.stamina = Math.max(0, this.stamina - dt * 0.16 / stamMul); else this.stamina = Math.min(1, this.stamina + dt * 0.2);
      const spd = moving || input.held('Space') || input.held('ControlLeft') ? (sp.speed.swim || 8) * (sprint ? 1.35 : 0.85) : 0;
      const maxDepth = Math.max(4, sp.dive || 12);
      c.stepSwim(dt, dir, fighting ? spd * 0.3 : spd, { breach: c.has('leap'), maxDepth,
        onTooDeep: () => { if (!this._deepWarn || G.time - this._deepWarn > 4) { this._deepWarn = G.time; G.ui.toast(sp.name + ' cannot dive any deeper (' + maxDepth + ' m).', 'warn'); } },
        onBreach: () => { G.fx.splash(c.pos.x, 0, c.pos.z, 1.5); G.audio.splash(c.pos, 1.2); Bus.emit('mount:breach', {}); },
        onSplash: () => { G.fx.splash(c.pos.x, 0, c.pos.z, 2); G.audio.splash(c.pos, 1.5); G.cam.shake(0.2); } });
      if (c.under && Math.random() < dt * 3) G.fx.burst(c.pos.x, c.pos.y + c.height * 0.4, c.pos.z, 'bubble', 2);
      this._seatPlayer(dt);
      return;
    }
    // ---- flyers
    if (c.flyer) {
      if (!c.flying) {
        if (!blocked && input.pressed('Space')) { c.takeOff(); G.audio.flap(c.pos, c.dims.span / 12); G.fx.burst(c.pos.x, c.pos.y, c.pos.z, 'dust', 20, { scale: 2 }); Bus.emit('mount:takeoff', {}); }
        else { c.stepGround(dt, moving ? heading : c.yaw, moving ? (sp.speed.run || 4) * (sprintKey ? 1 : 0.6) : 0, {}); this._seatPlayer(dt); return; }
      }
      const climbKey = !blocked && input.held('Space'), dive = !blocked && (input.held('ControlLeft') || input.held('KeyQ'));
      const boost = (sprintKey || this.dashT > 0) && (this.stamina > 0.05 || this.dashT > 0);
      const flyV = sp.speed.fly || 20;
      let want = mz > 0 ? flyV * (boost ? 1.45 : 1) : mz < 0 ? flyV * 0.3 : Math.max(flyV * 0.45, c.speed * 0.995);
      if (this.dashT > 0) want = flyV * 2.2;
      // fly where you look: camera pitch sets the climb
      let climb = (mz > 0 ? -clamp(cam.pitch - 0.15, -0.9, 0.9) * want * 0.65 : -1.4) + (climbKey ? 8 : 0) - (dive ? 14 : 0);
      if (dive) want += 10;
      const drain = (climbKey ? 0.09 : 0) + (boost && this.dashT <= 0 ? 0.14 : 0);
      if (drain) this.stamina = Math.max(0, this.stamina - dt * drain / stamMul); else this.stamina = Math.min(1, this.stamina + dt * 0.12);
      if (this.stamina <= 0.02 && climb > 0) climb = -1;
      const heading2 = moving ? heading : c.yaw;
      const land = mz < 0 && c.pos.y - Math.max(G.terrain.ground(c.pos.x, c.pos.z), 0) < 3;
      const still = c.stepFly(dt, mz > 0 || mx ? heading2 : c.yaw, fighting ? want * 0.35 : want, climb, { land });
      if (!still) { G.fx.burst(c.pos.x, c.pos.y, c.pos.z, 'dust', 14, { scale: 1.5 }); Bus.emit('mount:land', {}); }
      if (c.flap > 0.6 && Math.random() < dt * 2.5) G.audio.flap(c.pos, c.dims.span / 12);
      this._seatPlayer(dt);
      return;
    }
    // ---- walkers (and amphibians at the surface)
    const sprintable = c.has('sprint');
    const sprint = sprintKey && this.stamina > 0.04;
    if (sprint) this.stamina = Math.max(0, this.stamina - dt * (sprintable ? 0.14 : 0.2) / stamMul); else this.stamina = Math.min(1, this.stamina + dt * 0.16);
    const run = sp.speed.run || 6, walk = sp.speed.walk || 2;
    const trot = Math.max(walk * 1.9, run * 0.48);
    let want = moving ? (sprint ? run * (sprintable ? 1 : 0.82) : trot) : 0;
    if (this.charging > 0) want = run * 1.25;
    if (fighting) want *= 0.35;
    const jump = !blocked && input.pressed('Space') && c.has('jump') && c.onGround && !c.inWater ? (sp.speed.jump || 7) : 0;
    if (jump) { G.audio.jump(); c.anim.play('chomp'); }
    c.stepGround(dt, moving || this.charging > 0 ? (this.charging > 0 && !moving ? c.yaw : heading) : c.yaw, want, {
      jump, turnMul: this.charging > 0 ? 0.4 : 1, accelMul: this.charging > 0 ? 3 : 1,
      onLand: (v) => { G.fx.dust(c.pos.x, c.pos.y, c.pos.z, 1.5); G.cam.shake(Math.min(0.5, v * 0.02)); G.audio.stomp(c.pos, 0.6); },
      onBump: () => { if (this.charging > 0) { G.cam.shake(0.3); } },
    });
    if (this.charging > 0) G.abilities.chargeHit(c);
    if (c.inWater && c.speed > 2 && Math.random() < dt * 6) G.fx.burst(c.pos.x, 0.1, c.pos.z, 'splash', 2, { scale: 0.6 });
    if (c.speed > run * 0.7 && c.onGround && !c.inWater && Math.random() < dt * 8) G.fx.burst(c.pos.x, c.pos.y, c.pos.z, 'dust', 1, { scale: 0.6 + c.heavy });
    this._seatPlayer(dt);
  }
  /** you sit in the saddle and lean with the animal */
  _seatPlayer(dt) {
    const G = this.g, P = this.P, c = this.c;
    c.place(); c.saddle(_v);
    P.pos.copy(_v);
    P.yaw = c.yaw;
    P.rig.root.position.copy(_v).add(_w.set(0, -0.05, 0));
    P.rig.root.rotation.set(c.pitch * 0.8, c.yaw, c.roll * 0.8, 'YXZ');
    P.rig.anim(dt, { ride: true, lean: clamp(c.speed / Math.max(1, c.sp.speed.run || 8), 0, 1) * 0.6 + (c.flying ? 0.3 : 0), bounce: clamp(c.speed / 10, 0, 1), ...P._A(), cheer: P.cheerT > 0 });
    P.vel.copy(c.vel);
    P.onGround = c.onGround;
  }
  /** sitting behind a friend */
  _passenger(dt, input) {
    const G = this.g, P = this.P, m = this.mountOf(P.ride.owner);
    if (!m || input.pressed('KeyE')) { this.leaveSeat(); return; }
    m.seat(P.ride.seat, _v);
    P.pos.copy(_v); P.yaw = m.yaw;
    P.rig.root.position.copy(_v); P.rig.root.rotation.set(m.pitch * 0.8, m.yaw, m.roll * 0.8, 'YXZ');
    P.rig.anim(dt, { ride: true, lean: 0.3, ...P._A(), cheer: P.cheerT > 0 });
  }
  board(owner, seat) { const P = this.P; if (this.c && P.mount) this.dismount(false, true); P.ride = { owner, seat }; P.mode = 'ride'; this.g.ui.toast('Hop on! E to get off.', 'good'); }
  leaveSeat() {
    const G = this.g, P = this.P, m = this.mountOf(P.ride?.owner);
    if (m) { P.pos.set(m.pos.x + Math.cos(m.yaw) * (m.radius + 1), 0, m.pos.z - Math.sin(m.yaw) * (m.radius + 1)); P.pos.y = Math.max(G.terrain.ground(P.pos.x, P.pos.z), -1); }
    G.act({ k: 'unboard', owner: P.ride?.owner });
    P.ride = null; P.mode = 'foot'; P.vel.set(0, 3, 0); P.onGround = false;
  }
  /** off the saddle: trot after you */
  _follow(dt) {
    const G = this.g, P = this.P, c = this.c;
    const dx = P.pos.x - c.pos.x, dz = P.pos.z - c.pos.z, d = Math.hypot(dx, dz);
    if (d > 70) { this.recall(); G.ui.toast(c.sp.name + ' went back into your crate.', 'info'); return; }
    const near = 3 + c.radius * 1.5;
    if (c.swimmer) {
      const dir = _v.set(dx, (Math.min(-1.5, P.pos.y) - c.pos.y) * 0.3, dz); if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
      c.stepSwim(dt, dir.normalize(), d > near ? Math.min(c.sp.speed.swim || 8, d) : 0, {});
      return;
    }
    if (c.flyer && c.flying) {
      const want = d > near * 2 ? Math.min(c.sp.speed.fly || 15, d * 0.8) : 0;
      const gy = Math.max(G.terrain.ground(c.pos.x, c.pos.z), 0);
      c.stepFly(dt, Math.atan2(dx, dz), Math.max(want, 3), (gy + 4 - c.pos.y) * 0.8, { land: d < near * 2 });
      return;
    }
    const want = d > near ? clamp((d - near) * 1.2, 0, (c.sp.speed.run || 6) * 0.9) : 0;
    c.stepGround(dt, d > near ? Math.atan2(dx, dz) : c.yaw, want, { jump: d > near && P.pos.y > c.pos.y + 1.5 && c.has('jump') && c.onGround ? (c.sp.speed.jump || 6) : 0 });
    // idle: sniff around, sit down after a while
    c.idleT = d < near + 1 ? (c.idleT || 0) + dt : 0;
    c.astate = c.idleT > 12 ? 'rest' : c.idleT > 5 && Math.random() < 0.002 ? 'eat' : (c.astate === 'eat' && c.idleT > 5 ? 'eat' : null);
    void lerp;
  }
  /** draw / update another player's mount from their state */
  remoteMount(pid, st) {
    const G = this.g;
    let m = this.remote.get(pid);
    if (!st) { if (m) { m.dispose(); this.remote.delete(pid); } return; }
    if (!m || m.spId !== st.sp || m.v !== st.v) { if (m) m.dispose(); m = new Creature(G, { sp: st.sp, v: st.v, size: st.size }); m.remote = pid; this.remote.set(pid, m); m.pos.set(st.x, st.y, st.z); }
    m.target = st;
    return m;
  }
  tickRemote(dt) {
    for (const m of this.remote.values()) {
      const s = m.target; if (!s) continue;
      const k = 1 - Math.exp(-dt * 10);
      m.pos.x += (s.x - m.pos.x) * k; m.pos.y += (s.y - m.pos.y) * k; m.pos.z += (s.z - m.pos.z) * k;
      m.yaw += wrapAngle(s.yaw - m.yaw) * k; m.pitch += (s.p - m.pitch) * k; m.roll += (s.r - m.roll) * k;
      m.speed = s.sp2; m.flying = !!s.fl; m.under = !!s.un; m.onGround = !s.fl; m.inWater = !!s.wa; m.flap = s.fp ?? 0.5; m.astate = s.as || null;
      if (s.act && s.act !== m._lastAct) { m._lastAct = s.act; m.anim.play(s.act.split(':')[0]); }
      m.place(); m.animate(dt, {});
    }
  }
}
