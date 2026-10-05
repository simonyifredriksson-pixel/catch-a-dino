/* Species.js - every creature in the game.

   ADDING A CREATURE: append an entry to SPECIES. Everything else (art,
   animation, spawning, catching, riding, the zoo, the dex) reads from here.

   id, name, sci      names
   rarity             common | uncommon | rare | epic | legendary | mythic
   size               S (fits in one crate slot) | M | L | XL - also the exhibit size it needs
   move               walk | fly | swim | amph (walks and swims)
   habitat            the exhibit habitat it is happy in (see data/Build.js)
   diet               herb | carn | fish | omni   (which bait it takes)
   temper             skittish (runs) | calm | territorial (warns, then charges) | aggressive (hunts you)
   where              biome ids it spawns in
   when               {night, day, storm, event, den}  optional spawn conditions
   herd               [min, max] group size
   ride               false for creatures too small to ride
   speed              walk / run (m/s) for riding and AI;  turn (rad/s);  jump (m/s up)
   fight              how hard it fights on the rope (compared with a tool's rating)
   erratic, power     how it moves on the catch bar / how hard it tows you
   appeal             base zoo appeal (visitors per minute it is worth)
   abilities          ids from data/Abilities.js - what it lets YOU do when ridden
   body               proportions for the body plan (art/CreatureArt.js)
   cols               colours: top, belly, accent, pattern, patCol, glow...
   kg                 [min, max] adult weight
   lore               one line for the dex
   hint               how to find it (shown in the dex before you catch one) */

export const RARITY = {
  common:    { name: 'Common',    css: '#c8d0d8', stars: 1, w: 100, value: 1 },
  uncommon:  { name: 'Uncommon',  css: '#6ee07a', stars: 2, w: 40, value: 2.2 },
  rare:      { name: 'Rare',      css: '#4ab0ff', stars: 3, w: 12, value: 5 },
  epic:      { name: 'Epic',      css: '#c070ff', stars: 4, w: 4, value: 12 },
  legendary: { name: 'Legendary', css: '#ffb030', stars: 5, w: 1, value: 30 },
  mythic:    { name: 'Mythic',    css: '#ff5a8a', stars: 6, w: 0.25, value: 80 },
};
export const SIZE = { S: { name: 'Small', crate: 1, space: 1 }, M: { name: 'Medium', crate: 2, space: 2 }, L: { name: 'Large', crate: 4, space: 4 }, XL: { name: 'Huge', crate: 8, space: 8 } };

/* Variants roll on every wild spawn. They recolour the animal and are worth more. */
export const VARIANTS = {
  albino:   { name: 'Albino',   chance: 0.012, mult: 3, cols: c => ({ ...c, top: '#efe8dc', belly: '#fffaf2', patCol: '#e0d6c8', eye: '#e04050', accent: '#f0d8d8', feather: '#f4eee6', sail: '#f2dcd8', plate: '#f0d4d0', frill: '#f6e6e0', membrane: '#f0e0d8' }) },
  melanistic: { name: 'Shadow', chance: 0.012, mult: 3, cols: c => ({ ...c, top: '#2a2a32', belly: '#4a4a56', patCol: '#1a1a20', eye: '#ffd040', accent: '#3a3a48', feather: '#30303c', sail: '#3c2a40', plate: '#4a2a3a', frill: '#3a3040', membrane: '#2e2a36' }) },
  golden:   { name: 'Golden',   chance: 0.004, mult: 8, cols: c => ({ ...c, top: '#e8b830', belly: '#fff0b0', patCol: '#c88a10', accent: '#ffd860', feather: '#ffe070', sail: '#ffc840', plate: '#ffd050', frill: '#ffe080', membrane: '#f0c040', glow: '#fff2a0', glowPat: 'line' }) },
  starborn: { name: 'Starborn', chance: 0, mult: 15, cols: c => ({ ...c, top: '#2a1e58', belly: '#4a3a88', patCol: '#1a1240', accent: '#6a5ad8', feather: '#5a4ac8', sail: '#4a3ab8', membrane: '#3a2a88', glow: '#9af0ff', glowPat: 'spots', eye: '#9af0ff' }) },
};

