/* Items.js - bait, finds and upgrades.

   BAIT is thrown (hotbar, left click). Creatures whose diet matches smell it,
   come over and eat - a creature that is eating is easy to snare (slow ring,
   a head start on the tug meter). Some only show up for special bait.
   FINDS are what you dig up, fish out of cracks or find in ruins. Sell them
   at the Ranger Station, or hatch eggs at the Hatchery.
   UPGRADES are permanent and shared by everyone in the zoo. */
export const ITEMS = {
  berries: { name: 'Berry Bait', kind: 'bait', diet: ['herb', 'omni'], price: 15, stack: 20, color: '#d8405a', desc: 'Sweet berries. Herbivores and omnivores come running.' },
  meat: { name: 'Meat Bait', kind: 'bait', diet: ['carn', 'omni'], price: 25, stack: 20, color: '#c8504a', desc: 'A juicy steak. Predators smell it from far away - careful.' },
  fish: { name: 'Fish Bait', kind: 'bait', diet: ['fish', 'carn'], price: 20, stack: 20, color: '#8ab0c8', desc: 'Fish. Sea reptiles, pterosaurs and river hunters love it. Throw it in water too.' },
  glowberry: { name: 'Glowberries', kind: 'bait', diet: ['herb', 'omni', 'carn'], price: 160, stack: 10, color: '#40e0ff', level: 3, desc: 'They glow at night. Things that only come out after dark find them irresistible.' },
  golden: { name: 'Golden Fruit', kind: 'bait', diet: ['herb', 'omni', 'carn', 'fish'], price: 900, stack: 5, color: '#f0c020', level: 4, lure: true, desc: 'Rare creatures come from far away for this. Throw it and wait.' },
  // resources: gathered by you and by your creatures at the base; sold at the Ranger Station
  wood: { name: 'Wood', kind: 'res', sell: 4, color: '#a0703a', desc: 'Logs from the trees around your base.' },
  stone: { name: 'Stone', kind: 'res', sell: 3, color: '#a8a49a', desc: 'Good solid rock.' },
  ore: { name: 'Iron Ore', kind: 'res', sell: 14, color: '#b07a5a', desc: 'Rusty-red rock with metal in it.' },
  gem: { name: 'Crystal Shard', kind: 'res', sell: 60, color: '#7af0ff', desc: 'A glowing shard from a crystal outcrop. Only strong miners can break those.' },
  charcoal: { name: 'Charcoal', kind: 'res', sell: 12, color: '#3a3a3a', desc: 'Wood slow-burned by a fire creature.' },
  // finds
  fossil: { name: 'Fossil', kind: 'find', sell: 120, color: '#d8c8a8', desc: 'A piece of something very old. Museums pay well.' },
  bigfossil: { name: 'Giant Fossil', kind: 'find', sell: 900, heavy: true, color: '#e8dcc0', desc: 'A huge bone. Too heavy to carry far on foot - a strong mount carries it home.' },
  amber: { name: 'Amber', kind: 'find', sell: 300, color: '#f0a020', desc: 'Fossil resin. Sometimes with a little insect inside.' },
  crystal: { name: 'Glow Crystal', kind: 'find', sell: 450, color: '#c070ff', desc: 'Hums faintly. From the deep caves.' },
  idol: { name: 'Ancient Idol', kind: 'find', sell: 2500, color: '#5affc8', desc: 'A carved figure of a long-necked giant. Who made this?' },
  pearl: { name: 'Giant Pearl', kind: 'find', sell: 1200, color: '#f4f0ff', desc: 'From the sunken ruins. Perfectly round.' },
  egg: { name: 'Mystery Egg', kind: 'egg', sell: 0, color: '#e8dcb8', desc: 'Warm. Something inside is moving. Take it to the Hatchery at your base.' },
};
export const UPGRADES = {
  crate: { name: 'Capture Crate', levels: [{ cap: 4, price: 0 }, { cap: 6, price: 1500 }, { cap: 10, price: 6000 }, { cap: 16, price: 18000 }, { cap: 26, price: 45000 }], desc: 'How many creatures you can carry (small 1, medium 2, large 4, huge 8 slots).' },
  boots: { name: 'Trail Boots', levels: [{ price: 0, stam: 1 }, { price: 1200, stam: 1.5 }, { price: 5000, stam: 2.2 }], desc: 'Run further before you get tired.' },
  helmet: { name: 'Dive Helmet', levels: [{ price: 0, air: 15 }, { price: 2500, air: 60 }, { price: 9000, air: 9999 }], desc: 'Hold your breath longer underwater (on foot and riding a swimmer).' },
  coat: { name: 'Fur Coat', levels: [{ price: 0, cold: 0 }, { price: 3500, cold: 1 }], desc: 'Walk into the Whiteout without freezing (otherwise you need a warm-blooded mount).' },
  glider: { name: 'Leaf Glider', levels: [{ price: 0, glide: 0 }, { price: 4000, glide: 1 }], desc: 'Hold SPACE while falling to glide down from cliffs, mesas and flying mounts.' },
  saddle: { name: 'Saddle Kit', levels: [{ price: 0, stam: 1 }, { price: 2000, stam: 1.4 }, { price: 8000, stam: 2 }], desc: 'Your mounts can sprint and fly for longer.' },
  drone: { name: 'Airlift Drone', levels: [{ price: 0, on: 0 }, { price: 25000, on: 1 }], desc: 'When your crate is full, new catches are airlifted straight to the zoo.' },
  beacon: { name: 'Ranger Beacons', levels: [{ price: 0, on: 0 }, { price: 3000, on: 1 }], desc: 'Fast travel between discovered ranger beacons and your base (from the map, M).' },
};
export const UPGRADE_ORDER = Object.keys(UPGRADES);
