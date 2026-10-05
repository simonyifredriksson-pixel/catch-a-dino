/* Inventory.js - the hotbar along the bottom, and the inventory screen (TAB / I).

   Same system as Pizza Underground's: one hotbar and one inventory that are
   the same thing seen two ways. The hotbar holds tools, bait and the
   creatures in your crate: press 1-9 / 0 (or scroll) to hold a tool or bait;
   press a creature's number to call it out and ride it (again to put it
   back). In the inventory, point at something and press a number to put it
   on that slot. Tabs: Creatures (your crate), Tools, Items (bait, finds,
   eggs), Gear (upgrades). The big turntable on the right shows the creature
   or tool, animated; the card has its stars, chips and story. */
import * as THREE from '../../lib/three.module.js';
import { TOOLS, TOOL_ORDER } from '../data/Tools.js';
import { ITEMS, UPGRADES, UPGRADE_ORDER } from '../data/Items.js';
import { SP, RARITY, SIZE, VARIANTS } from '../data/Species.js';
import { ABILITIES } from '../data/Abilities.js';
import { holdModel } from '../art/ToolArt.js';
import { IconMaker, Preview, creatureObj } from './Icons.js';
import { saveProfile } from '../game/State.js';
import { money, esc, fmtKg } from '../core/Util.js';

const SLOTS = 10;
const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];

