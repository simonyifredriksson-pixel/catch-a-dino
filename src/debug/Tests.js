/* Tests.js - staged screenshots and scripted tests.

   ?shot=<name>&...   set a scene up and fast-forward it (headless Chrome
                      renders few frames, so we simulate time by hand)
   ?script=<name>     run a test suite; results are printed big at the top
                      of the page (read them from a screenshot)

   shots: play, at (x, z, yaw, h), ride (sp), fight (sp), snare, inv (tab),
          zoo, build, dex, map, station, card, night, storm, under, cave
   suites: all, core, catch, zoo, ride, world, net */
import * as THREE from '../../lib/three.module.js';
import { SP, SPECIES } from '../data/Species.js';
import { creatureRecord } from '../game/State.js';
import { ZOO } from '../data/Biomes.js';
import { INTERIORS } from '../data/Places.js';

export function sim(G, seconds, dt = 1 / 30) { const n = Math.round(seconds / dt); for (let i = 0; i < n; i++) { G.update(dt); G.input.endFrame(); } }
const num = (P, k, d) => (P.has(k) ? +P.get(k) : d);

function give(G, sp, o = {}) {
  const r = creatureRecord(sp, { size: o.size ?? 0.6, v: o.v || null, at: o.at || 'pack:' + G.packKey, kg: SP[sp].kg[0] });
  G.W.creatures[r.uid] = r; return r;
}
function wildAt(G, sp, x, z, o = {}) {
  const c = G.wild.add({ sp, x, z, y: o.y ?? G.terrain.ground(x, z), size: o.size ?? 0.6, v: o.v || null, yaw: o.yaw ?? 0, flying: o.flying });
  c.ai.st = o.st || 'eat'; c.ai.t = 999; c.astate = o.st === 'eat' ? 'eat' : null;
  return c;
}
function face(G, x, z) { const P = G.player.pos; const a = Math.atan2(x - P.x, z - P.z); G.cam.yaw = a + Math.PI; G.player.yaw = a; }

