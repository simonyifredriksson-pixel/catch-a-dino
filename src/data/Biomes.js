/* Biomes.js - the shape of the world.

   HOME ISLAND -> THE LAGOON -> THE REGIONS -> THE WILD EDGE

   Your zoo sits on Home Island in the middle of the map. All round it is the
   Glass Lagoon, the first place you explore (fish it, ride across it). The
   lagoon's far shores are the regions, and rivers run from them into the
   lagoon, so you can swim inland:
     NORTH  the Verdant Tangle (jungle) and, north-west, the Elderwood
     EAST   Bonedust Flats (mesas, bones) under the Spine Peaks
     SOUTH  the Murkmire (swamp), where the Giant River ends
     WEST   the lagoon opens into the open sea: Palm Isle, Skull Isle, the
            sunken ruins, and far out the Trench
   Farther from home is wilder: the Lost Valley and Frostfang Tundra beyond
   the northern peaks, Mount Cinder past the eastern range. A ring of high
   mountains closes the north, east and south edges of the world, so there is
   always something on the horizon.

   Each biome is a soft blob (centre, radius, base height, roughness); the
   terrain blends them, so you walk from one into the next without a seam.
   North is -z. */

export const BIOMES = {
  home:     { name: 'Home Island',        tag: 'Your zoo. Your home. The world is out there.', ground: ['#8fc45a', '#86bd52', '#9ccb62'], fog: '#cfe8f0', amb: 'meadow', danger: 0 },
  meadow:   { name: 'Fernvale Shore',     tag: 'Easy pickings on the north shore',  ground: ['#8fc45a', '#7db54c', '#a3cf63'], fog: '#cfe8f0', amb: 'meadow',   danger: 1 },
  lake:     { name: 'The Glass Lagoon',   tag: 'Calm water, curious creatures',     ground: ['#d8c890', '#c8b880', '#bfae78'], fog: '#c4e6f0', amb: 'ocean',    danger: 1 },
  jungle:   { name: 'The Verdant Tangle', tag: 'Dense, loud and full of teeth',     ground: ['#4f9a3c', '#3f8a35', '#5ea847'], fog: '#b8dcc0', amb: 'jungle',   danger: 2 },
  elder:    { name: 'Elderwood',          tag: 'Trees older than the mountains',    ground: ['#6a8f3e', '#5b7f38', '#7d9a48'], fog: '#c8d8b8', amb: 'forest',   danger: 2 },
  desert:   { name: 'Bonedust Flats',     tag: 'Sand, sun and very old bones',      ground: ['#e8c47c', '#dcb468', '#f0d08e'], fog: '#f4e2c0', amb: 'desert',   danger: 2 },
  swamp:    { name: 'The Murkmire',       tag: 'Something big moves in the reeds',  ground: ['#5f7a3a', '#536c34', '#6e8642'], fog: '#a8b890', amb: 'swamp',    danger: 2 },
  peaks:    { name: 'The Spine Peaks',    tag: 'Where the sky-lizards nest',        ground: ['#8a8f86', '#7a8078', '#9aa092'], fog: '#d8e4ee', amb: 'wind',     danger: 3 },
  tundra:   { name: 'Frostfang Tundra',   tag: 'Cold enough to freeze a roar',      ground: ['#eef4f8', '#dfe9f0', '#f8fbfd'], fog: '#e4eef6', amb: 'wind',     danger: 4 },
  volcano:  { name: 'Mount Cinder',       tag: 'The mountain is awake',             ground: ['#4a3f3a', '#3c3330', '#5a4c44'], fog: '#c8a898', amb: 'volcano',  danger: 4 },
  beach:    { name: 'Sunbeach',           tag: 'Warm sand, warm water',             ground: ['#f2dca2', '#ead090', '#f8e6b4'], fog: '#d4ecf4', amb: 'beach',    danger: 1 },
  ocean:    { name: 'The Open Sea',       tag: 'The lagoon opens into the blue',    ground: ['#d8c890', '#c8b880', '#bfae78'], fog: '#bfe0ec', amb: 'ocean',    danger: 2 },
  deep:     { name: 'The Deep Blue',      tag: 'Nothing down there is small',       ground: ['#3a5068', '#2e4258', '#465c74'], fog: '#9ccae0', amb: 'ocean',    danger: 4 },
  valley:   { name: 'The Lost Valley',    tag: 'Sealed off since the old days',     ground: ['#5aa04a', '#4a9040', '#6cb058'], fog: '#c8e0c0', amb: 'jungle',   danger: 4 },
  isle:     { name: 'Palm Isle',          tag: 'A tropical speck in the sea',       ground: ['#7cc456', '#6cb44a', '#8cd064'], fog: '#cdeef0', amb: 'beach',    danger: 1 },
  skull:    { name: 'Skull Isle',         tag: 'Nobody who went came back... bored', ground: ['#4a7a3a', '#3e6a32', '#567f40'], fog: '#b0c4b8', amb: 'jungle', danger: 4 },
  cave:     { name: 'Crystal Hollow',     tag: 'Glittering and very dark',          ground: ['#4a4658', '#3c3a4a', '#555068'], fog: '#201c30', amb: 'cave',     danger: 3 },
};

