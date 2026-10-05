/* Biomes.js - the regions of the prehistoric continent.

   The world is ONE heightfield. Each biome is a soft blob of influence
   (centre, radius, base height, roughness); the terrain blends them, so you
   walk from meadow into jungle without a seam. `ground` colours paint the
   terrain, `fog`/`sky` tint the air while you are there, `flora` says what
   grows (see world/Scatter.js) and `amb` picks the ambient soundscape.

   North is -z. The zoo sits in the middle of Fernvale Meadows. */

export const BIOMES = {
  meadow:   { name: 'Fernvale Meadows',   tag: 'Where every zoo begins',          ground: ['#8fc45a', '#7db54c', '#a3cf63'], fog: '#cfe8f0', amb: 'meadow',   danger: 1 },
  jungle:   { name: 'The Verdant Tangle', tag: 'Dense, loud and full of teeth',   ground: ['#4f9a3c', '#3f8a35', '#5ea847'], fog: '#b8dcc0', amb: 'jungle',   danger: 2 },
  elder:    { name: 'Elderwood',          tag: 'Trees older than the mountains',  ground: ['#6a8f3e', '#5b7f38', '#7d9a48'], fog: '#c8d8b8', amb: 'forest',   danger: 2 },
  desert:   { name: 'Bonedust Flats',     tag: 'Sand, sun and very old bones',    ground: ['#e8c47c', '#dcb468', '#f0d08e'], fog: '#f4e2c0', amb: 'desert',   danger: 2 },
  swamp:    { name: 'The Murkmire',       tag: 'Something big moves in the reeds', ground: ['#5f7a3a', '#536c34', '#6e8642'], fog: '#a8b890', amb: 'swamp',    danger: 3 },
  peaks:    { name: 'The Spine Peaks',    tag: 'Where the sky-lizards nest',      ground: ['#8a8f86', '#7a8078', '#9aa092'], fog: '#d8e4ee', amb: 'wind',     danger: 3 },
  tundra:   { name: 'Frostfang Tundra',   tag: 'Cold enough to freeze a roar',    ground: ['#eef4f8', '#dfe9f0', '#f8fbfd'], fog: '#e4eef6', amb: 'wind',     danger: 4 },
  volcano:  { name: 'Mount Cinder',       tag: 'The mountain is awake',           ground: ['#4a3f3a', '#3c3330', '#5a4c44'], fog: '#c8a898', amb: 'volcano',  danger: 4 },
  beach:    { name: 'Sunbeach Coast',     tag: 'Warm sand, warm sea',             ground: ['#f2dca2', '#ead090', '#f8e6b4'], fog: '#d4ecf4', amb: 'beach',    danger: 1 },
  ocean:    { name: 'The Shallows',       tag: 'Clear water over the reef',       ground: ['#d8c890', '#c8b880', '#bfae78'], fog: '#bfe0ec', amb: 'ocean',    danger: 2 },
  deep:     { name: 'The Deep Blue',      tag: 'Nothing down there is small',     ground: ['#3a5068', '#2e4258', '#465c74'], fog: '#9ccae0', amb: 'ocean',    danger: 4 },
  valley:   { name: 'The Lost Valley',    tag: 'Sealed off since the old days',   ground: ['#5aa04a', '#4a9040', '#6cb058'], fog: '#c8e0c0', amb: 'jungle',   danger: 4 },
  isle:     { name: 'Palm Isle',          tag: 'A tropical speck in the sea',     ground: ['#7cc456', '#6cb44a', '#8cd064'], fog: '#cdeef0', amb: 'beach',    danger: 1 },
  skull:    { name: 'Skull Isle',         tag: 'Nobody who went came back... bored', ground: ['#4a7a3a', '#3e6a32', '#567f40'], fog: '#b0c4b8', amb: 'jungle', danger: 4 },
  cave:     { name: 'Crystal Hollow',     tag: 'Glittering and very dark',        ground: ['#4a4658', '#3c3a4a', '#555068'], fog: '#201c30', amb: 'cave',     danger: 3 },
};

/** The influence blobs that shape the land: [biome, x, z, radius, height, roughness, kind] */
export const REGIONS = [
  ['meadow', 0, 60, 360, 9, 5, 'roll'],
  ['jungle', -40, -330, 300, 20, 16, 'hill'],
  ['elder', -500, -360, 270, 26, 10, 'roll'],
  ['desert', -680, 200, 340, 12, 7, 'dune'],
  ['swamp', 640, -110, 290, 0.25, 2.4, 'flat'],
  ['peaks', 0, -800, 420, 95, 125, 'ridge'],
  ['tundra', -660, -840, 320, 46, 14, 'roll'],
  ['volcano', 680, -680, 280, 34, 14, 'hill'],
  ['beach', 0, 640, 300, 4, 2, 'flat'],
];

export const ZOO = { x: 0, z: 110, y: 8, half: 112, base: 56 };   // flattened plateau; `base` = starting buildable half-size

export const RIVER = [
  [250, -980], [235, -760], [285, -560], [215, -400], [250, -230], [330, -70],
  [385, 110], [420, 290], [470, 450], [540, 600], [590, 760],
];

export const MESAS = [   // desert table mountains: x, z, radius, height
  [-560, 30, 52, 72, 'sky'], [-790, 270, 66, 88, 'big'], [-700, -70, 38, 58, 'small'], [-480, 300, 30, 44, 'tiny'],
];

export const VOLCANO = { x: 720, z: -720, r: 330, h: 250, crater: 72, lava: 168 };
export const VALLEY = { x: -150, z: -610, r: 118, floor: 20 };
export const WHITEOUT = { x: -780, z: -900, r: 150 };
export const ISLANDS = [
  { id: 'isle', x: 400, z: 820, r: 85, h: 16 },
  { id: 'skull', x: -440, z: 880, r: 115, h: 34 },
  { id: 'reef', x: 60, z: 900, r: 26, h: 4 },
];
export const TRENCH = { x: 40, z: 1060, a: 520, b: 110, depth: -240 };
export const WORLD_HALF = 1200;
