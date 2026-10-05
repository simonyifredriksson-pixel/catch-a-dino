/* Build.js - what you can build at the zoo (B opens build mode).

   EXHIBITS have a habitat and a size. A creature is happiest in its own
   habitat (species.habitat), needs an exhibit at least its size, and takes up
   space (S 1, M 2, L 4, XL 8). Flyers only live in aviaries, swimmers only in
   aquatic tanks. Aggressive predators belong in a predator paddock - anywhere
   else they get restless, and restless tyrants break out.
   DECOR inside an exhibit makes its animals happier (and the zoo prettier).
   BUILDINGS: the Hatchery (eggs) and a Viewing Deck to admire your animals.
   There are no visitors to manage: animals on show simply earn money.
   `level` is the zoo star level that unlocks it. */
export const HABITATS = {
  meadow:   { name: 'Meadow',   ground: '#8cc85a', fence: 'wood',    props: ['fern', 'flowers', 'rock', 'cycad'], level: 0 },
  jungle:   { name: 'Jungle',   ground: '#4f9a3c', fence: 'bamboo',  props: ['tfern', 'jtree', 'fern', 'palm'], level: 1 },
  desert:   { name: 'Desert',   ground: '#e8c47c', fence: 'stone',   props: ['succulent', 'rock', 'deadtree', 'bones'], level: 1 },
  swamp:    { name: 'Swamp',    ground: '#5f7a3a', fence: 'log',     props: ['reeds', 'horsetail', 'swamptree', 'mushroom'], level: 2, pond: true },
  forest:   { name: 'Forest',   ground: '#6a8f3e', fence: 'log',     props: ['araucaria', 'ginkgo', 'fern', 'log'], level: 2 },
  mountain: { name: 'Mountain', ground: '#9a9a8e', fence: 'stone',   props: ['rock', 'rock', 'pebbles', 'snowpine'], level: 2, hill: true },
  arctic:   { name: 'Arctic',   ground: '#eef4f8', fence: 'ice',     props: ['icespire', 'snowpine', 'rock'], level: 3 },
  volcanic: { name: 'Volcanic', ground: '#4a3f3a', fence: 'metal',   props: ['lavarock', 'deadtree', 'pebbles'], level: 4 },
  cave:     { name: 'Cavern',   ground: '#4a4658', fence: 'stone',   props: ['crystal', 'rock', 'mushroom'], level: 4, roof: true },
  predator: { name: 'Predator Paddock', ground: '#6a9a4a', fence: 'electric', props: ['jtree', 'rock', 'log', 'bones'], level: 2 },
  aviary:   { name: 'Aviary',   ground: '#8cc85a', fence: 'dome',    props: ['rock', 'deadtree', 'palm'], level: 2, flyers: true },
  aquatic:  { name: 'Aquatic Tank', ground: '#3a8ab0', fence: 'glass', props: ['coral', 'kelp', 'rock'], level: 2, water: true },
};
export const EX_SIZES = {
  S: { name: 'Small', w: 18, space: 4, price: 600 },
  M: { name: 'Medium', w: 26, space: 10, price: 2200 },
  L: { name: 'Large', w: 36, space: 24, price: 6500 },
  XL: { name: 'Huge', w: 50, space: 60, price: 16000 },
};
export const HAB_PRICE = { meadow: 1, jungle: 1.15, desert: 1.1, swamp: 1.3, forest: 1.25, mountain: 1.3, arctic: 1.6, volcanic: 1.8, cave: 1.9, predator: 1.5, aviary: 1.6, aquatic: 1.9 };
export const SIZE_LEVEL = { S: 0, M: 1, L: 2, XL: 4 };

