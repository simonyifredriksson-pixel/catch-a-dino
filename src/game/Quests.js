/* Quests.js - the tutorial, then the path through the game.

   THE TUTORIAL (Professor Bramble talks you through it):
     dock -> fish something in the lagoon -> unload at the Ranger Station ->
     put it in the Lagoon Tank -> see what the zoo earns -> Shelly the Archelon
     (a gift) -> ride her across the lagoon -> lasso a land dino -> Meadow Pen
     -> buy something.
   After that the quests point at the big things to work toward; once the
   chain is done the objective panel keeps suggesting a species you have not
   caught yet, with its dex hint.

   Each quest is checked on the host against the save (so it works in co-op
   whoever does the deed). Quests may have a waypoint (`at`): a compass marker
   and a bobbing arrow in the world. ADDING A QUEST: add an entry. */
import * as THREE from '../../lib/three.module.js';
import { SPECIES, SP, RARITY } from '../data/Species.js';
import { PLACES, BEACONS } from '../data/Places.js';
import { DOCK, HOME } from '../data/Biomes.js';
import { STATION } from './Zoo.js';
import { creatureRecord } from './State.js';
import { TOOLS } from '../data/Tools.js';

const recs = g => Object.values(g.W.creatures);
const isSwim = r => SP[r.sp]?.move === 'swim';
const wild = r => !r.starter && !r.gift;
const exAt = (g, id) => g.W.zoo.exhibits.find(e => e.id === id);
const dockEnd = { x: DOCK.x, z: DOCK.z + DOCK.len - 2, label: 'Dock' };
/** the arrow leads to the start of the pier first, then out along it */
function dockWay(g) {
  const D = g.landmarks?.dock, P = g.player.pos;
  if (!D) return dockEnd;
  const onPier = Math.abs(P.x - D.x) < D.hw + 0.6 && P.z > D.z0 - 1 && P.y > D.y - 0.6;
  return onPier || P.z > D.z0 + 4 ? dockEnd : { x: D.x, z: D.z0, label: 'Dock' };
}