const B = (o) => o;
export const SPECIES = [
  /* ---------------- Fernvale Meadows: where every zoo begins ---------------- */
  { id: 'compy', name: 'Compsognathus', sci: 'Compsognathus longipes', rarity: 'common', size: 'S', move: 'walk', habitat: 'meadow', diet: 'carn', temper: 'skittish',
    where: ['meadow', 'jungle', 'beach', 'isle'], herd: [3, 6], ride: false, speed: { walk: 2.2, run: 9, turn: 6 }, fight: 0.35, erratic: 1.6, power: 0.3, appeal: 2, kg: [2, 3.5],
    abilities: ['scout'], body: B({ plan: 'theropod', len: 1.0, hip: 0.3, feat: ['feathers', 'quills'], eye: 1.3, bw: 0.07, bh: 0.085 }),
    cols: { top: '#7cb342', belly: '#efe8b0', pattern: 'stripes', patCol: '#4a7a24', feather: '#f0a030', eye: '#e8a020' },
    lore: 'A chicken-sized hunter that travels in squabbling gangs. Steals sandwiches.', hint: 'Everywhere in the lowlands, in noisy little groups.' },
  { id: 'proto', name: 'Protoceratops', sci: 'Protoceratops andrewsi', rarity: 'common', size: 'S', move: 'walk', habitat: 'desert', diet: 'herb', temper: 'calm',
    where: ['meadow', 'desert', 'beach'], herd: [1, 4], speed: { walk: 1.8, run: 6.5, turn: 3.2, jump: 0 }, fight: 0.6, erratic: 0.7, power: 0.8, appeal: 3, kg: [60, 90],
    abilities: ['dig', 'sturdy'], body: B({ plan: 'quad', herb: true, len: 2.0, hip: 0.62, shoulder: 0.55, headL: 0.5, head: 0.46, headH: 0.28, headW: 0.17, feat: ['frill'], frill: 0.62, neck: 0.12, tail: 0.6, bw: 0.24, bh: 0.24, legW: 0.07, headLow: 0.25, eye: 1.05 }),
    cols: { top: '#c8a26a', belly: '#f2e2c4', frill: '#e08a5a', frillPat: '#b0503a', rim: '#8a4a30', pattern: 'bands', patCol: '#a8844e', beak: '#6a5040' },
    lore: 'A sturdy little digger with a bony collar. Finds things nobody asked it to find.', hint: 'Grazing on the meadows and the edge of the desert. Dig spots love it.' },
  { id: 'dryo', name: 'Dryosaurus', sci: 'Dryosaurus altus', rarity: 'common', size: 'M', move: 'walk', habitat: 'meadow', diet: 'herb', temper: 'skittish',
    where: ['meadow', 'jungle', 'elder'], herd: [2, 5], speed: { walk: 2.6, run: 13, turn: 3.6, jump: 7 }, fight: 0.7, erratic: 1.1, power: 0.7, appeal: 3, kg: [70, 100],
    abilities: ['sprint', 'jump'], body: B({ plan: 'theropod', herb: true, len: 3.2, hip: 1.05, neck: 0.5, head: 0.4, headH: 0.24, headW: 0.13, neckRise: 0.7, arm: 0.36, bw: 0.24, bh: 0.3, eye: 1.25 }),
    cols: { top: '#5aa0c8', belly: '#eef2ec', pattern: 'stripes', patCol: '#356c94', beak: '#e8d090', eye: '#4a2e1a' },
    lore: 'Built for running away, which makes it excellent for running anywhere.', hint: 'Common in the meadows. A great first ride.' },
  { id: 'galli', name: 'Gallimimus', sci: 'Gallimimus bullatus', rarity: 'uncommon', size: 'M', move: 'walk', habitat: 'meadow', diet: 'omni', temper: 'skittish',
    where: ['meadow', 'desert'], herd: [4, 9], speed: { walk: 3, run: 19, turn: 3.2, jump: 6 }, fight: 1.05, erratic: 1.5, power: 1.0, appeal: 6, kg: [300, 440],
    abilities: ['sprint', 'jump'], body: B({ plan: 'theropod', herb: true, len: 5.6, hip: 1.8, neck: 1.25, head: 0.48, headH: 0.24, headW: 0.14, neckRise: 0.85, arm: 0.7, bw: 0.34, bh: 0.42, tail: 2.4, legW: 0.11, toe: 2.2, eye: 1.3, feat: ['feathers'] }),
    cols: { top: '#d89a4a', belly: '#f6ead6', feather: '#8a5a30', pattern: 'stripes', patCol: '#b07230', beak: '#4a3a2a' },
    lore: 'The fastest thing on two legs. Flocks stampede at the slightest surprise.', hint: 'Big flocks on the open meadows and the desert edge.' },
  { id: 'para', name: 'Parasaurolophus', sci: 'Parasaurolophus walkeri', rarity: 'uncommon', size: 'L', move: 'walk', habitat: 'jungle', diet: 'herb', temper: 'calm',
    where: ['meadow', 'jungle', 'swamp'], herd: [3, 6], speed: { walk: 2.4, run: 10, turn: 2.4, jump: 0 }, fight: 1.25, erratic: 0.7, power: 2.2, appeal: 8, kg: [2200, 2800],
    abilities: ['call', 'carry'], body: B({ plan: 'theropod', herb: true, len: 9, hip: 2.4, neck: 1.2, head: 1.0, headH: 0.5, headW: 0.3, neckRise: 0.6, arm: 1.1, armW: 0.11, bw: 0.62, bh: 0.78, tail: 4, legW: 0.2, feat: ['tube'], belly: 1.15, eye: 1.1 }),
    cols: { top: '#4a8a6a', belly: '#ece4c4', crest: '#e8603a', pattern: 'stripes', patCol: '#2f5f4a', beak: '#e8c890' },
    lore: 'Its crest is a trumpet. The herd honks to keep track of each other.', hint: 'Herds wander the meadows, the jungle and the swamp edge.' },
  { id: 'pachy', name: 'Pachycephalosaurus', sci: 'Pachycephalosaurus wyomingensis', rarity: 'uncommon', size: 'M', move: 'walk', habitat: 'mountain', diet: 'herb', temper: 'territorial',
    where: ['meadow', 'peaks', 'elder'], herd: [1, 3], speed: { walk: 2.3, run: 11, turn: 3, jump: 6 }, fight: 1.15, erratic: 1.2, power: 1.6, appeal: 6, kg: [370, 450],
    abilities: ['smash', 'climb'], body: B({ plan: 'theropod', herb: true, len: 4.5, hip: 1.35, neck: 0.6, head: 0.58, headH: 0.42, headW: 0.22, neckRise: 0.4, arm: 0.42, bw: 0.36, bh: 0.44, feat: ['dome'], eye: 1.1 }),
    cols: { top: '#8a6a5a', belly: '#efe0c8', dome: '#e8dcc0', horn: '#c8a878', pattern: 'spots', patCol: '#6a4a3a', beak: '#5a4030' },
    lore: 'Settles every argument with its forehead. Walls, boulders, other pachys.', hint: 'Butting heads on the meadow hills and the mountain slopes.' },
  { id: 'raptor', name: 'Velociraptor', sci: 'Velociraptor mongoliensis', rarity: 'rare', size: 'S', move: 'walk', habitat: 'jungle', diet: 'carn', temper: 'aggressive',
    where: ['meadow', 'jungle', 'desert', 'valley'], herd: [2, 4], speed: { walk: 3, run: 16, turn: 5, jump: 9 }, fight: 1.4, erratic: 2.0, power: 1.0, appeal: 10, kg: [15, 25],
    abilities: ['sprint', 'jump', 'climb', 'track'], body: B({ plan: 'theropod', len: 2.0, hip: 0.62, neck: 0.32, head: 0.33, headH: 0.15, headW: 0.09, arm: 0.36, armW: 0.04, bw: 0.12, bh: 0.15, feat: ['feathers', 'sickle', 'quills'], legW: 0.045, tail: 1.0 }),
    cols: { top: '#b8723a', belly: '#efe2c8', feather: '#2d6fb5', pattern: 'tiger', patCol: '#6a3a1a', eye: '#f0c020' },
    lore: 'Clever, feathered and absolutely sure it is the main character.', hint: 'Packs hunt the edges of the meadows and the jungle. They will come to you.' },

  /* ---------------- The Verdant Tangle ---------------- */
  { id: 'dilo', name: 'Dilophosaurus', sci: 'Dilophosaurus wetherilli', rarity: 'uncommon', size: 'M', move: 'walk', habitat: 'jungle', diet: 'carn', temper: 'territorial',
    where: ['jungle', 'valley', 'skull'], herd: [1, 2], speed: { walk: 2.6, run: 12, turn: 3.6, jump: 5 }, fight: 1.2, erratic: 1.4, power: 1.3, appeal: 8, kg: [300, 400],
    abilities: ['spit', 'sprint'], body: B({ plan: 'theropod', len: 6, hip: 1.6, neck: 0.85, head: 0.68, headH: 0.32, headW: 0.18, neckRise: 0.6, arm: 0.65, bw: 0.32, bh: 0.42, feat: ['crest2'], legW: 0.1 }),
    cols: { top: '#8ab040', belly: '#f2ecc0', crest: '#e04a2a', pattern: 'spots', patCol: '#5a7a20', eye: '#f0d020' },
    lore: 'Twin crests, a terrible temper and a spit that leaves you seeing stars.', hint: 'Prowling the Verdant Tangle.' },
  { id: 'trike', name: 'Triceratops', sci: 'Triceratops horridus', rarity: 'uncommon', size: 'L', move: 'walk', habitat: 'meadow', diet: 'herb', temper: 'territorial',
    where: ['jungle', 'meadow', 'elder'], herd: [1, 3], speed: { walk: 2, run: 9.5, turn: 1.9, jump: 0 }, fight: 1.9, erratic: 0.8, power: 3, appeal: 14, kg: [6000, 9000],
    abilities: ['smash', 'charge', 'carry', 'sturdy'], body: B({ plan: 'quad', herb: true, len: 8.5, hip: 2.3, shoulder: 1.9, head: 2.0, headH: 1.0, headW: 0.62, neck: 0.4, tail: 2.4, bw: 1.0, bh: 0.95, legW: 0.26, feat: ['frill', 'horns3'], frill: 0.62, headLow: 0.22, eye: 1.0 }),
    cols: { top: '#5a7a9a', belly: '#dcd4bc', frill: '#e8a040', frillPat: '#c85a2a', rim: '#7a3a20', horn: '#f0e6cc', pattern: 'dapple', patCol: '#4a6888', beak: '#4a4038', frillEye: '#3a2a20' },
    lore: 'Three horns and a shield. Nothing argues with a triceratops for long.', hint: 'Small herds in the jungle clearings and the meadow edges.' },
  { id: 'stego', name: 'Stegosaurus', sci: 'Stegosaurus stenops', rarity: 'uncommon', size: 'L', move: 'walk', habitat: 'jungle', diet: 'herb', temper: 'calm',
    where: ['jungle', 'elder'], herd: [1, 3], speed: { walk: 1.8, run: 7, turn: 1.8, jump: 0 }, fight: 1.7, erratic: 0.6, power: 2.6, appeal: 12, kg: [4500, 6500],
    abilities: ['carry', 'tailwhip', 'sturdy'], body: B({ plan: 'quad', herb: true, len: 8.5, hip: 2.6, shoulder: 1.55, head: 0.75, headH: 0.32, headW: 0.24, neck: 0.7, tail: 3.2, bw: 0.82, bh: 0.92, legW: 0.22, feat: ['plates', 'thag'], plate: 1.25, headLow: 0.55, hump: 0.4, tailUp: 0.5, droop: 0.05, frontLeg: 0.8 }),
    cols: { top: '#6a8a4a', belly: '#e2d6b0', plate: '#d8503a', plateTip: '#f0b040', horn: '#efe6d0', pattern: 'dapple', patCol: '#4a6a34', beak: '#5a5040' },
    lore: 'Walnut-sized brain, enormous confidence. Mind the tail.', hint: 'Browsing in the Verdant Tangle and the Elderwood.' },
  { id: 'theri', name: 'Therizinosaurus', sci: 'Therizinosaurus cheloniformis', rarity: 'rare', size: 'L', move: 'walk', habitat: 'forest', diet: 'herb', temper: 'territorial',
    where: ['jungle', 'elder'], herd: [1, 1], speed: { walk: 1.8, run: 7.5, turn: 2.2, jump: 0 }, fight: 2.1, erratic: 1.0, power: 2.8, appeal: 20, kg: [3500, 5000],
    abilities: ['cut', 'carry'], body: B({ plan: 'theropod', herb: true, len: 8, hip: 2.6, neck: 1.6, head: 0.62, headH: 0.34, headW: 0.2, neckRise: 0.85, arm: 2.4, armW: 0.16, bw: 0.7, bh: 0.85, tail: 2.6, upright: 0.65, belly: 1.25, feat: ['claws', 'mane', 'feathers'], legW: 0.24, droop: 0.2 }),
    cols: { top: '#7a6450', belly: '#d8c8a8', feather: '#5a4a3a', claw: '#2e2620', beak: '#3a3028', pattern: 'stripes', patCol: '#5a4838' },
    lore: 'Claws a metre long, used almost entirely for eating leaves and cutting vines.', hint: 'Lurking alone deep in the jungle and the Elderwood.' },
  { id: 'meganeura', name: 'Meganeura', sci: 'Meganeura monyi', rarity: 'common', size: 'S', move: 'fly', habitat: 'swamp', diet: 'carn', temper: 'skittish',
    where: ['swamp', 'jungle'], herd: [1, 3], ride: false, speed: { walk: 3, run: 12, turn: 4 }, fight: 0.5, erratic: 2.2, power: 0.2, appeal: 3, kg: [0.6, 1.2], flyH: [2, 6],
    abilities: ['scout'], body: B({ plan: 'dragonfly', len: 1.3 }),
    cols: { top: '#2a9ac8', accent: '#e0e070', wing: '#cfeaf5', eye: '#40c070' },
    lore: 'A dragonfly the size of a seagull, from a time when the air was richer.', hint: 'Zipping over the swamp and jungle pools.' },
  { id: 'glowtail', name: 'Glowtail', sci: 'Noctiraptor luminis', rarity: 'epic', size: 'M', move: 'walk', habitat: 'jungle', diet: 'carn', temper: 'skittish',
    where: ['jungle', 'valley'], when: { night: true }, herd: [1, 2], speed: { walk: 3, run: 17, turn: 4.6, jump: 10 }, fight: 2.1, erratic: 2.3, power: 1.4, appeal: 34, kg: [80, 120],
    abilities: ['glow', 'sprint', 'jump', 'climb'], body: B({ plan: 'theropod', len: 3.4, hip: 1.0, neck: 0.5, head: 0.5, headH: 0.22, headW: 0.13, arm: 0.5, bw: 0.2, bh: 0.26, feat: ['feathers', 'sickle', 'quills'], legW: 0.07, tail: 1.8 }),
    cols: { top: '#1e2430', belly: '#2e3646', feather: '#283040', glow: '#3af0ff', glowPat: 'stripes', eye: '#3af0ff' },
    lore: 'Only comes out after dark. Its stripes pulse when it is curious - or hungry.', hint: 'Only at NIGHT, deep in the Verdant Tangle. Look for blue light.' },
  { id: 'trex', name: 'Tyrannosaurus', sci: 'Tyrannosaurus rex', rarity: 'epic', size: 'XL', move: 'walk', habitat: 'predator', diet: 'carn', temper: 'aggressive',
    where: ['jungle', 'valley', 'skull'], herd: [1, 1], speed: { walk: 2.4, run: 11, turn: 1.5, jump: 0 }, fight: 3.0, erratic: 1.3, power: 5, appeal: 60, kg: [7000, 9500],
    abilities: ['roar', 'smash', 'charge', 'sturdy', 'carry'], body: B({ plan: 'theropod', len: 12.3, hip: 3.6, neck: 1.6, head: 1.6, headH: 0.95, headW: 0.5, neckRise: 0.45, arm: 0.8, armW: 0.12, bw: 0.95, bh: 1.15, tail: 5.4, legW: 0.36, fingers: 2, belly: 1.15, eye: 0.85 }),
    cols: { top: '#5a6a3a', belly: '#dccca4', pattern: 'stripes', patCol: '#3a4422', eye: '#f0b030' },
    lore: 'The tyrant king. Visitors will queue for hours. So will its lunch.', hint: 'Rare in the deep jungle. Much more common in the Lost Valley.' },

  /* ---------------- The Giant River & the Murkmire ---------------- */
  { id: 'sarco', name: 'Sarcosuchus', sci: 'Sarcosuchus imperator', rarity: 'rare', size: 'L', move: 'amph', habitat: 'swamp', diet: 'carn', temper: 'aggressive',
    where: ['swamp', 'river'], herd: [1, 1], speed: { walk: 1.4, run: 6, swim: 9, turn: 1.6, jump: 0 }, fight: 2.2, erratic: 1.1, power: 3.4, appeal: 22, kg: [6000, 8000],
    abilities: ['swim', 'dive', 'ambush'], body: B({ plan: 'quad', len: 11, hip: 0.9, shoulder: 0.85, head: 1.8, headH: 0.5, headW: 0.44, neck: 0.3, tail: 4.6, torso: 3.8, bw: 0.75, bh: 0.45, legW: 0.15, sprawl: 0.75, headStyle: 'croc', feat: ['scutes'], headLow: 0.05, droop: 0.02, flatBody: 0.15, nails: 4 }),
    cols: { top: '#5a6a3a', belly: '#d8d0a0', pattern: 'bands', patCol: '#3e4a28', eye: '#d0b020' },
    lore: 'The "super croc". Twelve metres of patience, lying in the reeds.', hint: 'Basking in the Murkmire and along the Giant River.' },
  { id: 'spino', name: 'Spinosaurus', sci: 'Spinosaurus aegyptiacus', rarity: 'epic', size: 'XL', move: 'amph', habitat: 'swamp', diet: 'fish', temper: 'territorial',
    where: ['river', 'swamp', 'skull'], herd: [1, 1], speed: { walk: 2.2, run: 9, swim: 11, turn: 1.6, jump: 0 }, fight: 2.9, erratic: 1.2, power: 4.6, appeal: 55, kg: [7000, 9000],
    abilities: ['swim', 'roar', 'carry', 'sturdy'], body: B({ plan: 'theropod', len: 14, hip: 3.1, neck: 1.9, head: 1.9, headH: 0.62, headW: 0.34, neckRise: 0.55, arm: 1.6, armW: 0.16, bw: 0.85, bh: 0.95, tail: 6.5, legW: 0.28, feat: ['sail', 'longsnout'], sailH: 2.2, tailDeep: 1.3, snoutDrop: 0.08 }),
    cols: { top: '#4a6a7a', belly: '#e0d8c0', sail: '#e86a3a', pattern: 'bands', patCol: '#34505e', eye: '#f0c040' },
    lore: 'Half fisherman, half nightmare, with a sail you can see from a mile away.', hint: 'Fishing in the Giant River and the Murkmire. Look for the sail.' },
  { id: 'arthro', name: 'Arthropleura', sci: 'Arthropleura armata', rarity: 'rare', size: 'M', move: 'walk', habitat: 'swamp', diet: 'herb', temper: 'calm',
    where: ['swamp', 'cave', 'elder'], herd: [1, 1], speed: { walk: 1.6, run: 6.5, turn: 2.2, jump: 0 }, fight: 1.5, erratic: 1.4, power: 1.6, appeal: 16, kg: [50, 80],
    abilities: ['climb', 'wallclimb'], body: B({ plan: 'millipede', len: 2.8, segs: 12, w: 0.24, hip: 0.18 }),
    cols: { top: '#6a4a3a', accent: '#c89a5a' },
    lore: 'A millipede longer than a canoe. Climbs sheer rock like it is a flat road.', hint: 'In the Murkmire mud, the Elderwood leaf litter and dark caves.' },

  /* ---------------- Elderwood ---------------- */
  { id: 'brachio', name: 'Brachiosaurus', sci: 'Brachiosaurus altithorax', rarity: 'rare', size: 'XL', move: 'walk', habitat: 'forest', diet: 'herb', temper: 'calm',
    where: ['elder', 'jungle'], herd: [1, 3], speed: { walk: 1.7, run: 4.5, turn: 0.9, jump: 0 }, fight: 3.2, erratic: 0.5, power: 6, appeal: 45, kg: [30000, 45000],
    abilities: ['carry', 'wade', 'tall', 'sturdy'], body: B({ plan: 'sauropod', len: 24, hip: 5.2, shoulder: 6.6, neck: 9.5, neckAngle: 1.05, tail: 8.5, torso: 6, bw: 1.8, bh: 2.0, legW: 0.62, head: 1.0, feat: ['nasal'] }),
    cols: { top: '#8a9aa0', belly: '#e2ded0', pattern: 'dapple', patCol: '#6e7e86', eye: '#3a2a1a' },
    lore: 'A living crane. Gentle, enormous, and the best seat in the house.', hint: 'Grazing the treetops of the Elderwood.' },
  { id: 'diplo', name: 'Diplodocus', sci: 'Diplodocus carnegii', rarity: 'uncommon', size: 'XL', move: 'walk', habitat: 'forest', diet: 'herb', temper: 'calm',
    where: ['elder', 'meadow'], herd: [2, 4], speed: { walk: 1.8, run: 5, turn: 0.9, jump: 0 }, fight: 2.6, erratic: 0.6, power: 5, appeal: 30, kg: [14000, 18000],
    abilities: ['carry', 'tailwhip', 'wade'], body: B({ plan: 'sauropod', len: 26, hip: 4.0, shoulder: 3.6, neck: 8, neckAngle: 0.25, tail: 12, torso: 5, bw: 1.35, bh: 1.5, legW: 0.45, head: 0.9, feat: ['spines'] }),
    cols: { top: '#a08a6a', belly: '#ece0c8', pattern: 'stripes', patCol: '#7e6a4e', spike: '#6a5a44', eye: '#3a2a1a' },
    lore: 'Its tail cracks like a whip. Herds sweep the forest edge in long lines.', hint: 'Herds cross between the Elderwood and the meadows.' },

  /* ---------------- Bonedust Flats ---------------- */
  { id: 'scorp', name: 'Pulmonoscorpius', sci: 'Pulmonoscorpius kirktonensis', rarity: 'uncommon', size: 'S', move: 'walk', habitat: 'desert', diet: 'carn', temper: 'territorial',
    where: ['desert', 'cave'], herd: [1, 2], speed: { walk: 1.6, run: 7, turn: 3.6, jump: 0 }, fight: 1.0, erratic: 1.7, power: 0.8, appeal: 7, kg: [8, 14],
    abilities: ['wallclimb', 'sting'], body: B({ plan: 'scorpion', len: 1.6 }),
    cols: { top: '#c8a060', accent: '#8a6a3a', sting: '#e0b050' },
    lore: 'A scorpion as long as a bicycle. Very proud of its tail.', hint: 'Under the rocks of Bonedust Flats, and in caves.' },
  { id: 'carno', name: 'Carnotaurus', sci: 'Carnotaurus sastrei', rarity: 'rare', size: 'L', move: 'walk', habitat: 'desert', diet: 'carn', temper: 'aggressive',
    where: ['desert'], herd: [1, 1], speed: { walk: 2.8, run: 17, turn: 2.2, jump: 0 }, fight: 2.2, erratic: 1.6, power: 2.8, appeal: 26, kg: [1300, 2000],
    abilities: ['sprint', 'charge', 'roar'], body: B({ plan: 'theropod', len: 8, hip: 2.3, neck: 1.0, head: 0.85, headH: 0.6, headW: 0.3, neckRise: 0.45, arm: 0.35, armW: 0.08, bw: 0.5, bh: 0.6, tail: 3.6, legW: 0.2, feat: ['horns2'], fingers: 4 }),
    cols: { top: '#a8423a', belly: '#e8d0b0', horn: '#2a2420', pattern: 'spots', patCol: '#6a2a24', eye: '#f0e040' },
    lore: 'A horned sprinter with arms that are, frankly, a rumour.', hint: 'Running down prey across the open Bonedust Flats.' },
  { id: 'dimetro', name: 'Dimetrodon', sci: 'Dimetrodon grandis', rarity: 'common', size: 'M', move: 'walk', habitat: 'desert', diet: 'carn', temper: 'territorial',
    where: ['desert', 'volcano'], herd: [1, 2], speed: { walk: 1.4, run: 6, turn: 2.4, jump: 0 }, fight: 1.0, erratic: 0.9, power: 1.3, appeal: 6, kg: [150, 250],
    abilities: ['warm', 'sturdy'], body: B({ plan: 'quad', len: 3.4, hip: 0.55, shoulder: 0.55, head: 0.62, headH: 0.36, headW: 0.18, neck: 0.15, tail: 1.6, torso: 1.2, bw: 0.3, bh: 0.26, legW: 0.07, sprawl: 0.65, headStyle: 'sail', feat: ['sail'], sailH: 1.05, headLow: 0.05, droop: 0.05, nails: 4 }),
    cols: { top: '#8a6a4a', belly: '#d8c8a0', sail: '#d8a040', pattern: 'bands', patCol: '#6a4a30', eye: '#e0a020' },
    lore: 'Not actually a dinosaur, and very tired of being told. Its sail keeps it warm.', hint: 'Basking on the warm rocks of the desert and the volcano slopes.' },

  /* ---------------- The Spine Peaks ---------------- */
  { id: 'ptera', name: 'Pteranodon', sci: 'Pteranodon longiceps', rarity: 'common', size: 'M', move: 'fly', habitat: 'aviary', diet: 'fish', temper: 'skittish',
    where: ['peaks', 'beach', 'ocean', 'isle'], herd: [2, 5], speed: { walk: 1.5, run: 4, fly: 20, turn: 1.9 }, fight: 1.0, erratic: 1.6, power: 1.2, appeal: 8, kg: [20, 30], flyH: [25, 70],
    abilities: ['fly'], body: B({ plan: 'ptero', span: 6.5, body: 0.9, neck: 0.5, head: 1.1, feat: ['crestBack'] }),
    cols: { top: '#e8e4dc', belly: '#f8f6f0', membrane: '#c8885a', crest: '#d84a2a', beak: '#e8c060', eye: '#2a1a10' },
    lore: 'The classic sky-lizard. Glides for hours over the sea, looking for fish.', hint: 'Circling the Spine Peaks and the coast.' },
  { id: 'dimorph', name: 'Dimorphodon', sci: 'Dimorphodon macronyx', rarity: 'common', size: 'S', move: 'fly', habitat: 'aviary', diet: 'carn', temper: 'skittish',
    where: ['beach', 'isle', 'jungle', 'skull'], herd: [2, 4], ride: false, speed: { walk: 1.5, run: 3, fly: 13, turn: 3 }, fight: 0.5, erratic: 2.0, power: 0.4, appeal: 4, kg: [1.5, 2.5], flyH: [8, 22],
    abilities: ['scout'], body: B({ plan: 'ptero', span: 1.45, body: 0.26, neck: 0.12, head: 0.24, headH: 0.12, feat: ['teeth', 'longtail'] }),
    cols: { top: '#3a3a4a', belly: '#6a6a7a', membrane: '#5a4a6a', crest: '#f0c030', beak: '#f0c030', eye: '#f0c030' },
    lore: 'A puffin-faced little flyer with a big head and bigger opinions.', hint: 'Squabbling over the beaches and islands.' },
  { id: 'tape', name: 'Tapejara', sci: 'Tapejara wellnhoferi', rarity: 'uncommon', size: 'M', move: 'fly', habitat: 'aviary', diet: 'omni', temper: 'skittish',
    where: ['isle', 'jungle', 'peaks'], herd: [1, 3], speed: { walk: 1.6, run: 4, fly: 23, turn: 2.4 }, fight: 1.1, erratic: 1.8, power: 1.0, appeal: 11, kg: [15, 22], flyH: [15, 45],
    abilities: ['fly'], body: B({ plan: 'ptero', span: 4.2, body: 0.6, neck: 0.4, head: 0.55, headH: 0.2, feat: ['crestSail'] }),
    cols: { top: '#4a8ad0', belly: '#e8eef4', membrane: '#3a6aa8', crest: '#ff5a3a', beak: '#f0d080', eye: '#2a1a10' },
    lore: 'A parrot-coloured flyer with a sail on its head. Nimble in the air.', hint: 'Over Palm Isle and the jungle canopy.' },
  { id: 'quetz', name: 'Quetzalcoatlus', sci: 'Quetzalcoatlus northropi', rarity: 'epic', size: 'XL', move: 'fly', habitat: 'aviary', diet: 'carn', temper: 'territorial',
    where: ['peaks', 'desert'], when: { den: 'nest' }, herd: [1, 1], speed: { walk: 2, run: 5, fly: 30, turn: 1.2 }, fight: 2.9, erratic: 1.2, power: 4.2, appeal: 52, kg: [200, 250], flyH: [60, 120],
    abilities: ['fly', 'carry', 'sturdy'], body: B({ plan: 'ptero', span: 11, body: 1.6, neck: 2.6, head: 2.4, headH: 0.36, bw: 0.4, bh: 0.42, feat: ['crestSmall'], fierce: true }),
    cols: { top: '#8a8278', belly: '#ece6dc', membrane: '#6a5a50', crest: '#d84a2a', beak: '#e8d090', pattern: 'spots', patCol: '#6a6258', eye: '#e0a020' },
    lore: 'As tall as a giraffe, with wings like a small plane. Rules the high sky.', hint: 'Nests on the highest places: the Sky Mesa, the peaks. Fly up to it.' },

  /* ---------------- Frostfang Tundra ---------------- */
  { id: 'mammoth', name: 'Woolly Mammoth', sci: 'Mammuthus primigenius', rarity: 'rare', size: 'XL', move: 'walk', habitat: 'arctic', diet: 'herb', temper: 'calm',
    where: ['tundra'], herd: [2, 4], speed: { walk: 2, run: 7, turn: 1.5, jump: 0 }, fight: 2.6, erratic: 0.7, power: 4.2, appeal: 30, kg: [5000, 6500],
    abilities: ['warm', 'carry', 'smash', 'sturdy'], body: B({ plan: 'quad', herb: true, len: 5.6, hip: 2.6, shoulder: 3.0, head: 1.3, headH: 1.1, headW: 0.62, neck: 0.25, tail: 0.6, torso: 2.6, bw: 1.15, bh: 1.2, legW: 0.34, headStyle: 'trunk', feat: ['fur', 'trunk', 'tusks', 'ears', 'hump'], headLow: -0.05, headUp: 0.2, hoof: false, nails: 3, tailTip: 0.1 }),
    cols: { top: '#8a5a3a', belly: '#6a4228', fur: '#7a4a2c', skin: '#6a4a3a', tusk: '#f2ead6', eye: '#2a1a10' },
    lore: 'A walking haystack with tusks. Unbothered by blizzards, or by you.', hint: 'Herds on Frostfang Tundra.' },
  { id: 'smilo', name: 'Smilodon', sci: 'Smilodon populator', rarity: 'rare', size: 'M', move: 'walk', habitat: 'arctic', diet: 'carn', temper: 'aggressive',
    where: ['tundra', 'peaks'], herd: [1, 2], speed: { walk: 2.6, run: 15, turn: 3.6, jump: 9 }, fight: 1.9, erratic: 1.7, power: 1.8, appeal: 24, kg: [220, 400],
    abilities: ['warm', 'sprint', 'jump', 'track'], body: B({ plan: 'quad', len: 2.5, hip: 0.82, shoulder: 0.92, head: 0.5, headH: 0.4, headW: 0.24, neck: 0.25, tail: 0.32, torso: 1.25, bw: 0.34, bh: 0.38, legW: 0.1, headStyle: 'cat', feat: ['sabers', 'catears'], headLow: -0.1, headUp: 0.1, nails: 4, tailTip: 0.3 }),
    cols: { top: '#d8a868', belly: '#f4e8d0', pattern: 'spots', patCol: '#a87840', eye: '#e0c020' },
    lore: 'The sabre-toothed cat. Ambushes from snowdrifts. Purrs like a motorbike.', hint: 'Stalking the tundra and the high passes.' },
  { id: 'rhino', name: 'Woolly Rhino', sci: 'Coelodonta antiquitatis', rarity: 'uncommon', size: 'L', move: 'walk', habitat: 'arctic', diet: 'herb', temper: 'territorial',
    where: ['tundra'], herd: [1, 2], speed: { walk: 2, run: 9, turn: 2, jump: 0 }, fight: 1.6, erratic: 1.0, power: 2.6, appeal: 14, kg: [1800, 2900],
    abilities: ['warm', 'smash', 'charge'], body: B({ plan: 'quad', herb: true, len: 3.8, hip: 1.5, shoulder: 1.65, head: 0.9, headH: 0.55, headW: 0.34, neck: 0.25, tail: 0.5, torso: 1.9, bw: 0.62, bh: 0.62, legW: 0.15, headStyle: 'wide', feat: ['fur', 'nosehorn', 'hump', 'catears'], headLow: 0.45, hoof: true, tailTip: 0.12 }),
    cols: { top: '#7a5a40', belly: '#5a4030', fur: '#6a4a32', horn: '#4a3a2a', eye: '#2a1a10', beak: '#4a3a30' },
    lore: 'A shaggy battering ram with a horn like a scythe.', hint: 'Grumbling across Frostfang Tundra.' },
  { id: 'frostmaw', name: 'Frostmaw', sci: 'Glaciotyrannus rex', rarity: 'legendary', size: 'XL', move: 'walk', habitat: 'arctic', diet: 'carn', temper: 'aggressive',
    where: ['tundra'], when: { den: 'whiteout' }, herd: [1, 1], speed: { walk: 2.6, run: 12, turn: 1.6, jump: 0 }, fight: 4.2, erratic: 1.6, power: 6, appeal: 140, kg: [9000, 12000],
    abilities: ['warm', 'roar', 'smash', 'charge', 'sturdy', 'carry'], body: B({ plan: 'theropod', len: 13, hip: 3.8, neck: 1.7, head: 1.7, headH: 0.95, headW: 0.52, neckRise: 0.5, arm: 0.9, armW: 0.13, bw: 1.0, bh: 1.2, tail: 5.6, legW: 0.38, fingers: 2, feat: ['spines'], eye: 0.85 }),
    cols: { top: '#e8f2fa', belly: '#c8d8e8', pattern: 'stripes', patCol: '#9ab8d0', spike: '#9ae0ff', spikeGlow: true, eye: '#5ad8ff', glow: '#9ae0ff', glowPat: 'line' },
    lore: 'The tundra tells stories about a white tyrant that walks inside the blizzard.', hint: 'Somewhere inside the Whiteout - the endless blizzard at the far end of the tundra.' },

  /* ---------------- Mount Cinder ---------------- */
  { id: 'allo', name: 'Allosaurus', sci: 'Allosaurus fragilis', rarity: 'uncommon', size: 'L', move: 'walk', habitat: 'predator', diet: 'carn', temper: 'aggressive',
    where: ['volcano', 'desert', 'elder'], herd: [1, 2], speed: { walk: 2.6, run: 13, turn: 2, jump: 0 }, fight: 1.8, erratic: 1.4, power: 2.8, appeal: 20, kg: [1700, 2300],
    abilities: ['roar', 'charge', 'sprint'], body: B({ plan: 'theropod', len: 9, hip: 2.5, neck: 1.1, head: 1.05, headH: 0.55, headW: 0.3, neckRise: 0.45, arm: 0.95, armW: 0.11, bw: 0.55, bh: 0.65, tail: 4.2, legW: 0.22, feat: ['browcrest'] }),
    cols: { top: '#9a8a6a', belly: '#e8dcc0', crest: '#c84a2a', pattern: 'tiger', patCol: '#6a5a40', eye: '#f0a020' },
    lore: 'The lion of its age. Red-browed and always on patrol.', hint: 'Hunting the volcano badlands, the desert and the forest edge.' },
  { id: 'ember', name: 'Emberback', sci: 'Pyroankylus magmatis', rarity: 'epic', size: 'L', move: 'walk', habitat: 'volcanic', diet: 'omni', temper: 'territorial',
    where: ['volcano'], herd: [1, 1], speed: { walk: 1.6, run: 6, turn: 1.6, jump: 0 }, fight: 2.6, erratic: 1.1, power: 3.6, appeal: 48, kg: [5000, 7000],
    abilities: ['heatproof', 'smash', 'sturdy', 'carry'], body: B({ plan: 'quad', herb: true, len: 7, hip: 1.6, shoulder: 1.5, head: 1.0, headH: 0.55, headW: 0.5, neck: 0.3, tail: 2.6, torso: 3, bw: 1.15, bh: 0.6, legW: 0.22, headStyle: 'wide', feat: ['armor', 'sidespikes', 'club'], headLow: 0.35, flatBody: 0.2, droop: 0.1 }),
    cols: { top: '#2e2624', belly: '#4a3a34', armor: '#3a302c', armorGlow: true, club: '#2a2220', horn: '#5a4a40', glow: '#ff7a2a', glowPat: 'cracks', eye: '#ffa030', beak: '#3a302c' },
    lore: 'An armoured tank that bathes in lava. Its back glows like coals.', hint: 'Wallowing near the lava on Mount Cinder.' },
  { id: 'ankylo', name: 'Ankylosaurus', sci: 'Ankylosaurus magniventris', rarity: 'uncommon', size: 'L', move: 'walk', habitat: 'meadow', diet: 'herb', temper: 'calm',
    where: ['meadow', 'elder', 'volcano'], herd: [1, 2], speed: { walk: 1.5, run: 5.5, turn: 1.6, jump: 0 }, fight: 1.9, erratic: 0.6, power: 3, appeal: 13, kg: [4800, 6000],
    abilities: ['smash', 'sturdy', 'tailwhip'], body: B({ plan: 'quad', herb: true, len: 7, hip: 1.5, shoulder: 1.4, head: 0.95, headH: 0.5, headW: 0.48, neck: 0.3, tail: 2.6, torso: 3, bw: 1.1, bh: 0.6, legW: 0.22, headStyle: 'wide', feat: ['armor', 'sidespikes', 'club'], headLow: 0.35, flatBody: 0.2, droop: 0.1 }),
    cols: { top: '#8a7a5a', belly: '#d8ccb0', armor: '#6a5a44', club: '#5a4a3a', horn: '#e0d4b8', eye: '#3a2a1a', beak: '#5a4a3a' },
    lore: 'A walking fortress with a sledgehammer for a tail.', hint: 'Plodding through meadows, forest and the volcano foothills.' },

  /* ---------------- Coast, ocean and the deep ---------------- */
  { id: 'archelon', name: 'Archelon', sci: 'Archelon ischyros', rarity: 'common', size: 'L', move: 'swim', habitat: 'aquatic', diet: 'fish', temper: 'calm',
    where: ['ocean', 'beach', 'isle'], herd: [1, 2], speed: { walk: 0.8, run: 2, swim: 9, turn: 1.6 }, fight: 1.1, erratic: 0.6, power: 1.8, appeal: 9, kg: [1800, 2200], depth: [1, 8],
    abilities: ['swim', 'dive', 'sturdy'], dive: 25, body: B({ plan: 'marine', len: 4.2, bw: 0.75, bh: 0.35, torso: 2, tail: 0.6, neck: 0.5, head: 0.7, headH: 0.38, headW: 0.26, flipF: 2.2, flipH: 1.1, feat: ['shell', 'beak'], flat: 0.15, bigEye: true }),
    cols: { top: '#8aa090', belly: '#e0e0c8', shell: '#4a6a5a', beak: '#c8b080', eye: '#2a1a10' },
    lore: 'A sea turtle the size of a car. Slow, kind, and an excellent boat.', hint: 'Paddling off Sunbeach Coast and around the islands.' },
  { id: 'ichthy', name: 'Ichthyosaurus', sci: 'Ichthyosaurus communis', rarity: 'uncommon', size: 'M', move: 'swim', habitat: 'aquatic', diet: 'fish', temper: 'skittish',
    where: ['ocean', 'deep'], herd: [2, 5], speed: { swim: 18, turn: 2.6 }, fight: 1.3, erratic: 2.0, power: 1.4, appeal: 12, kg: [90, 160], depth: [2, 30],
    abilities: ['swim', 'dive', 'echo', 'leap'], dive: 60, body: B({ plan: 'marine', len: 3.3, bw: 0.32, bh: 0.36, torso: 1.1, tail: 1.2, neck: 0.15, head: 0.7, headH: 0.26, headW: 0.16, snout: 1.6, flipF: 0.6, flipH: 0.35, feat: ['crescent', 'dorsal'], fin: 0.6, dorsal: 0.35, bigEye: true, eye: 1.4 }),
    cols: { top: '#4a6ea0', belly: '#e8eef4', pattern: 'dapple', patCol: '#3a5a88', eye: '#1a1a1a' },
    lore: 'The dolphin of the dinosaur age. Pods leap the waves for fun.', hint: 'Pods leaping in the open sea.' },
  { id: 'plesio', name: 'Plesiosaurus', sci: 'Elasmosaurus platyurus', rarity: 'rare', size: 'L', move: 'swim', habitat: 'aquatic', diet: 'fish', temper: 'calm',
    where: ['ocean', 'deep', 'river'], herd: [1, 2], speed: { swim: 12, turn: 1.6 }, fight: 2.0, erratic: 1.1, power: 2.6, appeal: 26, kg: [2000, 3000], depth: [3, 40],
    abilities: ['swim', 'dive', 'carry'], dive: 90, body: B({ plan: 'marine', len: 10, bw: 0.85, bh: 0.6, torso: 3, tail: 1.6, neck: 4.6, neckBones: 5, head: 0.65, headH: 0.32, headW: 0.24, flipF: 2.2, flipH: 1.9, flat: 0.2 }),
    cols: { top: '#4a7a8a', belly: '#e0e8e0', pattern: 'spots', patCol: '#34606e', eye: '#e0a020' },
    lore: 'A snake threaded through a turtle, everyone says. It is much prettier than that.', hint: 'Gliding through the open sea - and, rumour says, up the Giant River.' },
  { id: 'dunk', name: 'Dunkleosteus', sci: 'Dunkleosteus terrelli', rarity: 'rare', size: 'L', move: 'swim', habitat: 'aquatic', diet: 'carn', temper: 'aggressive',
    where: ['deep', 'ocean'], herd: [1, 1], speed: { swim: 10, turn: 1.6 }, fight: 2.4, erratic: 1.2, power: 3, appeal: 24, kg: [1000, 1500], depth: [20, 120],
    abilities: ['swim', 'dive', 'deepdiver', 'sturdy'], dive: 200, body: B({ plan: 'fish', len: 6, bw: 0.6, bh: 0.75, feat: ['armor'], eye: 1.3 }),
    cols: { top: '#4a5a6a', belly: '#c8ccc8', plate: '#8a8070', fin: '#3a4a58', eye: '#e0c040' },
    lore: 'An armoured fish with bone shears for a mouth. Older than the dinosaurs.', hint: 'Prowling the reef drop-off and the deep.' },
  { id: 'mosa', name: 'Mosasaurus', sci: 'Mosasaurus hoffmannii', rarity: 'epic', size: 'XL', move: 'swim', habitat: 'aquatic', diet: 'carn', temper: 'aggressive',
    where: ['deep', 'ocean'], herd: [1, 1], speed: { swim: 17, turn: 1.4 }, fight: 3.3, erratic: 1.4, power: 5.4, appeal: 70, kg: [12000, 15000], depth: [6, 120],
    abilities: ['swim', 'dive', 'deepdiver', 'roar', 'leap', 'carry'], dive: 220, body: B({ plan: 'marine', len: 16, bw: 1.15, bh: 1.2, torso: 5, tail: 6.5, neck: 0.8, head: 2.6, headH: 1.0, headW: 0.65, flipF: 2.2, flipH: 1.8, feat: ['fluke'], fin: 2.4, fierce: true }),
    cols: { top: '#3a5a7a', belly: '#dce4e4', pattern: 'stripes', patCol: '#2a4460', eye: '#f0c040' },
    lore: 'The tyrant of the sea. When the water goes very calm, look down.', hint: 'Hunting the deep water past the reef.' },
  { id: 'megalodon', name: 'Megalodon', sci: 'Otodus megalodon', rarity: 'legendary', size: 'XL', move: 'swim', habitat: 'aquatic', diet: 'carn', temper: 'aggressive',
    where: ['deep'], when: { den: 'trench' }, herd: [1, 1], speed: { swim: 22, turn: 1.3 }, fight: 4.5, erratic: 1.5, power: 7, appeal: 150, kg: [40000, 55000], depth: [20, 220],
    abilities: ['swim', 'dive', 'deepdiver', 'carry', 'sturdy'], dive: 300, body: B({ plan: 'fish', len: 17, bw: 1.8, bh: 2.1, eye: 0.8 }),
    cols: { top: '#5a6a7a', belly: '#f2f2f0', fin: '#4a5a6a', eye: '#101010' },
    lore: 'The biggest shark that ever lived. It does not live in a tank. Usually.', hint: 'Somewhere over the Trench, in the deepest blue south of the islands.' },

  /* ---------------- secrets ---------------- */
  { id: 'crystal', name: 'Crystalback', sci: 'Lithostegus prismaticus', rarity: 'epic', size: 'L', move: 'walk', habitat: 'cave', diet: 'herb', temper: 'calm',
    where: ['cave'], when: { den: 'hollow' }, herd: [1, 2], speed: { walk: 1.6, run: 6, turn: 1.8, jump: 0 }, fight: 2.5, erratic: 1.0, power: 3, appeal: 50, kg: [4000, 5500],
    abilities: ['glow', 'carry', 'tailwhip', 'sturdy'], body: B({ plan: 'quad', herb: true, len: 8, hip: 2.4, shoulder: 1.5, head: 0.75, headH: 0.32, headW: 0.24, neck: 0.7, tail: 3, bw: 0.8, bh: 0.9, legW: 0.22, feat: ['crystals', 'thag'], headLow: 0.55, hump: 0.4, tailUp: 0.4, droop: 0.05, frontLeg: 0.8 }),
    cols: { top: '#4a4060', belly: '#7a7090', crystal: '#c070ff', horn: '#e0c8ff', pattern: 'dapple', patCol: '#3a3050', beak: '#3a3048', eye: '#e0b0ff' },
    lore: 'A stegosaur that grew crystals instead of plates. Lights up a whole cavern.', hint: 'Deep inside Crystal Hollow. The way in is blocked by fallen rock.' },
  { id: 'stormwing', name: 'Stormwing', sci: 'Fulgurodraco tempestas', rarity: 'legendary', size: 'XL', move: 'fly', habitat: 'aviary', diet: 'carn', temper: 'territorial',
    where: ['peaks', 'ocean', 'tundra'], when: { storm: true }, herd: [1, 1], speed: { walk: 2, run: 5, fly: 38, turn: 1.6 }, fight: 4.0, erratic: 2.0, power: 5, appeal: 130, kg: [260, 320], flyH: [70, 140],
    abilities: ['fly', 'dash', 'sturdy'], body: B({ plan: 'ptero', span: 13, body: 1.8, neck: 1.6, head: 2.0, headH: 0.5, bw: 0.45, bh: 0.48, feat: ['crestBack', 'longtail'], fierce: true }),
    cols: { top: '#2a3040', belly: '#4a5468', membrane: '#323a4e', memGlow: '#ffe24a', crest: '#ffe24a', beak: '#8a8aa0', glow: '#ffe24a', glowPat: 'line', eye: '#ffe24a' },
    lore: 'They say it is born from lightning. It only ever comes when the sky breaks open.', hint: 'Only during THUNDERSTORMS, high over the peaks and the sea.' },
  { id: 'titanus', name: 'Titanus', sci: 'Colossosaurus antiquus', rarity: 'mythic', size: 'XL', move: 'walk', habitat: 'forest', diet: 'herb', temper: 'calm',
    where: ['elder', 'valley'], when: { event: 'titan' }, herd: [1, 1], speed: { walk: 2.0, run: 4, turn: 0.6, jump: 0 }, fight: 5.5, erratic: 0.8, power: 9, appeal: 400, kg: [90000, 120000],
    abilities: ['carry', 'wade', 'tall', 'sturdy', 'smash'], body: B({ plan: 'sauropod', len: 40, hip: 8.5, shoulder: 9.5, neck: 15, neckAngle: 0.7, tail: 15, torso: 10, bw: 3.0, bh: 3.2, legW: 1.0, head: 1.7, feat: ['spines', 'mossy'] }),
    cols: { top: '#7a7a6a', belly: '#a8a490', moss: '#5a8a3a', stone: '#8a8a7a', spike: '#5a5a4a', glow: '#5affc8', glowPat: 'runes', eye: '#5affc8' },
    lore: 'A sauropod so old that moss and stone grew on it. Walks the land once in a long while.', hint: 'Seen only during the Titan Walk - when the ground shakes for no reason. Listen.' },
  { id: 'leviathan', name: 'Abyssal Leviathan', sci: 'Abyssosaurus profundus', rarity: 'mythic', size: 'XL', move: 'swim', habitat: 'aquatic', diet: 'carn', temper: 'territorial',
    where: ['deep'], when: { den: 'trench', night: true }, herd: [1, 1], speed: { swim: 16, turn: 1.0 }, fight: 6, erratic: 1.7, power: 9, appeal: 420, kg: [60000, 80000], depth: [80, 230],
    abilities: ['swim', 'dive', 'deepdiver', 'glow', 'carry', 'sturdy'], dive: 400, body: B({ plan: 'marine', len: 30, bw: 1.6, bh: 1.7, torso: 8, tail: 13, neck: 3, neckBones: 1, head: 3.6, headH: 1.4, headW: 0.95, flipF: 3.6, flipH: 2.6, feat: ['fluke', 'lure'], fin: 3.6, fierce: true }),
    cols: { top: '#1a2a3a', belly: '#2a3a50', pattern: 'dapple', patCol: '#12202e', glow: '#40ffd0', glowPat: 'spots', eye: '#40ffd0' },
    lore: 'A light in the dark at the bottom of the Trench. Then a much bigger light.', hint: 'At NIGHT, at the very bottom of the Trench. You will need a deep diver.' },
];
export const SP = Object.fromEntries(SPECIES.map(s => [s.id, s]));
export const SPECIES_ORDER = SPECIES.map(s => s.id);