export const DECOR = {
  tree:     { name: 'Tree Fern', cat: 'nature', flora: 'tfern', price: 60, level: 0, r: 1 },
  jtree:    { name: 'Jungle Tree', cat: 'nature', flora: 'jtree', price: 150, level: 1, r: 1.5 },
  palm:     { name: 'Palm', cat: 'nature', flora: 'palm', price: 90, level: 0, r: 1 },
  pine:     { name: 'Snow Pine', cat: 'nature', flora: 'snowpine', price: 120, level: 2, r: 1 },
  ginkgo:   { name: 'Ginkgo', cat: 'nature', flora: 'ginkgo', price: 140, level: 1, r: 1.2 },
  bush:     { name: 'Bush', cat: 'nature', flora: 'bush', price: 30, level: 0, r: 1 },
  flowers:  { name: 'Flower Bed', cat: 'nature', flora: 'flowers', price: 25, level: 0, r: 0.8 },
  fern:     { name: 'Ferns', cat: 'nature', flora: 'fern', price: 20, level: 0, r: 0.8 },
  rock:     { name: 'Boulder', cat: 'nature', flora: 'rock', price: 50, level: 0, r: 1.6 },
  log:      { name: 'Fallen Log', cat: 'nature', flora: 'log', price: 40, level: 0, r: 1.5 },
  ice:      { name: 'Ice Spire', cat: 'nature', flora: 'icespire', price: 110, level: 3, r: 1.3 },
  crystal:  { name: 'Glow Crystals', cat: 'nature', flora: 'crystal', price: 260, level: 4, r: 1.2 },
  lava:     { name: 'Lava Rock', cat: 'nature', flora: 'lavarock', price: 180, level: 4, r: 1.6 },
  pond:     { name: 'Pond', cat: 'nature', art: 'pond', price: 220, level: 1, r: 3.2 },
  path:     { name: 'Path Tile', cat: 'path', art: 'path', price: 8, level: 0, r: 0, tile: 4 },
  path2:    { name: 'Stone Path', cat: 'path', art: 'path2', price: 14, level: 2, r: 0, tile: 4 },
  bench:    { name: 'Bench', cat: 'deco', art: 'bench', price: 45, level: 0, r: 0.8, joy: 1 },
  lamp:     { name: 'Lamp Post', cat: 'deco', art: 'lamp', price: 60, level: 0, r: 0.3, joy: 0.5 },
  bin:      { name: 'Bin', cat: 'deco', art: 'bin', price: 25, level: 0, r: 0.4, joy: 0.5 },
  flag:     { name: 'Banner Flag', cat: 'deco', art: 'flag', price: 70, level: 1, r: 0.3, joy: 1 },
  statue:   { name: 'Creature Statue', cat: 'deco', art: 'statue', price: 600, level: 2, r: 1.5, joy: 4 },
  fountain: { name: 'Fountain', cat: 'deco', art: 'fountain', price: 1200, level: 3, r: 2.6, joy: 6 },
  topiary:  { name: 'Topiary Creature', cat: 'deco', art: 'topiary', price: 450, level: 2, r: 1.4, joy: 3 },
  balloon:  { name: 'Balloon Stall', cat: 'deco', art: 'balloon', price: 350, level: 1, r: 1, joy: 3 },
  platform: { name: 'Viewing Deck', cat: 'shop', art: 'platform', price: 1600, level: 2, r: 3.5, view: true },
  hatchery: { name: 'Hatchery', cat: 'shop', art: 'hatchery', price: 2500, level: 1, r: 4, unique: true },
};
export const DECOR_CATS = [
  { k: 'exhibit', name: 'Exhibits' },
  { k: 'nature', name: 'Nature' },
  { k: 'path', name: 'Paths' },
  { k: 'deco', name: 'Decor' },
  { k: 'shop', name: 'Buildings' },
];
/** zoo star levels: the income ($ a minute) needed for each */
export const ZOO_LEVELS = [0, 35, 130, 380, 950, 2100, 4600, 10000];
export const ZOO_LEVEL_NAMES = ['Camp', 'Outpost', 'Ranger Base', 'Creature Sanctuary', 'Famous Sanctuary', 'Grand Sanctuary', 'Wonder of the World', 'Legendary Sanctuary'];
/** how much land you can build on: half-size of the buildable square per plot level */
export const PLOTS = [{ half: 56, price: 0 }, { half: 72, price: 3000 }, { half: 88, price: 12000 }, { half: 100, price: 30000 }, { half: 112, price: 70000 }];
