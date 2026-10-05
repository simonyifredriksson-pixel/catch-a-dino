/* Places.js - the named places of the world, and what is hidden there.

   SPOTS      where every set piece stands (move one here and it moves everywhere)
   PLACES     discovered when you first reach them (a title card, a map marker)
   BEACONS    ranger beacons: light one (E) and, with the beacon upgrade, fast travel to it
   GATES      blocked ways: boulders need a creature that SMASHES (or, under
              water, RAMS), vines need a machete or a creature that SLASHES
   INTERIORS  caves and vaults, built outside the map edge and reached through
              a mouth in the world (walk in)
   CHESTS     one-time treasure
   NESTS      eggs in high places (only flyers and climbers get there) */
import { ZOO, DOCK, VALLEY, ISLANDS, GROTTO, VOLCANO, WHITEOUT, TRENCH, MESAS } from './Biomes.js';

export const SPOTS = {
  temple: { x: -60, z: -740, base: 46 },
  ribcage: { x: 700, z: 240 },
  obelisk: { x: 930, z: 400 },
  worldtree: { x: -500, z: -780 },
  skull: { x: ISLANDS[1].x, z: ISLANDS[1].z + 20 },
  frozen: { x: 610, z: -960 },
  crater: { x: 620, z: 470 },
  ruins: { x: -340, z: 110 },
  colossus: { x: -900, z: -360 },
  hollow: { x: 1000, z: 60 },
  arches: [[-130, -505, 1, 0.3], [-165, -522, 0.6, 1.2], [520, -170, 0.85, -0.4], [-30, 515, 0.8, 0.9]],
  grotto: GROTTO,
  dock: DOCK,
};

