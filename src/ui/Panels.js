/* Panels.js - the menus you open.

   station    the Ranger Station: SHOP (tools, bait, upgrades, more land),
              ANIMALS (unload your crate, the holding pen, put animals on show),
              SELL (finds), ZOO (appeal, level, what the next star unlocks)
   exhibit    one exhibit's animals and how happy they are (and why)
   hatchery   incubate eggs; babies come out
   dex        every species: silhouettes until you scan one, hints, abilities
   map        the world, with fog where you have not been; fast travel
   pause      settings and controls
   confirm    yes / no */
import * as THREE from '../../lib/three.module.js';
import { SPECIES, SP, RARITY, SIZE, VARIANTS } from '../data/Species.js';
import { TOOLS, TOOL_ORDER, SIZE_RANK } from '../data/Tools.js';
import { ITEMS, UPGRADES, UPGRADE_ORDER } from '../data/Items.js';
import { ABILITIES } from '../data/Abilities.js';
import { HABITATS, EX_SIZES, ZOO_LEVELS, ZOO_LEVEL_NAMES, PLOTS, DECOR } from '../data/Build.js';
import { BIOMES, ZOO, WORLD_HALF, REGIONS, ISLANDS, VALLEY, VOLCANO, TRENCH, GROTTO, DOCK } from '../data/Biomes.js';
import { PLACES, BEACONS, INTERIORS } from '../data/Places.js';
import { habitatOK } from '../game/Zoo.js';
import { svg } from './Inventory.js';
import { esc, money, fmtKg, clamp } from '../core/Util.js';

const $ = id => document.getElementById(id);

export class Panels {
  constructor(game) {
    this.g = game; this.k = null; this.tab = 'shop';
    this.el = $('panel');
    this.el.addEventListener('mousedown', e => e.stopPropagation());
    this.el.addEventListener('click', e => this._click(e));
  }
  get W() { return this.g.W; }
  get open_() { return !!this.k; }
  open(k, arg) {
    const G = this.g;
    if (G.inv.open) G.inv.close();
    this.k = k; this.arg = arg; G.ui.panel = k;
    G.input.unlock();
    this.el.className = 'on p-' + k;
    G.audio.open();
    this.render();
  }
  close() { if (!this.k) return; this.k = null; this.g.ui.panel = null; this.el.className = ''; this.el.innerHTML = ''; this.g.audio.close(); }
  confirm(title, text, yes) { this._yes = yes; this.open('confirm', { title, text }); }

  render() {
    const k = this.k; if (!k) return;
    const f = this['_' + k];
    const scroll = this.el.querySelector('.pbody')?.scrollTop || 0;
    this.el.innerHTML = `<div class="pbox">${f ? f.call(this) : ''}<button class="pclose" data-a="close">&times;</button></div>`;
    const b = this.el.querySelector('.pbody'); if (b) b.scrollTop = scroll;
    if (k === 'map') this._drawMap();
  }
  _click(e) {
    const t = e.target.closest('[data-a]'); if (!t) return;
    const G = this.g, a = t.dataset.a, v = t.dataset.v, W = this.W;
    G.audio.click();
    if (a === 'close') return this.close();
    if (a === 'tab') { this.tab = v; return this.render(); }
    if (a === 'buyTool') G.act({ k: 'buy', what: 'tool', id: v });
    if (a === 'buyItem') G.act({ k: 'buy', what: 'item', id: v, n: +t.dataset.n || 1 });
    if (a === 'buyUpg') G.act({ k: 'buy', what: 'upg', id: v });
    if (a === 'buyPlot') G.act({ k: 'buy', what: 'plot' });
    if (a === 'unload') G.act({ k: 'unload' });
    if (a === 'take') G.act({ k: 'move', uid: v, to: 'pack' });
    if (a === 'place') G.act({ k: 'move', uid: v, to: 'ex:' + t.dataset.ex });
    if (a === 'hold') G.act({ k: 'move', uid: v, to: 'zoo' });
    if (a === 'release') { const r = W.creatures[v]; this.confirm('Release ' + (r?.name || SP[r?.sp]?.name) + '?', 'It goes back to the wild for good.', () => G.act({ k: 'release', uid: v })); return; }
    if (a === 'sell') G.act({ k: 'sell', id: v });
    if (a === 'sellAll') G.act({ k: 'sell', id: '*' });
    if (a === 'hatch') G.act({ k: 'hatch' });
    if (a === 'dex') { this.arg = v; return this.render(); }
    if (a === 'travel') { G.act({ k: 'travel', id: v }); return this.close(); }
    if (a === 'yes') { const y = this._yes; this.close(); if (y) y(); return; }
    if (a === 'no') return this.close();
    if (a === 'adm') { const spawn = e.shiftKey && v === 'give'; G.adminCmd(spawn ? 'spawn' : v, spawn ? String(t.dataset.x).split(':')[0] : t.dataset.x); if (spawn) return this.close(); return setTimeout(() => this.render(), 60); }
    if (a === 'admin') return this.open('admin');
    if (a === 'resume') return this.close();
    if (a === 'skipTut') { G.act({ k: 'skipTut' }); return this.close(); }
    if (a === 'quit') { G.saveNow(); location.reload(); return; }
    if (a === 'set') { const p = G.profile; const key = t.dataset.k; if (key === 'invert' || key === 'shadows') p[key] = !p[key]; G.applySettings(); }
    setTimeout(() => this.render(), 80);
  }

