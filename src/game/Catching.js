/* Catching.js - the Hooked catch, rebuilt for dinosaurs.

   idle -> charge (hold LMB: the loop whirls overhead) -> fly (the lasso, bola,
   net, harpoon or grapnel is a real projectile on a rope) -> snare -> fight
   -> caught / lost.  A miss reels back in.

   SNARE (Hooked's strike, moved to the creature): the loop lands around it
   and it rears up. A ring shrinks around it on screen - CLICK while the ring
   is inside the target band. Dead centre is a PERFECT snare (a head start).
   Too early, too late: it slips the loop and bolts - or, if it is the kind
   that bites, comes for you. Creatures busy eating bait are slow to react.

   FIGHT (Hooked's catch bar, reworked into the TUG METER):
     zone    your loop on the meter: hold LMB to pull (it rises), let go to
             give slack (it sinks). Keep the creature's head inside it.
     meter   fills while you are on it, drains while you are not, and a
             creature stronger than your rope (tool rating + mount + friends)
             bleeds it however well you play - the upgrade loop as a rule.
     tired   it only tires while you are on it.
     LUNGES  every few seconds it bolts left or right: press the OPPOSITE key
             (A / D) in time to brace. Miss it and you lose rope and get
             yanked off your feet.
     RAGE    the big ones roar: the screen shakes and your zone shrinks.
     cap     after 90 s (more for legends) the rope finally gives.
   In the world the animal runs circles at the end of the rope, drags you
   (or your mount) about, and is reeled closer as the meter fills.
   Friends who rope the same animal ASSIST: every helper adds strength. */
import * as THREE from '../../lib/three.module.js';
import { TOOLS, SIZE_RANK } from '../data/Tools.js';
import { RARITY } from '../data/Species.js';
import { projectileModel, Rope } from '../art/ToolArt.js';
import { clamp, damp, lerp, rng, wrapAngle } from '../core/Util.js';
import { Bus } from '../core/Bus.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3();
const TIER = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
const GRAV = { lasso: 14, bola: 12, net: 9, harpoon: 1.5, skyhook: 3 };

