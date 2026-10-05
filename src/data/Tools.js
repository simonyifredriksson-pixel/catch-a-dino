/* Tools.js - everything you can hold.

   ADDING A TOOL: add an entry here. `behavior` picks the code that runs it
   (game/Tools.js has one handler per behaviour: 'lasso', 'bola', 'net',
   'harpoon', 'skyhook' all throw something and start a catch; 'scan',
   'cut', 'dig', 'light', 'photo' are utilities). `model` picks the art in
   art/ToolArt.js (falls back to the behaviour's default). Stats feed the
   catch fight (game/Catching.js):

     rating    how strong a creature it can hold (compare with species.fight).
               Over the rating, the catch meter bleeds however well you play.
     band      size of your catch zone on the tug meter (0..1)
     lift/fall how fast holding raises / letting go drops the zone
     control   damping (higher = steadier zone)
     range     throw distance (m);  speed  projectile speed;  reach  how close
               the loop has to land to a creature to snare it
     window    timing window for the snare (the shrinking ring) - multiplier
     targets   'land' | 'air' | 'water'  what it can catch
     maxSize   biggest size class it can hold (S, M, L, XL)
     effect    optional: 'stun' (bola), 'calm', 'luck', 'deep'
*/
export const TOOLS = {
  rope: {
    name: 'Rope Lasso', kind: 'catch', behavior: 'lasso', rarity: 'common', price: 0, level: 0, color: '#c8a060',
    stats: { rating: 1.0, band: 0.27, lift: 3.1, fall: 2.5, control: 1.0, range: 22, speed: 24, reach: 2.4, window: 1.0 },
    targets: ['land'], maxSize: 'L',
    desc: 'A good old rope with a loop on the end. Spin it, throw it, hang on.',
  },
  net: {
    name: 'Snare Net Launcher', kind: 'catch', behavior: 'net', rarity: 'common', price: 600, level: 0, color: '#7a9a5a',
    stats: { rating: 1.25, band: 0.42, lift: 3.4, fall: 2.6, control: 1.2, range: 14, speed: 30, reach: 3.6, window: 1.5 },
    targets: ['land', 'air'], maxSize: 'M',
    desc: 'Fires a weighted net. A huge catch zone and an easy snare - but only for small and medium creatures.',
  },
  bola: {
    name: 'Bola Sling', kind: 'catch', behavior: 'bola', rarity: 'uncommon', price: 2600, level: 2, color: '#8a6a4a',
    stats: { rating: 1.6, band: 0.3, lift: 3.3, fall: 2.6, control: 1.1, range: 28, speed: 30, reach: 3.0, window: 1.2 },
    targets: ['land', 'air'], maxSize: 'L', effect: 'stun',
    desc: 'Wraps their legs. Creatures start the fight dazed and slow for a few seconds.',
  },
  braided: {
    name: 'Braided Lasso', kind: 'catch', behavior: 'lasso', rarity: 'uncommon', price: 4200, level: 3, color: '#d86a3a',
    stats: { rating: 2.0, band: 0.29, lift: 3.4, fall: 2.6, control: 1.1, range: 26, speed: 26, reach: 2.6, window: 1.1 },
    targets: ['land', 'water'], maxSize: 'XL',
    desc: 'Three ropes woven into one. Holds most of what the jungle can throw at you.',
  },
  harpoon: {
    name: 'Tether Harpoon', kind: 'catch', behavior: 'harpoon', rarity: 'rare', price: 6500, level: 3, color: '#6a8aa8',
    stats: { rating: 2.4, band: 0.28, lift: 3.4, fall: 2.8, control: 1.15, range: 34, speed: 55, reach: 2.2, window: 1.0 },
    targets: ['water', 'land'], maxSize: 'XL',
    desc: 'A blunt, padded harpoon on a cable. Fires straight and works UNDERWATER. Made for the sea.',
  },
  skyhook: {
    name: 'Sky Hook', kind: 'catch', behavior: 'skyhook', rarity: 'rare', price: 7800, level: 4, color: '#c8c8d8',
    stats: { rating: 2.5, band: 0.28, lift: 3.6, fall: 2.6, control: 1.1, range: 48, speed: 60, reach: 3.2, window: 1.1 },
    targets: ['air', 'land'], maxSize: 'XL',
    desc: 'A grapnel launcher with a long, long reach. Best fired from the back of something that flies.',
  },
  titan: {
    name: 'Titan Cable', kind: 'catch', behavior: 'lasso', rarity: 'epic', price: 18000, level: 5, color: '#4a4a5a',
    stats: { rating: 3.6, band: 0.29, lift: 3.6, fall: 2.7, control: 1.25, range: 30, speed: 28, reach: 3.0, window: 1.15 },
    targets: ['land', 'water', 'air'], maxSize: 'XL',
    desc: 'Steel cable and a lot of nerve. Holds tyrants.',
  },
  abyss: {
    name: 'Abyss Harpoon', kind: 'catch', behavior: 'harpoon', rarity: 'epic', price: 26000, level: 6, color: '#2a6a8a',
    stats: { rating: 4.6, band: 0.29, lift: 3.7, fall: 2.8, control: 1.3, range: 40, speed: 65, reach: 2.6, window: 1.1 },
    targets: ['water'], maxSize: 'XL', effect: 'deep',
    desc: 'Pressure-rated and glowing. For the things at the bottom of the Trench.',
  },
  storm: {
    name: 'Stormcatcher', kind: 'catch', behavior: 'skyhook', rarity: 'epic', price: 28000, level: 6, color: '#e8d040',
    stats: { rating: 4.4, band: 0.3, lift: 3.8, fall: 2.6, control: 1.25, range: 55, speed: 70, reach: 3.6, window: 1.2 },
    targets: ['air', 'land'], maxSize: 'XL', effect: 'stun',
    desc: 'A grounded copper grapnel. Lightning does not bother it. Neither do legends.',
  },
  amber: {
    name: 'Amber Lasso', kind: 'catch', behavior: 'lasso', rarity: 'legendary', price: 60000, level: 7, color: '#f0a020',
    stats: { rating: 6.0, band: 0.33, lift: 3.8, fall: 2.7, control: 1.35, range: 34, speed: 30, reach: 3.4, window: 1.4 },
    targets: ['land', 'water', 'air'], maxSize: 'XL', effect: 'luck',
    desc: 'Woven from fossil resin. Things caught with it are more often rare colours. Holds anything that lives.',
  },
  // ---- fishing rods (the Hooked catch: cast, wait for the bob, strike, fight).
  //      Small swimmers fight on the line; hook something big and it comes up out of the water.
  reedrod: {
    name: 'Reed Rod', kind: 'rod', behavior: 'rod', rarity: 'common', price: 0, level: 0, color: '#c8b070',
    stats: { rating: 1.0, band: 0.28, lift: 3.2, fall: 2.5, control: 1.05, range: 22, window: 1.0, bite: 1 },
    targets: ['water'], maxSize: 'XL',
    desc: 'A bendy reed with a bone hook. Cast it off the dock - the lagoon is full of things that bite.',
  },
  bonerod: {
    name: 'Bone Rod', kind: 'rod', behavior: 'rod', rarity: 'uncommon', price: 3000, level: 1, color: '#e8dcc0',
    stats: { rating: 2.0, band: 0.29, lift: 3.3, fall: 2.5, control: 1.1, range: 28, window: 1.1, bite: 1.25 },
    targets: ['water'], maxSize: 'XL',
    desc: 'Carved from a long-neck\'s rib. Strong enough to keep a big head above the water.',
  },
  ironrod: {
    name: 'Ironbark Rod', kind: 'rod', behavior: 'rod', rarity: 'rare', price: 9500, level: 3, color: '#6a5a4a',
    stats: { rating: 3.3, band: 0.3, lift: 3.5, fall: 2.6, control: 1.2, range: 34, window: 1.2, bite: 1.45 },
    targets: ['water'], maxSize: 'XL',
    desc: 'Wood that sinks. A line that does not snap. Mosasaurs, beware.',
  },
  levrod: {
    name: 'Leviathan Rod', kind: 'rod', behavior: 'rod', rarity: 'legendary', price: 42000, level: 5, color: '#2a8aa0',
    stats: { rating: 5.4, band: 0.32, lift: 3.7, fall: 2.6, control: 1.3, range: 42, window: 1.35, bite: 1.7 },
    targets: ['water'], maxSize: 'XL', effect: 'luck',
    desc: 'Glows faintly blue. Legends say it was made to land the thing at the bottom of the Trench.',
  },
  // ---- utilities
  binoculars: { name: 'Binoculars', kind: 'util', behavior: 'scan', rarity: 'common', price: 0, level: 0, color: '#3a3a4a', desc: 'Hold to zoom. Look at a creature to scan it into your Dino Dex (and see how strong it is).' },
  machete: { name: 'Machete', kind: 'util', behavior: 'cut', rarity: 'common', price: 650, level: 0, color: '#b8c0c8', desc: 'Cuts through vine curtains. Some ruins are hidden behind them.' },
  shovel: { name: 'Shovel', kind: 'util', behavior: 'dig', rarity: 'common', price: 400, level: 0, color: '#8a7050', desc: 'Dig up the sparkling mounds: fossils, amber - and eggs that hatch at the zoo.' },
  lantern: { name: 'Lantern', kind: 'util', behavior: 'light', rarity: 'uncommon', price: 1400, level: 2, color: '#f0c050', desc: 'Lights up caves and the night. Some creatures are curious about it.' },
  camera: { name: 'Field Camera', kind: 'util', behavior: 'photo', rarity: 'uncommon', price: 1800, level: 2, color: '#4a4a4a', desc: 'Photograph wild creatures. The zoo pays for good photos of rare ones.' },
};
export const TOOL_ORDER = Object.keys(TOOLS);
export const SIZE_RANK = { S: 0, M: 1, L: 2, XL: 3 };