export const QUESTS = [
  { id: 'land', tut: true, title: 'Your first creature', text: 'Some Mudbuns are grazing just outside the gate. Catch one with your Rope Lasso.', hint: 'Hold C to sneak. Hold LMB to spin, let go to throw, CLICK when the ring is in the green band, then HOLD LMB to keep its head in your loop. When it faints, press E to catch it.',
    say: 'Welcome to Home Island, ranger! I am Professor Bramble. This island is your base - and the world out there is full of creatures nobody has ever seen. Let us start small: some Mudbuns are grazing just outside the gate. Catch one!',
    at: g => ({ ...plantAt(g, 'land'), label: 'Mudbuns' }), now: g => { const p = plantAt(g, 'land'); return far(g, p) > 30 ? 'Walk to the arrow, outside the gate (' + far(g, p) + ' m). Hold ' + K('W') + ' and turn with the mouse.' : faintNow(g) || lassoNow(g); },
    check: g => recs(g).some(r => SP[r.sp]?.move !== 'swim' && SP[r.sp]?.move !== 'fly' && wild(r)), pay: 100 },
  { id: 'flyer', tut: true, title: 'Asleep on the beach', text: 'A Breezewing is asleep on the beach. Sneak up and catch it before it wakes up.', hint: 'Hold C the whole way. If you walk up normally it hears you and flies off. A sleeping creature is an easy catch.',
    say: 'Look, over on the beach - a Breezewing, fast asleep! Flyers are hard to catch in the air, but asleep on the ground... Hold C and creep up on it. Quietly!',
    at: g => ({ ...plantAt(g, 'fly'), label: 'Breezewing' }), now: g => { const p = plantAt(g, 'fly'), d = far(g, p); return faintNow(g) || (d > 40 ? 'Follow the arrow to the beach (' + d + ' m).' : !g.player.crouch && d > 9 && g.catching.state === 'idle' ? 'Now hold ' + K('C') + ' to sneak - ' + d + ' m to go. Do not wake it!' : lassoNow(g)); },
    check: g => recs(g).some(r => SP[r.sp]?.move === 'fly' && wild(r)), pay: 150 },
  { id: 'fish', tut: true, title: 'Something in the lagoon', text: 'Go to the dock and fish up a water creature with your Reed Rod.', hint: 'Hold LMB to cast. Wait for the float to go under, CLICK, then HOLD to reel. When it floats up fainted, press E.',
    say: 'Land, sky... and water! Plenty lives in the lagoon. Take your rod out to the end of the dock.',
    at: dockWay, now: g => faintNow(g) || (near(g, dockEnd, 14) || g.catching.state === 'fight' ? rodNow(g) : 'Follow the arrow to the end of the dock (' + far(g, dockEnd) + ' m).'),
    check: g => recs(g).some(r => isSwim(r) && wild(r)), pay: 150 },
  { id: 'job', tut: true, title: 'Put a creature to work', text: 'Send a creature home to the base and give it a job at the Ranger Station.', hint: 'Station (E) > CREATURES tab: click "Send home to the base", then click one of its jobs. Mudbuns can mine, Swiftfawns carry, Breezewings fish.',
    say: 'Creatures are not just for collecting - they help! At your base they chop, mine, farm, fish and carry. Send one home and give it a job.',
    at: () => ({ x: STATION.x, z: STATION.z + 5, label: 'Station' }), now: g => { if (g.panels?.k === 'station') return 'Click the CREATURES tab. Click "Send home to the base" next to a creature, then click one of its job buttons.'; return atStation(g) ? 'Press ' + K('E') + ' to open the Ranger Station.' : 'Follow the arrow to the Ranger Station (' + far(g, { x: STATION.x, z: STATION.z + 5 }) + ' m).'; },
    check: g => recs(g).some(r => r.at === 'zoo' && r.job), pay: 150 },
  { id: 'chop', tut: true, title: 'Gather wood', text: 'Chop a tree with your Stone Axe. Your workers will bring more to the storage yard.', hint: 'Pick the axe on your hotbar, walk up to a tree and click it a few times. Ancient trees are too big - a strong lumber creature can fell them.',
    say: 'Wood, stone, ore, crystal... you gather, your creatures gather, and everything goes to the storage yard by the plaza. Try the axe on a tree.',
    at: g => { const n = g.base?.nodes.filter(n => n.type === 'tree' && n.alive).sort((a, b) => Math.hypot(a.x - g.player.pos.x, a.z - g.player.pos.z) - Math.hypot(b.x - g.player.pos.x, b.z - g.player.pos.z))[0]; return n && { x: n.x, z: n.z, label: 'Tree' }; },
    now: g => holding(g, 'util') && g.tools.id === 'axe' ? 'Walk right up to a tree (follow the arrow) and CLICK to chop. A few hits and it falls.' : 'Press ' + K(slotOf(g, 'tool:axe') || '4') + ' to take out your axe.',
    check: g => (g.W.stats.got_wood || 0) >= 3, pay: 100 },
  { id: 'sell', tut: true, title: 'Make some money', text: 'Sell some of what you gathered at the Ranger Station.', hint: 'Station (E) > SELL tab. Money buys better rods, ropes, bait and tools.',
    say: 'Sell what you do not need - money buys better ropes, rods and gear, and better gear catches bigger creatures.',
    at: () => ({ x: STATION.x, z: STATION.z + 5, label: 'Station' }), now: g => g.panels?.k === 'station' ? 'Click the SELL tab, then click a price button.' : atStation(g) ? 'Press ' + K('E') + ' to open the Ranger Station.' : 'Follow the arrow to the Ranger Station (' + far(g, { x: STATION.x, z: STATION.z + 5 }) + ' m).',
    check: g => (g.W.stats.sold || 0) >= 1, pay: 100 },
  { id: 'shelly', tut: true, title: 'Shelly the Isleback', text: 'Shelly is on your team. Stand at the end of the dock and call her from the hotbar, then press E to climb on.', hint: 'Sea creatures can only be called in water deep enough to swim.',
    say: 'One last thing - meet Shelly, my old Isleback. She carries a little island on her shell and she will carry you anywhere on the water. Call her at the end of the dock and climb aboard!',
    at: dockWay, now: g => { const sh = recs(g).find(r => r.gift && r.sp === 'archelon'), k = sh && slotOf(g, 'cr:' + sh.uid); const c = g.riding.c; if (c?.spId === 'archelon') return 'Walk up to Shelly in the water and press ' + K('E') + ' to climb on her back.'; if (!near(g, dockEnd, 12)) return 'Walk to the end of the dock (' + far(g, dockEnd) + ' m). Shelly needs deep water.'; return 'Press ' + K(k || 'her hotbar number') + ' to call Shelly. Then press ' + K('E') + ' near her to climb on.'; },
    check: g => g.player.mount?.spId === 'archelon' || [...g.remotes.values()].some(R => R.st?.m?.sp === 'archelon'), pay: 100 },
  { id: 'cross', tut: true, title: 'Into the world', text: 'Ride Shelly north across the lagoon to the Fernvale Shore. From there, the world is yours.', hint: 'W to swim where you look. Every land has its own creatures - and the further from home, the rarer they get.',
    say: 'North is the Fernvale Shore. Beyond it the jungle, east the mountains, south the swamp, west the open sea - and creatures in every one of them. Find them. Catch them. Bring them home. Good luck, ranger!',
    at: () => ({ x: 0, z: -560, label: 'Fernvale' }), now: g => (g.player.mount ? 'Hold ' + K('W') + ' to swim the way you are looking. Follow the arrow north' : 'Get back on Shelly (' + K('E') + ' near her), then follow the arrow north') + ' - ' + far(g, { x: 0, z: -560 }) + ' m to the far shore.', check: g => g.players().some(p => p.pos.z < -505 && Math.abs(p.pos.x) < 420 && g.terrain.ground(p.pos.x, p.pos.z) > -0.5), pay: 200 },
  // ---- after the tutorial
  { id: 'crew', title: 'A working base', text: 'Have three creatures working at your base.', hint: 'Catch creatures with jobs, send them home, give them a job at the Ranger Station (Creatures tab).', check: g => recs(g).filter(r => r.at === 'zoo' && r.job).length >= 3, pay: 400 },
  { id: 'star1', title: 'A real collection', text: 'Reach base level 1 (catch 4 different species).', hint: 'Every new species counts. Rarer ones count more.', check: g => (g.W.zooLevel || 0) >= 1, pay: 500 },
  { id: 'beacon', title: 'Light the way', text: 'Find a Ranger Beacon out in the wild and light it (E).', hint: 'They are tall towers with red roofs, on the far shores of the lagoon and beyond.', check: g => Object.keys(g.W.beacons).length >= 1, pay: 300 },
  { id: 'five', title: 'Collector', text: 'Catch 5 different species.', hint: 'Different regions, different creatures. Scan with the Binoculars (hold RMB) to see what they are.', check: g => new Set(recs(g).filter(wild).map(r => r.sp)).size >= 5, pay: 1000 },
  { id: 'places', title: 'Explorer', text: 'Discover 5 named places.', hint: 'Look for strange shapes on the horizon - giant bones, temples, glowing towers.', check: g => PLACES.filter(p => g.W.flags['seen:' + p.id]).length >= 5, pay: 800 },
  { id: 'big', title: 'Something BIG', text: 'Hook a large sea creature with a rod.', hint: 'A Bone Rod and fish bait, out where the water is deep. Big shadows mean big fish.', check: g => recs(g).some(r => isSwim(r) && wild(r) && ['L', 'XL'].includes(SP[r.sp].size)), pay: 1500 },
  { id: 'flyer', title: 'Sky catcher', text: 'Catch a flying creature.', hint: 'The Snare Net or the Bola Sling can catch fliers. A Sky Hook is best - from the back of a flyer.', check: g => recs(g).some(r => SP[r.sp].move === 'fly'), pay: 1500 },
  { id: 'gate', title: 'The way is shut', text: 'Smash a boulder pile or cut through a vine curtain.', hint: 'A Bonkbeak or a Bramblehorn can smash (F). A Machete cuts vines. Some piles are underwater - a ramming sea creature breaks those.', check: g => Object.keys(g.W.gates).length >= 1, pay: 1200 },
  { id: 'star3', title: 'Creature Sanctuary', text: 'Reach base level 3.', hint: 'Catch more species - rare ones count far more than common ones.', check: g => (g.W.zooLevel || 0) >= 3, pay: 3000 },
  { id: 'epic', title: 'Something huge', text: 'Catch an Epic creature.', hint: 'Rumblemaw, Riversail, Tidewyrm, Cloudking, Lumenfox... far from home, with strong rope.', check: g => recs(g).some(r => RARITY[SP[r.sp].rarity].stars >= 4 && wild(r)), pay: 5000 },
  { id: 'legend', title: 'Legend', text: 'Catch a Legendary creature.', hint: 'Frostmaw in the Whiteout, Stormwing in a thunderstorm, Grimfin over the Trench.', check: g => recs(g).some(r => RARITY[SP[r.sp].rarity].stars >= 5), pay: 15000 },
  { id: 'half', title: 'Half the book', text: 'Catch half of all species in your Collection.', hint: 'Check the Dex (J) for hints on where each one lives.', check: g => Object.values(g.W.dex).filter(d => d.caught).length >= Math.ceil(SPECIES.length / 2), pay: 20000 },
  { id: 'myth', title: 'Myth', text: 'Catch a Mythic creature.', hint: 'Some say the Temple Vault tells you how.', check: g => recs(g).some(r => SP[r.sp].rarity === 'mythic'), pay: 50000 },
];
export const TUT_END = QUESTS.findIndex(q => !q.tut);