export const SVG = {
  creatures: '<path d="M4 15c0-4 3-7 7-7h2l3-3 1 4 3 1-2 3c1 3-1 7-5 7H9l-3 3v-3c-1-1-2-3-2-5z"/><circle cx="15.5" cy="9.5" r="1" fill="#15181d"/>',
  tools: '<path d="M4 20c4-1 6-4 6-8 0-3 2-6 6-6 2 0 4 1 4 3s-2 3-4 3c-2 0-3-1-3-3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  items: '<path d="M7.6 7.4c1.1-.9 2.6-1.3 4.4-1.3s3.3.4 4.4 1.3l2.2 11.1c.2 1.2-.6 2.4-1.8 2.6-3.1.6-6.5.6-9.6 0-1.2-.2-2-1.4-1.8-2.6z"/><path d="M9.8 6.2 11 3.3h2l1.2 2.9" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  gear: '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/>',
  coin: '<circle cx="12" cy="12" r="9.5" fill="#f0c040" stroke="#8a5a10" stroke-width="1.6"/><path d="M14.6 9.2c-.5-.9-1.5-1.4-2.6-1.4-1.6 0-2.7.8-2.7 2s1 1.7 2.7 2.1 2.8.9 2.8 2.2-1.2 2.1-2.8 2.1c-1.2 0-2.3-.6-2.8-1.6M12 6.4v11.2" fill="none" stroke="#5a3a08" stroke-width="1.7" stroke-linecap="round"/>',
  star: '<path d="M12 2.6l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.8l-5.8 3.3 1.4-6.4-4.9-4.4 6.5-.7z"/>',
  bolt: '<path d="M13 2 5 13h6l-1 9 8-11h-6z"/>', up: '<path d="M12 3l8 9h-5v9H9v-9H4z"/>', down: '<path d="M12 21l8-9h-5V3H9v9H4z"/>',
  mount: '<path d="M3 20l6-9 4 5 3-4 5 8z"/>', fist: '<path d="M6 9h11a3 3 0 010 6h-2v4H7a3 3 0 01-3-3v-4a3 3 0 012-3z"/>', box: '<path d="M3 7 12 3l9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10" fill="none" stroke="#15181d" stroke-width="1.3"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/>', roar: '<path d="M3 8l8-4v16l-8-4zM14 8c2 1 2 7 0 8M17 6c3 2 3 10 0 12" fill="none" stroke="currentColor" stroke-width="2"/>',
  note: '<path d="M9 18a3 3 0 11-2-2.8V4l11-2v13a3 3 0 11-2-2.8V6.5l-7 1.3z"/>', drop: '<path d="M12 2c4 6 6 9 6 12a6 6 0 01-12 0c0-3 2-6 6-12z"/>', swirl: '<path d="M12 3a9 9 0 109 9h-3a6 6 0 11-6-6z"/>',
  dig: '<path d="M14 3l7 7-3 3-7-7zM10 7l-7 11 3 3 11-7"/>', claw: '<path d="M5 20C8 12 6 6 4 3c5 2 8 8 6 17zM11 20c2-7 1-12-1-15 4 2 6 8 4 15zM17 20c1-6 0-10-2-13 3 2 5 7 4 13z"/>',
  nose: '<path d="M4 12c4-6 12-6 16 0-4 6-12 6-16 0z"/><circle cx="12" cy="12" r="2.5" fill="#15181d"/>', sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4M4 4l3 3M17 17l3 3M4 20l3-3M17 7l3-3" stroke="currentColor" stroke-width="2"/>',
  fire: '<path d="M12 2c2 5 7 7 7 13a7 7 0 01-14 0c0-4 3-6 4-9 1 2 2 3 3 3 0-3-1-5 0-7z"/>', snow: '<path d="M12 2v20M3 7l18 10M3 17l18-10" stroke="currentColor" stroke-width="2.2"/>', wave: '<path d="M2 14c3-4 5-4 8 0s5 4 8 0 3-3 4-2v6H2z"/>',
  wing: '<path d="M2 12c6-8 14-9 20-6-4 1-6 3-7 6 2 0 4 1 5 3-6 1-12 0-18-3z"/>', ring: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4"/>', eye: '<path d="M2 12c2.5-4.5 6-7 10-7s7.5 2.5 10 7c-2.5 4.5-6 7-10 7S4.5 16.5 2 12z"/><circle cx="12" cy="12" r="3.2" fill="#15181d"/>',
  weight: '<path d="M7 8h10l3 12H4z"/><circle cx="12" cy="6" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/>', speed: '<path d="M3 14a9 9 0 0118 0h-3a6 6 0 00-12 0zM12 14l5-6" stroke="currentColor" stroke-width="2"/>',
};
export const svg = (k, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${SVG[k] || SVG.star}</svg>`;
const TABS = [{ k: 'creatures', name: 'Creatures' }, { k: 'tools', name: 'Tools' }, { k: 'items', name: 'Items' }, { k: 'gear', name: 'Gear' }];
const TSTARS = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };

export class Inventory {
  constructor(game) {
    this.g = game; this.open = false; this.tab = 'creatures'; this.sel = 0;
    this.icons = new IconMaker(game.renderer);
    const p = game.profile;
    if (!Array.isArray(p.hotbar) || p.hotbar.length !== SLOTS) p.hotbar = Array(SLOTS).fill(null);
    p.hotSeen = p.hotSeen || [];
    this.hold = 0;            // which slot you are holding (tools / bait)
    this._buildHotbar(); this._buildScreen();
    this.barKey = '';
  }
  get W() { return this.g.W; }
  get bar() { return this.g.profile.hotbar; }

  /* ---------------- what you own ---------------- */
  entries(tab) {
    const G = this.g, W = this.W, out = [];
    if (tab === 'creatures') for (const r of G.packCreatures()) {
      const sp = SP[r.sp], R = RARITY[sp.rarity], out1 = G.riding.c?.uid === r.uid;
      const ab = sp.abilities.filter(a => ABILITIES[a]).slice(0, 4);
      out.push({ id: 'cr:' + r.uid, kind: 'creature', key: r.uid, rec: r, name: r.name || sp.name, sub: r.name ? sp.name : null, stars: R.stars, rcss: R.css, on: out1,
        chips: [['box', SIZE[sp.size].name + ' (' + SIZE[sp.size].crate + ' slots)'], ...(sp.ride === false ? [['eye', 'Too small to ride']] : [['speed', Math.round((sp.speed.run || sp.speed.fly || sp.speed.swim) * 3.6) + ' km/h']]), ...ab.map(a => [ABILITIES[a].icon, ABILITIES[a].name])],
        desc: (r.v ? VARIANTS[r.v].name + ' colouring! ' : '') + sp.lore + (r.traits?.length ? ' Traits: ' + r.traits.join(', ') + '.' : '') + ' ' + fmtKg(r.kg || sp.kg[0]) + '.',
        abil: ab, icon: () => creatureObj(r.sp, r.v, 0.6), iconKey: 'cr:' + r.sp + ':' + (r.v || ''), iconOpt: { dir: [1, 0.3, 0.6] },
        act: sp.ride === false ? (out1 ? 'Put back' : 'Let it out') : out1 ? (G.player.mount ? 'Put back in the crate' : 'Ride') : 'Ride', act2: 'Release into the wild' });
    }
    if (tab === 'tools') for (const k of TOOL_ORDER) {
      if (!W.tools[k]) continue;
      const T = TOOLS[k], S = T.stats;
      out.push({ id: 'tool:' + k, kind: 'tool', key: k, name: T.name, stars: TSTARS[T.rarity] || 1, on: G.tools.id === k, desc: T.desc,
        chips: S ? [['fist', 'Strength ' + S.rating.toFixed(1)], ['ring', 'Loop ' + Math.round(S.band * 100) + '%'], ['up', 'Range ' + S.range + ' m'], ['eye', 'Catches: ' + T.targets.join(', ')], ['box', 'Up to ' + SIZE[T.maxSize].name]] : [['bolt', 'Utility']],
        icon: () => holdModel(k), iconKey: 'tool:' + k, iconOpt: { dir: [1, 0.5, 0.8] }, act: G.tools.id === k ? 'Holding' : 'Hold' });
    }
    if (tab === 'items') for (const k of Object.keys(ITEMS)) {
      const n = W.items[k] || 0; if (n <= 0) continue;
      const I = ITEMS[k];
      out.push({ id: 'item:' + k, kind: I.kind, key: k, name: I.name, count: n, stars: I.kind === 'bait' ? (I.lure ? 4 : 1) : I.sell >= 1000 ? 4 : I.sell >= 300 ? 3 : 2, on: G.tools.id === k, desc: I.desc,
        chips: I.kind === 'bait' ? [['drop', 'Attracts: ' + I.diet.join(', ')], ['box', n + ' left']] : I.kind === 'egg' ? [['sun', 'Hatches at the Hatchery']] : [['coin', 'Sells for ' + money(I.sell)]],
        icon: () => holdModel(k), iconKey: 'item:' + k, act: I.kind === 'bait' ? (G.tools.id === k ? 'Holding' : 'Hold') : null });
    }
    if (tab === 'gear') for (const k of UPGRADE_ORDER) {
      const U = UPGRADES[k], lv = W.upg[k] || 0;
      if (lv <= 0 && k !== 'crate') continue;
      out.push({ id: 'upg:' + k, kind: 'upg', key: k, name: U.name + (U.levels.length > 2 ? ' Lv ' + (lv + 1) : ''), stars: Math.min(5, lv + 1), desc: U.desc, chips: k === 'crate' ? [['box', 'Holds ' + U.levels[lv].cap + ' slots']] : [['shield', 'Level ' + (lv + 1) + ' of ' + U.levels.length]], icon: () => gearModel(k), iconKey: 'upg:' + k, act: null });
    }
    return out;
  }
  hotbarIds() { return [...this.entries('creatures'), ...this.entries('tools'), ...this.entries('items').filter(e => e.kind === 'bait')].map(e => e.id); }
  entryById(id) { for (const t of ['creatures', 'tools', 'items']) { const e = this.entries(t).find(x => x.id === id); if (e) return e; } return null; }
  icon(e) { return this.icons.get(e.iconKey || e.id, e.icon, e.iconOpt); }

  /* ---------------- the hotbar ---------------- */
  _buildHotbar() {
    const host = document.getElementById('hud') || document.body;
    this.hb = document.createElement('div'); this.hb.id = 'hotbar'; host.appendChild(this.hb);
    this.hbName = document.createElement('div'); this.hbName.id = 'hotname'; host.appendChild(this.hbName);
    this.hb.innerHTML = Array.from({ length: SLOTS }, (_, i) => `<div class="hs" data-i="${i}"><span class="n">${(i + 1) % 10}</span><img alt=""><span class="c"></span><i class="rb"></i></div>`).join('');
    this.hb.addEventListener('mousedown', e => { const s = e.target.closest('.hs'); if (s) { e.stopPropagation(); this.activate(+s.dataset.i); } });
  }
  _syncBar() {
    const own = new Set(this.hotbarIds()), p = this.g.profile, bar = this.bar;
    let changed = false;
    for (let i = 0; i < SLOTS; i++) if (bar[i] && !own.has(bar[i])) { bar[i] = null; changed = true; }
    for (const id of own) {
      if (bar.includes(id) || p.hotSeen.includes(id)) continue;
      const free = bar.indexOf(null); if (free < 0) break;
      bar[free] = id; p.hotSeen.push(id); changed = true;
    }
    for (const id of [...p.hotSeen]) if (!own.has(id) && id.startsWith('item:')) p.hotSeen.splice(p.hotSeen.indexOf(id), 1);
    if (changed) saveProfile(p);
    // make sure we hold what the held slot says
    const hid = bar[this.hold], he = hid ? this.entryById(hid) : null;
    const want = he && (he.kind === 'tool' || he.kind === 'bait') ? he.key : null;
    if (this.g.tools.id !== want) this.g.tools.hold(want);
  }
  _drawBar() {
    const G = this.g, W = this.W;
    const key = JSON.stringify([this.bar, this.hold, G.riding.c?.uid, Object.values(W.items), G.tools.id]);
    if (key === this.barKey) return;
    this.barKey = key;
    [...this.hb.children].forEach((el, i) => {
      const id = this.bar[i], e = id ? this.entryById(id) : null;
      el.classList.toggle('empty', !e);
      el.classList.toggle('on', !!e && i === this.hold && (e.kind === 'tool' || e.kind === 'bait'));
      el.classList.toggle('out', !!e && e.kind === 'creature' && e.on);
      el.classList.toggle('cr', !!e && e.kind === 'creature');
      el.style.setProperty('--rc', e?.rcss || 'transparent');
      const img = el.querySelector('img');
      if (e) { const u = this.icon(e); if (img.getAttribute('src') !== u) img.src = u; img.style.display = ''; } else { img.removeAttribute('src'); img.style.display = 'none'; }
      el.querySelector('.c').textContent = e && e.count != null ? e.count : '';
      el.title = e ? e.name : '';
    });
  }
  /** press a number: hold a tool, or call out / ride / put back a creature */
  activate(i) {
    const G = this.g, id = this.bar[i], e = id ? this.entryById(id) : null;
    if (!e) { if (G.tools.id) { this.hold = i; this.barKey = ''; } return; }
    if (e.kind === 'creature') {
      const sp = SP[e.rec.sp];
      if (G.riding.c?.uid === e.key) { if (G.player.mount || sp.ride === false) G.riding.recall(); else G.riding.mountOn(G.riding.c); }
      else G.riding.summon(e.key);
      this._showName(e.name);
    } else {
      if (G.catching.busy && G.catching.state !== 'reel') return G.ui.toast('Finish the catch first!', 'warn');
      this.hold = i; this._showName(e.name);
    }
    G.audio.tone(660, 0.05, 'triangle', 0.05);
    this.barKey = '';
  }
  _scroll(d) {
    // the wheel steps through holdable slots only
    for (let k = 1; k <= SLOTS; k++) {
      const i = (this.hold + d * k + SLOTS * 10) % SLOTS, id = this.bar[i], e = id ? this.entryById(id) : null;
      if (!e || e.kind === 'tool' || e.kind === 'bait') { if (e) { this.hold = i; this._showName(e.name); this.barKey = ''; } else continue; return; }
    }
  }
  _showName(t) { if (!t) return; this.hbName.textContent = t; this.hbName.classList.remove('on'); void this.hbName.offsetWidth; this.hbName.classList.add('on'); }

  /* ---------------- the inventory screen ---------------- */
  _buildScreen() {
    const el = document.createElement('div'); el.id = 'inv'; document.body.appendChild(el); this.el = el;
    el.innerHTML = `
      <div class="inv-head"><div class="inv-lr"><b class="ikey">Q</b><span class="inv-prev"></span></div><div class="inv-title">Inventory</div><div class="inv-lr"><span class="inv-next"></span><b class="ikey">E</b></div></div>
      <div class="inv-money">${svg('coin')}<span></span></div>
      <div class="inv-tabs">${TABS.map(t => `<div class="itab" data-t="${t.k}"><span class="itab-name">${t.name}</span>${svg(t.k)}</div>`).join('')}</div>
      <div class="inv-cap"></div>
      <div class="inv-gridwrap"><div class="inv-grid"></div><div class="inv-empty"></div></div>
      <canvas class="inv-preview" width="360" height="500"></canvas>
      <div class="inv-card"></div>
      <div class="inv-foot"><span><b class="ikey">Click</b>Select / use</span><span><b class="ikey">1-0</b>Put on hotbar</span><span><b class="ikey">Drag</b>Rotate</span><span><b class="ikey">TAB</b>Close</span></div>`;
    this.grid = el.querySelector('.inv-grid'); this.card = el.querySelector('.inv-card');
    this.preview = new Preview(this.icons, el.querySelector('.inv-preview'));
    el.querySelector('.inv-tabs').addEventListener('click', e => { const t = e.target.closest('.itab'); if (t) this.setTab(t.dataset.t); });
    this.grid.addEventListener('click', e => { const s = e.target.closest('.islot'); if (!s || s.classList.contains('none')) return; const i = +s.dataset.i; if (i === this.sel) this.primary(); else { this.sel = i; this.render(); } });
    this.grid.addEventListener('mouseover', e => { const s = e.target.closest('.islot'); if (s && !s.classList.contains('none') && +s.dataset.i !== this.sel) { this.sel = +s.dataset.i; this.render(); } });
    this.card.addEventListener('click', e => { if (e.target.closest('.d-act')) this.primary(); if (e.target.closest('.d-act2')) this.secondary(); });
    el.addEventListener('mousedown', e => e.stopPropagation());
  }
  toggle(tab) { if (this.open) this.close(); else this.show(tab); }
  show(tab) {
    const G = this.g;
    if (G.phase !== 'play' || G.ui.panel || G.build?.active) return;
    if (tab) this.setTab(tab, true);
    this.open = true; this.sel = Math.min(this.sel, Math.max(0, this.entries(this.tab).length - 1));
    G.input.unlock(); this.el.classList.add('on'); this.preview.key = ''; this.render(); G.audio.open();
  }
  close() { if (!this.open) return; this.open = false; this.el.classList.remove('on'); this.g.audio.close(); }
  setTab(t, quiet) { if (this.tab !== t) { this.tab = t; this.sel = 0; this.preview.key = ''; } if (!quiet) { this.render(); this.g.audio.click(); } }
  render() {
    if (!this.open) return;
    const G = this.g, W = this.W, list = this.entries(this.tab), ti = TABS.findIndex(t => t.k === this.tab);
    this.list = list; this.sel = Math.max(0, Math.min(this.sel, list.length - 1));
    this.el.querySelectorAll('.itab').forEach(t => t.classList.toggle('on', t.dataset.t === this.tab));
    this.el.querySelector('.inv-prev').textContent = TABS[(ti + TABS.length - 1) % TABS.length].name;
    this.el.querySelector('.inv-next').textContent = TABS[(ti + 1) % TABS.length].name;
    this.el.querySelector('.inv-money span').textContent = money(W.money).replace('$', '');
    const cap = G.crateCap(), used = G.crateUsed();
    this.el.querySelector('.inv-cap').innerHTML = this.tab === 'creatures' ? `Capture crate <b>${used} / ${cap}</b> slots${G.player.mount?.has('carry') ? ' <span class="pk">+ saddlebags</span>' : ''}` : '';
    const slots = Math.max(15, Math.ceil(list.length / 5) * 5);
    this.grid.innerHTML = Array.from({ length: slots }, (_, i) => {
      const e = list[i];
      if (!e) return '<div class="islot none"></div>';
      const hk = this.bar.indexOf(e.id);
      return `<div class="islot ${e.on ? 'eq' : ''} ${i === this.sel ? 'sel' : ''}" data-i="${i}" style="--rc:${e.rcss || 'transparent'}"><img src="${this.icon(e)}" alt="">${e.count != null ? `<span class="cnt">${e.count}</span>` : ''}${hk >= 0 ? `<span class="hk">${(hk + 1) % 10}</span>` : ''}${e.rcss ? '<i class="rar"></i>' : ''}</div>`;
    }).join('');
    this.el.querySelector('.inv-empty').textContent = list.length ? '' : {
      creatures: 'Nobody on your team yet. Go and catch something! (Creatures at your base are managed at the Ranger Station.)',
      tools: 'No tools.', items: 'Nothing here. Bait is sold at the Ranger Station; dig spots and cracks hide finds.', gear: 'No upgrades yet. The Ranger Station sells them.' }[this.tab];
    const e = list[this.sel];
    this.card.style.display = e ? '' : 'none';
    if (e) {
      const hk = this.bar.indexOf(e.id), canBar = e.kind === 'creature' || e.kind === 'tool' || e.kind === 'bait';
      this.card.innerHTML = `
        <div class="d-stars" style="color:${e.rcss || '#fff'}">${Array.from({ length: e.stars }, () => svg('star')).join('')}</div>
        <div class="d-name">${esc(e.name)}${e.sub ? ` <span class="d-sub">${esc(e.sub)}</span>` : ''}</div>
        <div class="d-chips">${(e.chips || []).map(([ic, t]) => `<span class="chip">${svg(ic)}${esc(t)}</span>`).join('')}</div>
        <div class="d-desc">${esc(e.desc)}</div>
        <div class="d-row">${e.act ? `<button class="d-act">${esc(e.act)}</button>` : ''}${e.act2 ? `<button class="d-act2">${esc(e.act2)}</button>` : ''}${canBar ? `<span class="d-hint">${hk >= 0 ? 'Hotbar slot ' + ((hk + 1) % 10) + '. ' : ''}Press 1-0 to put it on the hotbar.</span>` : ''}</div>`;
    }
    if (!e) this.preview.set('me', () => this.g.player.rig.root.clone());
    else this.preview.set(e.iconKey || e.id, e.kind === 'creature' ? () => creatureObj(e.rec.sp, e.rec.v, 0.5) : e.icon, { height: e.kind === 'creature' ? 2.1 : 1.3 });
  }
  primary() {
    const G = this.g, e = this.list?.[this.sel]; if (!e) return;
    if (e.kind === 'creature') { const i = this.bar.indexOf(e.id); if (i >= 0) this.activate(i); else { if (G.riding.c?.uid === e.key) G.riding.recall(); else G.riding.summon(e.key); } this.close(); return; }
    if (e.kind === 'tool' || e.kind === 'bait') { let i = this.bar.indexOf(e.id); if (i < 0) { i = this.bar.indexOf(null); if (i < 0) i = this.hold; this.bar[i] = e.id; saveProfile(G.profile); } this.hold = i; this.barKey = ''; }
    G.audio.click(); setTimeout(() => this.render(), 50);
  }
  secondary() {
    const G = this.g, e = this.list?.[this.sel]; if (!e || e.kind !== 'creature') return;
    G.ui.confirm('Release ' + e.name + ' back into the wild?', 'It will be gone for good (but you can always catch another).', () => { if (G.riding.c?.uid === e.key) G.riding.recall(); G.act({ k: 'release', uid: e.key }); setTimeout(() => this.render(), 120); });
  }
  assign(i) {
    const e = this.list?.[this.sel]; if (!e) return;
    if (!(e.kind === 'creature' || e.kind === 'tool' || e.kind === 'bait')) return this.g.ui.toast('That can\'t go on the hotbar.');
    const bar = this.bar, was = bar.indexOf(e.id), there = bar[i];
    if (was >= 0) bar[was] = there === e.id ? null : there;
    bar[i] = e.id;
    if (!this.g.profile.hotSeen.includes(e.id)) this.g.profile.hotSeen.push(e.id);
    saveProfile(this.g.profile); this.barKey = '';
    this.g.audio.tone(1200, 0.05, 'triangle', 0.05);
    this.render();
  }

  /* ---------------- every frame ---------------- */
  update(dt) {
    const G = this.g, I = G.input, play = G.phase === 'play';
    this.hb.style.display = play && !this.open && !G.build?.active ? '' : 'none';
    if (!play) { if (this.open) this.close(); return; }
    this._syncBar(); this._drawBar();
    if ((I.pressedRaw('Tab') || I.pressedRaw('KeyI')) && !G.chatOpen && !G.ui.panel && !G.build?.active) this.toggle();
    if (this.open) {
      if (I.pressedRaw('Escape')) this.close();
      if (I.pressedRaw('KeyQ')) this.setTab(TABS[(TABS.findIndex(t => t.k === this.tab) + TABS.length - 1) % TABS.length].k);
      if (I.pressedRaw('KeyE')) this.setTab(TABS[(TABS.findIndex(t => t.k === this.tab) + 1) % TABS.length].k);
      const n = this.list?.length || 0, mv = (d) => { if (n) { this.sel = (this.sel + d + n) % n; this.render(); } };
      if (I.pressedRaw('ArrowRight') || I.pressedRaw('KeyD')) mv(1);
      if (I.pressedRaw('ArrowLeft') || I.pressedRaw('KeyA')) mv(-1);
      if (I.pressedRaw('ArrowDown') || I.pressedRaw('KeyS')) mv(5);
      if (I.pressedRaw('ArrowUp') || I.pressedRaw('KeyW')) mv(-5);
      if (I.pressedRaw('Enter') || I.pressedRaw('Space')) this.primary();
      KEYS.forEach((k, i) => { if (I.pressedRaw(k)) this.assign(i); });
      this.preview.update(dt);
      this._refreshT = (this._refreshT || 0) - dt;
      if (this._refreshT <= 0) { this._refreshT = 0.5; const k = JSON.stringify([this.W.money, this.entries(this.tab).map(e => [e.id, e.count, e.on])]); if (k !== this._lastK) { this._lastK = k; this.render(); } }
      return;
    }
    if (G.frozen()) return;
    KEYS.forEach((k, i) => { if (I.pressed(k)) this.activate(i); });
    const w = I.wheel(); if (w && !G.build?.active) this._scroll(w > 0 ? 1 : -1);
  }
}

/** little models for the upgrades */
function gearModel(k) {
  const g = new THREE.Group();
  const M = (geo, c, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c, flatShading: true })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); };
  const B = new THREE.BoxGeometry(1, 1, 1), S = new THREE.IcosahedronGeometry(0.5, 1), C = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
  if (k === 'crate') { M(B, '#8a6a42', 0, 0.5, 0, 1.2, 1, 1); M(B, '#5a3a20', 0, 0.75, 0.51, 1.22, 0.1, 0.04); M(B, '#5a3a20', 0, 0.25, 0.51, 1.22, 0.1, 0.04); }
  else if (k === 'boots') { M(B, '#6a4a2a', 0, 0.3, 0.1, 0.5, 0.4, 0.9); M(B, '#5a3a20', 0, 0.7, -0.15, 0.45, 0.6, 0.45); }
  else if (k === 'helmet') { M(S, '#c8a040', 0, 0.6, 0, 1.1, 1.1, 1.1); M(C, '#8ad0f0', 0, 0.6, 0.45, 0.6, 0.12, 0.6); }
  else if (k === 'coat') { M(B, '#8a6a4a', 0, 0.6, 0, 1, 1.2, 0.5); M(S, '#f0e8d8', 0, 1.2, 0, 1.1, 0.4, 0.6); }
  else if (k === 'glider') { M(B, '#5aa04a', 0, 0.6, 0, 2, 0.06, 0.9); M(B, '#6a4a2a', 0, 0.3, 0, 0.06, 0.6, 0.06); }
  else if (k === 'saddle') { M(B, '#8a4a2a', 0, 0.4, 0, 0.9, 0.3, 1.1); M(B, '#c8a040', 0, 0.6, -0.4, 0.8, 0.3, 0.12); }
  else if (k === 'drone') { M(B, '#4a4a5a', 0, 0.5, 0, 0.8, 0.25, 0.8); for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) M(C, '#9a9aa8', x, 0.65, z, 0.5, 0.04, 0.5); }
  else { M(C, '#7a5a3a', 0, 0.6, 0, 0.3, 1.2, 0.3); M(S, '#7aff9a', 0, 1.3, 0, 0.4, 0.4, 0.4); }
  return g;
}
