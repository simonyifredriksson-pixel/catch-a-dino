/* Game.js - wires everything together and runs the frame.

   ACTIONS: anything that changes the shared world (a catch, a purchase, an
   exhibit, a dig, a gate, a roar) goes through game.act(a). The host (or a
   solo player) performs it in perform(); a client sends it to the host. The
   host's save reaches everyone; one-off happenings (a roar, a banner, a
   lava bomb) go out as events (event()), handled in onEvent().

   THE FRAME: time and weather -> you (on foot or riding) -> what you hold
   (catching, fishing) -> the wild -> the zoo (income) -> world events and
   quests -> discovery, caves, fog of war -> effects, sky, water, streaming
   -> camera -> audio -> HUD -> network. */
import * as THREE from '../../lib/three.module.js';
import { Terrain } from '../world/Terrain.js';
import { Water, lavaAt } from '../world/Water.js';
import { Sky } from '../world/Sky.js';
import { Scatter } from '../world/Scatter.js';
import { Colliders } from '../world/Colliders.js';
import { Landmarks } from '../world/Landmarks.js';
import { Mesher } from '../art/Mesher.js';
import { holdModel } from '../art/ToolArt.js';
import { makeHuman } from '../art/PeopleArt.js';
import { Effects } from './Effects.js';
import { Player, HEARTS } from './Player.js';
import { CameraRig } from './Camera.js';
import { Catching } from './Catching.js';
import { Tools } from './Tools.js';
import { Riding } from './Riding.js';
import { Abilities } from './Abilities.js';
import { Wild } from './Wild.js';
import { Zoo, habitatOK } from './Zoo.js';
import { Fishing } from './Fishing.js';
import { WaterSigns } from './WaterSigns.js';
import { Fossils } from '../world/Fossils.js';
import { Base } from './Base.js';
export const TEAM_SIZE = 6;
import { Events } from './Events.js';
import { Quests } from './Quests.js';
import { Build, exhibitPrice } from './Build.js';
import { UI } from '../ui/UI.js';
import { Panels } from '../ui/Panels.js';
import { Inventory } from '../ui/Inventory.js';
import { newWorld, migrate, saveWorld, saveProfile, creatureRecord } from './State.js';
import { SPECIES, SP, RARITY, SIZE, VARIANTS } from '../data/Species.js';
import { JOBS } from '../data/Creatures.js';
import { TOOLS, SIZE_RANK } from '../data/Tools.js';
import { ITEMS, UPGRADES } from '../data/Items.js';
import { HABITATS, EX_SIZES, DECOR, PLOTS } from '../data/Build.js';
import { BIOMES, ZOO, WORLD_HALF, VOLCANO } from '../data/Biomes.js';
import { PLACES, BEACONS, GATES, INTERIORS, CHESTS, NESTS } from '../data/Places.js';
import { clamp, damp, lerp, uid, money, weighted, wrapAngle } from '../core/Util.js';
import { Bus } from '../core/Bus.js';

const DAY = 1200;                     // seconds in a day
const TRAITS = ['Speedy', 'Gentle', 'Showoff', 'Cheerful', 'Grumpy', 'Brave', 'Lazy', 'Curious', 'Hungry', 'Sleepy', 'Clever', 'Loud'];
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

export class Game {
  constructor({ renderer, scene, camera, input, audio, net, profile }) {
    Object.assign(this, { renderer, scene, camera, input, audio, net, profile });
    this.time = 0; this.frame = 0; this.phase = 'title';
    this.Mesher = Mesher; this.holdModel = holdModel;
    this.interacts = []; this.interactable = null;
    this.remotes = new Map();        // pid -> { H, st, tool, rope }
    this.W = null; this.me = profile.key;
    this.packKey = profile.key;       // whose crate is whose survives reconnecting (peer ids do not)
    this.inInterior = null; this.inCave = false;
    this.saveT = 20; this.baitMeshes = [];
  }
  get isHost() { return !this.net.isClient; }