  /* ---------------- the Ranger Station ---------------- */
  _station() {
    const G = this.g, W = this.W, tab = this.tab;
    const tabs = [['shop', 'Shop'], ['animals', 'Animals'], ['sell', 'Sell finds'], ['zoo', 'Your zoo']];
    let body = '';
    if (tab === 'shop') {
      const lv = G.zoo.level;
      const row = (icon, name, desc, price, act, v, owned, need, extra = '') => `<div class="srow ${owned ? 'own' : ''} ${need > lv ? 'lock' : ''}"><img src="${icon}"><div class="sinfo"><b>${esc(name)}</b><span>${esc(desc)}</span>${extra}</div><div class="sbuy">${owned ? '<em>Owned</em>' : need > lv ? `<em>${'&#9733;'.repeat(need)} zoo</em>` : `<button data-a="${act}" data-v="${v}" ${W.money < price ? 'disabled' : ''}>${money(price)}</button>`}</div></div>`;
      body += '<h3>Catching tools</h3>';
      for (const k of TOOL_ORDER) { const T = TOOLS[k]; if (T.kind !== 'catch' || !T.price) continue; body += row(G.inv.icons.get('tool:' + k, () => G.holdModel(k), { dir: [1, 0.5, 0.8] }), T.name, T.desc, T.price, 'buyTool', k, W.tools[k], T.level, `<span class="sst">Strength ${T.stats.rating.toFixed(1)} &middot; ${T.targets.join(' / ')} &middot; up to ${SIZE[T.maxSize].name}</span>`); }
      body += '<h3>Field kit</h3>';
      for (const k of TOOL_ORDER) { const T = TOOLS[k]; if (T.kind !== 'util' || !T.price) continue; body += row(G.inv.icons.get('tool:' + k, () => G.holdModel(k), { dir: [1, 0.5, 0.8] }), T.name, T.desc, T.price, 'buyTool', k, W.tools[k], T.level); }
      body += '<h3>Bait</h3>';
      for (const k of Object.keys(ITEMS)) { const I = ITEMS[k]; if (I.kind !== 'bait') continue; const need = I.level || 0; body += `<div class="srow ${need > lv ? 'lock' : ''}"><img src="${G.inv.icons.get('item:' + k, () => G.holdModel(k))}"><div class="sinfo"><b>${esc(I.name)} <i>x${W.items[k] || 0}</i></b><span>${esc(I.desc)}</span></div><div class="sbuy">${need > lv ? `<em>${'&#9733;'.repeat(need)} zoo</em>` : `<button data-a="buyItem" data-v="${k}" data-n="1" ${W.money < I.price ? 'disabled' : ''}>1 &middot; ${money(I.price)}</button><button data-a="buyItem" data-v="${k}" data-n="5" ${W.money < I.price * 5 ? 'disabled' : ''}>5 &middot; ${money(I.price * 5)}</button>`}</div></div>`; }
      body += '<h3>Upgrades</h3>';
      for (const k of UPGRADE_ORDER) {
        const U = UPGRADES[k], l = W.upg[k] || 0, nx = U.levels[l + 1];
        body += `<div class="srow ${!nx ? 'own' : ''}"><div class="sic">${svg(k === 'crate' ? 'box' : k === 'helmet' ? 'wave' : k === 'coat' ? 'snow' : k === 'glider' ? 'wing' : k === 'beacon' ? 'sun' : k === 'drone' ? 'up' : 'bolt')}</div><div class="sinfo"><b>${esc(U.name)} ${U.levels.length > 2 ? '<i>Lv ' + (l + 1) + '/' + U.levels.length + '</i>' : ''}</b><span>${esc(U.desc)}${k === 'crate' ? ' Now: ' + U.levels[l].cap + ' slots' + (nx ? ', next: ' + nx.cap : '') + '.' : ''}</span></div><div class="sbuy">${nx ? `<button data-a="buyUpg" data-v="${k}" ${W.money < nx.price ? 'disabled' : ''}>${money(nx.price)}</button>` : '<em>Maxed</em>'}</div></div>`;
      }
      const np = PLOTS[(W.plot || 0) + 1];
      body += `<h3>Land</h3><div class="srow ${!np ? 'own' : ''}"><div class="sic">${svg('mount')}</div><div class="sinfo"><b>Expand the zoo</b><span>More room to build: ${PLOTS[W.plot || 0].half * 2} m now${np ? ', ' + np.half * 2 + ' m next' : ''}.</span></div><div class="sbuy">${np ? `<button data-a="buyPlot" ${W.money < np.price ? 'disabled' : ''}>${money(np.price)}</button>` : '<em>Maxed</em>'}</div></div>`;
    }
    if (tab === 'animals') {
      const pack = G.packCreatures(), hold = G.zoo.holding();
      body += `<h3>Your crate <i>${G.crateUsed()} / ${G.crateCap()} slots</i></h3>`;
      body += pack.length ? `<button class="wide" data-a="unload">Unload everything into the holding pen</button>` + pack.map(r => this._crRow(r, [['hold', 'To holding pen'], ...this._placeBtns(r)])).join('') : '<p class="dim">Nothing in your crate.</p>';
      body += `<h3>Holding pen <i>${hold.length}</i></h3><p class="dim">Animals waiting for an exhibit. They do not count toward appeal until they are on show.</p>`;
      body += hold.length ? hold.map(r => this._crRow(r, [...this._placeBtns(r), ['take', 'Into my crate'], ['release', 'Release']])).join('') : '<p class="dim">Empty.</p>';
    }
    if (tab === 'sell') {
      const finds = Object.keys(ITEMS).filter(k => ITEMS[k].kind === 'find' && W.items[k] > 0);
      body += finds.length ? `<button class="wide" data-a="sellAll">Sell everything (${money(finds.reduce((s, k) => s + ITEMS[k].sell * W.items[k], 0))})</button>` + finds.map(k => `<div class="srow"><img src="${G.inv.icons.get('item:' + k, () => G.holdModel(k))}"><div class="sinfo"><b>${esc(ITEMS[k].name)} <i>x${W.items[k]}</i></b><span>${esc(ITEMS[k].desc)}</span></div><div class="sbuy"><button data-a="sell" data-v="${k}">${money(ITEMS[k].sell)} each</button></div></div>`).join('') : '<p class="dim">No finds to sell. Dig up sparkling mounds, open chests, and send tiny creatures into cracks.</p>';
      if (W.items.egg > 0) body += `<p>You have <b>${W.items.egg}</b> Mystery Egg${W.items.egg > 1 ? 's' : ''} - take ${W.items.egg > 1 ? 'them' : 'it'} to the Hatchery.</p>`;
    }
    if (tab === 'zoo') {
      const Z = G.zoo, nx = ZOO_LEVELS[Z.level + 1];
      body += `<div class="zbig"><div class="zst">${'&#9733;'.repeat(Z.level)}<i>${'&#9733;'.repeat(7 - Z.level)}</i></div><b>${esc(ZOO_LEVEL_NAMES[Z.level])}</b><div class="zbar"><i style="width:${nx ? clamp(((Z.income || 0) - ZOO_LEVELS[Z.level]) / (nx - ZOO_LEVELS[Z.level]) * 100, 0, 100) : 100}%"></i></div><span>Income <b>+${money(Z.income || 0)}/min</b>${nx ? ' - the next star at ' + money(nx) + '/min' : ''}</span></div>`;
      body += `<p>Every animal on show earns money by itself, all the time - even while you are out exploring. Rarer, bigger, happier animals (in the right habitat) earn more; rare colours and babies earn extra.</p>`;
      body += `<p>Earned so far: ${money(W.stats.earned || 0)} &middot; Creatures caught: ${W.stats.caught || 0}</p>`;
      const top = Object.values(W.creatures).filter(r => r.at.startsWith('ex:')).map(r => ({ r, m: Math.round(SP[r.sp].appeal * 2.5 * (0.35 + (r.happy || 0.5) * 0.85) * (r.v ? Math.sqrt(VARIANTS[r.v].mult) : 1)) })).sort((a, b) => b.m - a.m).slice(0, 6);
      if (top.length) body += '<h3>Top earners</h3>' + top.map(({ r, m }) => `<div class="srow"><img src="${G.inv.icons.creature(r.sp, r.v)}"><div class="sinfo"><b>${esc(r.name || SP[r.sp].name)}</b><span>about +${money(m)}/min &middot; happiness ${Math.round((r.happy || 0) * 100)}%</span></div></div>`).join('');
      const unlock = [];
      for (const [k, H] of Object.entries(HABITATS)) if (H.level === Z.level + 1) unlock.push(H.name + ' exhibits');
      for (const [k, D] of Object.entries(DECOR)) if (D.level === Z.level + 1) unlock.push(D.name);
      for (const k of TOOL_ORDER) if (TOOLS[k].level === Z.level + 1) unlock.push(TOOLS[k].name);
      if (unlock.length) body += `<h3>Next star unlocks</h3><p>${esc(unlock.join(', '))}</p>`;
      body += '<h3>Exhibits</h3>' + [...G.zoo.ex.values()].map(E => { const res = G.zoo.residents(E.d.id); return `<div class="srow"><div class="sic">${svg('box')}</div><div class="sinfo"><b>${esc(E.d.name || HABITATS[E.d.hab].name)}</b><span>${HABITATS[E.d.hab].name} &middot; ${EX_SIZES[E.d.size].name} &middot; ${res.length} animal${res.length === 1 ? '' : 's'}</span></div></div>`; }).join('');
    }
    return `<div class="phead"><h2>Ranger Station</h2><div class="pmoney">${svg('coin')} ${money(W.money)}</div></div><div class="ptabs">${tabs.map(([k, n]) => `<button data-a="tab" data-v="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div><div class="pbody">${body}</div>`;
  }
  _crRow(r, btns) {
    const G = this.g, sp = SP[r.sp], R = RARITY[sp.rarity];
    return `<div class="srow cr"><img src="${G.inv.icons.creature(r.sp, r.v)}"><div class="sinfo"><b>${esc(r.name || sp.name)} <i style="color:${R.css}">${'&#9733;'.repeat(R.stars)}</i>${r.v ? ` <em class="var">${VARIANTS[r.v].name}</em>` : ''}${r.baby ? ' <em class="var">Baby</em>' : ''}</b><span>${esc(sp.name)} &middot; likes ${HABITATS[sp.move === 'fly' ? 'aviary' : sp.move === 'swim' ? 'aquatic' : sp.habitat]?.name || sp.habitat} &middot; ${SIZE[sp.size].name}</span></div><div class="sbuy">${btns.map(([a, l, ex]) => `<button data-a="${a}" data-v="${r.uid}" ${ex ? `data-ex="${ex}"` : ''}>${esc(l)}</button>`).join('')}</div></div>`;
  }
  /** "put on show" buttons for the exhibits this animal fits */
  _placeBtns(r) {
    const G = this.g, sp = SP[r.sp], out = [];
    for (const E of G.zoo.ex.values()) {
      if (SIZE_RANK[sp.size] > SIZE_RANK[E.d.size]) continue;
      const ok = habitatOK(sp, E.d.hab); if (ok <= 0) continue;
      out.push(['place', (ok >= 0.95 ? '★ ' : '') + (E.d.name || HABITATS[E.d.hab].name), E.d.id]);
    }
    return out.slice(0, 4);
  }