export async function shot(G, name, P) {
  G.noSpawn = P.has('nospawn');
  if (G.noSpawn) G.wild.spawnAround = () => {};
  if (P.has('tod')) G.W.tod = +P.get('tod');
  if (P.has('weather')) { G.W.weather.kind = P.get('weather'); const w = { clear: [0.1, 0, 0], cloudy: [0.6, 0, 0], rain: [0.85, 0.8, 0.15], storm: [1, 1, 1] }[P.get('weather')]; G.events.w = { cloud: w[0], rain: w[1], storm: w[2] }; }
  const Pl = G.player;
  const at = (x, z, yaw) => { G.teleport(x, z, null); if (yaw != null) { G.cam.yaw = yaw; Pl.yaw = yaw + Math.PI; } };
  if (P.has('x')) at(num(P, 'x', 0), num(P, 'z', 0), num(P, 'yaw', 0));
  if (P.has('pitch')) G.cam.pitch = +P.get('pitch');
  switch (name) {
    case 'ride': {
      const r = give(G, P.get('sp') || 'trex');
      sim(G, 0.5); G.riding.summon(r.uid); sim(G, 0.5);
      if (P.has('run')) { G.input.keys.add('KeyW'); if (P.get('run') === '2') G.input.keys.add('ShiftLeft'); }
      if (P.has('fly')) { G.riding.c.takeOff(); G.input.keys.add('KeyW'); G.input.keys.add('Space'); }
      sim(G, num(P, 't', 3));
      break;
    }
    case 'fight': case 'snare': {
      const p = Pl.pos, sp = P.get('sp') || 'proto';
      const c = wildAt(G, sp, p.x + Math.sin(Pl.yaw) * 12, p.z + Math.cos(Pl.yaw) * 12, { st: 'eat' });
      sim(G, 0.3);
      G.catching.toolId = P.get('tool') || 'rope';
      G.wild.claim(c); G.catching.c = c; G.catching.state = 'snare'; G.catching.ringDur = 1.4; G.catching.ring = 0;
      if (name === 'fight') { G.catching._startFight(false); }
      if (P.has('lmb')) G.input.mouse.buttons.add(0);
      sim(G, num(P, 't', name === 'fight' ? 3 : 0.75));
      if (P.has('lunge') && G.catching.F) { G.catching.F.lunge.on = 0.8; G.catching.F.lunge.dir = -1; sim(G, 0.05); }
      break;
    }
    case 'inv': { if (P.has('give')) for (const s of P.get('give').split(',')) give(G, s, { v: P.get('v') }); sim(G, 0.3); G.inv.show(P.get('tab') || 'creatures'); if (P.has('sel')) { G.inv.sel = +P.get('sel'); G.inv.render(); } sim(G, 0.5); break; }
    case 'zoo': {
      // a busier zoo to look at
      if (P.has('full')) {
        G.W.money = 99999; G.W.zooLevel = 4;
        const add = (hab, size, x, z, sps) => { const id = 'ex' + hab; G.W.zoo.exhibits.push({ id, hab, size, x, z, rot: 0, name: hab[0].toUpperCase() + hab.slice(1) + ' Exhibit' }); for (const s of sps) give(G, s, { at: 'ex:' + id }); };
        add('jungle', 'L', ZOO.x + 22, ZOO.z - 18, ['trike', 'stego', 'para']);
        add('predator', 'L', ZOO.x - 18, ZOO.z - 40, ['trex']);
        add('aquatic', 'M', ZOO.x + 30, ZOO.z + 22, ['ichthy', 'archelon']);
        add('aviary', 'M', ZOO.x - 24, ZOO.z + 26, ['ptera', 'tape']);
        G.W.zoo.decor.push({ id: 'dg', k: 'gift', x: ZOO.x + 4, z: ZOO.z + 20, rot: 0 }, { id: 'df', k: 'fountain', x: ZOO.x, z: ZOO.z + 4, rot: 0 }, { id: 'ds', k: 'statue', x: ZOO.x - 6, z: ZOO.z + 40, rot: 0 });
        G.zoo.rebuild();
      }
      at(ZOO.x + num(P, 'cx', 0), ZOO.z + num(P, 'cz', 52), num(P, 'yaw', 0));
      G.cam.pitch = num(P, 'pitch', 0.35); G.cam.preset = 2;
      sim(G, num(P, 't', 6));
      break;
    }
    case 'build': { at(ZOO.x, ZOO.z + 30, 0); sim(G, 0.5); G.build.toggle(); if (P.has('cat')) { G.build.cat = P.get('cat'); G.build.render(); } G.build.mouse.set(0, -0.1); sim(G, 1); break; }
    case 'dex': case 'map': case 'station': case 'pause': {
      if (P.has('give')) for (const s of P.get('give').split(',')) { give(G, s); G.W.dex[s] = { seen: 1, caught: 1 }; }
      if (name === 'map') for (let i = 0; i < G.explored.bits.length; i++) G.explored.bits[i] = Math.random() < 0.5 ? 1 : 0;
      sim(G, 0.3); G.panels.open(name, P.get('arg') || undefined); if (P.has('tab')) { G.panels.tab = P.get('tab'); G.panels.render(); } sim(G, 0.2); break;
    }
    case 'card': { sim(G, 0.3); const r = creatureRecord(P.get('sp') || 'trex', { v: P.get('v') || null, kg: 8000, traits: ['Showoff'] }); G.ui.catchCard(r, { isNew: true, reward: 960, where: 'Added to your crate (4/4).' }); sim(G, 0.4); break; }
    case 'char': {
      // all four looks in a row, facing the camera (or their backs with &back)
      at(ZOO.x + 30, ZOO.z + 70, 0);
      const { makeHuman } = await import('../art/PeopleArt.js');
      const back = P.has('back');
      Pl.yaw = back ? Math.PI : 0;
      for (let i = 1; i < 4; i++) { const H = makeHuman({ look: i }); H.root.position.set(Pl.pos.x + i * 1.1, Pl.pos.y, Pl.pos.z); H.root.rotation.y = Pl.yaw + (P.has('side') ? Math.PI / 2 : 0); G.scene.add(H.root); H.anim(0.1, {}); }
      if (P.has('side')) Pl.yaw += Math.PI / 2;
      sim(G, 0.3);
      G.cam.override = { pos: new THREE.Vector3(Pl.pos.x + 1.65, Pl.pos.y + 1.4, Pl.pos.z + 5.2), look: new THREE.Vector3(Pl.pos.x + 1.65, Pl.pos.y + 1.0, Pl.pos.z), rate: 100 };
      G.hideHud = true;
      sim(G, 0.3);
      break;
    }
    case 'cave': { G.teleport(INTERIORS.hollow.x, INTERIORS.hollow.z + 40, 'hollow', Math.PI); sim(G, num(P, 't', 2)); break; }
    case 'wild': {
      // a lineup of wild creatures in front of you
      const list = (P.get('sp') || 'trex,trike,raptor').split(',');
      list.forEach((s, i) => { const a = Pl.yaw + (i - (list.length - 1) / 2) * 0.35; wildAt(G, s, Pl.pos.x + Math.sin(a) * num(P, 'd', 22), Pl.pos.z + Math.cos(a) * num(P, 'd', 22), { st: P.get('st') || 'wander', flying: SP[s].move === 'fly' }); });
      sim(G, num(P, 't', 2));
      break;
    }
    default: sim(G, num(P, 't', 2));
  }
  if (P.has('hud') && P.get('hud') === '0') G.hideHud = true;
  G.noRender = false;
  // freeze the moment (rendering and CSS keep going) so the screenshot shows what was staged
  if (!P.has('live')) { G.timeScale = 0; G.update(0.0001); }
}