  /* ---------------- building the world ---------------- */
  buildWorld() {
    const S = this.scene;
    // lights
    const hemi = new THREE.HemisphereLight('#e8f4ff', '#6a7a50', 1.2); S.add(hemi);
    const sun = new THREE.DirectionalLight('#fff2dc', 2.6);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 520 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
    S.add(sun, sun.target);
    this.lights = { hemi, sun };
    S.fog = new THREE.Fog('#cfe8f0', 80, 900);
    // the land
    this.terrain = new Terrain();
    Landmarks.mods(this.terrain);
    this.terrain.generate();
    this.terrain.buildMeshes(S);
    this.colliders = new Colliders();
    this.water = new Water(S);
    this.sky = new Sky(S, this.lights);
    this.sky.onBolt = (x, z) => { this.audio.thunder(Math.hypot(x - this.camera.position.x, z - this.camera.position.z)); this.isles_bolt = { x, z, t: this.time }; };
    this.scatter = new Scatter(this);
    this.fx = new Effects(this);
    this.landmarks = new Landmarks(this);
    this.landmarks.build();
    this.fossils = new Fossils(this); this.fossils.build();
    this.base = new Base(this); this.base.build();
    for (const it of this.landmarks.items) this.addInteract(it);
    this.world = {
      lavaFlows: this._lavaFlows(),
      lavaY: (x, z) => Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < VOLCANO.crater * 1.05 ? VOLCANO.lava : this.terrain.ground(x, z),
      clampBounds: (p) => { if (p.x < WORLD_HALF + 200) { p.x = clamp(p.x, -WORLD_HALF + 20, WORLD_HALF - 20); p.z = clamp(p.z, -WORLD_HALF + 20, WORLD_HALF - 20); } },
    };
    this._lavaMesh();
    // people and systems
    this.player = new Player(this, this.profile.look);
    this.cam = new CameraRig(this, this.camera);
    this.catching = new Catching(this);
    this.fishing = new Fishing(this);
    this.signs = new WaterSigns(this);
    this.tools = new Tools(this);
    this.riding = new Riding(this);
    this.abilities = new Abilities(this);
    this.wild = new Wild(this);
    this.zoo = new Zoo(this);
    this.events = new Events(this);
    this.weather = this.events;      // .storm
    this.quests = new Quests(this);
    this.ui = new UI(this);
    this.panels = new Panels(this);
    this.inv = new Inventory(this);
    this.build = new Build(this);
    this.explored = { n: 96, bits: new Uint8Array(96 * 96), at: (x, z) => { const n = 96, i = Math.floor((x + WORLD_HALF) / (WORLD_HALF * 2) * n), j = Math.floor((z + WORLD_HALF) / (WORLD_HALF * 2) * n); return i >= 0 && j >= 0 && i < n && j < n && this.explored.bits[i * n + j]; } };
    this._netHooks();
  }
  /** lava rivers down the cone from the crater rim, following the slope */
  _lavaFlows() {
    const T = this.terrain, flows = [];
    for (const a0 of [0.4, 2.0, 3.5, 5.1]) {
      const pts = []; let x = VOLCANO.x + Math.cos(a0) * VOLCANO.crater * 1.25, z = VOLCANO.z + Math.sin(a0) * VOLCANO.crater * 1.25;
      for (let i = 0; i < 46; i++) {
        const g = T.ground(x, z); if (g < 40) break;
        pts.push([x, z, Math.max(2.5, 6 - i * 0.08)]);
        const n = T.normal(x, z, _v), out = _w.set(x - VOLCANO.x, 0, z - VOLCANO.z).normalize();
        x += (n.x * 0.6 + out.x * 0.6) * 6; z += (n.z * 0.6 + out.z * 0.6) * 6;
      }
      if (pts.length > 3) flows.push(pts);
    }
    return flows;
  }
  _lavaMesh() {
    const pos = [], T = this.terrain;
    for (const F of this.world.lavaFlows) for (let i = 0; i < F.length - 1; i++) {
      const [ax, az, w] = F[i], [bx, bz] = F[i + 1];
      const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, nx = -dz / L * w, nz = dx / L * w;
      const y = (x, z) => T.ground(x, z) + 0.35;
      const p = [[ax + nx, az + nz], [ax - nx, az - nz], [bx + nx, bz + nz], [bx - nx, bz - nz]].map(([x, z]) => [x, y(x, z), z]);
      pos.push(...p[0], ...p[1], ...p[2], ...p[1], ...p[3], ...p[2]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, this.water.lava.material); this.scene.add(m); this.lavaFlowMesh = m;
  }

  /* ---------------- interactions ---------------- */
  addInteract(it) { this.interacts.push(it); }
  removeInteract(it) { const i = this.interacts.indexOf(it); if (i >= 0) this.interacts.splice(i, 1); }
  _findInteract() {
    const P = this.player.pos;
    let best = null, bd = Infinity;
    for (const it of this.interacts) {
      if (it.when && !it.when()) continue;
      const d = Math.hypot(it.x - P.x, it.z - P.z);
      if (d < it.r && Math.abs((it.y ?? P.y) - P.y) < 6 && d < bd) { bd = d; best = it; }
    }
    // your companion creature, or a friend's mount with a free seat
    const c = this.riding.c;
    if (!this.player.riding && c && c.sp.ride !== false && Math.hypot(c.pos.x - P.x, c.pos.z - P.z) < c.radius + 3 && (!best || bd > 2)) best = { label: () => 'Ride ' + (this.W.creatures[c.uid]?.name || c.sp.name), act: () => this.riding.mountOn(c) };
    if (!this.player.riding) for (const [pid, m] of this.riding.remote) {
      if (m.seats < 1 || Math.hypot(m.pos.x - P.x, m.pos.z - P.z) > m.radius + 3.5) continue;
      best = { label: () => 'Hop on behind ' + (this.remotes.get(pid)?.name || 'your friend'), act: () => this.act({ k: 'board', owner: pid }) };
    }
    return best;
  }

  /* ---------------- starting a game ---------------- */
  begin(W) {
    const fresh = !W;
    this.W = migrate(W || newWorld(this.me));
    this.W.players[this.me] ||= {};
    if (this.W.explored) try { const b = atob(this.W.explored); for (let i = 0; i < b.length && i < this.explored.bits.length; i++) this.explored.bits[i] = b.charCodeAt(i); } catch (e) { /* */ }
    for (const id in this.W.gates) this.landmarks.openGate(id, false);
    this.zoo.build();
    const gp = this.zoo.gatePos();
    this.player.pos.set(gp.x + 3, ZOO.y, gp.z - 10); this.player.yaw = Math.PI;
    this.cam.yaw = 0; this.cam.pitch = 0.2;
    if (fresh) {
      const d = Object.values(this.W.creatures).find(r => r.sp === 'dryo');
      this.profile.hotbar = ['tool:rope', 'tool:reedrod', d ? 'cr:' + d.uid : null, 'tool:axe', 'tool:pickaxe', 'tool:binoculars', 'item:berries', 'item:fish', 'tool:journal', null];
      this.profile.hotSeen = this.profile.hotbar.filter(Boolean);
      saveProfile(this.profile);
    }
    this.inv.hold = 0;
    this.scatter.warm(this.player.pos);
    this.phase = 'play';
    this.cam.baseFov = this.profile.fov || 70;
    if (fresh) setTimeout(() => { this.ui.banner('WELCOME TO HOME ISLAND!', 'This island is your base. The world out there is full of creatures. Follow the arrow!', 'good', 5); }, 800);
    this.zoo.compute();
    Bus.emit('game:begin', { fresh });
  }
  respawn() {
    const gp = this.zoo.gatePos();
    this.teleport(gp.x + 2, gp.z - 8, null);
  }
  /** debugging: if you ever jump far in one step, say which system did it */
  _jumpCheck() {
    const P = this.player.pos, last = P.clone();
    return (step) => {
      const d = Math.hypot(P.x - last.x, P.z - last.z);
      if (d > 12 && !this._tpNow) { const m = 'Moved ' + Math.round(d) + ' m by: ' + step + ' (from ' + Math.round(last.x) + ',' + Math.round(last.z) + ')'; window.__log?.('JUMP ' + m); }
      last.copy(P); this._tpNow = false;
    };
  }
  teleport(x, z, interior, yaw) {
    const P = this.player;
    const why = (new Error().stack || '').split('\n').slice(2, 4).map(l => l.trim().replace(/^at /, '').replace(/\(.*\//, '(').replace(/\?v=\w+/, '')).join(' < ');
    if (this.phase === 'play' && Math.hypot(P.pos.x - x, P.pos.z - z) > 12) window.__log?.('TELEPORT ' + why);
    this._tpNow = true;
    if (this.riding.c) this.riding.recall(true);
    if (P.ride) this.riding.leaveSeat();
    this.catching.cancel(true);
    P.pos.set(x, Math.max(this.terrain.ground(x, z), this.colliders.floorAt(x, z, 60, 0)) + 0.2, z); P.vel.set(0, 0, 0);   // onto a deck or bridge if there is one
    if (yaw != null) { P.yaw = yaw; this.cam.yaw = yaw + Math.PI; }
    this.inInterior = interior ? { id: interior, ...INTERIORS[interior] } : null;
    this.cam.focus.copy(P.pos);
    this.scatter.warm(P.pos);
  }

  /* ---------------- money and the save ---------------- */
  earn(m, pos, quiet, label) {
    if (!m) return;
    this.W.money += m; this.W.stats.earned = (this.W.stats.earned || 0) + Math.max(0, m);
    if (!quiet) { this.ui.floater('+' + money(m), pos, 'money'); if (this.time - (this._coinT || 0) > 0.25) { this._coinT = this.time; this.audio.coin(); } }
    void label;
  }
  spend(m) { if (this.W.money < m) return false; this.W.money -= m; this.ui.floater('-' + money(m), null, 'spend'); return true; }
  saveSoon() { this.saveT = Math.min(this.saveT, 1.5); this._dirty = true; }
  saveNow() {
    if (!this.isHost || !this.W) return;
    let s = ''; const b = this.explored.bits; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    this.W.explored = btoa(s);
    saveWorld(this.W); saveProfile(this.profile);
    if (this.net.isOnline) this.net.sendSave(this.W);
  }

  /* ---------------- players (you + co-op friends) ---------------- */
  players() {
    const P = this.player, out = [{ pid: this.me, pos: P.pos, yaw: P.yaw, crouch: P.crouch, mountSp: P.mount?.spId, under: P.under || P.mount?.under, inWater: P.mode === 'swim' || P.mount?.inWater, flying: P.mount?.flying }];
    for (const [pid, R] of this.remotes) if (R.st) out.push({ pid, pos: R.pos, yaw: R.st.yaw, crouch: R.st.cr, mountSp: R.st.m?.sp, under: R.st.un, inWater: R.st.wa, flying: R.st.m?.fl });
    return out;
  }
  nearestPlayer(p) { let best = null, bd = Infinity; for (const q of this.players()) { const d = Math.hypot(q.pos.x - p.x, q.pos.z - p.z); if (d < bd) { bd = d; best = q; } } return best; }
  playerPos(pid) { if (pid === this.me || !pid) return this.player.pos; return this.remotes.get(pid)?.pos || null; }
  remoteState(pid) { return this.remotes.get(pid)?.st || null; }
  hitPlayer(pid, c, force) {
    const why = 'The ' + c.sp.name + (c.sp.diet === 'carn' ? ' bit you!' : ' rammed you!');
    if (pid === this.me || !pid) this.player.hit(_v.set(this.player.pos.x - c.pos.x, 0, this.player.pos.z - c.pos.z), force, 1, why);
    else this.net.sendEvent({ k: 'hit', pid, x: c.pos.x, z: c.pos.z, f: force, why });
  }
  packCreatures(owner = this.packKey) { return Object.values(this.W.creatures).filter(r => r.at === 'pack:' + owner); }
  spOf(r) { return SP[r.sp]; }
  ownerOf(pid) { return pid === this.me ? this.packKey : (this.net.profiles.get(pid)?.key || pid); }
  crateCap() { return TEAM_SIZE; }   // your team: up to six creatures with you
  crateUsed(owner = this.packKey) { return this.packCreatures(owner).length; }
  frozen() { return !!this.ui.panel || this.inv.open || this.build.active || this.chatOpen || this.player.koT > 0; }
  applySettings() {
    const p = this.profile;
    this.input.sensitivity = p.sens; this.input.invertY = p.invert;
    this.audio.setVolume(p.vol, p.music);
    this.cam.baseFov = p.fov || 70;
    this.renderer.shadowMap.enabled = p.shadows !== false; this.lights.sun.castShadow = p.shadows !== false;
    saveProfile(p);
  }

  /* ---------------- things that happen to you ---------------- */
  onCaught(c, info) { this.act({ k: 'caught', ...info }); if (!this.isHost) this.wild.remove(c); }
  onScan(c) {
    const R = RARITY[c.sp.rarity];
    const dif = this.catching.difficulty(c, Object.keys(this.W.tools).filter(k => TOOLS[k].kind === 'catch').sort((a, b) => TOOLS[b].stats.rating - TOOLS[a].stats.rating)[0]);
    this.ui.toast('Scanned: ' + c.sp.name + ' (' + R.name + ')' + (dif ? ' - with your best rope: ' + dif.toUpperCase() : '') + '.', 'good');
    this.ui.mark(c, 60);
    this.act({ k: 'seen', sp: c.spId });
    this.audio.tone(1500, 0.08, 'sine', 0.08); this.audio.tone(2000, 0.12, 'sine', 0.06, 0.005, 0, 0.08);
  }
  onZooLevel(lv) { this.event({ k: 'banner', t: 'BASE LEVEL UP! ' + '★'.repeat(lv), s: this.zoo.levelName + ' - new things to build and buy at the Ranger Station.', kind: 'good' }); this.event({ k: 'fanfare' }); }

  /* ---------------- the admin panel ---------------- */
  adminCmd(cmd, arg) {
    const A = this.admin ||= {}, P = this.player;
    const flip = k => { A[k] = !A[k]; this.ui.toast(k + (A[k] ? ' ON' : ' OFF'), 'info'); };
    switch (cmd) {
      case 'god': return flip('god');
      case 'fly': flip('fly'); if (!A.fly) { P.vel.set(0, 0, 0); P.onGround = false; P.safeFall = true; } return;
      case 'auto': return flip('autoCatch');
      case 'speed': A.speed = +arg; return this.ui.toast('Speed x' + arg, 'info');
      case 'heal': P.hearts = HEARTS; P.koT = 0; P.cold = 0; return;
      case 'tp': {
        const [x, z, inter] = arg.split(','); this.teleport(+x, +z, inter || null);
        return;
      }
      case 'reveal': this.explored.bits.fill(1); return this.ui.toast('The whole map is revealed.', 'info');
      case 'spawn': {
        const f = this.camera.getWorldDirection(_v).setY(0).normalize(), x = P.pos.x + f.x * 14, z = P.pos.z + f.z * 14;
        return this.act({ k: 'admin', cmd: 'spawn', sp: arg, x, z });
      }
      default: return this.act({ k: 'admin', cmd, arg });
    }
  }
  _admin(a, pid) {
    const W = this.W, owner = this.ownerOf(pid);
    const give = (sp, v) => { const S = SP[sp]; const r = creatureRecord(sp, { v: v || null, size: 0.5 + Math.random() * 0.45, kg: Math.round(lerp(S.kg[0], S.kg[1], 0.7)), at: 'zoo' }); if (this.crateUsed(owner) + 1 <= this.crateCap(owner)) r.at = 'pack:' + owner; W.creatures[r.uid] = r; const d = W.dex[sp] ||= { seen: 0, caught: 0 }; d.seen++; d.caught++; if (v) { d.v ||= []; if (!d.v.includes(v)) d.v.push(v); } return r; };
    switch (a.cmd) {
      case 'money': W.money += +a.arg; this.audio.cash(); break;
      case 'give': { const [sp, v] = String(a.arg).split(':'); const r = give(sp, v); this._to(pid, { k: 'toast', t: (v ? VARIANTS[v].name + ' ' : '') + SP[sp].name + (r.at === 'zoo' ? ' went home to your base (team full).' : ' joined your team!'), kind: 'good' }); break; }
      case 'giveAll': for (const s of SPECIES) { const r = give(s.id); r.at = 'zoo'; } this._to(pid, { k: 'toast', t: 'One of every species is waiting in the holding pen.', kind: 'good' }); break;
      case 'dexAll': for (const s of SPECIES) { const d = W.dex[s.id] ||= { seen: 0, caught: 0 }; d.seen = Math.max(1, d.seen); } break;
      case 'tools': for (const k in TOOLS) W.tools[k] = 1; break;
      case 'items': for (const k in ITEMS) if (ITEMS[k].kind === 'bait') W.items[k] = (W.items[k] || 0) + 20; break;
      case 'upg': for (const k in UPGRADES) W.upg[k] = UPGRADES[k].levels.length - 1; break;
      case 'stars': W.adminLevel = +a.arg; this.zoo.compute(); break;
      case 'plot': W.plot = Math.min(PLOTS.length - 1, (W.plot || 0) + 1); this.zoo.rebuild(); this.event({ k: 'zoo' }); break;
      case 'tod': W.tod = +a.arg; break;
      case 'weather': W.weather.kind = a.arg; W.weather.t = 400; this.event({ k: 'weather', w: a.arg }); break;
      case 'event': this.events.start(a.arg); break;
      case 'skipTut': this.quests.skip(); break;
      case 'spawn': { const c = this.wild.add({ sp: a.sp, x: a.x, z: a.z, y: this.terrain.ground(a.x, a.z), size: 0.5 + Math.random() * 0.4 }); if (SP[a.sp].move === 'swim') c.pos.y = Math.min(-1.5, this.terrain.ground(a.x, a.z) + 1); break; }
    }
    this.zoo.syncCreatures(); this.saveSoon();
  }

  /* ---------------- actions ---------------- */
  act(a) {
    if (!this.W) return;
    if (this.isHost) this.perform(a, this.me);
    else this.net.sendAction(a);
  }
  /** tell everyone (and yourself) */
  event(e) { this.onEvent(e, this.me); if (this.net.isOnline) this.net.sendEvent(e); }
  _to(pid, e) { if (pid === this.me) this.onEvent(e, this.me); else this.net.sendEvent({ ...e, pid }); }
  perform(a, pid) {
    const W = this.W, me = pid === this.me, owner = this.ownerOf(pid);
    const toast = (t, kind = 'info') => this._to(pid, { k: 'toast', t, kind });
    const fail = (t) => { toast(t, 'warn'); if (me) this.audio.deny(); };
    switch (a.k) {
      case 'use': if (W.items[a.item] > 0) W.items[a.item]--; break;
      case 'bait': this.wild.addBait(a.x, a.y, a.z, a.item); this.event({ k: 'baitMesh', x: a.x, y: a.y, z: a.z, item: a.item }); break;
      case 'claim': { const c = this.wild.byId.get(a.id); if (c && !c.claim) { c.claim = pid; c.ai.st = 'held'; } break; }
      case 'unclaim': { const c = this.wild.byId.get(a.id); if (c && c.claim === pid) { c.claim = null; this.wild._setAfter(c, a.mode); } break; }
      case 'seen': { const d = W.dex[a.sp] ||= { seen: 0, caught: 0 }; d.seen++; break; }
      case 'caught': this._caught(a, pid); break;
      case 'release': { const r = W.creatures[a.uid]; if (r && (r.at === 'pack:' + owner || r.at === 'zoo' || r.at.startsWith('ex:'))) { delete W.creatures[a.uid]; this.zoo.syncCreatures(); toast((r.name || SP[r.sp].name) + ' trots off into the wild. Bye!'); } break; }
      case 'unload': {
        const list = this.packCreatures(owner).filter(r => !r.starter && !r.gift); if (!list.length) return fail('Your crate is empty.');
        for (const r of list) r.at = 'zoo';
        toast(list.length + ' creature' + (list.length > 1 ? 's' : '') + ' went home to the base. Give them jobs in the Creatures tab.', 'good');
        Bus.emit('zoo:unload', { n: list.length });
        break;
      }
      case 'move': {
        const r = W.creatures[a.uid]; if (!r) return;
        if (a.to === 'pack') { if (this.crateUsed(owner) + 1 > this.crateCap(owner)) return fail('Your team is full (6). Send someone home to the base first.'); r.at = 'pack:' + owner; }
        else if (a.to === 'zoo') r.at = 'zoo';
        else if (a.to.startsWith('ex:')) {
          const E = this.zoo.ex.get(a.to.slice(3)); if (!E) return;
          const sp = SP[r.sp];
          if (SIZE_RANK[sp.size] > SIZE_RANK[E.d.size]) return fail('Too big for that exhibit.');
          if (habitatOK(sp, E.d.hab) <= 0) return fail(sp.move === 'fly' ? 'Flyers need an Aviary.' : sp.move === 'swim' ? 'Swimmers need an Aquatic Tank.' : 'That will not work.');
          r.at = a.to;
          toast((r.name || sp.name) + ' moved into ' + (E.d.name || HABITATS[E.d.hab].name) + '!', 'good');
          Bus.emit('zoo:place', { sp: r.sp });
        }
        this.zoo.syncCreatures(); this.zoo.compute();
        break;
      }
      case 'job': { const r = W.creatures[a.uid]; if (!r) return; r.job = a.job || null; const b = this.base.byUid.get(a.uid); if (b) { b.ai.st = 'idle'; b.ai.t = 0; b.ai.node = null; this.base._uncarry(b); } toast((r.name || SP[r.sp].name) + (r.job ? ' is now on ' + JOBS[r.job].name.toLowerCase() + ' duty.' : ' is taking it easy.'), 'good'); break; }
      case 'buy': this._buy(a, pid, fail, toast); break;
      case 'sell': {
        let total = 0;
        for (const k of a.id === '*' ? Object.keys(ITEMS).filter(k => ITEMS[k].kind === 'find' || ITEMS[k].kind === 'res') : [a.id]) { const n = W.items[k] || 0; if (!n || (ITEMS[k].kind !== 'find' && ITEMS[k].kind !== 'res')) continue; total += n * ITEMS[k].sell; W.items[k] = a.id === '*' ? 0 : n - 1; if (a.id !== '*') total = ITEMS[k].sell; }
        if (total) { this.earn(total, null, false, 'Sold'); this.audio.cash(); W.stats.sold = (W.stats.sold || 0) + 1; }
        break;
      }
      case 'build': this._build(a, pid, fail); break;
      case 'sellBuild': this._sellBuild(a, pid, fail); break;
      case 'hatch': {
        if (!(W.items.egg > 0)) return fail('No eggs.');
        if (!W.zoo.decor.some(d => d.k === 'hatchery')) return fail('Build a Hatchery first.');
        W.items.egg--; W.eggs ||= []; const biome = (W.eggQ ||= []).shift() || 'meadow';
        W.eggs.push({ id: uid('e'), biome, t0: Date.now(), dur: 180 });
        toast('The egg is warm and cosy. It will hatch in about 3 minutes.', 'good');
        break;
      }
      case 'dig': this._dig(a, pid); break;
      case 'scout': this._scout(a, pid); break;
      case 'chest': this._chest(a, pid); break;
      case 'beacon': if (!W.beacons[a.id]) { W.beacons[a.id] = true; this.event({ k: 'banner', t: 'BEACON LIT', s: BEACONS.find(b => b.id === a.id).name + (W.upg.beacon ? ' - fast travel from the map (M).' : ' - buy Ranger Beacons at the station to fast travel here.'), kind: 'good' }); this.earn(150, null, false); } break;
      case 'gate': if (!W.gates[a.id]) { W.gates[a.id] = true; this.event({ k: 'gate', id: a.id }); const G0 = GATES.find(g => g.id === a.id); this.event({ k: 'banner', t: G0.kind === 'vines' ? 'THE VINES PART' : 'SMASHED THROUGH!', s: 'A new way is open.', kind: 'good' }); Bus.emit('gate:open', { id: a.id }); } break;
      case 'stun': { const c = this.wild.byId.get(a.id); if (c) this.wild.stun(c, a.t, a.knock); break; }
      case 'roar': this.wild.roarAt(a.x, a.z, a.r, a.big); break;
      case 'call': this.wild.callAt(a.x, a.z, a.r); break;
      case 'aoe': this.wild.aoe(a.x, a.z, a.r, a.stun, a.knock); break;
      case 'photo': this._photo(a, pid); break;
      case 'assist': { const c = this.wild.byId.get(a.id); if (!c || !c.claim) return; if (c.claim === this.me) this.catching.assist(pid); else this.net.sendEvent({ k: 'assist', pid: c.claim, from: pid }); break; }
      case 'unassist': break;
      case 'board': {
        const owner = a.owner, R = owner === this.me ? this.riding.c : this.riding.remote.get(owner);
        const taken = this.players().filter(p => p.pid !== pid && (p.pid === this.me ? this.player.ride?.owner === owner : this.remotes.get(p.pid)?.st?.rd?.owner === owner)).length;
        if (!R || taken >= R.seats) return fail('No room on that one.');
        this._to(pid, { k: 'board', owner, seat: taken });
        break;
      }
      case 'unboard': break;
      case 'travel': {
        if (!W.upg.beacon) return fail('You need the Ranger Beacons upgrade.');
        let x, z;
        if (a.id === 'zoo') { const gp = this.zoo.gatePos(); x = gp.x; z = gp.z - 8; }
        else { const B = BEACONS.find(b => b.id === a.id); if (!B || !W.beacons[a.id]) return fail('That beacon is not lit.'); x = B.x + 4; z = B.z + 4; }
        this._to(pid, { k: 'tp', x, z });
        break;
      }
      case 'throw': break;
      case 'hitNode': this.base.hit(a.id, a.dmg || 1, { player: pid }); break;
      case 'skipTut': this.quests.skip(); break;
      case 'admin': this._admin(a, pid); break;
    }
    this.saveSoon();
  }
  _caught(a, pid) {
    const W = this.W, sp = SP[a.sp]; if (!sp) return;
    const c = this.wild.byId.get(a.id);
    const escaped = c?.escaped;
    if (c) this.wild.remove(c);
    const d = W.dex[a.sp] ||= { seen: 0, caught: 0 };
    const isNew = !d.caught;
    d.seen++; d.caught++; d.best = Math.max(d.best || 0, a.kg || 0);
    if (a.v) { d.v ||= []; if (!d.v.includes(a.v)) d.v.push(a.v); }
    const traits = [];
    if (Math.random() < 0.7) traits.push(TRAITS[Math.floor(Math.random() * TRAITS.length)]);
    if (a.size > 0.92) traits.push('Giant');
    const rec = creatureRecord(a.sp, { uid: escaped || undefined, v: a.v, size: a.size, kg: a.kg || lerp(sp.kg[0], sp.kg[1], a.size), traits, by: pid });
    // into the crate if it fits; otherwise airlifted (free with the drone, a fee without)
    const owner = this.ownerOf(pid);
    const fits = this.crateUsed(owner) + 1 <= this.crateCap(owner);
    let where;
    if (escaped) { rec.at = 'zoo'; where = 'Back to the holding pen with you!'; }
    else if (fits) { rec.at = 'pack:' + owner; where = 'It joined your team (' + (this.crateUsed(owner) + 1) + '/' + this.crateCap(owner) + ').'; }
    else { rec.at = 'zoo'; where = 'Your team is full - it went home to your base.'; }
    W.creatures[rec.uid] = rec;
    W.stats.caught = (W.stats.caught || 0) + 1;
    // the field journal
    (W.journal ||= []).unshift({ sp: a.sp, v: a.v || null, kg: Math.round(rec.kg), size: a.size, b: a.x != null ? this.terrain.biome(a.x, a.z) : null, day: W.day, tod: W.tod, fish: !!a.fishing, by: pid === this.me ? null : (this.remotes.get(pid)?.name || 'A friend'), uid: rec.uid });
    if (W.journal.length > 300) W.journal.length = 300;
    if (a.fishing) W.stats.fished = (W.stats.fished || 0) + 1;
    const reward = isNew ? Math.round(80 * RARITY[sp.rarity].value) : 0;
    if (reward) this.earn(reward, null, true, 'Grant');
    this._to(pid, { k: 'card', rec, isNew, reward, where });
    if (RARITY[sp.rarity].stars >= 4 || a.v) this.event({ k: 'toast', t: (this.remotes.get(pid)?.name || 'You') + ' caught a ' + (a.v ? VARIANTS[a.v].name + ' ' : '') + sp.name + '!', kind: 'legend' });
    this.zoo.syncCreatures();
    Bus.emit('creature:caught', { sp: a.sp, v: a.v, isNew });
  }
  _buy(a, pid, fail, toast) {
    const W = this.W, lv = this.zoo.level, m0 = W.money;
    try { this._buy0(a, fail, toast, W, lv); } finally { if (W.money < m0) W.stats.bought = (W.stats.bought || 0) + 1; }
  }
  _buy0(a, fail, toast, W, lv) {
    if (a.what === 'tool') { const T = TOOLS[a.id]; if (!T || W.tools[a.id]) return; if (T.level > lv) return fail('Needs a ' + T.level + '-level base.'); if (!this.spend(T.price)) return fail('Not enough money.'); W.tools[a.id] = 1; toast('Bought: ' + T.name + '! It is on your hotbar.', 'good'); this.audio.cash(); }
    if (a.what === 'item') { const I = ITEMS[a.id], n = a.n || 1; if (!I) return; if ((I.level || 0) > lv) return fail('Locked.'); if (!this.spend(I.price * n)) return fail('Not enough money.'); W.items[a.id] = (W.items[a.id] || 0) + n; this.audio.cash(); }
    if (a.what === 'upg') { const U = UPGRADES[a.id], l = W.upg[a.id] || 0, nx = U.levels[l + 1]; if (!nx) return; if (!this.spend(nx.price)) return fail('Not enough money.'); W.upg[a.id] = l + 1; toast(U.name + ' upgraded!', 'good'); this.audio.cash(); }
    if (a.what === 'plot') { const np = PLOTS[(W.plot || 0) + 1]; if (!np) return; if (!this.spend(np.price)) return fail('Not enough money.'); W.plot = (W.plot || 0) + 1; this.zoo.rebuild(); toast('Your zoo grew! More room to build.', 'good'); this.audio.cash(); this.event({ k: 'zoo' }); }
  }
  _build(a, pid, fail) {
    const W = this.W;
    if (a.what === 'exhibit') {
      const price = exhibitPrice(a.hab, a.size);
      if (!this.spend(price)) return fail('Not enough money.');
      const n = W.zoo.exhibits.filter(e => e.hab === a.hab).length + 1;
      W.zoo.exhibits.push({ id: uid('ex'), hab: a.hab, size: a.size, x: a.x, z: a.z, rot: a.rot || 0, name: HABITATS[a.hab].name + (n > 1 ? ' ' + n : '') + (a.hab === 'aviary' || a.hab === 'aquatic' || a.hab === 'predator' ? '' : ' Exhibit') });
      Bus.emit('zoo:build', { what: 'exhibit' });
    } else if (a.what === 'path') {
      const D = DECOR[a.key]; if (!this.spend(D.price)) return;
      if (!W.zoo.paths.some(([x, z]) => x === a.x && z === a.z)) W.zoo.paths.push([a.x, a.z, a.key === 'path2' ? 2 : 1]);
    } else {
      const D = DECOR[a.key]; if (!D) return;
      if (!this.spend(D.price)) return fail('Not enough money.');
      W.zoo.decor.push({ id: uid('d'), k: a.key, x: a.x, z: a.z, rot: a.rot || 0 });
    }
    this.zoo.rebuild();
    this.event({ k: 'zoo' });
  }
  _sellBuild(a, pid, fail) {
    const W = this.W;
    if (a.what === 'exhibit') {
      const e = W.zoo.exhibits.find(x => x.id === a.id); if (!e) return;
      if (this.zoo.residents(e.id).length) return fail('Move the animals out first.');
      W.zoo.exhibits.splice(W.zoo.exhibits.indexOf(e), 1); this.earn(Math.round(exhibitPrice(e.hab, e.size) / 2), null, false);
    } else if (a.what === 'decor') {
      const d = W.zoo.decor.find(x => x.id === a.id); if (!d) return;
      W.zoo.decor.splice(W.zoo.decor.indexOf(d), 1); this.earn(Math.round(DECOR[d.k].price / 2), null, false);
    } else if (a.what === 'path') {
      const i = W.zoo.paths.findIndex(([x, z]) => x + ',' + z === a.id); if (i >= 0) { W.zoo.paths.splice(i, 1); this.earn(4, null, true); }
    }
    this.zoo.rebuild(); this.event({ k: 'zoo' });
  }
  /** loot from the ground: what kind of thing comes out depends on where you are */
  _loot(biome, rich = 1) {
    const r = Math.random();
    if (biome === 'cave' || biome === 'crater') return r < 0.5 ? ['crystal', 1] : r < 0.75 ? ['amber', 1] : r < 0.9 ? ['egg', 1, biome === 'crater' ? 'meadow' : 'cave'] : ['money', 400];
    if (r < 0.36) return ['fossil', 1 + (Math.random() < 0.3 * rich ? 1 : 0)];
    if (r < 0.58) return ['amber', 1];
    if (r < 0.72) return ['money', Math.round((60 + Math.random() * 240) * rich)];
    if (r < 0.86) return ['egg', 1, biome];
    if (r < 0.93) return ['bigfossil', 1];
    return ['berries', 4];
  }
  _give(loot, pid, x, y, z) {
    const W = this.W, out = [];
    for (const [k, n, b] of loot) {
      if (k === 'money') { this.earn(n, null, true); out.push(money(n)); continue; }
      W.items[k] = (W.items[k] || 0) + n;
      if (k === 'egg') { W.eggQ ||= []; for (let i = 0; i < n; i++) W.eggQ.push(b || 'meadow'); }
      out.push((n > 1 ? n + 'x ' : '') + ITEMS[k].name);
    }
    this._to(pid, { k: 'loot', t: out.join(', '), x, y, z });
  }
  _dig(a, pid) {
    const L = this.landmarks, d = L.digs[a.i]; if (!d || !L.digReady(a.i)) return;
    this.W.found['dig' + a.i] = Date.now();
    const loot = [this._loot(d.biome)]; if (Math.random() < 0.3) loot.push(this._loot(d.biome));
    this._give(loot, pid, d.x, d.y + 1, d.z);
    this.event({ k: 'fx', kind: 'dirt', x: d.x, y: d.y, z: d.z, n: 26 });
    Bus.emit('dig', { biome: d.biome });
  }
  _scout(a, pid) {
    const L = this.landmarks, C = L.cracks[a.i]; if (!C || !L.crackReady(a.i)) return;
    const r = this.W.creatures[a.uid]; if (!r || r.at !== 'pack:' + this.ownerOf(pid)) return;
    this.W.found['crack' + a.i] = Date.now();
    const name = r.name || SP[r.sp].name;
    this._to(pid, { k: 'toast', t: name + ' squeezes into the crack...', kind: 'info' });
    setTimeout(() => {
      const loot = [this._loot(C.biome, 1.6), this._loot(C.biome, 1.6)];
      this._give(loot, pid, C.x, C.y + 1, C.z);
      this._to(pid, { k: 'toast', t: name + ' came back out with treasure!', kind: 'good' });
      if (Math.random() < 0.25) { const ctx = this.wild._ctx(C.x, C.z); const pool = this.wild.weights(ctx, 'walk').filter(e => RARITY[e.sp.rarity].stars >= 3); const pick = weighted(pool); if (pick) { this.wild.spawnHerd(pick.sp, C.x + 8, C.z + 8, ctx, { quiet: true }); this._to(pid, { k: 'toast', t: 'Something rare was hiding in there - and it is coming out!', kind: 'legend' }); } }
    }, 6000);
  }
  _chest(a, pid) {
    const W = this.W; if (W.found[a.id]) return;
    const C = [...CHESTS, ...NESTS].find(c => c.id === a.id); if (!C) return;
    W.found[a.id] = Date.now();
    const S = this.landmarks.chests[a.id];
    this._give(C.loot, pid, S.x, S.y + 1, S.z);
    this.event({ k: 'fx', kind: 'spark', x: S.x, y: S.y + 1, z: S.z, n: 30 });
    this.event({ k: 'fanfare' });
    Bus.emit('chest', { id: a.id });
  }
  _photo(a, pid) {
    const sp = SP[a.sp]; if (!sp) return;
    const base = [12, 30, 70, 160, 400, 1000][RARITY[sp.rarity].stars - 1];
    const act = a.act === 'roar' || a.act === 'attack' ? 2 : a.act === 'fly' || a.act === 'run' ? 1.5 : a.act === 'sleep' ? 1.2 : 1;
    const close = a.d < 15 ? 1.5 : a.d < 35 ? 1.2 : a.d > 70 ? 0.6 : 1;
    let m = Math.round(base * act * close * (a.v ? 3 : 1) * (a.wild ? 1 : 0.4));
    const d = this.W.dex[a.sp] ||= { seen: 0, caught: 0 }; d.seen++;
    if (!d.photo) { d.photo = 1; m += base * 2; }
    this.W.stats.photos = (this.W.stats.photos || 0) + 1;
    this.earn(m, null, true);
    this._to(pid, { k: 'toast', t: 'Photo of a ' + sp.name + (act > 1 ? ' in action' : '') + ' sold to the Ranger Gazette: ' + money(m) + '!', kind: 'good' });
  }

  /* ---------------- events ---------------- */
  onEvent(e, from) {
    if (e.pid && e.pid !== this.me && e.k !== 'board') return;   // meant for someone else
    switch (e.k) {
      case 'toast': this.ui.toast(e.t, e.kind); break;
      case 'banner': this.ui.banner(e.t, e.s, e.kind, 4); if (e.kind === 'bad') this.audio.alarm(); else this.audio.discover(); break;
      case 'nodeHit': case 'node': this.base.onEvent(e); break;
      case 'gather': { const y = this.terrain.ground(e.x, e.z) + 2; this.ui.floater('+' + e.n + ' ' + ITEMS[e.res].name, new THREE.Vector3(e.x, y, e.z), 'res'); if (e.pid === this.me || !e.pid) this.audio.coin(); break; }
      case 'quest': this.ui.banner('QUEST COMPLETE: ' + e.title.toUpperCase(), '+ ' + money(e.pay), 'good', 3.5); this.audio.level(); break;
      case 'fanfare': this.audio.level(); break;
      case 'weather': if (e.w === 'storm') this.ui.toast('A thunderstorm is rolling in. Some say a creature rides the lightning...', 'warn'); else if (e.w === 'rain') this.ui.toast('It is starting to rain.', 'info'); break;
      case 'roar': { const c = this.wild.byId.get(e.id); if (c) { c.anim.play('roar'); this.audio.roar(c.pos, Math.min(1, c.height / 6), c.flyer ? 'screech' : c.sp.id === 'para' ? 'honk' : 'roar'); } break; }
      case 'splash': this.fx.splash(e.x, 0, e.z, e.s || 1); this.audio.splash({ x: e.x, y: 0, z: e.z }, e.s || 1); break;
      case 'bomb': this.events.bomb(e.x, e.z); break;
      case 'meteor': this.events.meteor(e.x, e.z, e.land); break;
      case 'quake': this.events.quake(e.s || 0.4, e.x, e.z); break;
      case 'hit': if (e.pid === this.me) this.player.hit(_v.set(this.player.pos.x - e.x, 0, this.player.pos.z - e.z), e.f, 1, e.why); break;
      case 'card': if (!e.pid || e.pid === this.me) { this.ui.catchCard(e.rec, { isNew: e.isNew, reward: e.reward, where: e.where }); } break;
      case 'loot': this.ui.toast('Found: ' + e.t, 'good'); this.audio.coin(); if (e.x != null) this.fx.burst(e.x, e.y, e.z, 'spark', 16); break;
      case 'fx': this.fx.burst(e.x, e.y, e.z, e.kind, e.n || 12); break;
      case 'gate': this.landmarks.openGate(e.id, true); break;
      case 'assist': if (e.pid === this.me) this.catching.assist(e.from); break;
      case 'board': if (e.pid === this.me) this.riding.board(e.owner, e.seat); break;
      case 'tp': if (e.pid === this.me || !e.pid) { this.ui.fade('Fast travel', '', 1.2); setTimeout(() => this.teleport(e.x, e.z, null), 300); } break;
      case 'baitMesh': this.baitMesh(e.x, e.y, e.z, e.item); break;
      case 'zoo': if (!this.isHost) { /* the save will follow */ } break;
      case 'chat': this.ui.toast(e.name + ': ' + e.text, 'chat'); break;
    }
  }
  baitMesh(x, y, z, item) {
    const m = holdModel(item); m.scale.setScalar(2.2); m.position.set(x, y + 0.2, z); this.scene.add(m);
    const b = { m, t: 30, x, z }; this.baitMeshes.push(b);
  }
  unbaitMesh() {}

  /* ---------------- per frame ---------------- */
  update(dt) {
    dt = Math.min(dt, 0.1);
    this.time += dt; this.frame++;
    const W = this.W, I = this.input;
    if (this.phase !== 'play' || !W) return this._titleFrame(dt);
    // time of day
    if (this.isHost) { W.tod += dt / DAY; if (W.tod >= 1) { W.tod -= 1; W.day++; } }
    const blocked = this.frozen();
    I.blocked = this.frozen();
    // menus
    if (I.pressedRaw('Escape') && !this.ui.panel && !this.inv.open && !this.build.active) this.panels.open('pause');
    if (I.pressedRaw('KeyB') && !this.ui.panel && !this.inv.open && !this.build.active && !this.chatOpen) this.build.toggle();
    // interactions (E) first: they win over getting off your mount
    this.interactable = blocked ? null : this._findInteract();
    if (this.interactable && I.pressed('KeyE') && !this.catching.fighting) { I.down.delete('KeyE'); this.interactable.act(); }
    // you
    const J = this._jumpCheck('start');
    if (!this.build.active) this.player.update(dt, I, this.cam);
    J('player');
    this.riding.update(dt, I, blocked); J('riding');
    this.riding.tickRemote(dt);
    this.tools.update(dt, I, blocked); J('tools');
    this.abilities.update(dt); J('abilities');
    // the world
    this.wild.update(dt); J('wild');
    this.zoo.update(dt); J('zoo');
    this.base.update(dt); J('base');
    this.events.update(dt); J('events');
    this.quests.update(dt); J('quests');
    this._hatchery();
    this._remotes(dt); J('remotes');
    for (let i = this.baitMeshes.length - 1; i >= 0; i--) { const b = this.baitMeshes[i]; b.t -= dt; if (b.t <= 0) { this.scene.remove(b.m); this.baitMeshes.splice(i, 1); } }
    this._discovery(dt); J('discovery');
    this._portals(dt); J('portals');
    // effects, sky, water, streaming
    const P = this.player.pos, cp = this.camera.position;
    this.signs.update(dt);
    this.fx.update(dt);
    const biome = this.inInterior ? 'cave' : this.terrain.biome(P.x, P.z);
    const under = cp.y < -0.15 && this.terrain.ground(cp.x, cp.z) < cp.y;
    this.inCave = !!this.inInterior;
    this.sky.update(dt, { tod: W.tod, cloud: this.events.w.cloud, rain: this.events.w.rain, storm: this.events.w.storm, biome, under, depth: -cp.y, cave: this.inCave, whiteout: this.terrain.inWhiteout(P.x, P.z), sand: this.events.active.sand ? 1 : 0, cam: cp, groundAt: (x, z) => this.terrain.ground(x, z) });
    this.water.update(dt, cp, this.events.w.storm);
    this.landmarks.update(dt, this.time, this.sky.state.night);
    if (this.frame % 2 === 0) this.scatter.update(cp, this.frame < 60 ? 6 : 1);
    this.terrain.cull(cp, this.scene.fog.far + 100);
    this.build.update(dt);
    this.cam.update(dt, I);
    // audio
    const A = this.audio; A.listener.x = cp.x; A.listener.y = cp.y; A.listener.z = cp.z;
    const nearZoo = Math.hypot(P.x - ZOO.x, P.z - ZOO.z);
    const fightT = this.catching.fighting ? this.catching.tension : 0;
    A.update(dt, {
      wind: (biome === 'peaks' || biome === 'tundra' ? 0.8 : 0.2) + (cp.y > 60 ? 0.6 : 0) + (this.player.mount?.flying ? 0.5 : 0) + this.events.w.storm * 0.6,
      rain: this.events.w.rain * (this.inCave ? 0 : 1), surf: this.terrain.ground(P.x, P.z) < 2 && biome !== 'swamp' ? 0.6 : 0,
      jungle: ['jungle', 'valley', 'swamp', 'skull'].includes(biome) ? 1 : 0, lava: Math.max(0, 1 - Math.hypot(P.x - VOLCANO.x, P.z - VOLCANO.z) / 350),
      crowd: 0,
      creak: fightT, under: under ? 1 : 0, life: this.inCave ? 0 : ['meadow', 'jungle', 'elder', 'valley', 'swamp', 'isle'].includes(biome) ? 0.8 : 0.2,
      night: this.sky.state.night > 0.5, swamp: biome === 'swamp',
      mood: this.catching.fighting || this.events.active.raid || this.events.active.stampede || this.events.active.titan ? 'tense' : this.sky.state.night > 0.6 ? 'night' : 'calm',
    });
    // HUD
    this.ui.update(dt);
    this.inv.update(dt);
    this.panels.update(dt);
    this._chat();
    // network and saving
    this._net(dt);
    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 20; this.saveNow(); }
  }
  _titleFrame(dt) {
    // a slow fly-over of the zoo for the title screen
    const t = this.time * 0.05;
    this.camera.position.set(ZOO.x + Math.sin(t) * 150, 70, ZOO.z + Math.cos(t) * 150);
    this.camera.lookAt(ZOO.x, 20, ZOO.z - 80);
    this.sky.update(dt, { tod: 0.36, cloud: 0.2, rain: 0, storm: 0, biome: 'meadow', cam: this.camera.position });
    this.water.update(dt, this.camera.position, 0);
    this.fx.update(dt);
    if (this.frame % 3 === 0) this.scatter.update(this.camera.position, 3);
    this.terrain.cull(this.camera.position, 1000);
  }
  _hatchery() {
    const W = this.W; if (!this.isHost || !W.eggs?.length) return;
    for (const e of [...W.eggs]) {
      if (Date.now() - e.t0 < e.dur * 1000) continue;
      W.eggs.splice(W.eggs.indexOf(e), 1);
      const pool = SPECIES.filter(s => (s.where.includes(e.biome) || (e.biome === 'deep' && s.where.includes('ocean'))) && !s.when?.event && s.rarity !== 'mythic');
      const pick = weighted(pool.map(s => ({ s, w: RARITY[s.rarity].w * (RARITY[s.rarity].stars >= 3 ? 3 : 1) }))) || { s: SP.compy };
      const rec = creatureRecord(pick.s.id, { size: Math.random(), baby: true, at: 'zoo', v: Math.random() < 0.05 ? 'albino' : null });
      rec.baby = true; rec.born = Date.now();
      W.creatures[rec.uid] = rec;
      const d = W.dex[pick.s.id] ||= { seen: 0, caught: 0 }; d.seen++; d.caught++;
      this.event({ k: 'banner', t: 'AN EGG HATCHED!', s: 'A baby ' + pick.s.name + ' is in the holding pen. Babies are extra adorable.', kind: 'good' });
      this.saveSoon();
    }
    // babies grow up after a while
    for (const r of Object.values(W.creatures)) if (r.baby && Date.now() - (r.born || 0) > 20 * 60 * 1000) { r.baby = false; this.zoo.syncCreatures(); }
  }
  /** first time somewhere: a title card (and for biomes, the name every time you cross over) */
  _discovery(dt) {
    const P = this.player.pos, W = this.W;
    if ((this._discT = (this._discT || 0) - dt) > 0) return;
    this._discT = 0.5;
    // fog of war
    const n = this.explored.n, ci = Math.floor((P.x + WORLD_HALF) / (WORLD_HALF * 2) * n), cj = Math.floor((P.z + WORLD_HALF) / (WORLD_HALF * 2) * n);
    const rad = this.player.mount?.has('tall') || this.player.mount?.flying ? 3 : 2;
    for (let i = ci - rad; i <= ci + rad; i++) for (let j = cj - rad; j <= cj + rad; j++) if (i >= 0 && j >= 0 && i < n && j < n) this.explored.bits[i * n + j] = 1;
    if (this.inInterior) return;
    const Pl = this.landmarks.discover(P);
    if (Pl && this.isHost) { W.flags['seen:' + Pl.id] = 1; this.ui.region(Pl.name, Pl.tag); this.audio.discover(); this.earn(100, null, true); Bus.emit('place:seen', { id: Pl.id }); this.saveSoon(); }
    else if (Pl && !this.isHost) { W.flags['seen:' + Pl.id] = 1; this.ui.region(Pl.name, Pl.tag); this.audio.discover(); }
    const b = this.terrain.biome(P.x, P.z);
    if (b !== this._biome && b !== 'ocean' && !(b === 'beach' && this._biome === 'ocean')) {
      const B = BIOMES[b];
      if (B && (!this._biome || this.time - (this._biomeT || 0) > 6)) {
        if (!W.flags['b:' + b]) { W.flags['b:' + b] = 1; if (!Pl) { this.ui.region(B.name, B.tag, b); this.audio.discover(); } }
        else if ((B.danger || 0) >= 3 && !Pl && this.time - (this._dangerT || -999) > 90) { this._dangerT = this.time; this.ui.region(B.name, 'You are entering dangerous land.', b); this.audio.alarm?.(); }
        this._biomeT = this.time;
      }
      this._biome = b;
    }
  }
  /** walking into a cave mouth (and out again) */
  _portals(dt) {
    // a pending trip finishes half a second into the fade (game time, so tests can step it)
    const Q = this._portalQ;
    if (Q) {
      Q.t -= dt;
      if (Q.t <= 0) {
        this._portalQ = null;
        const T = Q.T;
        this.teleport(T.x, T.z, T.interior, T.yaw);
        if (Q.uid) this.riding.summon(Q.uid);
        if (T.interior) this.ui.region(INTERIORS[T.interior].name, INTERIORS[T.interior].dark ? 'It is very dark in here. A lantern - or a glowing creature - would help.' : '');
        Bus.emit('portal', { to: T.interior });
      }
      return;
    }
    if (this._portalCd > 0) { this._portalCd -= dt; return; }
    const P = this.player, at = this.landmarks.portalAt(P.mount ? P.mount.pos : P.pos);
    if (!at) return;
    if (P.mount && P.mount.sp.size === 'XL') { if (!this._xlWarn || this.time - this._xlWarn > 4) { this._xlWarn = this.time; this.ui.toast('Too big to fit through there. Get off first.', 'warn'); } return; }
    const T = this.landmarks.portalTarget(at);
    this._portalCd = 2.5;
    this.ui.fade(T.interior ? INTERIORS[T.interior].name : 'Back outside', '', 1.4);
    this._portalQ = { T, t: 0.5, uid: P.mount ? this.riding.c?.uid : null };
  }

  /* ---------------- co-op ---------------- */
  _netHooks() {
    const N = this.net;
    N.on.getSave = () => this.W;
    N.on.action = (pid, a) => { if (this.isHost) this.perform(a, pid); };
    N.on.event = (pid, e) => this.onEvent(e, pid);
    N.on.player = (pid, s) => { let R = this.remotes.get(pid); if (!R) R = this._addRemote(pid); R.st = s; R.pos.set(s.x, s.y, s.z); };
    N.on.world = (w) => { if (w.wild) this.wild.applySnapshot(w.wild); if (w.tod != null && this.W) { this.W.tod = w.tod; this.W.day = w.day; this.W.weather.kind = w.wk; } };
    N.on.saveIn = (s) => { const zk = JSON.stringify(s.zoo) + s.plot; const old = this.W ? JSON.stringify(this.W.zoo) + this.W.plot : ''; const crk = JSON.stringify(s.creatures); this.W = migrate(s); if (zk !== old) { this.zoo.rebuild(); } else if (crk !== this._crk) this.zoo.syncCreatures(); this._crk = crk; };
    N.on.join = (pid, p) => { this._addRemote(pid, p); this.ui.toast((p?.name || 'A friend') + ' joined the expedition!', 'good'); if (this.isHost) this.net.sendSave(this.W); };
    N.on.leave = (pid, p) => { const R = this.remotes.get(pid); if (R) { this.scene.remove(R.H.root); R.rope?.hide(); this.remotes.delete(pid); } this.riding.remoteMount(pid, null); this.ui.toast((p?.name || 'A friend') + ' left.', 'info'); };
    N.on.welcome = (d) => { this.W = migrate(d.save); };
    N.on.lost = () => { this.ui.banner('CONNECTION LOST', 'The host left. Reload to play on your own.', 'bad', 6); };
  }
  _addRemote(pid, p) {
    if (this.remotes.has(pid)) return this.remotes.get(pid);
    const prof = p || this.net.profiles.get(pid) || {};
    const H = makeHuman({ look: prof.look || 1 });
    this.scene.add(H.root);
    const R = { H, st: null, pos: new THREE.Vector3(), name: prof.name || 'Ranger', tool: null, model: null, rope: null };
    this.remotes.set(pid, R);
    return R;
  }
  _remotes(dt) {
    for (const [pid, R] of this.remotes) {
      const s = R.st; if (!s) continue;
      // their mount
      const m = s.m ? this.riding.remoteMount(pid, s.m) : (this.riding.remoteMount(pid, null), null);
      if (m) { m.seat(0, _v); R.H.root.position.copy(m.saddle(_w)); R.H.root.rotation.set(m.pitch * 0.8, m.yaw, m.roll * 0.8, 'YXZ'); }
      else if (s.rd) { const o = this.riding.mountOf(s.rd.owner); if (o) { o.seat(s.rd.seat, _v); R.H.root.position.copy(_v); R.H.root.rotation.set(0, o.yaw, 0); } }
      else { R.H.root.position.lerp(R.pos, 1 - Math.exp(-dt * 12)); R.H.root.rotation.set(0, R.H.root.rotation.y + wrapAngle(s.yaw - R.H.root.rotation.y) * Math.min(1, dt * 10), 0); }
      R.H.anim(dt, { ...s.an, ride: !!(s.m || s.rd) });
      // what they hold, and their rope
      if (R.tool !== s.tool) { if (R.model) R.H.P.handR.remove(R.model); R.tool = s.tool; R.model = s.tool ? holdModel(s.tool) : null; if (R.model) R.H.P.handR.add(R.model); }
      if (s.rope) { if (!R.rope) R.rope = new (this.catching.rope.constructor)(this.scene, '#c8a878', 0.06); R.H.P.handR.getWorldPosition(_v); R.rope.draw(_v, _w.set(s.rope[0], s.rope[1], s.rope[2]), 0.5, this.camera.position); }
      else if (R.rope) R.rope.hide();
    }
  }
  _net(dt) {
    const N = this.net; if (!N.isOnline) return;
    const P = this.player, m = P.mount, C = this.catching;
    const r2 = v => Math.round(v * 100) / 100;
    const ropeEnd = C.state === 'fight' || C.state === 'snare' || C.state === 'assist' ? C.loop.position : C.projMesh ? C.projMesh.position : null;
    const s = {
      x: r2(P.pos.x), y: r2(P.pos.y), z: r2(P.pos.z), yaw: r2(P.yaw), cr: P.crouch ? 1 : 0, un: P.under ? 1 : 0, wa: P.mode === 'swim' ? 1 : 0,
      an: { ...P._A(), speed: r2(Math.hypot(P.vel.x, P.vel.z)), swim: P.mode === 'swim', crouch: P.crouch, cheer: P.cheerT > 0, air: !P.onGround },
      tool: this.tools.id, rope: ropeEnd ? [r2(ropeEnd.x), r2(ropeEnd.y), r2(ropeEnd.z)] : null,
      m: m ? { sp: m.spId, v: m.v, size: m.size, x: r2(m.pos.x), y: r2(m.pos.y), z: r2(m.pos.z), yaw: r2(m.yaw), p: r2(m.pitch), r: r2(m.roll), sp2: r2(m.speed), fl: m.flying ? 1 : 0, un: m.under ? 1 : 0, wa: m.inWater ? 1 : 0, fp: r2(m.flap), as: m.astate, act: m.anim.act ? m.anim.act + ':' + Math.floor(this.time) : null } : null,
      rd: P.ride || null,
      cl: C.c && (C.state === 'fight' || C.state === 'snare') ? { id: C.c.id, x: r2(C.c.pos.x), y: r2(C.c.pos.y), z: r2(C.c.pos.z), yaw: r2(C.c.yaw), p: r2(C.c.pitch), r: r2(C.c.roll), s: r2(C.c.speed) } : null,
    };
    N.sendPlayer(s, dt);
    if (this.isHost) N.sendWorld(() => ({ wild: this.wild.snapshot(), tod: r2(this.W.tod * 1000) / 1000, day: this.W.day, wk: this.W.weather.kind }), dt);
  }
  _chat() {
    const I = this.input, box = document.getElementById('chatbox');
    if (!this.net.isOnline || !box) return;
    if (!this.chatOpen && I.pressedRaw('KeyT') && !this.frozen()) { this.chatOpen = true; box.style.display = 'block'; box.value = ''; setTimeout(() => box.focus(), 0); this.input.unlock(); box.onkeydown = (e) => { if (e.key === 'Enter') { const t = box.value.trim().slice(0, 120); if (t) this.event({ k: 'chat', name: this.profile.name, text: t }); this._closeChat(); } if (e.key === 'Escape') this._closeChat(); }; }
  }
  _closeChat() { const box = document.getElementById('chatbox'); this.chatOpen = false; box.style.display = 'none'; box.blur(); }

  /** a picture of the whole world for the map panel */
  makeMapImage() {
    const T = this.terrain, N0 = 400, cv = document.createElement('canvas'); cv.width = cv.height = N0;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(N0, N0), c = new THREE.Color();
    const n = Math.round(WORLD_HALF * 2 / 6) + 1;
    for (let y = 0; y < N0; y++) for (let x = 0; x < N0; x++) {
      const i = Math.min(n - 1, Math.floor(x / N0 * n)), j = Math.min(n - 1, Math.floor(y / N0 * n));
      T._color(i, j, c);
      const h = T.H[i * n + j], hx = T.H[Math.min(n - 1, i + 1) * n + j] - h, hz = T.H[i * n + Math.min(n - 1, j + 1)] - h;
      let k = clamp(1 + (-hx - hz) * 0.06, 0.55, 1.4);
      let r = c.r * k, g = c.g * k, b = c.b * k;
      if (h < 0) { const d = Math.min(1, -h / 60); r = r * 0.35 + 0.12 * (1 - d); g = g * 0.4 + 0.42 * (1 - d) + 0.1; b = b * 0.3 + 0.72 - d * 0.3; }
      const o = (y * N0 + x) * 4;
      img.data[o] = Math.min(255, Math.pow(r, 1 / 2.2) * 255); img.data[o + 1] = Math.min(255, Math.pow(g, 1 / 2.2) * 255); img.data[o + 2] = Math.min(255, Math.pow(b, 1 / 2.2) * 255); img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}
void lavaAt; void damp; void EX_SIZES; void PLACES;