  /* ---------------- one exhibit ---------------- */
  _exhibit() {
    const G = this.g, E = G.zoo.ex.get(this.arg); if (!E) return '<p>Gone.</p>';
    const e = E.d, H = HABITATS[e.hab], S = EX_SIZES[e.size], res = G.zoo.residents(e.id);
    const used = res.reduce((s, r) => s + SIZE[SP[r.sp].size].crate, 0);
    let body = `<p>${H.name} habitat &middot; ${S.name} (${S.w} m) &middot; space <b>${used} / ${S.space}</b>${used > S.space ? ' <span class="bad">- crowded!</span>' : ''}</p>`;
    body += res.length ? res.map(r => {
      const h = r.happy ?? 0.5, sp = SP[r.sp];
      const why = [];
      const hk = habitatOK(sp, e.hab); why.push(hk >= 0.95 ? 'loves this habitat' : hk >= 0.6 ? 'habitat is OK' : 'wants a ' + (HABITATS[sp.habitat]?.name || sp.habitat) + ' habitat');
      if (sp.herd[1] > 1 && res.filter(o => o.sp === r.sp).length < 2) why.push('lonely - wants company');
      if (sp.temper === 'aggressive' && e.hab !== 'predator' && sp.size !== 'S') why.push('RESTLESS - needs a Predator Paddock');
      if (sp.diet !== 'carn' && res.some(o => SP[o.sp].diet === 'carn')) why.push('scared of the predator');
      return this._crRow(r, [['hold', 'To holding'], ['take', 'Into my crate']]).replace('</span></div><div class="sbuy">', `</span><div class="hap"><i style="width:${Math.round(h * 100)}%;background:${h > 0.66 ? '#5ad06a' : h > 0.4 ? '#f0c040' : '#f05a4a'}"></i></div><span class="why">${esc(why.join(' · '))}</span></div><div class="sbuy">`);
    }).join('') : '<p class="dim">No animals yet.</p>';
    const cands = [...G.packCreatures(), ...G.zoo.holding()].filter(r => SIZE_RANK[SP[r.sp].size] <= SIZE_RANK[e.size] && habitatOK(SP[r.sp], e.hab) > 0);
    body += `<h3>Move in</h3>` + (cands.length ? cands.map(r => this._crRow(r, [['place', 'Move in', e.id]])).join('') : `<p class="dim">Nothing you have fits here. ${e.hab === 'aviary' ? 'Aviaries are for flyers.' : e.hab === 'aquatic' ? 'Tanks are for swimmers.' : ''}</p>`);
    return `<div class="phead"><h2>${esc(e.name || H.name)}</h2></div><div class="pbody">${body}</div>`;
  }

