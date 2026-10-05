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
  { id: 'dock', tut: true, title: 'Down to the water', text: 'Walk to the end of the dock, south of the zoo.', hint: 'Follow the arrow. WASD to walk, SHIFT to sprint. Fell in? Swim to the pier and press SPACE to climb up.',
    say: 'Welcome to Home Island, ranger! I am Professor Bramble. Your zoo is small, but the world out there is full of creatures. Let us start at the water - meet me on the dock.',
    at: dockWay, now: g => { const w = dockWay(g); return 'Hold ' + K('W') + ' to walk. Turn with the mouse so you face the yellow arrow. ' + (w === dockEnd ? 'Walk to the end of the dock' : 'The dock') + ' is ' + far(g, w) + ' m away.'; },
    check: g => near(g, dockEnd, 9), pay: 50 },
  { id: 'fish', tut: true, title: 'Something in the lagoon', text: 'Pick the Reed Rod (2). Hold LMB to charge, release to cast. Wait for a bite, then CLICK right away.', hint: 'Then HOLD LMB to reel and keep the fish in the green zone. Watch for shadows and bubbles - fish are where the signs are.',
    say: 'The Glass Lagoon is full of life. Cast your rod, wait for the float to bob - and when it dips, click! Small fish come easy. Big ones... you will know.',
    at: dockWay, now: g => near(g, dockEnd, 14) || g.catching.state === 'fight' ? rodNow(g) : 'Go back out to the end of the dock (' + far(g, dockEnd) + ' m) and fish there.',
    check: g => recs(g).some(r => isSwim(r) && wild(r)), pay: 150 },
  { id: 'unload', tut: true, title: 'Bring it home', text: 'Take your fish to the Ranger Station and put it in the Lagoon Tank.', hint: 'At the station: press E, click ANIMALS, then click Lagoon Tank next to your fish.', now: g => stationNow(g, 'fish'),
    say: 'A fine catch! Take it to the Ranger Station - that is where your animals, the shop and the upgrades are.',
    at: () => ({ x: STATION.x, z: STATION.z + 5, label: 'Station' }), check: g => recs(g).some(r => isSwim(r) && wild(r) && !r.at.startsWith('pack:')), pay: 100 },
  { id: 'tank', tut: true, title: 'Into the tank', text: 'Put your fish in the Lagoon Tank.', hint: 'At the Ranger Station (E), ANIMALS tab: click Lagoon Tank next to your fish.', now: g => stationNow(g, 'fish'),
    say: 'Now put it on show. The Lagoon Tank is right there on the east side.',
    at: () => ({ x: STATION.x, z: STATION.z + 5, label: 'Station' }), check: g => recs(g).some(r => isSwim(r) && wild(r) && r.at.startsWith('ex:')), pay: 200 },
  { id: 'income', tut: true, title: 'Your zoo earns money', text: 'Look at the top right: your zoo pays you every few seconds. Rarer, happier animals pay more.', hint: 'Wait for the next payout.', now: () => 'Just wait a few seconds and watch your money (top right) go up. The zoo earns by itself!',
    say: 'See that? Every animal on show earns your zoo money, all by itself. The rarer and happier, the more. Now - I have a gift for you.',
    check: g => g.W.stats.zooPaid >= 2, pay: 0 },
  { id: 'shelly', tut: true, title: 'Shelly the Archelon', text: 'Shelly is in your crate. Stand at the end of the dock and summon her from the hotbar, then press E to climb on.', hint: 'Sea creatures can only be summoned in water deep enough to swim.',
    say: 'This is Shelly, my old Archelon. She is slow, but she swims anywhere. Call her at the end of the dock and climb aboard!',
    at: dockWay, now: g => { const sh = recs(g).find(r => r.gift && r.sp === 'archelon'), k = sh && slotOf(g, 'cr:' + sh.uid); const c = g.riding.c; if (c?.spId === 'archelon') return 'Walk up to Shelly in the water and press ' + K('E') + ' to climb on her back.'; if (!near(g, dockEnd, 12)) return 'Walk to the end of the dock (' + far(g, dockEnd) + ' m). Shelly needs deep water.'; return 'Press ' + K(k || 'her hotbar number') + ' to call Shelly. Then press ' + K('E') + ' near her to climb on.'; },
    check: g => g.player.mount?.spId === 'archelon' || [...g.remotes.values()].some(R => R.st?.m?.sp === 'archelon'), pay: 100 },
  { id: 'cross', tut: true, title: 'Across the lagoon', text: 'Ride Shelly north across the lagoon to the Fernvale Shore.', hint: 'W to swim where you look, SPACE up, CTRL down. Rivers lead inland from every shore.',
    say: 'North is the Fernvale Shore - easy dinosaurs, perfect for a first lasso. Beyond it the jungle, east the mountains, south the swamp, west the open sea. The farther you go, the rarer it gets.',
    at: () => ({ x: 0, z: -560, label: 'Fernvale' }), now: g => (g.player.mount ? 'Hold ' + K('W') + ' to swim the way you are looking. Follow the arrow north' : 'Get back on Shelly (' + K('E') + ' near her), then follow the arrow north') + ' - ' + far(g, { x: 0, z: -560 }) + ' m to the far shore.', check: g => g.players().some(p => p.pos.z < -505 && Math.abs(p.pos.x) < 420 && g.terrain.ground(p.pos.x, p.pos.z) > -0.5), pay: 150 },
  { id: 'lasso', tut: true, title: 'Rope a dinosaur', text: 'Hold the Rope Lasso (1). Hold LMB to spin, release to throw. CLICK when the ring is in the green band, then HOLD to pull.', hint: 'Hold C to sneak: they notice you later, and the snare ring is easier. Press the opposite key (A/D) when it lunges.',
    say: 'Here is a trick: hold C and creep up on them. A dino that does not see you coming is much easier to snare.',
    now: g => g.player.mount ? 'Swim to the beach, then press ' + K('E') + ' to get off Shelly. Then catch a dinosaur.' : lassoNow(g),
    check: g => recs(g).some(r => SP[r.sp]?.move === 'walk' && wild(r)), pay: 250 },
  { id: 'pen', tut: true, title: 'The Meadow Pen', text: 'Bring it home and put it in the Meadow Pen.', hint: 'Ride Shelly back across the water. At the Ranger Station (E), ANIMALS tab: click Meadow Pen next to your dino.', now: g => { const big = recs(g).find(r => SP[r.sp]?.move === 'walk' && wild(r) && r.at === 'zoo' && !['S', 'M'].includes(SP[r.sp].size)); if (big) return 'That one is too big for the Meadow Pen! Leave it in the holding pen and catch a small dino (Compy, Protoceratops or Dryosaurus).'; return Math.hypot(g.player.pos.x, g.player.pos.z) > 260 ? 'Ride Shelly back home across the water (follow the arrow, ' + far(g, { x: STATION.x, z: STATION.z }) + ' m).' : stationNow(g, 'dino'); },
    say: 'Splendid! Ride home and give it a place in the Meadow Pen.',
    at: () => ({ x: STATION.x, z: STATION.z + 5, label: 'Station' }), check: g => recs(g).some(r => SP[r.sp]?.move === 'walk' && wild(r) && r.at.startsWith('ex:')), pay: 300 },
  { id: 'buy', tut: true, title: 'Gear up', text: 'Buy something at the Ranger Station: bait, a better rod, or a new tool.', hint: 'Fish bait brings bigger bites. A Bone Rod can hold things that would snap a reed.', now: g => g.ui.panel === 'station' || g.panels?.k === 'station' ? 'In the SHOP tab, scroll down to Bait and click a price button to buy something.' : atStation(g) ? 'Press ' + K('E') + ' to open the Ranger Station.' : 'Follow the arrow to the Ranger Station - ' + far(g, { x: STATION.x, z: STATION.z + 5 }) + ' m.',
    say: 'Money comes in, gear goes out. Better rods, ropes and bait let you catch bigger, rarer things. That is all I can teach you - the rest is out there. Good luck, ranger!',
    at: () => ({ x: STATION.x, z: STATION.z + 5, label: 'Station' }), check: g => (g.W.stats.bought || 0) >= 1, pay: 300 },
  // ---- after the tutorial
  { id: 'build', title: 'Build an exhibit', text: 'Press B at the zoo and build a new exhibit for your next catch.', hint: 'Match the habitat to the species - the card in the build menu says who likes it.', check: g => g.W.zoo.exhibits.length >= 3, pay: 400 },
  { id: 'star1', title: 'A real zoo', text: 'Reach zoo star level 1 (income $35/min).', hint: 'More animals, happier animals, rarer animals.', check: g => (g.W.zooLevel || 0) >= 1, pay: 500 },
  { id: 'beacon', title: 'Light the way', text: 'Find a Ranger Beacon out in the wild and light it (E).', hint: 'They are tall towers with red roofs, on the far shores of the lagoon and beyond.', check: g => Object.keys(g.W.beacons).length >= 1, pay: 300 },
  { id: 'five', title: 'Collector', text: 'Catch 5 different species.', hint: 'Different regions, different creatures. Scan with the Binoculars (hold RMB) to see what they are.', check: g => new Set(recs(g).filter(wild).map(r => r.sp)).size >= 5, pay: 1000 },
  { id: 'places', title: 'Explorer', text: 'Discover 5 named places.', hint: 'Look for strange shapes on the horizon - giant bones, temples, glowing towers.', check: g => PLACES.filter(p => g.W.flags['seen:' + p.id]).length >= 5, pay: 800 },
  { id: 'big', title: 'Something BIG', text: 'Hook a large sea creature with a rod.', hint: 'A Bone Rod and fish bait, out where the water is deep. Big shadows mean big fish.', check: g => recs(g).some(r => isSwim(r) && wild(r) && ['L', 'XL'].includes(SP[r.sp].size)), pay: 1500 },
  { id: 'flyer', title: 'Sky catcher', text: 'Catch a flying creature.', hint: 'The Snare Net or the Bola Sling can catch fliers. A Sky Hook is best - from the back of a flyer.', check: g => recs(g).some(r => SP[r.sp].move === 'fly'), pay: 1500 },
  { id: 'gate', title: 'The way is shut', text: 'Smash a boulder pile or cut through a vine curtain.', hint: 'A Pachycephalosaurus or a Triceratops can smash (F). A Machete cuts vines. Some piles are underwater - a ramming sea beast breaks those.', check: g => Object.keys(g.W.gates).length >= 1, pay: 1200 },
  { id: 'star3', title: 'Dino Park', text: 'Reach zoo star level 3.', hint: 'Big, rare and happy animals earn the most.', check: g => (g.W.zooLevel || 0) >= 3, pay: 3000 },
  { id: 'epic', title: 'Something huge', text: 'Catch an Epic creature.', hint: 'T-Rex, Spinosaurus, Mosasaurus, Quetzalcoatlus... far from home, with strong rope.', check: g => recs(g).some(r => RARITY[SP[r.sp].rarity].stars >= 4 && wild(r)), pay: 5000 },
  { id: 'legend', title: 'Legend', text: 'Catch a Legendary creature.', hint: 'Frostmaw in the Whiteout, Stormwing in a thunderstorm, Megalodon over the Trench.', check: g => recs(g).some(r => RARITY[SP[r.sp].rarity].stars >= 5), pay: 15000 },
  { id: 'half', title: 'Half the book', text: 'Catch half of all species in the Dino Dex.', hint: 'Check the Dex (J) for hints on where each one lives.', check: g => Object.values(g.W.dex).filter(d => d.caught).length >= Math.ceil(SPECIES.length / 2), pay: 20000 },
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
  if (C.state === 'fight') return 'HOLD the left mouse button to pull. Keep the dino picture inside the white box on the right. If a red arrow says BRACE, press that key (A or D).';
  if (C.state === 'snare') return 'CLICK when the white ring is inside the green circle (it says NOW!).';
  if (C.state === 'charge') return 'Aim at the dino and LET GO to throw!';
  if (C.state === 'fly') return 'The rope is flying...';
  if (!holding(g, 'catch')) return 'Press ' + K(slotOf(g, 'tool:rope') || '1') + ' to take out your lasso.';
  if (g.tools.assist) return 'Get within about 15 steps of it, then HOLD the left mouse button to spin the rope.' + (g.player.crouch ? '' : ' (Hold ' + K('C') + ' to sneak closer.)');
  return 'Find a small dinosaur on this shore and point the middle of your screen at it. Hold ' + K('C') + ' to sneak.';
}
const atStation = g => far(g, { x: STATION.x, z: STATION.z + 5 }) < 7;
const stationNow = (g, what) => g.ui.panel === 'station' || g.panels?.k === 'station'
  ? 'Click the ANIMALS tab at the top. Next to your ' + what + ', click the ' + (what === 'fish' ? 'Lagoon Tank' : 'Meadow Pen') + ' button.'
  : atStation(g) ? 'Press ' + K('E') + ' to open the Ranger Station.'
  : 'Follow the arrow to the Ranger Station (the wooden cabin) - ' + far(g, { x: STATION.x, z: STATION.z + 5 }) + ' m.';

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
    if (Q.check(G)) {
      this.W.quest++;
      if (Q.pay) G.earn(Q.pay, null, false, 'Quest');
      G.event({ k: 'quest', title: Q.title, pay: Q.pay });
      G.saveSoon();
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
    G.event({ k: 'banner', t: 'A GIFT: SHELLY THE ARCHELON', s: 'She is in your crate - summon her in deep water.', kind: 'good' });
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
    if (!miss.length) return { title: 'Every creature caught!', text: 'You are the greatest dino keeper who ever lived. Now go and make them all happy.' };
    const i = Math.floor((this.g.W.day || 1) * 7 + Object.keys(this.W.dex).length) % miss.length, s = miss[i];
    return { title: 'Dex: ' + (this.W.dex[s.id]?.seen ? s.name : '???'), text: s.hint, hint: RARITY[s.rarity].name + ' - ' + miss.length + ' species left to catch' };
  }
}
void BEACONS; void HOME;