export class Catching {
  constructor(game) {
    this.g = game;
    this.state = 'idle';
    this.charge = 0;
    this.rope = new Rope(game.scene, '#c8a878', 0.06);
    this.proj = null; this.projMesh = null; this.toolId = null;
    this.c = null;       // the creature on the end of the rope
    this.loop = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 20), new THREE.MeshStandardMaterial({ color: '#c8a878', flatShading: true }));
    this.loop.visible = false; game.scene.add(this.loop);
    this.F = null; this.bar = null; this.assists = {};
    this.ring = 0; this.msgT = 0;
    this.tip = new THREE.Vector3();
  }
  get busy() { return this.state !== 'idle'; }
  get aiming() { return this.state === 'charge'; }
  get fighting() { return this.state === 'fight'; }
  get moveMul() { return { fight: 0.32, snare: 0.15, charge: 0.6, fly: 0.9, reel: 1, assist: 0.4 }[this.state] ?? 1; }
  get tool() { return TOOLS[this.toolId] || TOOLS.rope; }
  kindOf(c) { return c.flying ? 'air' : (c.under || (c.swimmer && c.inWater)) ? 'water' : 'land'; }
  /** how hard would this one be with what you are holding? 'easy' | 'fair' | 'hard' | 'too strong' */
  difficulty(c, toolId) {
    const T = TOOLS[toolId]; if (!T || T.kind !== 'catch') return null;
    if (SIZE_RANK[c.sp.size] > SIZE_RANK[T.maxSize]) return 'too big';
    const over = this._fightOf(c) - this._rating(T);
    return over > 0.25 ? 'too strong' : over > -0.15 ? 'hard' : over > -0.6 ? 'fair' : 'easy';
  }
  _fightOf(c) { return c.sp.fight * (0.88 + c.size * 0.26) * (c.v ? 1.06 : 1); }
  _rating(T) {
    const P = this.g.player, m = P.mount;
    let r = T.stats.rating;
    if (m) r += 0.12 + (m.sp.power || 1) * 0.06;          // a strong mount helps you hold on
    const helpers = Object.values(this.assists).filter(t => this.g.time - t < 1.2).length;
    r += helpers * 0.4;
    return r;
  }

  cancel(silent = false) {
    if (this.state === 'fight' && !silent) return this._lose('You let it go.');
    if (this.c && (this.state === 'snare' || this.state === 'fight')) this.g.wild.release(this.c, 'calm');
    if (this.state === 'assist' && this.c) this.g.act({ k: 'unassist', id: this.c.id });
    this._clear();
  }
  _clear() {
    this.state = 'idle'; this.c = null; this.F = null; this.bar = null;
    if (this.projMesh) { this.g.scene.remove(this.projMesh); this.projMesh = null; }
    this.rope.hide(); this.loop.visible = false;
    const A = this.g.player.A; A.throw = 0; A.pull = 0; A.spin = false;
    this.g.audio.beds && this.g.audio.update && 0;
  }
  msg(t, kind) { this.g.ui.toast(t, kind); }

  /** where the rope leaves your hand */
  handPos(out) {
    const P = this.g.player;
    P.rig.P.handR.getWorldPosition(out);
    return out;
  }

  update(dt, input, blocked, toolId) {
    const G = this.g, P = G.player;
    this.handPos(this.tip);
    const lmb = !blocked && input.btn(0), click = !blocked && input.click(0), unclick = input.unclick(0);
    if (toolId !== this.toolId && this.state !== 'fight' && this.state !== 'snare') { if (this.state !== 'idle') this.cancel(true); this.toolId = toolId; }
    const T = TOOLS[this.toolId];
    const isCatch = T && T.kind === 'catch';
    switch (this.state) {
      case 'idle':
        if (isCatch && click && !P.koT && !G.ui.blockingClick) { this.state = 'charge'; this.charge = 0; G.audio.whoosh(0.3); }
        break;
      case 'charge': {
        this.charge = Math.min(1, this.charge + dt / 0.9);
        P.A.throw = 1; P.A.charge = this.charge; P.A.spin = T.behavior === 'lasso' || T.behavior === 'bola';
        G.audio.whirl(true, 1 + this.charge * 2);
        if (unclick || !lmb) this._throw();
        break;
      }
      case 'fly': this._fly(dt); break;
      case 'reel': {
        const pm = this.projMesh;
        if (!pm) { this._clear(); break; }
        _v.subVectors(this.tip, pm.position); const L = _v.length();
        pm.position.addScaledVector(_v.normalize(), Math.min(L, dt * 30));
        this.rope.draw(this.tip, pm.position, L * 0.08, G.camera.position);
        P.A.throw = 0; P.A.pull = 0.6;
        if (L < 1.2) this._clear();
        break;
      }
      case 'snare': this._snare(dt, click); break;
      case 'fight': this._fight(dt, input, lmb); break;
      case 'assist': this._assist(dt, input, lmb); break;
    }
    if (this.state !== 'charge') G.audio.whirl(false);
  }

  /* ---------------- throwing ---------------- */
  _throw() {
    const G = this.g, P = G.player, T = this.tool, S = T.stats;
    const cam = G.camera;
    const fwd = cam.getWorldDirection(_w).clone();
    // aim: the assisted target if there is one, else whatever the crosshair is on
    const range = S.range * (0.45 + 0.55 * this.charge);
    let aim = null;
    const tgt = G.tools.assist;
    if (tgt && tgt.c && tgt.d < range + 6) aim = tgt.c.centre(new THREE.Vector3());
    if (!aim) {
      const o = cam.position.clone();
      aim = o.clone().addScaledVector(fwd, range + 4);
      for (let d = 2; d < range + 4; d += 1.5) { const p = o.clone().addScaledVector(fwd, d); if (p.y < G.terrain.ground(p.x, p.z) || (p.y < 0 && T.behavior !== 'harpoon')) { aim = p; break; } }
    }
    const from = this.tip.clone();
    let to = aim.clone().sub(from);
    let dist = to.length();
    if (dist > range) { to.multiplyScalar(range / dist); dist = range; }
    const g = GRAV[T.behavior] ?? 12, speed = S.speed * (0.6 + 0.4 * this.charge);
    const t = Math.max(0.12, dist / speed);
    const vel = to.clone().divideScalar(t); vel.y += 0.5 * g * t;
    this.proj = { pos: from.clone(), vel, g, t: 0, maxT: t * 2.2 + 0.4, under: from.y < 0 };
    this.projMesh = projectileModel(this.toolId); this.projMesh.position.copy(from); G.scene.add(this.projMesh);
    this.state = 'fly';
    P.A.throw = 2;
    G.audio.whoosh(1);
    G.act({ k: 'throw', tool: this.toolId });
  }
  _fly(dt) {
    const G = this.g, P = G.player, pr = this.proj, T = this.tool;
    pr.t += dt;
    const sub = 3;
    for (let s = 0; s < sub; s++) {
      const h = dt / sub;
      pr.vel.y -= pr.g * h * (pr.pos.y < 0 ? 0.3 : 1);
      if (pr.pos.y < 0) pr.vel.multiplyScalar(Math.exp(-h * 2.5));
      pr.pos.addScaledVector(pr.vel, h);
      // a creature?
      const hit = G.wild.hitTest(pr.pos, T.stats.reach);
      if (hit) return this._latch(hit);
      // the ground / the water
      const g = G.terrain.ground(pr.pos.x, pr.pos.z);
      if (pr.pos.y < g) { pr.pos.y = g + 0.1; G.fx.dust(pr.pos.x, g, pr.pos.z, 0.6); return this._miss(); }
      if (pr.pos.y < 0 && !pr.under && T.behavior !== 'harpoon') { G.fx.splash(pr.pos.x, 0, pr.pos.z, 0.6); G.audio.splash(pr.pos, 0.4); return this._miss(); }
    }
    if (pr.t > pr.maxT) return this._miss();
    const pm = this.projMesh;
    pm.position.copy(pr.pos);
    if (T.behavior === 'bola') pm.rotation.y += dt * 22;
    else if (T.behavior === 'net') { pm.rotation.set(0, pr.t * 3, 0); pm.scale.setScalar(Math.min(1, 0.3 + pr.t * 2.5)); }
    else if (T.behavior === 'lasso') { pm.rotation.set(0, pr.t * 6, 0); pm.scale.setScalar(Math.min(1, 0.4 + pr.t * 2)); }
    else pm.lookAt(_v.copy(pr.pos).add(pr.vel));
    this.rope.draw(this.tip, pr.pos, pr.pos.distanceTo(this.tip) * 0.04, G.camera.position);
    P.A.throw = 2; P.A.pull = 0;
  }
  _miss() { this.state = 'reel'; this.g.audio.whoosh(0.4); }

  /* ---------------- the snare ---------------- */
  _latch(c) {
    const G = this.g, T = this.tool;
    const kind = this.kindOf(c);
    if (!T.targets.includes(kind)) { this.msg(kind === 'air' ? 'The ' + T.name + ' cannot catch things in the air.' : kind === 'water' ? 'The ' + T.name + ' cannot catch things in the water - try a harpoon.' : 'The ' + T.name + ' does not work on land.', 'warn'); return this._miss(); }
    if (SIZE_RANK[c.sp.size] > SIZE_RANK[T.maxSize]) { this.msg('Too big for the ' + T.name + '!', 'warn'); G.wild.spook(c, G.player.pos); return this._miss(); }
    if (c.claim && c.claim !== G.me) {
      // somebody else is already fighting this one: help them
      this.c = c; this.state = 'assist';
      if (this.projMesh) { G.scene.remove(this.projMesh); this.projMesh = null; }
      G.act({ k: 'assist', id: c.id });
      this.msg('Helping! Hold LMB to pull with them.', 'good');
      return;
    }
    if (!G.wild.claim(c)) { this.msg('It slipped out of the loop.', 'warn'); return this._miss(); }
    this.c = c;
    if (this.projMesh) { G.scene.remove(this.projMesh); this.projMesh = null; }
    this.state = 'snare';
    const eating = c.ai?.st === 'eat' || c.ai?.st === 'bait';
    const stunned = c.stun > 0;
    const D = 1.35 / (1 + c.sp.erratic * 0.18) * T.stats.window * (eating ? 1.6 : 1) * (stunned ? 1.35 : 1);
    this.ringDur = Math.max(0.55, D); this.ring = 0; this.eating = eating;
    c.astate = 'thrash'; c.anim.play(c.sp.diet === 'carn' ? 'roar' : 'shake');
    G.audio.latch();
    if (c.sp.temper !== 'skittish') G.audio.roar(c.pos, Math.min(1, c.height / 6), c.flyer ? 'screech' : 'roar');
    G.fx.burst(c.pos.x, c.pos.y + c.height * 0.5, c.pos.z, 'dust', 12, { scale: Math.max(1, c.height * 0.4) });
    const over = this._fightOf(c) - this._rating(T);
    if (over > 0.3) this.msg('Uh oh - this one is much stronger than your ' + T.name + '.', 'bad');
    Bus.emit('catch:snare', { c });
  }
  /** 0 = ring at full size .. 1 = ring closed */
  get ringT() { return this.ring / this.ringDur; }
  _snare(dt, click) {
    const G = this.g, c = this.c;
    if (!c || c.gone) return this._clear();
    this.ring += dt;
    this._holdAt(c, dt, 0);
    this._drawRope(0.35, dt);
    const f = this.ringT;
    if (click || G.admin?.autoCatch) {
      const v = 1 - f;   // ring size
      const perfect = Math.abs(v - 0.29) < 0.05 || G.admin?.autoCatch;
      if (perfect || (v > 0.18 && v < 0.42)) { G.audio.strike(perfect); this._startFight(perfect); }
      else { this._slip(v > 0.42 ? 'Too early - it shook the loop off!' : 'Too late - it shook the loop off!'); }
      return;
    }
    if (f >= 1) this._slip('Too slow - it shook the loop off!');
  }
  _slip(text) {
    const G = this.g, c = this.c;
    this.msg(text, 'warn'); G.audio.snap();
    G.wild.release(c, c.sp.temper === 'aggressive' || c.sp.temper === 'territorial' ? 'angry' : 'flee');
    this.state = 'reel'; this.projMesh = projectileModel(this.toolId); this.projMesh.position.copy(c.centre(_v)); G.scene.add(this.projMesh);
    this.c = null; this.loop.visible = false;
    Bus.emit('catch:slip', {});
  }

  /* ---------------- the fight ---------------- */
  _startFight(perfect) {
    const G = this.g, c = this.c, sp = c.sp, T = this.tool;
    const tier = TIER[sp.rarity] + (sp.size === 'XL' ? 0.5 : 0);
    const er = sp.erratic, sizeF = c.size;
    this.F = {
      tier, fight: this._fightOf(c), power: (sp.power || 1) * (0.8 + sizeF * 0.4), erratic: er,
      move: {
        speed: clamp(0.24 + er * 0.12 + tier * 0.05 + sizeF * 0.05, 0.18, 0.8),
        restless: 0.5 + er * 0.55 + tier * 0.16,
        dart: clamp(0.15 + er * 0.18 + tier * 0.035, 0, 0.6),
        pause: clamp(0.45 - er * 0.15 - tier * 0.05, 0.06, 0.5),
        drift: 0.08 + er * 0.06,
        drain: clamp(0.5 + (sp.power || 1) * 0.07 + tier * 0.1, 0.45, 1.35),
      },
      pos: 0.5, target: 0.5, think: 0.4, feint: 0, feintTo: 0.5, freeze: 0,
      rnd: rng((Math.random() * 1e9) | 0),
      stunT: (c.stun > 0 ? 3 : 0) + (T.effect === 'stun' ? 3.5 : 0),
      lunge: { next: 3 + Math.random() * 3, on: 0, dir: 1, ok: false },
      rage: { next: tier >= 3 ? 7 + Math.random() * 5 : 1e9, on: 0 },
      cap: 90 + (tier >= 4 ? 40 : 0),
      bearing: Math.atan2(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z),
      dist0: clamp(c.pos.distanceTo(G.player.pos), 7, 24), dist: c.pos.distanceTo(G.player.pos), dir: 0,
      t: 0, perfect,
    };
    this.bar = { zone: 0.5, vel: 0, catch: 0.3 + (perfect ? 0.12 : 0) + (this.eating ? 0.15 : 0), fought: 0, tired: 0, held: 0, on: 0 };
    this.state = 'fight';
    c.astate = 'thrash';
    G.audio.latch();
    G.ui.banner(perfect ? 'PERFECT SNARE!' : 'SNARED!', 'Hold LMB to pull - keep its head in your loop - brace with A / D when it lunges', perfect ? 'good' : 'info', 2.2);
    Bus.emit('catch:fight', { c, perfect });
  }
  assist(pid) { this.assists[pid] = this.g.time; }
  _fight(dt, input, holding) {
    const G = this.g, P = G.player, c = this.c, F = this.F, B = this.bar, T = this.tool, S = T.stats;
    if (!c || c.gone) return this._clear();
    F.t += dt;
    const rating = this._rating(T), over = F.fight - rating;
    // --- your loop on the meter: pull lifts it, slack lets it sink
    const ctrl = S.control * (P.mount ? 1.15 : 1);
    B.vel += ((holding ? S.lift : 0) - S.fall) * dt;
    B.vel -= B.vel * Math.min(1, 2.2 * ctrl * dt);
    B.zone += B.vel * dt;
    if (B.zone < 0) { B.zone = 0; B.vel = Math.max(0, B.vel); }
    if (B.zone > 1) { B.zone = 1; B.vel = Math.min(0, B.vel); }
    // --- the creature on the meter
    this._moveCreature(dt);
    // rage: it roars, the world shakes, your loop shrinks
    F.rage.next -= dt;
    if (F.rage.next <= 0) { F.rage.next = 9 + Math.random() * 7; F.rage.on = 2.6; c.anim.play('roar'); G.audio.roar(c.pos, Math.min(1, c.height / 6)); G.cam.shake(0.7); G.ui.banner('IT IS FURIOUS!', 'Hang on!', 'bad', 1.4); }
    F.rage.on = Math.max(0, F.rage.on - dt);
    const band = S.band * (F.rage.on > 0 ? 0.65 : 1) * (G.admin?.autoCatch ? 3 : 1);
    const on = Math.abs(F.pos - B.zone) <= band * 0.5;
    B.on = on ? Math.min(1, B.on + dt * 6) : Math.max(0, B.on - dt * 6);
    if (on) B.fought += dt;
    B.tired = clamp(B.fought / 30, 0, 1);
    B.held += dt;
    const helpers = Object.values(this.assists).filter(t => G.time - t < 1.2).length;
    if (on) B.catch += 0.5 * (1 + B.tired * 1.2) * (1 + helpers * 0.18) * dt;
    else B.catch -= 0.28 * F.move.drain * Math.min(1, B.held / 1.5) * dt;
    if (over > 0 && !G.admin?.autoCatch) B.catch -= (over * 0.5 + over * over * 1.1) * dt;
    if (G.admin?.autoCatch) { B.catch += dt / 2.5; F.pos = B.zone; }
    // --- lunges: brace with the OPPOSITE key
    const L = F.lunge;
    if (L.on > 0) {
      L.on -= dt;
      const want = L.dir < 0 ? 'KeyD' : 'KeyA', wrong = L.dir < 0 ? 'KeyA' : 'KeyD';
      if (input.pressed(want) || G.admin?.autoCatch) { L.on = 0; L.next = this._lungeGap(); B.catch = Math.min(1, B.catch + 0.07); F.freeze = 0.7; G.audio.brace(); G.cam.shake(0.25); G.ui.brace(true); Bus.emit('catch:brace', { ok: true }); }
      else if (input.pressed(wrong) || L.on <= 0) { L.on = 0; L.next = this._lungeGap(); B.catch -= 0.1 + F.tier * 0.015; this._yank(); G.ui.brace(false); Bus.emit('catch:brace', { ok: false }); }
    } else {
      L.next -= dt * (0.6 + F.erratic * 0.35);
      if (L.next <= 0 && F.t > 2) { L.on = Math.max(0.5, 0.85 - F.tier * 0.05); L.dir = Math.random() < 0.5 ? -1 : 1; c.anim.play('attack'); G.audio.roar(c.pos, Math.min(1, c.height / 7) * 0.6, c.flyer ? 'screech' : 'roar'); }
    }
    B.catch = clamp(B.catch, 0, 1);
    // --- the world: it runs circles on the end of the rope and comes closer as you win
    const want = 3 + c.radius * 1.6 + (F.dist0 - 3 - c.radius * 1.6) * (1 - B.catch);
    F.dist = damp(F.dist, Math.max(2.5, want), 1.4, dt);
    let ang = clamp(F.target - F.pos, -1, 1) * 1.6;
    if (L.on > 0) ang = L.dir * -2.5;     // screen-left lunge = turning left around you
    F.dir = damp(F.dir, ang, 4, dt);
    const cx = P.pos.x, cz = P.pos.z;
    F.bearing += F.dir * (2.8 / Math.max(4, F.dist)) * dt * (on ? 0.5 : 1);
    this._holdAt(c, dt, B.catch);
    // big ones tow you
    const pull = clamp(F.power / (P.mount ? 1 + (P.mount.sp.power || 1) : 1.2), 0, 4);
    _v.set(c.pos.x - cx, 0, c.pos.z - cz); const dl = _v.length() || 1; _v.divideScalar(dl);
    if (pull > 1 && !on) {
      if (P.mount) { P.mount.pos.addScaledVector(_v, (pull - 1) * 1.2 * dt); }
      else { P.vel.x += _v.x * (pull - 1) * 5 * dt; P.vel.z += _v.z * (pull - 1) * 5 * dt; P.A.drag = 1; }
    } else P.A.drag = 0;
    this.tension = clamp((on ? 0.35 : 0.75) * clamp(F.fight / rating, 0.2, 2) + (holding ? 0.15 : 0) + Math.max(0, over) * 0.6, 0.1, 1.2);
    P.A.pull = 1; P.A.tension = this.tension; P.A.throw = 0;
    if (holding && Math.random() < dt * 12) G.audio.reel();
    this._drawRope(this.tension, dt);
    if (Math.random() < dt * (1 + pull)) G.fx.dust(c.pos.x, c.pos.y, c.pos.z, Math.min(2.5, c.height * 0.3));
    // --- outcomes
    if (B.catch >= 1) return this._land();
    if (B.catch <= 0) return this._lose(over > 0.2 ? 'SNAP! Too strong for the ' + T.name + '.' : 'It broke free!');
    if (B.held > F.cap) return this._lose('After all that, the rope finally gives.');
  }
  _lungeGap() { return 3.2 + Math.random() * 3.6 - Math.min(1.2, this.F.tier * 0.25); }
  _yank() {
    const G = this.g, P = G.player, c = this.c;
    _v.set(c.pos.x - P.pos.x, 0, c.pos.z - P.pos.z).normalize();
    if (P.mount) { P.mount.yawRate += 2; P.mount.pos.addScaledVector(_v, 1.2); }
    else { P.knock.copy(_v).multiplyScalar(5 + this.F.power * 1.5); P.vel.y = 3; P.onGround = false; }
    G.cam.shake(0.5); G.audio.snap();
  }
  /** the creature on the meter: picks a spot and swims at it, Hooked's fish logic */
  _moveCreature(dt) {
    const F = this.F, M = F.move, B = this.bar, r = F.rnd, tier = F.tier;
    if (F.freeze > 0) { F.freeze -= dt; return; }
    F.feint = Math.max(0, F.feint - dt);
    if (F.feint > 0) F.target = clamp(F.feintTo, 0, 1);
    F.think -= dt;
    if (F.think <= 0) {
      const k = r();
      F.think = lerp(0.9, 0.16, clamp(M.restless / 2.6, 0, 1)) * (0.6 + r() * 0.9);
      if (tier >= 4 && r() < 0.5) {
        const roll = r();
        if (roll < 0.34) { F.target = F.pos; F.think = 1.2 + r(); }
        else if (roll < 0.72) { F.target = clamp(F.pos + (r() < 0.5 ? -1 : 1) * (0.34 + r() * 0.44), 0, 1); F.think = 0.12 + r() * 0.12; }
        else { F.target = clamp(0.08 + r() * 0.84, 0, 1); F.think = 0.45 + r() * 0.9; }
      } else if (tier >= 2 && r() < 0.13 + tier * 0.02) {
        const size = tier >= 4 ? 1 : 0.62, away = r() < 0.5 ? -1 : 1;
        F.feintTo = clamp(F.pos + away * (0.14 + r() * 0.22) * size, 0, 1);
        F.feint = (0.22 + r() * 0.14) * size;
        F.target = clamp(F.pos - away * (0.18 + r() * 0.26) * size, 0, 1);
        F.think = F.feint + 0.35;
      } else if (k < M.pause) F.target = F.pos;
      else if (k < M.pause + M.dart * 0.5) F.target = clamp(F.pos + (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.5), 0, 1);
      else F.target = clamp(0.1 + r() * 0.8, 0, 1);
    }
    const wob = Math.sin(F.t * 3.1) * M.drift * 0.06;
    const want = clamp(F.target + wob, 0, 1), d = want - F.pos;
    const slow = F.stunT > 0 ? 0.42 : 1; F.stunT = Math.max(0, F.stunT - dt);
    const rage = this.F.rage.on > 0 ? 1.3 : 1;
    const step = M.speed * slow * rage * (1 - B.tired * 0.17) * dt * (1 + Math.abs(d) * 1.4);
    F.pos = clamp(F.pos + clamp(d, -step, step), 0, 1);
  }
  /** pin the creature at the end of the rope (snare: where it is; fight: circling you) */
  _holdAt(c, dt, k) {
    const G = this.g, P = G.player, F = this.F;
    if (F) {
      const x = P.pos.x + Math.sin(F.bearing) * F.dist, z = P.pos.z + Math.cos(F.bearing) * F.dist;
      const ox = c.pos.x, oz = c.pos.z;
      c.pos.x = damp(c.pos.x, x, 5, dt); c.pos.z = damp(c.pos.z, z, 5, dt);
      const vx = (c.pos.x - ox) / dt, vz = (c.pos.z - oz) / dt, sp = Math.hypot(vx, vz);
      if (sp > 0.3) c.yaw = Math.atan2(vx, vz) * 0.3 + Math.atan2(c.pos.x - P.pos.x, c.pos.z - P.pos.z) * 0.7;
      c.speed = damp(c.speed, Math.min(sp, c.sp.speed.run || 8), 6, dt);
      if (c.flyer) { c.flying = true; c.flap = 1; const gy = Math.max(G.terrain.ground(c.pos.x, c.pos.z), 0); c.pos.y = damp(c.pos.y, gy + 3 + c.height + (1 - k) * 10, 2, dt); }
      else if (c.swimmer) { c.pos.y = damp(c.pos.y, Math.max(G.terrain.ground(c.pos.x, c.pos.z) + c.height * 0.5, -1.2 - (1 - k) * 3 + Math.sin(F.t * 2) * 0.6), 2, dt); c.under = c.pos.y < -0.4; }
      else { const gy = G.terrain.ground(c.pos.x, c.pos.z); c.pos.y = Math.max(gy, c.amph && gy < -c.hip ? -0.15 : gy); c.onGround = true; }
      G.colliders.push(c.pos, c.radius, c.height);
    } else c.speed = damp(c.speed, 0, 6, dt);
    c.astate = 'thrash';
    c.yawRate = 0;
  }
  _drawRope(tension, dt) {
    const G = this.g, c = this.c;
    // the loop sits around its neck
    const nb = c.T.meta.roles.neck?.[c.T.meta.roles.neck.length - 1] || c.T.meta.roles.head || c.T.meta.roles.hips;
    const neck = c.inst.by[nb] || c.inst.bones[0];
    c.group.updateMatrixWorld(true);
    neck.getWorldPosition(_u);
    this.loop.position.copy(_u);
    const r = Math.max(0.25, (c.dims.bw || 0.3) * c.scale * 0.9);
    this.loop.scale.setScalar(r);
    this.loop.lookAt(this.tip);
    this.loop.visible = true;
    const L = this.tip.distanceTo(_u);
    this.rope.draw(this.tip, _u, L * 0.12 * (1 - clamp(tension, 0, 1)), G.camera.position, tension > 0.9 ? 0.04 : 0, G.time);
    this.rope.color = tension > 0.98 ? '#ff7a5a' : tension > 0.82 ? '#ffd27a' : '#c8a878';
  }

  /* ---------------- outcomes ---------------- */
  _land() {
    const G = this.g, c = this.c, F = this.F;
    const info = { id: c.id, sp: c.spId, v: c.v, size: c.size, kg: c.kg, perfect: F.perfect, time: F.t };
    G.audio.caught(RARITY[c.sp.rarity].stars);
    G.fx.burst(c.pos.x, c.pos.y + c.height * 0.6, c.pos.z, 'confetti', 40, { scale: 1.2 });
    G.fx.burst(c.pos.x, c.pos.y + c.height * 0.6, c.pos.z, 'spark', 20, { scale: 1.5 });
    G.player.cheerT = 2;
    c.astate = 'rest';
    this.rope.hide(); this.loop.visible = false;
    this.state = 'idle'; this.c = null; this.F = null; this.bar = null;
    const A = G.player.A; A.pull = 0; A.drag = 0;
    G.onCaught(c, info);
    Bus.emit('catch:landed', info);
  }
  _lose(text) {
    const G = this.g, c = this.c;
    this.msg(text, 'bad'); G.audio.snap();
    if (c) G.wild.release(c, c.sp.temper === 'aggressive' ? 'angry' : 'flee');
    this._clear();
    Bus.emit('catch:lost', {});
  }

  /* ---------------- helping a friend ---------------- */
  _assist(dt, input, holding) {
    const G = this.g, P = G.player, c = this.c;
    if (!c || c.gone || !c.claim || c.claim === G.me) return this._clear();
    this._drawRope(holding ? 0.8 : 0.4, dt);
    P.A.pull = 1; P.A.tension = holding ? 0.8 : 0.3;
    if (holding) { this._pulse = (this._pulse || 0) - dt; if (this._pulse <= 0) { this._pulse = 0.4; G.act({ k: 'assist', id: c.id }); } }
    if (P.pos.distanceTo(c.pos) > 40) { this.msg('Too far away to help.', 'warn'); this.cancel(); }
  }

  /** what the HUD shows */
  hud() {
    const F = this.F, B = this.bar;
    return {
      state: this.state, charge: this.charge, ring: this.state === 'snare' ? 1 - this.ringT : 0, c: this.c,
      bar: F ? { zone: B.zone, band: this.tool.stats.band * (F.rage.on > 0 ? 0.65 : 1), pos: F.pos, target: F.target, catch: B.catch, on: B.on, over: F.fight - this._rating(this.tool), tier: F.tier, tired: B.tired, lunge: F.lunge.on > 0 ? F.lunge.dir : 0, lungeT: F.lunge.on, rage: F.rage.on > 0, helpers: Object.values(this.assists).filter(t => this.g.time - t < 1.2).length } : null,
      tension: this.tension || 0,
    };
  }
}
void wrapAngle;