/* ---- "DO THIS NOW": one plain instruction for this very moment ---- */
const K = k => '[' + k + ']';
const far = (g, p) => Math.round(Math.hypot(p.x - g.player.pos.x, p.z - g.player.pos.z));
const holding = (g, kind) => (TOOLS[g.tools.id]?.kind === kind);
function slotOf(g, id) { const i = (g.profile.hotbar || []).indexOf(id); return i < 0 ? null : String((i + 1) % 10); }
function rodNow(g) {
  const F = g.fishing.state, C = g.catching;
  if (C.state === 'fight') return 'HOLD the left mouse button to reel in. Keep the fish picture inside the white box on the right. Let go when it goes too high.';
  if (!holding(g, 'rod')) return 'Press ' + K(slotOf(g, 'tool:reedrod') || '2') + ' to take out your fishing rod.';
  if (F === 'charge') return 'Now LET GO of the mouse button to cast!';
  if (F === 'fly' || F === 'wait') return 'Wait and watch the red float... do not click yet.';
  if (F === 'nibble') return 'Something is nibbling... NOT YET! Wait until it goes under.';
  if (F === 'bite') return 'CLICK NOW!';
  if (F === 'reel') return 'Reeling the float back in...';
  return 'Face the water. HOLD the left mouse button, then LET GO to cast your float.';
}
function lassoNow(g) {
  const C = g.catching;
  if (C.state === 'fight') return 'HOLD the left mouse button to pull. Keep the creature picture inside the white box on the right. If a red arrow says BRACE, press that key (A or D).';
  if (C.state === 'snare') return 'CLICK when the white ring is inside the green circle (it says NOW!).';
  if (C.state === 'charge') return 'Aim at the creature and LET GO to throw!';
  if (C.state === 'fly') return 'The rope is flying...';
  if (!holding(g, 'catch')) return 'Press ' + K(slotOf(g, 'tool:rope') || '1') + ' to take out your lasso.';
  if (g.tools.assist) return 'Get within about 15 steps of it, then HOLD the left mouse button to spin the rope.' + (g.player.crouch ? '' : ' (Hold ' + K('C') + ' to sneak closer.)');
  return 'Find a creature and point the middle of your screen at it. Hold ' + K('C') + ' to sneak.';
}
const atStation = g => far(g, { x: STATION.x, z: STATION.z + 5 }) < 7;
const stationNow = (g, what) => g.ui.panel === 'station' || g.panels?.k === 'station'
  ? 'Click the ANIMALS tab at the top. Next to your ' + what + ', click the ' + (what === 'fish' ? 'Lagoon Tank' : 'Meadow Pen') + ' button.'
  : atStation(g) ? 'Press ' + K('E') + ' to open the Ranger Station.'
  : 'Follow the arrow to the Ranger Station (the wooden cabin) - ' + far(g, { x: STATION.x, z: STATION.z + 5 }) + ' m.';

