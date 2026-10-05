/* Abilities.js - what a creature lets you DO when you ride it (or carry it).

   key:  'F' the mount's main action (the first F ability in its list wins),
         'Space' / 'Shift' movement keys, 'pack' works from your crate,
         'passive' just works while riding.
   The code for each lives in game/Abilities.js under the same id; adding an
   ability is an entry here plus a handler there. */
export const ABILITIES = {
  sprint:    { name: 'Sprint',      key: 'Shift',   icon: 'bolt',   desc: 'Hold SHIFT to run flat out (uses stamina).' },
  jump:      { name: 'Leap',        key: 'Space',   icon: 'up',     desc: 'SPACE to jump over rocks, logs and gaps.' },
  climb:     { name: 'Climb',       key: 'passive', icon: 'mount',  desc: 'Walks up slopes that are too steep for anything else.' },
  wallclimb: { name: 'Wall Climb',  key: 'passive', icon: 'mount',  desc: 'Climbs sheer cliffs. Mesa tops are yours.' },
  smash:     { name: 'Smash',       key: 'F',       icon: 'fist',   desc: 'F to charge and SMASH boulder piles, cracked walls and ice.' },
  charge:    { name: 'Charge',      key: 'F',       icon: 'fist',   desc: 'F to charge: knocks over anything in the way.' },
  carry:     { name: 'Pack Animal', key: 'passive', icon: 'box',    desc: 'Saddlebags: carries extra creatures and heavy finds.' },
  sturdy:    { name: 'Sturdy',      key: 'passive', icon: 'shield', desc: 'Predators cannot knock you off it.' },
  roar:      { name: 'Roar',        key: 'F',       icon: 'roar',   desc: 'F to ROAR: predators back off, small creatures freeze (easy to snare).' },
  call:      { name: 'Herd Call',   key: 'F',       icon: 'note',   desc: 'F to honk: nearby plant-eaters calm down and stop running.' },
  spit:      { name: 'Dazzle Spit', key: 'F',       icon: 'drop',   desc: 'F to spit at a creature: it is dazed and easy to catch for a few seconds.' },
  tailwhip:  { name: 'Tail Swipe',  key: 'F',       icon: 'swirl',  desc: 'F to swing the tail: knocks back everything around you.' },
  sting:     { name: 'Stun Sting',  key: 'F',       icon: 'drop',   desc: 'F to sting the creature in front of you: dazed for a few seconds.' },
  dig:       { name: 'Dig',         key: 'F',       icon: 'dig',    desc: 'F at a sparkling mound to dig it up - no shovel needed.' },
  cut:       { name: 'Slash',       key: 'F',       icon: 'claw',   desc: 'F to slash through vine curtains.' },
  track:     { name: 'Track',       key: 'F',       icon: 'nose',   desc: 'F to sniff: a scent trail leads to the rarest creature nearby.' },
  glow:      { name: 'Glow',        key: 'passive', icon: 'sun',    desc: 'Lights up the dark around you. Caves and nights are no problem.' },
  heatproof: { name: 'Lava Walker', key: 'passive', icon: 'fire',   desc: 'Walks through lava and over hot ground unharmed.' },
  warm:      { name: 'Warm Blooded', key: 'passive', icon: 'snow',  desc: 'Keeps you warm in the Whiteout and on frozen ground.' },
  swim:      { name: 'Swim',        key: 'passive', icon: 'wave',   desc: 'Swims fast at the surface.' },
  dive:      { name: 'Dive',        key: 'passive', icon: 'down',   desc: 'Dives underwater (CTRL down, SPACE up). Bring a Dive Helmet.' },
  deepdiver: { name: 'Deep Diver',  key: 'passive', icon: 'down',   desc: 'Can reach the bottom of the Trench.' },
  echo:      { name: 'Echolocate',  key: 'F',       icon: 'ring',   desc: 'F to ping: shows creatures and treasure underwater around you.' },
  leap:      { name: 'Breach',      key: 'Space',   icon: 'up',     desc: 'SPACE at speed near the surface to leap clean out of the water.' },
  fly:       { name: 'Flight',      key: 'Space',   icon: 'wing',   desc: 'SPACE to take off and climb, CTRL to dive, W to fly where you look.' },
  dash:      { name: 'Storm Dash',  key: 'F',       icon: 'bolt',   desc: 'F for a lightning-fast burst through the sky.' },
  wade:      { name: 'Wade',        key: 'passive', icon: 'wave',   desc: 'So tall it walks through deep rivers like puddles.' },
  tall:      { name: 'Lookout',     key: 'passive', icon: 'eye',    desc: 'You see a very long way from up there. Rare creatures show on your compass.' },
  ambush:    { name: 'Ambush',      key: 'passive', icon: 'eye',    desc: 'Creatures do not notice you coming while you swim with it.' },
  scout:     { name: 'Scout',       key: 'pack',    icon: 'nose',   desc: 'Tiny: from your crate it can squeeze into narrow cracks and bring back what it finds (E at a crack).' },
};