  /* ---------------- hatchery ---------------- */
  _hatchery() {
    const G = this.g, W = this.W, eggs = W.eggs || [];
    let body = `<p>Eggs you have: <b>${W.items.egg || 0}</b>. An egg takes about 3 minutes to hatch. Babies are tiny, adorable and worth extra appeal - they grow up after a while.</p>`;
    body += (W.items.egg > 0 ? `<button class="wide" data-a="hatch">Put an egg in the incubator</button>` : '');
    body += eggs.length ? eggs.map(e => { const f = clamp((Date.now() - e.t0) / (e.dur * 1000), 0, 1); return `<div class="srow"><div class="sic egg">${svg('sun')}</div><div class="sinfo"><b>Egg from ${esc(BIOMES[e.biome]?.name || e.biome)}</b><div class="hap"><i style="width:${Math.round(f * 100)}%;background:#f0c040"></i></div><span>${f >= 1 ? 'Hatching!' : Math.ceil((1 - f) * e.dur) + ' s'}</span></div></div>`; }).join('') : '<p class="dim">The incubator is empty.</p>';
    return `<div class="phead"><h2>Hatchery</h2></div><div class="pbody">${body}</div>`;
  }

  /* ---------------- the Dino Dex ---------------- */
  /* ---------------- the admin panel ---------------- */
  _admin() {
    const G = this.g, W = this.W, A = G.admin || {}, tab = ['me', 'stuff', 'dinos', 'tp', 'world'].includes(this.tab) ? this.tab : 'me';
    const b = (cmd, label, x = '', on = false) => `<button data-a="adm" data-v="${cmd}" data-x="${esc(String(x))}" class="${on ? 'on' : ''}">${label}</button>`;
    let body = '';
    if (tab === 'me') {
      body += `<h3>You</h3><div class="abtns">${b('god', (A.god ? 'ON' : 'OFF') + ' &middot; Invincible', '', A.god)}${b('fly', (A.fly ? 'ON' : 'OFF') + ' &middot; Fly (SPACE up, CTRL down)', '', A.fly)}${b('auto', (A.autoCatch ? 'ON' : 'OFF') + ' &middot; Auto-catch', '', A.autoCatch)}${b('heal', 'Heal')}</div>`;
      body += `<h3>Speed</h3><div class="abtns">${[1, 2, 4, 8].map(s => b('speed', 'x' + s, s, (A.speed || 1) === s)).join('')}</div>`;
    }
    if (tab === 'stuff') {
      body += `<h3>Money <i>${money(W.money)}</i></h3><div class="abtns">${[1000, 10000, 100000, 1000000].map(m => b('money', '+' + money(m), m)).join('')}</div>`;
      body += `<h3>Gear</h3><div class="abtns">${b('tools', 'Every tool')}${b('items', '+20 of every bait')}${b('upg', 'Max all upgrades')}${b('plot', 'Bigger zoo land')}</div>`;
      body += `<h3>Zoo stars</h3><div class="abtns">${[0, 1, 2, 3, 4, 5, 6, 7].map(n => b('stars', n ? '&#9733;'.repeat(n) : 'none', n, (W.adminLevel || 0) === n)).join('')}</div>`;
    }
    if (tab === 'dinos') {
      body += `<div class="abtns">${b('giveAll', 'One of every species')}${b('dexAll', 'Fill the Dino Dex')}</div><p class="dim">Click a creature to get it (crate, or the holding pen when the crate is full). Shift-click spawns it wild in front of you.</p>`;
      body += '<div class="agrid">' + SPECIES.map(s => `<button data-a="adm" data-v="give" data-x="${s.id}" data-sp="${s.id}" title="${esc(s.name)}"><img src="${G.inv.icons.creature(s.id)}"><span>${esc(s.name)}</span><i style="color:${RARITY[s.rarity].css}">${'&#9733;'.repeat(RARITY[s.rarity].stars)}</i></button>`).join('') + '</div>';
      body += `<h3>Rare colours</h3><div class="abtns">${Object.entries(VARIANTS).map(([k, V]) => b('give', V.name + ' T-Rex', 'trex:' + k)).join('')}</div>`;
    }
    if (tab === 'tp') {
      const D = G.landmarks.dock, gp = G.zoo.gatePos();
      const spots = [['Your zoo', gp.x, gp.z - 8], ['The dock', D.x, D.z - 2]];
      const seenB = new Set();
      for (const [bm, x, z, r] of REGIONS) if (r > 2 && !seenB.has(bm)) { seenB.add(bm); spots.push([BIOMES[bm].name, x, z]); }
      for (const I of ISLANDS) if (I.id !== 'reef') spots.push([BIOMES[I.id]?.name || I.id, I.x, I.z]);
      spots.push(['The Lost Valley', VALLEY.x, VALLEY.z], ['Mount Cinder (rim)', VOLCANO.x - VOLCANO.crater - 30, VOLCANO.z], ['Over the Trench', TRENCH.x, TRENCH.z], ['Turtle Grotto', GROTTO.x, GROTTO.z]);
      body += '<h3>Lands</h3><div class="abtns">' + spots.map(([n, x, z]) => b('tp', esc(n), Math.round(x) + ',' + Math.round(z))).join('') + '</div>';
      body += '<h3>Places</h3><div class="abtns">' + PLACES.map(p => b('tp', esc(p.name), Math.round(p.x + 6) + ',' + Math.round(p.z + 6))).join('') + '</div>';
      body += '<h3>Caves</h3><div class="abtns">' + Object.entries(INTERIORS).map(([id, I]) => b('tp', esc(I.name), I.x + ',' + (I.z + I.r - 14) + ',' + id)).join('') + '</div>';
    }
    if (tab === 'world') {
      body += `<h3>Time</h3><div class="abtns">${[['Morning', 0.3], ['Noon', 0.5], ['Evening', 0.72], ['Night', 0.95]].map(([n, t]) => b('tod', n, t)).join('')}</div>`;
      body += `<h3>Weather</h3><div class="abtns">${['clear', 'cloudy', 'rain', 'storm'].map(w => b('weather', w[0].toUpperCase() + w.slice(1), w, W.weather.kind === w)).join('')}</div>`;
      body += `<h3>Events</h3><div class="abtns">${['stampede', 'migration', 'golden', 'meteors', 'eruption', 'sea', 'raid', 'titan'].map(e => b('event', e[0].toUpperCase() + e.slice(1), e)).join('')}</div>`;
      body += `<h3>Other</h3><div class="abtns">${b('reveal', 'Reveal the whole map')}${G.quests.inTutorial ? b('skipTut', 'Skip the tutorial') : ''}</div>`;
    }
    const tabs = [['me', 'Me'], ['stuff', 'Money & gear'], ['dinos', 'Dinosaurs'], ['tp', 'Teleport'], ['world', 'World']];
    return `<div class="phead"><h2>Admin Panel</h2><div class="pmoney">${svg('coin')} ${money(W.money)}</div></div><div class="ptabs">${tabs.map(([k, n]) => `<button data-a="tab" data-v="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div><div class="pbody admin">${body}</div>`;
  }