/** the spots where the tutorial plants its creatures */
const PLANT_LAND = { x: 82, z: 32 };
function plantAt(g, k) {
  if (k === 'land') return PLANT_LAND;
  if (!plantAt._fly) {   // a stretch of beach on the east of the island
    for (let r = 200; r < 260; r += 2) { const a = 1.05, x = Math.sin(a) * r, z = Math.cos(a) * r, h = g.terrain.ground(x, z); if (h > 0.4 && h < 2.6) plantAt._fly = { x, z }; }
    plantAt._fly ||= { x: 190, z: 110 };
  }
  return plantAt._fly;
}
const faintNow = g => g.catching.state === 'faint' ? 'It fainted! Press [E] to catch it - or [Q] to let it go.' : null;

function near(g, p, r) { return g.players().some(q => Math.hypot(q.pos.x - p.x, q.pos.z - p.z) < r); }

export class Quests {
  constructor(game) {
    this.g = game; this.saidFor = -1;
    // the waypoint arrow
    const m = new THREE.MeshBasicMaterial({ color: '#ffd040', fog: false, depthTest: false, transparent: true, opacity: 0.92 });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.4, 4).rotateX(Math.PI), m);
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), m); stem.position.y = 2;
    this.arrow = new THREE.Group(); this.arrow.add(cone, stem); this.arrow.renderOrder = 10; this.arrow.visible = false;
    cone.renderOrder = stem.renderOrder = 10;
    game.scene.add(this.arrow);
  }
  get W() { return this.g.W; }
  get current() { return QUESTS[this.W.quest] || null; }
  get inTutorial() { return (this.W?.quest ?? 99) < TUT_END; }
  update(dt = 0.016) {
    const G = this.g, Q = this.current;
    // the professor speaks when a tutorial step starts (every client)
    if (Q && this.W.quest !== this.saidFor && G.phase === 'play') {
      this.saidFor = this.W.quest;
      if (Q.say) G.ui.say?.('Professor Bramble', Q.say);
    }
    this._arrow(dt);
    if (!Q || !G.isHost) return;
    if (Q.id === 'shelly') this._gift();
    if (Q.id === 'land' || Q.id === 'flyer') this._plant(Q.id);
    if (Q.check(G)) {
      this.W.quest++;
      if (Q.pay) G.earn(Q.pay, null, false, 'Quest');
      G.event({ k: 'quest', title: Q.title, pay: Q.pay });
      G.saveSoon();
    }
  }
  /** keep the tutorial's creatures where they should be */
  _plant(id) {
    const G = this.g, P = this.planted ||= {};
    if ((this._plantT = (this._plantT || 0) - 1 / 30) > 0) return; this._plantT = 3;
    const alive = ids => (ids || []).filter(i => { const c = G.wild.byId.get(i); return c && !c.gone; });
    if (id === 'land') {
      P.land = alive(P.land);
      const p = plantAt(G, 'land');
      while (P.land.length < 3) {
        const x = p.x + (Math.random() - 0.5) * 14, z = p.z + (Math.random() - 0.5) * 14;
        const c = G.wild.add({ sp: 'proto', x, z, y: G.terrain.ground(x, z), size: 0.35 + Math.random() * 0.3 });
        c.ai.st = 'eat'; c.ai.t = 30; c.event = 'tut'; c.ai.home.set(p.x, 0, p.z); c.ai.homeR = 10;
        P.land.push(c.id);
      }
    } else {
      P.fly = alive(P.fly);
      if (!P.fly.length && !G.catching.busy) {
        const p = plantAt(G, 'fly');
        const c = G.wild.add({ sp: 'ptera', x: p.x, z: p.z, y: G.terrain.ground(p.x, p.z), size: 0.45 });
        c.flying = false; c.ai.st = 'sleep'; c.ai.t = 1e9; c.astate = 'sleep'; c.event = 'tut';
        P.fly.push(c.id);
      }
    }
  }
  /** Shelly the Archelon, delivered to the host's crate */
  _gift() {
    const G = this.g, W = this.W;
    if (W.flags.giftShelly) return;
    W.flags.giftShelly = 1;
    const r = creatureRecord('archelon', { size: 0.45, kg: 900, name: 'Shelly', at: 'pack:' + G.packKey });
    r.gift = true;
    W.creatures[r.uid] = r;
    W.dex.archelon ||= { seen: 1, caught: 0 }; W.dex.archelon.seen ||= 1;
    G.event({ k: 'banner', t: 'A GIFT: SHELLY THE ISLEBACK', s: 'She is on your team - call her in deep water.', kind: 'good' });
    G.saveSoon();
  }
  /** end the tutorial now (pause menu) */
  skip() {
    const G = this.g, W = this.W;
    if (!this.inTutorial) return;
    if (W.quest <= QUESTS.findIndex(q => q.id === 'shelly')) this._gift();
    W.quest = TUT_END;
    G.event({ k: 'toast', t: 'Tutorial skipped. Professor Bramble waves goodbye.', kind: 'info' });
    G.saveSoon();
  }
  /** where the current quest wants you to go */
  waypoint() {
    const Q = this.current;
    if (!Q?.at || this.g.inInterior) return null;
    return Q.at(this.g) || null;
  }
  _arrow(dt) {
    const p = this.g.phase === 'play' ? this.waypoint() : null, A = this.arrow;
    if (!p) { A.visible = false; return; }
    const P = this.g.player.pos, d = Math.hypot(p.x - P.x, p.z - P.z);
    A.visible = d > 6;
    this._t = (this._t || 0) + dt;
    const y = Math.max(0, this.g.terrain.ground(p.x, p.z));
    const s = Math.max(1, d / 40);
    A.scale.setScalar(s);
    A.position.set(p.x, y + 5 * s + Math.sin(this._t * 3) * 0.6 * s, p.z);
    A.rotation.y += dt * 1.5;
  }
  /** what to show in the objective box */
  objective() {
    const Q = this.current;
    if (Q) { let now = null; try { now = Q.now?.(this.g) || null; } catch (e) { now = null; } return { title: (Q.tut ? 'Tutorial ' + (this.W.quest + 1) + '/' + TUT_END + ': ' : '') + Q.title, text: Q.text, hint: Q.hint, now }; }
    // after the chain: point at something you have not caught
    const miss = SPECIES.filter(s => !this.W.dex[s.id]?.caught);
    if (!miss.length) return { title: 'Every creature caught!', text: 'You have found every creature in the world. Every single one. Professor Bramble is speechless.' };
    const i = Math.floor((this.g.W.day || 1) * 7 + Object.keys(this.W.dex).length) % miss.length, s = miss[i];
    return { title: 'Dex: ' + (this.W.dex[s.id]?.seen ? s.name : '???'), text: s.hint, hint: RARITY[s.rarity].name + ' - ' + miss.length + ' species left to catch' };
  }
}
void BEACONS; void HOME;
