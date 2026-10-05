# Catch a Dino

Your zoo sits on Home Island in the middle of the Glass Lagoon. Fish the lagoon, ride sea creatures across it, and explore the lands around it: jungle to the north, mountains to the east, swamp to the south, open sea to the west. The farther you go, the rarer the creatures. Co-op for 1-4 players, in the browser. A 10-step tutorial (Professor Bramble) teaches the loop; skip it from the pause menu.

**Catch creatures -> put them on show -> the zoo earns money by itself (+$/min) -> better gear and mounts -> explore further.**

## Controls
| | |
|---|---|
| WASD / SHIFT / C / SPACE | move / sprint / sneak / jump (hold SPACE to glide with the Leaf Glider) |
| LMB | throw the lasso (hold to spin) / use the held tool |
| RMB | aim, zoom (binoculars, camera) |
| 1-0, mouse wheel | hotbar: hold a tool, or call out and ride a creature |
| E | interact, get on / off |
| F | your mount's ability (smash, roar, dig, spit...) |
| TAB | inventory · J Dino Dex · M map · B build (at the zoo) · V camera · T chat · ESC pause |

**Catching** (the Hooked catch, reworked): throw the loop at a creature. When the ring shrinks around it, click while it is in the green band. Then hold LMB to keep its head inside your loop on the tug meter, and press the opposite key (A/D) when it lunges. Creatures stronger than your rope break it, so upgrade. Hold C to sneak: creatures notice you later and the snare ring is easier.

**Fishing:** hold the rod (2), hold LMB to cast, wait for the float to go under, click, then reel on the same tug meter. Large catches surface during the fight. Shadows, bubbles, wakes and fins show where swimmers are.

## Running it
Any static file server from this folder, for example `python -m http.server 8743`, then open http://127.0.0.1:8743/.
After changing JS run `node tools/stamp.mjs` (cache-busting import map; `tools/publish.ps1` does it too).

## For developers
- Everything is generated in code (three.js r160, no assets). PeerJS for co-op (host-authoritative).
- **New creature:** add an entry to `src/data/Species.js` (body plan + numbers + colours). Art, animation, spawning, catching, riding, the zoo and the dex all read from it.
- **New tool:** add an entry to `src/data/Tools.js`. Its `behavior` picks the code (`game/Tools.js` / `game/Catching.js`), and `model` its art (`art/ToolArt.js`).
- **New ability:** `src/data/Abilities.js` plus a method of the same name in `game/Abilities.js`.
- Tests: `/?script=all` (or core, tutorial, ride, catch, throw, fish, zoo, world, water, spawn), `/_nettest.html` (two-window co-op over a loopback), `/_lineup.html` (creature contact sheet: `?state=run&only=trex,trike`), `/_world.html?x=&z=&yaw=` (world view).
- Screenshots: `tools/shot_page.ps1 -Url "/?shot=ride&sp=trex&run=1"`. Shots: ride, fight (add &fish for a rod fight), inv, zoo, build, dex, map, station, card, cave, wild, char.