export const PLACES = [
  { id: 'zoo', name: 'Home Island', x: ZOO.x, z: ZOO.z, r: 120, icon: 'zoo' },
  { id: 'lagoon', name: 'The Glass Lagoon', x: 0, z: 0, r: 330, minR: 270, icon: 'wave', tag: 'Everything out there starts here' },
  { id: 'temple', name: 'The Sunken Temple', x: SPOTS.temple.x, z: SPOTS.temple.z, r: 55, icon: 'ruin', tag: 'Something old sleeps under the vines' },
  { id: 'ribcage', name: 'The Great Ribcage', x: SPOTS.ribcage.x, z: SPOTS.ribcage.z, r: 55, icon: 'bone', tag: 'What was big enough to leave THAT?' },
  { id: 'obelisk', name: 'The Star Obelisk', x: SPOTS.obelisk.x, z: SPOTS.obelisk.z, r: 45, icon: 'ruin', tag: 'It glows at night. Nobody knows why.' },
  { id: 'worldtree', name: 'The World Tree', x: SPOTS.worldtree.x, z: SPOTS.worldtree.z, r: 60, icon: 'tree', tag: 'Its top is above the clouds' },
  { id: 'skymesa', name: 'Sky Mesa', x: MESAS[0][0], z: MESAS[0][1], r: 50, icon: 'peak', tag: 'Only wings - or claws - get you up here', minY: 70 },
  { id: 'skull', name: 'Skull Rock', x: SPOTS.skull.x, z: SPOTS.skull.z, r: 75, icon: 'skull', tag: 'The island grins at passing ships' },
  { id: 'frozen', name: 'The Frozen Titan', x: SPOTS.frozen.x, z: SPOTS.frozen.z, r: 55, icon: 'bone', tag: 'Locked in ice for a million years' },
  { id: 'crater', name: 'Starfall Crater', x: SPOTS.crater.x, z: SPOTS.crater.z, r: 40, icon: 'star', tag: 'Something fell from the sky here' },
  { id: 'ruins', name: 'The Sunken Ruins', x: SPOTS.ruins.x, z: SPOTS.ruins.z, r: 55, icon: 'ruin', tag: 'A city under the lagoon' },
  { id: 'grotto', name: 'Turtle Grotto', x: GROTTO.x, z: GROTTO.z, r: 30, icon: 'wave', tag: 'Only small swimmers slip between the stacks' },
  { id: 'colossus', name: 'The Drowned Colossus', x: SPOTS.colossus.x, z: SPOTS.colossus.z, r: 70, icon: 'bone', tag: 'Bones of something that ate whales' },
  { id: 'valley', name: 'The Lost Valley', x: VALLEY.x, z: VALLEY.z, r: 95, icon: 'peak', tag: 'Sealed off since the old days' },
  { id: 'whiteout', name: 'The Whiteout', x: WHITEOUT.x, z: WHITEOUT.z, r: 120, icon: 'snow', tag: 'The blizzard that never ends' },
  { id: 'caldera', name: 'Cinder Caldera', x: VOLCANO.x, z: VOLCANO.z, r: 95, icon: 'fire', tag: 'The mountain breathes fire' },
  { id: 'palm', name: 'Palm Isle', x: ISLANDS[0].x, z: ISLANDS[0].z, r: 90, icon: 'tree' },
  { id: 'trench', name: 'The Trench', x: TRENCH.x, z: TRENCH.z, r: 220, icon: 'wave', tag: 'The deepest blue there is' },
  { id: 'north', name: 'Fernvale Shore', x: 0, z: -560, r: 90, icon: 'tree', tag: 'The first land across the water' },
  { id: 'murk', name: 'The Murkmire', x: 60, z: 720, r: 160, icon: 'swamp' },
  { id: 'river', name: 'The Giant River', x: 120, z: -820, r: 60, icon: 'wave' },
];
export const BEACONS = [
  { id: 'b_north', name: 'Fernvale Beacon', x: 60, z: -560 },
  { id: 'b_jungle', name: 'Tangle Beacon', x: 230, z: -880 },
  { id: 'b_elder', name: 'Elderwood Beacon', x: -400, z: -650 },
  { id: 'b_east', name: 'Bonedust Beacon', x: 600, z: 80 },
  { id: 'b_volcano', name: 'Cinder Beacon', x: 760, z: -470 },
  { id: 'b_tundra', name: 'Frostfang Beacon', x: 480, z: -930 },
  { id: 'b_south', name: 'Murkmire Beacon', x: 100, z: 580 },
  { id: 'b_swamp', name: 'Deep Murk Beacon', x: 440, z: 700 },
  { id: 'b_palm', name: 'Palm Isle Beacon', x: ISLANDS[0].x + 20, z: ISLANDS[0].z + 20 },
  { id: 'b_skull', name: 'Skull Isle Beacon', x: ISLANDS[1].x + 50, z: ISLANDS[1].z - 60 },
];
export const GATES = [
  { id: 'g_pass', kind: 'boulder', name: 'Rockfall', x: VALLEY.x + 95, z: VALLEY.z + 150, r: 9, need: 'smash', hint: 'A wall of fallen boulders. Something with a hard head could smash through.' },
  { id: 'g_hollow', kind: 'boulder', name: 'Collapsed Cave Mouth', x: 0, z: 0, r: 6, need: 'smash', cave: 'hollow', hint: 'The cave mouth is blocked by rocks. A creature that SMASHES could clear it.' },
  { id: 'g_temple', kind: 'vines', name: 'Vine Curtain', x: SPOTS.temple.x, z: SPOTS.temple.z + 24, r: 4, need: 'cut', hint: 'Thick vines over a doorway. A machete - or big claws - would cut through.' },
  { id: 'g_reef', kind: 'boulder', name: 'Sunken Rockfall', x: SPOTS.ruins.x - 30, z: SPOTS.ruins.z - 26, r: 7, need: 'ram', under: true, hint: 'Rocks block a sunken doorway. A strong swimmer could RAM through (F).' },
];
export const INTERIORS = {
  hollow: { name: 'Crystal Hollow', x: 1800, z: 0, r: 72, floor: 10, dark: true, biome: 'cave' },
  vault: { name: 'The Temple Vault', x: 1800, z: 320, r: 26, floor: 10, dark: true, biome: 'cave' },
  skullcave: { name: 'Inside Skull Rock', x: 1800, z: 620, r: 46, floor: 10, dark: true, biome: 'cave' },
};
const R = SPOTS.ruins, C = SPOTS.colossus;
export const CHESTS = [
  { id: 'c_ruins1', x: R.x + 8, z: R.z - 8, loot: [['pearl', 1], ['amber', 2]] },
  { id: 'c_ruins2', x: R.x - 18, z: R.z + 15, loot: [['pearl', 1], ['money', 800]] },
  { id: 'c_ruins3', x: R.x - 34, z: R.z - 32, loot: [['pearl', 2], ['amber', 3], ['egg', 1, 'ocean']] },   // behind the sunken rockfall
  { id: 'c_grotto', x: GROTTO.x, z: GROTTO.z, loot: [['pearl', 1], ['egg', 1, 'lake']] },
  { id: 'c_colossus', x: C.x + 10, z: C.z + 10, loot: [['pearl', 2], ['money', 2500], ['egg', 1, 'deep']] },
  { id: 'c_vault', interior: 'vault', ox: 0, oz: -16, loot: [['idol', 1], ['money', 3000]] },
  { id: 'c_hollow1', interior: 'hollow', ox: -30, oz: -40, loot: [['crystal', 3], ['egg', 1, 'cave']] },
  { id: 'c_hollow2', interior: 'hollow', ox: 38, oz: -22, loot: [['crystal', 2], ['amber', 2]] },
  { id: 'c_skull', interior: 'skullcave', ox: 0, oz: -30, loot: [['money', 2000], ['egg', 1, 'skull']] },
  { id: 'c_obelisk', x: SPOTS.obelisk.x + 6, z: SPOTS.obelisk.z + 12, loot: [['amber', 2], ['money', 600]] },
  { id: 'c_frozen', x: SPOTS.frozen.x + 10, z: SPOTS.frozen.z + 12, loot: [['bigfossil', 1], ['egg', 1, 'tundra']] },
];
export const NESTS = [
  { id: 'n_mesa', name: 'Sky Mesa Nest', x: MESAS[0][0], z: MESAS[0][1], top: true, loot: [['egg', 1, 'peaks'], ['egg', 1, 'peaks']] },
  { id: 'n_tree', name: 'World Tree Nest', x: SPOTS.worldtree.x, z: SPOTS.worldtree.z, tree: true, loot: [['egg', 1, 'elder'], ['amber', 2]] },
];
/** narrow cracks a tiny creature can squeeze into: [x, z, biome] */
export const CRACKS = [
  [-120, -640, 'meadow'], [240, -760, 'jungle'], [-60, -900, 'jungle'], [-380, -800, 'elder'], [620, 140, 'desert'], [820, 260, 'desert'],
  [-80, 640, 'swamp'], [380, 600, 'swamp'], [880, -500, 'volcano'], [520, -1000, 'tundra'], [ISLANDS[1].x + 40, ISLANDS[1].z + 30, 'skull'],
  [ISLANDS[0].x - 20, ISLANDS[0].z + 30, 'isle'], [VALLEY.x + 20, VALLEY.z + 30, 'valley'], [60, 120, 'home'],
];
