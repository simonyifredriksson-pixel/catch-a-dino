/* Quests.js - the path through the game.

   The first few teach the loop in a few minutes (ride -> catch -> bring home
   -> put on show -> build), the rest point at the big things to work toward.
   Each quest listens for bus events and/or checks the save; done quests pay.
   After the chain, the objective panel keeps suggesting a species you have
   not caught yet, with its dex hint. ADDING A QUEST: add an entry. */
import { Bus } from '../core/Bus.js';
import { SPECIES, SP, RARITY } from '../data/Species.js';
import { PLACES, BEACONS } from '../data/Places.js';

export const QUESTS = [
  { id: 'ride', title: 'Saddle up', text: 'Hop on Sprinkles the Dryosaurus: press 2 (or click its hotbar slot).', hint: 'SHIFT to sprint, SPACE to jump, E to get off.', on: 'mount:on', pay: 100 },
  { id: 'catch1', title: 'Catch your first dinosaur', text: 'Hold the Rope Lasso (1). Hold LMB to spin, release to throw at a creature on the meadow.', hint: 'When the ring shrinks, CLICK while it is in the green band. Then HOLD LMB to keep its head in your loop, and press the opposite key (A/D) when it lunges.', on: 'catch:landed', pay: 200 },
  { id: 'home', title: 'Bring it home', text: 'Ride back to the zoo and unload your crate at the Ranger Station (E).', hint: 'The zoo is marked on your compass.', check: g => Object.values(g.W.creatures).some(r => r.at === 'zoo' || (r.at.startsWith('ex:') && !['compy'].includes(r.sp))), pay: 200 },
  { id: 'show', title: 'Put it on show', text: 'Walk to the Meadow Pen gate and press E to move your new animal in.', hint: 'Happy animals in the right habitat pull more visitors.', check: g => Object.values(g.W.creatures).filter(r => r.at.startsWith('ex:')).length >= 3, pay: 300 },
  { id: 'build', title: 'Build an exhibit', text: 'Press B at the zoo and build a new exhibit for your next catch.', hint: 'Match the habitat to the species - the card in the build menu says who likes it.', check: g => g.W.zoo.exhibits.length >= 2, pay: 400 },
  { id: 'star1', title: 'A real zoo', text: 'Reach zoo star level 1 (appeal 15).', hint: 'More animals, happier animals, rarer animals. Decor helps a little.', check: g => (g.W.zooLevel || 0) >= 1, pay: 500 },
  { id: 'beacon', title: 'Light the way', text: 'Find a Ranger Beacon out in the wild and light it (E).', hint: 'They are tall towers with red roofs, at the edge of every region.', check: g => Object.keys(g.W.beacons).length >= 1, pay: 300 },
  { id: 'five', title: 'Collector', text: 'Catch 5 different species.', hint: 'Different regions, different creatures. Scan with the Binoculars (hold RMB) to see what they are.', check: g => Object.values(g.W.dex).filter(d => d.caught).length >= 5, pay: 1000 },
  { id: 'places', title: 'Explorer', text: 'Discover 5 named places.', hint: 'Look for strange shapes on the horizon - giant bones, temples, glowing towers.', check: g => PLACES.filter(p => g.W.flags['seen:' + p.id]).length >= 6, pay: 800 },
  { id: 'flyer', title: 'Sky catcher', text: 'Catch a flying creature.', hint: 'The Snare Net or the Bola Sling can catch fliers. A Sky Hook is best - from the back of a flyer.', check: g => Object.values(g.W.creatures).some(r => SP[r.sp].move === 'fly') , pay: 1500 },
  { id: 'gate', title: 'The way is shut', text: 'Smash a boulder pile or cut through a vine curtain.', hint: 'A Pachycephalosaurus or a Triceratops can smash (F). A Machete cuts vines.', check: g => Object.keys(g.W.gates).length >= 1, pay: 1200 },
  { id: 'sea', title: 'Into the blue', text: 'Catch a sea creature.', hint: 'Buy the Tether Harpoon. An Archelon is a good first boat - catch one off Sunbeach Coast.', check: g => Object.values(g.W.creatures).some(r => SP[r.sp].move === 'swim'), pay: 2000 },
  { id: 'star3', title: 'Dino Park', text: 'Reach zoo star level 3.', hint: 'Big, rare and happy animals are what visitors cross the world for.', check: g => (g.W.zooLevel || 0) >= 3, pay: 3000 },
  { id: 'epic', title: 'Something big', text: 'Catch an Epic creature.', hint: 'T-Rex, Spinosaurus, Mosasaurus, Quetzalcoatlus... you will need strong rope.', check: g => Object.values(g.W.creatures).some(r => RARITY[SP[r.sp].rarity].stars >= 4), pay: 5000 },
  { id: 'legend', title: 'Legend', text: 'Catch a Legendary creature.', hint: 'Frostmaw in the Whiteout, Stormwing in a thunderstorm, Megalodon over the Trench.', check: g => Object.values(g.W.creatures).some(r => RARITY[SP[r.sp].rarity].stars >= 5), pay: 15000 },
  { id: 'half', title: 'Half the book', text: 'Catch half of all species in the Dino Dex.', hint: 'Check the Dex (J) for hints on where each one lives.', check: g => Object.values(g.W.dex).filter(d => d.caught).length >= Math.ceil(SPECIES.length / 2), pay: 20000 },
  { id: 'myth', title: 'Myth', text: 'Catch a Mythic creature.', hint: 'Some say the Temple Vault tells you how.', check: g => Object.values(g.W.creatures).some(r => SP[r.sp].rarity === 'mythic'), pay: 50000 },
];

export class Quests {
  constructor(game) {
    this.g = game; this.hits = new Set();
    for (const Q of QUESTS) if (Q.on) Bus.on(Q.on, () => this.hits.add(Q.id));
  }
  get W() { return this.g.W; }
  get current() { return QUESTS[this.W.quest] || null; }
  update() {
    const Q = this.current; if (!Q || !this.g.isHost) return;
    const ok = (Q.on && this.hits.has(Q.id)) || (Q.check && Q.check(this.g));
    if (ok) {
      this.W.quest++;
      this.hits.clear();
      this.g.earn(Q.pay, null, false, 'Quest');
      this.g.event({ k: 'quest', title: Q.title, pay: Q.pay });
      this.g.saveSoon();
    }
  }
  /** what to show in the objective box */
  objective() {
    const Q = this.current;
    if (Q) return { title: Q.title, text: Q.text, hint: Q.hint };
    // after the chain: point at something you have not caught
    const miss = SPECIES.filter(s => !this.W.dex[s.id]?.caught);
    if (!miss.length) return { title: 'Every creature caught!', text: 'You are the greatest dino keeper who ever lived. Now go and make them all happy.' };
    const i = Math.floor((this.g.W.day || 1) * 7 + Object.keys(this.W.dex).length) % miss.length, s = miss[i];
    return { title: 'Dex: ' + (this.W.dex[s.id]?.seen ? s.name : '???'), text: s.hint, hint: RARITY[s.rarity].name + ' - ' + miss.length + ' species left to catch' };
  }
}
void BEACONS;