/* ---------------- suites ---------------- */
const SUITES = {
  core(t, G) {
    t.ok('world built', G.terrain.chunks.length > 50);
    t.ok('player at the zoo', Math.hypot(G.player.pos.x - ZOO.x, G.player.pos.z - ZOO.z) < 140);
    t.ok('starting animals', Object.values(G.W.creatures).length === 3);
    t.ok('hotbar seeded', G.profile.hotbar[0] === 'tool:rope');
    sim(G, 1);
    t.ok('holding the rope', G.tools.id === 'rope');
    t.ok('zoo has an exhibit', G.zoo.ex.size === 1 && G.zoo.creatures.length === 2);
  },
  ride(t, G) {
    const d = Object.values(G.W.creatures).find(r => r.sp === 'dryo');
    G.inv.activate(1); sim(G, 0.5);
    t.ok('summoned and riding the dryosaurus', G.player.mount && G.player.mount.spId === 'dryo');
    const p0 = G.player.pos.clone();
    G.input.keys.add('KeyW'); G.input.keys.add('ShiftLeft'); sim(G, 3); G.input.keys.clear();
    t.ok('it ran (moved ' + G.player.pos.distanceTo(p0).toFixed(1) + ' m)', G.player.pos.distanceTo(p0) > 15);
    G.input.fake('KeyE', true); sim(G, 0.1); G.input.fake('KeyE', false); sim(G, 0.5);
    t.ok('got off', !G.player.mount && G.riding.c);
    // a flyer
    const r = creatureRecord('ptera', { at: 'pack:' + G.packKey }); G.W.creatures[r.uid] = r;
    G.riding.summon(r.uid); sim(G, 0.3);
    G.input.fake('Space', true); sim(G, 0.1); G.input.keys.add('KeyW'); sim(G, 3); G.input.keys.clear(); G.input.fake('Space', false);
    t.ok('pteranodon flies (y ' + G.riding.c.pos.y.toFixed(1) + ')', G.riding.c.flying && G.riding.c.pos.y > G.terrain.ground(G.riding.c.pos.x, G.riding.c.pos.z) + 3);
    G.riding.recall(true); sim(G, 0.2);
    t.ok('recalled', !G.riding.c && !G.player.mount);
    delete G.W.creatures[r.uid];
    void d;
  },
  catch(t, G) {
    const P = G.player; P.yaw = 0;
    const c = wildAt(G, 'proto', P.pos.x, P.pos.z + 12, { st: 'eat' });
    sim(G, 0.2);
    G.admin = { autoCatch: true };
    G.catching.toolId = 'rope'; G.wild.claim(c); G.catching.c = c; G.catching.state = 'snare'; G.catching.ringDur = 2; G.catching.ring = 0;
    G.input.fakeBtn(0, true); sim(G, 0.05); G.input.fakeBtn(0, false);
    t.ok('snared into a fight', G.catching.state === 'fight');
    const before = Object.keys(G.W.creatures).length;
    sim(G, 4);
    t.ok('caught it', Object.keys(G.W.creatures).length === before + 1 && G.catching.state === 'idle');
    t.ok('it is in the crate', G.packCreatures().some(r => r.sp === 'proto'));
    t.ok('dex updated', G.W.dex.proto?.caught === 1);
    G.admin = null;
    // too strong: the meter bleeds
    const big = wildAt(G, 'trex', P.pos.x, P.pos.z + 20, { st: 'eat' });
    sim(G, 0.1);
    G.wild.claim(big); G.catching.c = big; G.catching.state = 'snare'; G.catching.ringDur = 2; G.catching.ring = 0; G.catching._startFight(true);
    G.input.mouse.buttons.add(0);
    sim(G, 10);
    G.input.mouse.buttons.delete(0);
    t.ok('a tyrant breaks a rope lasso', G.catching.state !== 'fight' && !G.W.dex.trex?.caught);
    G.catching.cancel(true);
  },
  zoo(t, G) {
    const W = G.W;
    G.act({ k: 'unload' }); sim(G, 0.1);
    const proto = Object.values(W.creatures).find(r => r.sp === 'proto') || Object.values(W.creatures).find(r => r.sp === 'dryo');
    W.money = 50000;
    G.act({ k: 'build', what: 'exhibit', hab: 'desert', size: 'S', x: ZOO.x + 25, z: ZOO.z - 20, rot: 0 }); sim(G, 0.1);
    t.ok('built an exhibit', W.zoo.exhibits.length === 2 && G.zoo.ex.size === 2);
    const ex = W.zoo.exhibits[1];
    if (proto) { G.act({ k: 'move', uid: proto.uid, to: 'ex:' + ex.id }); sim(G, 0.2); }
    t.ok('animal on show', proto && W.creatures[proto.uid].at === 'ex:' + ex.id && G.zoo.creatures.length >= 3);
    G.zoo.compute();
    t.ok('appeal > 0 (' + G.zoo.appeal + ')', G.zoo.appeal > 0);
    G.act({ k: 'build', what: 'decor', key: 'food', x: ZOO.x - 30, z: ZOO.z + 30, rot: 0 }); sim(G, 0.1);
    t.ok('built a stall', W.zoo.decor.some(d => d.k === 'food' && d.x === ZOO.x - 30));
    const n0 = W.items.fish || 0;
    G.act({ k: 'buy', what: 'item', id: 'fish', n: 5 }); sim(G, 0.1);
    t.ok('bought fish bait', W.items.fish === n0 + 5);
    G.act({ k: 'buy', what: 'tool', id: 'net' }); sim(G, 0.1);
    t.ok('bought a net launcher', W.tools.net === 1);
    G.act({ k: 'buy', what: 'tool', id: 'titan' }); sim(G, 0.1);
    t.ok('the Titan Cable waits for a 5-star zoo', !W.tools.titan);
    sim(G, 20);
    t.ok('visitors arrive (' + G.visitors.list.length + ')', G.visitors.list.length > 0);
  },
  world(t, G) {
    const L = G.landmarks;
    t.ok('dig spots', L.digs.length > 40);
    t.ok('cracks', L.cracks.length > 10);
    t.ok('gates', Object.keys(L.gates).length === 3);
    const d = L.digs[0];
    G.act({ k: 'dig', i: 0 }); sim(G, 0.1);
    t.ok('dig gives loot and cools down', !L.digReady(0));
    G.act({ k: 'gate', id: 'g_pass' }); sim(G, 0.1);
    t.ok('gate opens', L.gates.g_pass.open && G.W.gates.g_pass);
    // a portal into Crystal Hollow (the gate must be open)
    G.act({ k: 'gate', id: 'g_hollow' }); sim(G, 0.1);
    const P = L.portals.find(p => p.to === 'hollow');
    G.teleport(P.x, P.z + 0.2, null); sim(G, 1.2);
    t.ok('walked into Crystal Hollow', !!G.inInterior && G.inInterior.id === 'hollow');
    t.ok('cave floor holds you up (' + G.player.pos.y.toFixed(1) + ')', Math.abs(G.player.pos.y - INTERIORS.hollow.floor) < 2.5);
    void d;
  },
  throw(t, G) {
    const P = G.player;
    G.teleport(ZOO.x + 60, ZOO.z - 160, null, 0);
    sim(G, 0.5);
    const tgt = wildAt(G, 'proto', P.pos.x, P.pos.z + 12, { st: 'eat' });
    G.cam.yaw = Math.PI; G.cam.pitch = 0.08; sim(G, 0.4);
    t.ok('holding ' + G.tools.id + ', assist ' + (G.tools.assist ? G.tools.assist.c.spId + ' ' + G.tools.assist.d.toFixed(1) : 'none'), !!G.tools.assist);
    G.input.fakeBtn(0, true); sim(G, 0.1);
    t.ok('charging (' + G.catching.state + ')', G.catching.state === 'charge');
    sim(G, 0.9); G.input.fakeBtn(0, false);
    const log = [];
    for (let i = 0; i < 40; i++) { sim(G, 1 / 30); const pr = G.catching.proj; if (pr) log.push(G.catching.state[0] + ':' + pr.pos.x.toFixed(1) + ',' + pr.pos.y.toFixed(1) + ',' + pr.pos.z.toFixed(1)); }
    t.ok('state ' + G.catching.state + ' path ' + log.filter((_, i) => i % 4 === 0).join(' ') + ' target at ' + tgt.pos.x.toFixed(1) + ',' + tgt.pos.y.toFixed(1) + ',' + tgt.pos.z.toFixed(1) + ' hand ' + G.catching.tip.toArray().map(v => v.toFixed(1)), G.catching.state === 'snare' || G.catching.state === 'fight');
  },
  spawn(t, G) {
    sim(G, 8);
    t.ok('wild creatures spawn (' + G.wild.list.length + ')', G.wild.list.length > 5);
    const kinds = new Set(G.wild.list.map(c => c.spId));
    t.ok('several species (' + [...kinds].join(',') + ')', kinds.size >= 2);
    G.events.start('stampede'); sim(G, 2);
    t.ok('stampede event', !!G.events.active.stampede);
  },
};
SUITES.all = (t, G) => { for (const k of ['core', 'ride', 'catch', 'throw', 'zoo', 'world', 'spawn']) { t.section(k); try { SUITES[k](t, G); } catch (e) { t.ok(k + ' threw: ' + e.message + ' ' + (e.stack || '').split('\n')[1], false); } } };

export function run(G, name) {
  const out = []; let pass = 0, fail = 0;
  const t = { ok(msg, v) { out.push((v ? 'PASS ' : 'FAIL ') + msg); v ? pass++ : fail++; }, section(s) { out.push('--- ' + s); } };
  G.noRender = true;
  try { (SUITES[name] || SUITES.all)(t, G); } catch (e) { t.ok('suite threw: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' '), false); }
  const el = document.createElement('pre');
  el.style.cssText = 'position:fixed;left:0;top:0;right:0;z-index:999;background:rgba(0,0,0,.85);color:#fff;font:13px monospace;padding:10px;margin:0;white-space:pre-wrap';
  el.textContent = pass + ' passed, ' + fail + ' failed\n' + out.join('\n') + '\n' + (window.__logs || []).filter(l => /^(ERR|REJ|UPDATE)/.test(l)).join('\n');
  document.body.appendChild(el);
  G.noRender = false;
  console.log(el.textContent);
}
void THREE; void SPECIES; void face;