/** home island and the lagoon round it */
export const HOME = { x: 0, z: 0, r: 255 };
export const LAGOON = { r: 520 };            // the far shore (it wobbles with noise and opens to the west)
export const ZOO = { x: 0, z: -12, y: 8, half: 112, base: 56 };
export const DOCK = { x: 34, z: 236, len: 34 };

/** influence blobs on the mainland: [biome, x, z, radius, height, roughness, kind, stretchX] */
export const REGIONS = [
  ['meadow', 0, -600, 280, 8, 5, 'roll'],
  ['jungle', 100, -800, 340, 20, 16, 'hill'],
  ['elder', -460, -760, 320, 26, 10, 'roll'],
  ['desert', 780, 180, 340, 12, 7, 'dune'],
  ['swamp', 40, 760, 400, 0.3, 2.4, 'flat'],
  ['swamp', 520, 640, 220, 0.6, 2.4, 'flat'],
  ['peaks', 0, -1210, 230, 95, 120, 'ridge', 3.2],
  ['peaks', 1210, 0, 210, 95, 120, 'ridge', 0.3],
  ['peaks', 120, 1220, 200, 80, 110, 'ridge', 3],
  ['tundra', 600, -1000, 300, 46, 14, 'roll'],
  ['volcano', 920, -580, 260, 34, 14, 'hill'],
  ['beach', 0, 0, 1, 3, 1, 'flat'],
];

/** rivers flow from the regions into the lagoon: swim up them */
export const RIVERS = [
  { id: 'giant', name: 'The Giant River', pts: [[160, -1080], [120, -900], [190, -760], [90, -640], [40, -520]], w0: 22, w1: 60 },
  { id: 'murk', name: 'Murk River', pts: [[-120, 1060], [-60, 900], [60, 780], [20, 640], [10, 520]], w0: 20, w1: 55 },
  { id: 'gorge', name: 'Bonedust Gorge', pts: [[1040, -220], [900, -160], [760, -40], [600, 20], [520, 20]], w0: 16, w1: 40 },
];
export const RIVER = RIVERS[0].pts;   // (older code paths)

export const MESAS = [   // desert table mountains: x, z, radius, height
  [700, 40, 52, 72, 'sky'], [880, 320, 62, 86, 'big'], [640, 300, 36, 56, 'small'], [820, 130, 28, 44, 'tiny'],
];
export const VOLCANO = { x: 930, z: -600, r: 300, h: 250, crater: 70, lava: 168 };
export const VALLEY = { x: -360, z: -1000, r: 112, floor: 22 };
export const WHITEOUT = { x: 640, z: -1060, r: 130 };
export const ISLANDS = [
  { id: 'isle', x: -700, z: -160, r: 90, h: 16 },
  { id: 'skull', x: -820, z: 520, r: 120, h: 34 },
  { id: 'reef', x: -330, z: 330, r: 30, h: 5 },
  { id: 'reef', x: 300, z: -330, r: 26, h: 5 },
  { id: 'reef', x: -460, z: -420, r: 34, h: 6 },
];
export const TRENCH = { x: -1060, z: 120, a: 120, b: 520, depth: -240 };
export const GROTTO = { x: 300, z: 270, r: 34 };   // a ring of sea-stacks in the lagoon; only small swimmers fit through the gap
export const WORLD_HALF = 1200;