  /* ---------------- the field journal (your notes, no clues) ---------------- */
  _journal() {
    const G = this.g, W = this.W, tab = ['catches', 'records', 'places', 'totals'].includes(this.tab) ? this.tab : 'catches';
    const J = W.journal || [];
    const when = e => 'Day ' + e.day + ', ' + String(Math.floor((e.tod || 0) * 24)).padStart(2, '0') + ':' + String(Math.floor(((e.tod || 0) * 24 % 1) * 60)).padStart(2, '0');
    const kg = v => v >= 1000 ? (v / 1000).toFixed(1) + ' t' : Math.round(v) + ' kg';
    const nameOf = e => (e.v ? VARIANTS[e.v]?.name + ' ' : '') + SP[e.sp].name;
    let body = '';
    if (tab === 'catches') {
      body += J.length ? '' : '<p class="jdim">Nothing written here yet. Catch something and it goes in the journal.</p>';
      body += J.slice(0, 80).map(e => { const sp = SP[e.sp], R = RARITY[sp.rarity], rec = W.creatures[e.uid];
        return `<div class="jrow"><img src="${G.inv.icons.creature(e.sp, e.v)}"><div class="jtx"><b>${esc(nameOf(e))}</b>${rec?.name ? ' <i>"' + esc(rec.name) + '"</i>' : ''} <span style="color:${R.css}">${'&#9733;'.repeat(R.stars)}</span><span>${kg(e.kg)} &middot; ${e.fish ? 'hooked on a rod' : 'roped'}${e.b ? ' in ' + esc(BIOMES[e.b]?.name || e.b) : ''}${e.by ? ' &middot; by ' + esc(e.by) : ''}</span></div><div class="jwhen">${when(e)}</div></div>`; }).join('');
    }
    if (tab === 'records') {
      const best = {};
      for (const e of J) { const b = best[e.sp] ||= { n: 0, kg: 0, first: e, top: e }; b.n++; if (e.kg > b.kg) { b.kg = e.kg; b.top = e; } b.first = e; }
      for (const s of SPECIES) if (W.dex[s.id]?.caught && !best[s.id]) best[s.id] = { n: W.dex[s.id].caught, kg: W.dex[s.id].best || 0, first: null, top: null };
      const rows = Object.entries(best).sort((a, b) => RARITY[SP[b[0]].rarity].stars - RARITY[SP[a[0]].rarity].stars || b[1].kg - a[1].kg);
      body += rows.length ? rows.map(([id, b]) => `<div class="jrow"><img src="${G.inv.icons.creature(id, b.top?.v)}"><div class="jtx"><b>${esc(SP[id].name)}</b><span>Heaviest ${kg(b.kg)}${b.top?.b ? ' (' + esc(BIOMES[b.top.b]?.name || '') + ')' : ''} &middot; caught ${b.n}x${b.first ? ' &middot; first on day ' + b.first.day : ''}</span></div></div>`).join('') : '<p class="jdim">No records yet.</p>';
    }
    if (tab === 'places') {
      const seen = PLACES.filter(p => W.flags['seen:' + p.id]);
      body += `<h3>Places found <i>${seen.length} / ${PLACES.length}</i></h3>`;
      body += seen.length ? seen.map(p => `<div class="jrow"><div class="sic">${svg('star')}</div><div class="jtx"><b>${esc(p.name)}</b><span>${esc(p.tag || '')}</span></div></div>`).join('') : '<p class="jdim">You have not found any named places yet.</p>';
      const regions = Object.keys(BIOMES).filter(b => W.flags['b:' + b]);
      body += `<h3>Lands visited</h3>` + regions.map(b => `<div class="jrow"><div class="jtx"><b>${esc(BIOMES[b].name)}</b><span>Danger: ${['Safe', 'Easy', 'Wild', 'Dangerous', 'DEADLY'][BIOMES[b].danger] || '?'}</span></div></div>`).join('');
    }
    if (tab === 'totals') {
      const heavy = J.reduce((m, e) => (e.kg > (m?.kg || 0) ? e : m), null), rare = J.reduce((m, e) => (!m || RARITY[SP[e.sp].rarity].stars > RARITY[SP[m.sp].rarity].stars ? e : m), null);
      const t = [['Creatures caught', W.stats.caught || 0], ['Caught on a rod', W.stats.fished || 0], ['Different species', SPECIES.filter(s => W.dex[s.id]?.caught).length + ' / ' + SPECIES.length], ['Heaviest catch', heavy ? nameOf(heavy) + ', ' + kg(heavy.kg) : '-'], ['Rarest catch', rare ? nameOf(rare) + ' (' + RARITY[SP[rare.sp].rarity].name + ')' : '-'], ['Money earned', money(W.stats.earned || 0)], ['Places found', PLACES.filter(p => W.flags['seen:' + p.id]).length], ['Days in the wild', W.day]];
      body += t.map(([k, v]) => `<div class="jtot"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join('');
    }
    const tabs = [['catches', 'Catches'], ['records', 'Records'], ['places', 'Places'], ['totals', 'Totals']];
    return `<div class="phead journal"><h2>Field Journal</h2></div><div class="ptabs">${tabs.map(([k, n]) => `<button data-a="tab" data-v="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div><div class="pbody jbody">${body}</div>`;
  }
  _dex() {
    const G = this.g, W = this.W, sel = this.arg && SP[this.arg] ? this.arg : SPECIES[0].id;
    const caught = SPECIES.filter(s => W.dex[s.id]?.caught).length;
    const grid = SPECIES.map(s => {
      const d = W.dex[s.id], R = RARITY[s.rarity];
      const icon = d?.seen || d?.caught ? G.inv.icons.creature(s.id) : G.inv.icons.creature(s.id, null, { dark: true });
      return `<div class="dx ${d?.caught ? 'c' : d?.seen ? 's' : ''} ${s.id === sel ? 'sel' : ''}" data-a="dex" data-v="${s.id}" style="--rc:${R.css}"><img src="${icon}"><span>${d?.caught || d?.seen ? esc(s.name) : '???'}</span></div>`;
    }).join('');
    const s = SP[sel], d = W.dex[sel], R = RARITY[s.rarity], known = d?.seen || d?.caught;
    const card = `<div class="dxcard"><img src="${known ? G.inv.icons.creature(s.id) : G.inv.icons.creature(s.id, null, { dark: true })}">
      <h3>${known ? esc(s.name) : '???'}</h3><div class="dsci">${known ? esc(s.sci) : ''}</div>
      <div style="color:${R.css}">${'&#9733;'.repeat(R.stars)} ${R.name}</div>
      <p>${known ? esc(s.lore) : 'Not seen yet.'}</p>
      <p class="dhint">${svg('eye')} ${esc(s.hint)}</p>
      ${d?.caught ? `<p>Caught: <b>${d.caught}</b>${d.best ? ' &middot; biggest ' + fmtKg(d.best) : ''}${d.v?.length ? ' &middot; colours: ' + d.v.map(v => VARIANTS[v].name).join(', ') : ''}</p><div class="dab">${s.abilities.filter(a => ABILITIES[a]).map(a => `<span class="chip" title="${esc(ABILITIES[a].desc)}">${svg(ABILITIES[a].icon)}${esc(ABILITIES[a].name)}</span>`).join('')}</div><p class="dim">${esc(s.abilities.filter(a => ABILITIES[a]).map(a => ABILITIES[a].desc).join(' '))}</p>` : known ? '<p class="dim">Catch one to learn what it can do.</p>' : ''}
    </div>`;
    return `<div class="phead"><h2>Dino Dex</h2><div class="pmoney">${caught} / ${SPECIES.length} caught</div></div><div class="pbody dexwrap"><div class="dxgrid">${grid}</div>${card}</div>`;
  }

  /* ---------------- the map ---------------- */
  _map() {
    const G = this.g, W = this.W;
    const lit = BEACONS.filter(B => W.beacons[B.id]);
    const travel = W.upg.beacon ? `<div class="mtravel"><b>Fast travel</b> <button data-a="travel" data-v="zoo">Zoo</button>${lit.map(B => `<button data-a="travel" data-v="${B.id}">${esc(B.name)}</button>`).join('')}</div>` : `<div class="mtravel dim">Buy Ranger Beacons at the Ranger Station to fast travel between lit beacons.</div>`;
    return `<div class="phead"><h2>Map</h2><div class="pmoney">${PLACES.filter(p => W.flags['seen:' + p.id]).length} / ${PLACES.length} places found</div></div><div class="pbody mapwrap"><canvas id="mapc" width="760" height="760"></canvas>${travel}</div>`;
  }
  _drawMap() {
    const G = this.g, W = this.W, cv = $('mapc'); if (!cv) return;
    const ctx = cv.getContext('2d'), S = cv.width;
    if (!G.mapImage) G.mapImage = G.makeMapImage();
    ctx.drawImage(G.mapImage, 0, 0, S, S);
    // fog of war
    const ex = G.explored, n = ex.n;
    ctx.fillStyle = 'rgba(20, 28, 36, 0.86)';
    const cs = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!ex.bits[i * n + j]) ctx.fillRect(i * cs - 0.5, j * cs - 0.5, cs + 1, cs + 1);
    const tp = (x, z) => [(x + WORLD_HALF) / (WORLD_HALF * 2) * S, (z + WORLD_HALF) / (WORLD_HALF * 2) * S];
    ctx.font = '700 12px Nunito, sans-serif'; ctx.textAlign = 'center';
    for (const P of PLACES) { if (!W.flags['seen:' + P.id] || P.id === 'zoo') continue; const [x, y] = tp(P.x, P.z); ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText(P.name, x, y - 8); ctx.fillStyle = '#fff'; ctx.fillText(P.name, x, y - 8); }
    for (const B of BEACONS) { const [x, y] = tp(B.x, B.z); const lit = W.beacons[B.id]; if (!lit && !ex.at(B.x, B.z)) continue; ctx.fillStyle = lit ? '#7aff9a' : '#7a7a7a'; ctx.fillRect(x - 4, y - 4, 8, 8); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 4, y - 4, 8, 8); }
    const [zx, zy] = tp(ZOO.x, ZOO.z); ctx.fillStyle = '#ffd040'; ctx.beginPath(); ctx.arc(zx, zy, 7, 0, 7); ctx.fill(); ctx.strokeStyle = '#5a3a08'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText('ZOO', zx, zy - 11); ctx.fillText('ZOO', zx, zy - 11);
    for (const M of G.ui.marks) { const p = M.c ? M.c.pos : M.p; const [x, y] = tp(p.x, p.z); ctx.fillStyle = M.c ? RARITY[M.c.sp.rarity].css : '#fff'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); }
    for (const p of G.players()) { const [x, y] = tp(p.pos.x, p.pos.z); ctx.save(); ctx.translate(x, y); ctx.rotate(-(p.yaw ?? 0) + Math.PI); ctx.fillStyle = p.pid === G.me ? '#ff5a5a' : '#5ab0ff'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); }
  }

