/* Places.js - the named places of the world, and what is hidden there.

   PLACES     discovered when you first reach them (a title card, a map marker)
   BEACONS    ranger beacons: light one (E) and, with the beacon upgrade, fast travel to it
   GATES      blocked ways: boulders need a creature that SMASHES, vines need a
              machete or a creature that SLASHES
   INTERIORS  caves and vaults, built outside the map edge and reached through
              a mouth in the world (walk in)
   CHESTS     one-time treasure
   NESTS      eggs in high places (only flyers and climbers get there) */
export const PLACES = [
  { id: 'zoo', name: 'Your Zoo', x: 0, z: 110, r: 100, icon: 'zoo' },
  { id: 'temple', name: 'The Sunken Temple', x: -160, z: -320, r: 55, icon: 'ruin', tag: 'Something old sleeps under the vines' },
  { id: 'ribcage', name: 'The Great Ribcage', x: -610, z: 260, r: 55, icon: 'bone', tag: 'What was big enough to leave THAT?' },
  { id: 'obelisk', name: 'The Star Obelisk', x: -830, z: -30, r: 45, icon: 'ruin', tag: 'It glows at night. Nobody knows why.' },
  { id: 'worldtree', name: 'The World Tree', x: -520, z: -430, r: 60, icon: 'tree', tag: 'Its top is above the clouds' },
  { id: 'skymesa', name: 'Sky Mesa', x: -560, z: 30, r: 50, icon: 'peak', tag: 'Only wings - or claws - get you up here', minY: 70 },
  { id: 'skull', name: 'Skull Rock', x: -440, z: 880, r: 75, icon: 'skull', tag: 'The island grins at passing ships' },
  { id: 'frozen', name: 'The Frozen Titan', x: -700, z: -760, r: 55, icon: 'bone', tag: 'Locked in ice for a million years' },
  { id: 'crater', name: 'Starfall Crater', x: -330, z: 250, r: 40, icon: 'star', tag: 'Something fell from the sky here' },
  { id: 'ruins', name: 'The Sunken Ruins', x: 150, z: 720, r: 55, icon: 'ruin', tag: 'A city under the waves' },
  { id: 'colossus', name: 'The Drowned Colossus', x: -160, z: 965, r: 70, icon: 'bone', tag: 'Bones of something that ate whales' },
  { id: 'valley', name: 'The Lost Valley', x: -150, z: -610, r: 95, icon: 'peak', tag: 'Sealed off since the old days' },
  { id: 'whiteout', name: 'The Whiteout', x: -780, z: -900, r: 140, icon: 'snow', tag: 'The blizzard that never ends' },
  { id: 'caldera', name: 'Cinder Caldera', x: 720, z: -720, r: 95, icon: 'fire', tag: 'The mountain breathes fire' },
  { id: 'arches', name: 'Sunbeach Arches', x: -220, z: 578, r: 40, icon: 'peak' },
  { id: 'palm', name: 'Palm Isle', x: 400, z: 820, r: 90, icon: 'tree' },
  { id: 'trench', name: 'The Trench', x: 40, z: 1060, r: 220, icon: 'wave', tag: 'The deepest blue there is' },
  { id: 'murk', name: 'The Murkmire', x: 640, z: -110, r: 160, icon: 'swamp' },
  { id: 'river', name: 'The Giant River', x: 300, z: -150, r: 50, icon: 'wave' },
];
export const BEACONS = [
  { id: 'b_jungle', name: 'Tangle Beacon', x: -30, z: -150 },
  { id: 'b_desert', name: 'Bonedust Beacon', x: -430, z: 150 },
  { id: 'b_elder', name: 'Elderwood Beacon', x: -390, z: -270 },
  { id: 'b_swamp', name: 'Murkmire Beacon', x: 470, z: -40 },
  { id: 'b_peaks', name: 'Spine Beacon', x: 40, z: -500 },
  { id: 'b_tundra', name: 'Frostfang Beacon', x: -520, z: -650 },
  { id: 'b_volcano', name: 'Cinder Beacon', x: 520, z: -520 },
  { id: 'b_beach', name: 'Sunbeach Beacon', x: 130, z: 515 },
  { id: 'b_skull', name: 'Skull Isle Beacon', x: -380, z: 830 },
  { id: 'b_palm', name: 'Palm Isle Beacon', x: 385, z: 800 },
];
export const GATES = [
  { id: 'g_pass', kind: 'boulder', name: 'Rockfall', x: -122, z: -440, r: 9, need: 'smash', hint: 'A wall of fallen boulders. Something with a hard head could smash through.' },
  { id: 'g_hollow', kind: 'boulder', name: 'Collapsed Cave Mouth', x: 0, z: 0, r: 6, need: 'smash', cave: 'hollow', hint: 'The cave mouth is blocked by rocks. A creature that SMASHES could clear it.' },
  { id: 'g_temple', kind: 'vines', name: 'Vine Curtain', x: -160, z: -296, r: 4, need: 'cut', hint: 'Thick vines over a doorway. A machete - or big claws - would cut through.' },
];
export const INTERIORS = {
  hollow: { name: 'Crystal Hollow', x: 1800, z: 0, r: 72, floor: 10, dark: true, biome: 'cave' },
  vault: { name: 'The Temple Vault', x: 1800, z: 320, r: 26, floor: 10, dark: true, biome: 'cave' },
  skullcave: { name: 'Inside Skull Rock', x: 1800, z: 620, r: 46, floor: 10, dark: true, biome: 'cave' },
};
export const CHESTS = [
  { id: 'c_ruins1', x: 158, z: 712, loot: [['pearl', 1], ['amber', 2]] },
  { id: 'c_ruins2', x: 132, z: 735, loot: [['pearl', 1], ['money', 800]] },
  { id: 'c_ruins3', x: 172, z: 740, loot: [['amber', 3], ['egg', 1, 'ocean']] },
  { id: 'c_colossus', x: -150, z: 975, loot: [['pearl', 2], ['money', 2500], ['egg', 1, 'deep']] },
  { id: 'c_vault', interior: 'vault', ox: 0, oz: -16, loot: [['idol', 1], ['money', 3000]] },
  { id: 'c_hollow1', interior: 'hollow', ox: -30, oz: -40, loot: [['crystal', 3], ['egg', 1, 'cave']] },
  { id: 'c_hollow2', interior: 'hollow', ox: 38, oz: -22, loot: [['crystal', 2], ['amber', 2]] },
  { id: 'c_skull', interior: 'skullcave', ox: 0, oz: -30, loot: [['money', 2000], ['egg', 1, 'skull']] },
  { id: 'c_obelisk', x: -824, z: -18, loot: [['amber', 2], ['money', 600]] },
  { id: 'c_frozen', x: -690, z: -748, loot: [['bigfossil', 1], ['egg', 1, 'tundra']] },
];
export const NESTS = [
  { id: 'n_mesa', name: 'Sky Mesa Nest', x: -560, z: 30, top: true, loot: [['egg', 1, 'peaks'], ['egg', 1, 'peaks']] },
  { id: 'n_tree', name: 'World Tree Nest', x: -520, z: -430, tree: true, loot: [['egg', 1, 'elder'], ['amber', 2]] },
];