  /* ---------------- pause / settings / confirm ---------------- */
  _pause() {
    const G = this.g, p = G.profile;
    const room = G.net.isOnline ? `<p class="room">Co-op room code: <b>${esc(G.net.room)}</b> &middot; ${G.net.count} player${G.net.count > 1 ? 's' : ''}</p>` : '';
    const sl = (k, min, max, step, label) => `<label class="set">${label}<input type="range" min="${min}" max="${max}" step="${step}" value="${p[k]}" data-k="${k}"></label>`;
    return `<div class="phead"><h2>Paused</h2></div><div class="pbody">${room}
      <button class="wide" data-a="resume">Back to the game</button><button class="wide alt" data-a="admin">Admin panel (F2)</button>${G.quests.inTutorial ? '<button class="wide alt" data-a="skipTut">Skip the tutorial</button>' : ''}
      <h3>Settings</h3>${sl('sens', 0.2, 3, 0.05, 'Mouse sensitivity')}${sl('vol', 0, 1, 0.05, 'Volume')}${sl('music', 0, 1, 0.05, 'Music')}${sl('fov', 55, 95, 1, 'Field of view')}
      <label class="set">Invert mouse Y <button data-a="set" data-k="invert">${p.invert ? 'On' : 'Off'}</button></label>
      <label class="set">Shadows <button data-a="set" data-k="shadows">${p.shadows ? 'On' : 'Off'}</button></label>
      <h3>Controls</h3>
      <div class="ctl"><span><b class="key">WASD</b> move</span><span><b class="key">SHIFT</b> sprint</span><span><b class="key">C</b> sneak</span><span><b class="key">SPACE</b> jump / climb</span><span><b class="key">E</b> interact / get on / off</span><span><b class="key">F</b> mount ability</span><span><b class="key">LMB</b> throw / use</span><span><b class="key">RMB</b> aim / zoom</span><span><b class="key">1-0</b> hotbar</span><span><b class="key">TAB</b> inventory</span><span><b class="key">J</b> Dino Dex</span><span><b class="key">M</b> map</span><span><b class="key">N</b> journal</span><span><b class="key">B</b> build (at the zoo)</span><span><b class="key">V</b> camera distance</span><span><b class="key">T</b> chat (co-op)</span></div>
      <button class="wide alt" data-a="quit">Save and quit to the title screen</button></div>`;
  }
  _confirm() { const a = this.arg; return `<div class="phead"><h2>${esc(a.title)}</h2></div><div class="pbody"><p>${esc(a.text)}</p><div class="yn"><button data-a="yes">Yes</button><button data-a="no" class="alt">No</button></div></div>`; }
  /** sliders need live input events */
  bindSliders() {
    this.el.querySelectorAll('input[type=range]').forEach(inp => inp.oninput = () => { this.g.profile[inp.dataset.k] = +inp.value; this.g.applySettings(); });
  }
  update(dt) {
    const G = this.g, I = G.input;
    if (this.k) {
      if (I.pressedRaw('Escape')) { this.close(); return; }
      if (this.k === 'pause') this.bindSliders();
      if (this.k === 'hatchery' || (this.k === 'station' && this.tab !== 'shop')) { this._rt = (this._rt || 0) - dt; if (this._rt <= 0) { this._rt = 1; const key = JSON.stringify([G.W.money, G.W.eggs, Object.values(G.W.creatures).map(r => r.at + r.uid)]); if (key !== this._rk) { this._rk = key; this.render(); } } }
      if (this.k === 'map') { this._mt = (this._mt || 0) - dt; if (this._mt <= 0) { this._mt = 0.5; this._drawMap(); } }
      if (I.pressedRaw('KeyJ') && this.k === 'dex') this.close();
      if (I.pressedRaw('KeyM') && this.k === 'map') this.close();
      if (I.pressedRaw('KeyN') && this.k === 'journal') this.close();
      if (I.pressedRaw('F2') && this.k === 'admin') this.close();
      return;
    }
    if (G.phase !== 'play' || G.inv.open || G.build?.active || G.chatOpen) return;
    if (I.pressedRaw('KeyJ')) this.open('dex');
    if (I.pressedRaw('KeyM')) this.open('map');
    if (I.pressedRaw('KeyN') && G.W?.tools?.journal) this.open('journal');
    if (I.pressedRaw('F2')) this.open('admin');
  }
}
void THREE;
