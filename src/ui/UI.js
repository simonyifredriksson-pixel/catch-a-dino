/* UI.js - the HUD.

   top left      what to do next (quest), with a hint
   top centre    the compass: N/E/S/W, the zoo, lit beacons, marked creatures
   top right     money, zoo stars and income per minute, the clock and weather
   bottom left   hearts, breath, cold; your mount: name, stamina, its keys
   centre        crosshair, and a nameplate for the creature under it (name,
                 rarity, and how hard it would be with what you are holding)
   catching      the throw charge, the snare ring around the creature, the
                 TUG METER on the right, brace arrows when it lunges
   messages      toasts, banners, region title cards, money that floats up
   the catch card after a successful catch
   Panels (shop, dex, map, exhibits...) live in ui/Panels.js. */
import * as THREE from '../../lib/three.module.js';
import { SP, RARITY, SIZE, VARIANTS } from '../data/Species.js';
import { ABILITIES } from '../data/Abilities.js';
import { TOOLS } from '../data/Tools.js';
import { BIOMES } from '../data/Biomes.js';
import { BEACONS, PLACES } from '../data/Places.js';
import { ZOO } from '../data/Biomes.js';
import { HEARTS } from '../game/Player.js';
import { svg } from './Inventory.js';
import { esc, money, clamp, fmtKg, fmtM } from '../core/Util.js';

const $ = id => document.getElementById(id);
const _v = new THREE.Vector3();

export class UI {
  constructor(game) {
    this.g = game; this.panel = null; this.marks = []; this.floaters = [];
    this.root = $('hud');
    this._tT = 0; this.bannerT = 0; this.regionT = 0;
    this._build();
  }
  _build() {
    const H = this.root;
    H.insertAdjacentHTML('beforeend', `
      <div id="obj"><div class="ot"></div><div class="ox"></div><div class="onow"></div><div class="oh"></div></div>
      <div id="compass"><div class="cstrip"></div><div class="cmarks"></div><i class="cneedle"></i></div>
      <div id="topright"><div id="money"><span class="mi">${svg('coin')}</span><b>0</b></div><div id="zoochip"></div><div id="clock"></div></div>
      <div id="vitals"><div class="hearts"></div><div class="breath"><i></i></div><div class="cold"><i></i></div></div>
      <div id="mountp"><div class="mn"></div><div class="ms"><i></i></div><div class="mk"></div></div>
      <div id="cross"><i></i></div>
      <div id="plate"><div class="pn"></div><div class="pr"></div><div class="pd"></div></div>
      <div id="prompt"></div>
      <div id="hint"></div>
      <div id="charge"><i></i></div>
      <canvas id="ring"></canvas>
      <div id="tug"><div class="tlabel"></div><div class="tbar"><div class="tzone"></div><div class="thead"></div><div class="tfill"><i></i></div></div><div class="ttxt"></div></div>
      <div id="lunge"><div class="la la-l">${svg('up')}</div><div class="lk"></div><div class="la la-r">${svg('up')}</div></div>
      <div id="toasts"></div>
      <div id="banner"><div class="bt"></div><div class="bs"></div></div>
      <div id="region"><div class="rt"></div><div class="rs"></div></div>
      <div id="catchcard"></div>
      <div id="floaters"></div>
      <div id="frost"></div><div id="hurt"></div>
      <div id="say"><div class="sf"></div><div class="sn"></div><div class="sx"></div></div>
      <div id="sneak">SNEAKING - quieter, easier snares</div>
      <div id="bite">BITE!</div>
    `);
    this.ring = $('ring'); this.ringCtx = this.ring.getContext('2d');
  }
  get blockingClick() { return !!this.panel; }

  /* ---------------- messages ---------------- */
  toast(t, kind = 'info') {
    const el = document.createElement('div'); el.className = 'toast ' + kind; el.innerHTML = esc(t);
    $('toasts').prepend(el);
    while ($('toasts').children.length > 5) $('toasts').lastChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, kind === 'legend' ? 6500 : 4200);
  }
  banner(t, s = '', kind = 'info', dur = 3.2) { const B = $('banner'); B.className = 'on ' + kind; B.querySelector('.bt').textContent = t; B.querySelector('.bs').textContent = s; this.bannerT = dur; }
  region(name, tag) { const R = $('region'); R.querySelector('.rt').textContent = name; R.querySelector('.rs').textContent = tag || ''; R.classList.remove('on'); void R.offsetWidth; R.classList.add('on'); this.regionT = 5; }
  fade(t, s, dur = 2) { const F = $('fade'); F.querySelector('.ft').textContent = t; F.querySelector('.fs').textContent = s || ''; F.classList.add('on'); clearTimeout(this._fadeT); this._fadeT = setTimeout(() => F.classList.remove('on'), dur * 1000); }
  flash() { const F = $('flash'); F.classList.remove('on'); void F.offsetWidth; F.classList.add('on'); }
  hurt() { const H = $('hurt'); H.classList.remove('on'); void H.offsetWidth; H.classList.add('on'); }
  brace(ok) { const L = $('lunge'); L.classList.add(ok ? 'ok' : 'bad'); setTimeout(() => L.classList.remove('ok', 'bad'), 400); }
  /** money that floats up from a world position (or the money counter) */
  floater(text, pos, kind = 'money') {
    const el = document.createElement('div'); el.className = 'floater ' + kind; el.textContent = text;
    $('floaters').appendChild(el);
    this.floaters.push({ el, pos: pos ? pos.clone().add(new THREE.Vector3(0, 2.2, 0)) : null, t: 0 });
  }
  /** the zoo paid out: a little "+$" by the money counter */
  payout(m) { if (m >= 1) this.floater('+' + money(m) + ' zoo', null, 'money'); }
  /** someone talks to you (the professor) */
  say(name, text) { const S = $('say'); S.querySelector('.sn').textContent = name; S.querySelector('.sx').textContent = text; S.classList.add('on'); this.sayT = 10 + text.length * 0.07; this._said = [name, text]; }
  /** the float went under */
  flashBite(big) { const B = $('bite'); B.textContent = big ? 'SOMETHING BIG!' : 'BITE!'; B.classList.toggle('big', !!big); B.classList.add('on'); this.biteT = 0.9; }
  mark(c, dur = 60) { this.marks = this.marks.filter(m => m.c !== c); this.marks.push({ c, t: dur, kind: 'creature' }); }
  markPoint(x, y, z, label, dur = 30) { this.marks.push({ p: new THREE.Vector3(x, y, z), t: dur, label, kind: 'point' }); }
  mountHint(c) {
    const a = this.g.abilities.primary(c);
    if (!this.g.profile.tips['m:' + c.spId]) { this.g.profile.tips['m:' + c.spId] = 1; this.toast(c.sp.name + (a ? ': F = ' + ABILITIES[a].name : '') + (c.has('jump') ? ', SPACE = jump' : '') + (c.flyer ? ', SPACE = take off' : '') + (c.has('sprint') ? ', SHIFT = sprint' : ''), 'info'); }
  }

  /* ---------------- the catch card ---------------- */
  catchCard(rec, o = {}) {
    const sp = SP[rec.sp], R = RARITY[sp.rarity], C = $('catchcard'), G = this.g;
    const icon = G.inv.icons.creature(rec.sp, rec.v);
    const ab = sp.abilities.filter(a => ABILITIES[a]).slice(0, 5);
    C.innerHTML = `
      <div class="cc-top" style="--rc:${R.css}"><span class="cc-r">${R.name}</span>${o.isNew ? '<span class="cc-new">NEW SPECIES!</span>' : ''}${rec.v ? `<span class="cc-v">${VARIANTS[rec.v].name.toUpperCase()}</span>` : ''}</div>
      <img src="${icon}" alt="">
      <div class="cc-name">${esc(sp.name)}</div>
      <div class="cc-sci">${esc(sp.sci)}</div>
      <div class="cc-stars" style="color:${R.css}">${Array.from({ length: R.stars }, () => svg('star')).join('')}</div>
      <div class="cc-stats"><span>${svg('weight')}${fmtKg(rec.kg)}</span><span>${svg('box')}${SIZE[sp.size].name}</span>${rec.traits?.length ? `<span>${svg('star')}${esc(rec.traits.join(', '))}</span>` : ''}</div>
      <div class="cc-ab">${ab.map(a => `<span class="chip">${svg(ABILITIES[a].icon)}${esc(ABILITIES[a].name)}</span>`).join('')}</div>
      <div class="cc-where">${esc(o.where || '')}</div>
      ${o.reward ? `<div class="cc-pay">+ ${money(o.reward)} research grant</div>` : ''}
      <div class="cc-foot"><b class="key">E</b> / click to continue</div>`;
    C.classList.add('on');
    this.cardT = 9;
    C.onclick = () => this.closeCard();
  }
  closeCard() { $('catchcard').classList.remove('on'); this.cardT = 0; }

  /* ---------------- confirm ---------------- */
  confirm(title, text, yes) { this.g.panels.confirm(title, text, yes); }
  openPanel(k, arg) { this.g.panels.open(k, arg); }

  /* ---------------- every frame ---------------- */
  update(dt) {
    const G = this.g, P = G.player, W = G.W, cam = G.camera;
    this.bannerT -= dt; if (this.bannerT <= 0) $('banner').classList.remove('on');
    if (this.sayT > 0) { this.sayT -= dt; if (this.sayT <= 0) $('say').classList.remove('on'); }
    if (this._said && G.input.pressedRaw('KeyH') && !this.panel && !G.chatOpen) this.say(...this._said);   // hear the professor again
    const Fh = G.fishing.hud();
    if (this.biteT > 0) { this.biteT -= dt; if (this.biteT <= 0 || Fh.state !== 'bite') { this.biteT = 0; $('bite').classList.remove('on'); } }
    $('sneak').classList.toggle('on', !!P.crouch && !P.mount);
    if (this.cardT > 0) { this.cardT -= dt; if (this.cardT <= 0 || G.input.pressedRaw('KeyE') && this.cardT < 8.5) this.closeCard(); }
    this.root.classList.toggle('hidden', G.phase !== 'play' || !!G.build?.active || G.hideHud);
    // ----- catching
    const C = G.catching.hud();
    const fc = Fh.state === 'charge';
    $('charge').classList.toggle('on', C.state === 'charge' || fc);
    $('charge').querySelector('i').style.width = Math.round((fc ? Fh.charge : C.charge) * 100) + '%';
    const fight = C.state === 'fight' && C.bar;
    $('tug').classList.toggle('on', !!fight);
    this.root.classList.toggle('fighting', !!fight);
    if (fight) {
      const b = C.bar, T = $('tug');
      const z = T.querySelector('.tzone');
      z.style.bottom = clamp((b.zone - b.band / 2) * 100, 0, 100 - b.band * 100) + '%'; z.style.height = b.band * 100 + '%';
      z.classList.toggle('on', b.on > 0.5); z.classList.toggle('rage', b.rage);
      const hd = T.querySelector('.thead'); hd.style.bottom = b.pos * 100 + '%';
      hd.style.transform = `translate(-50%, 50%) rotate(${(b.target - b.pos) * -120}deg)`;
      if (C.c && hd.dataset.sp !== C.c.spId) { hd.dataset.sp = C.c.spId; hd.innerHTML = `<img src="${G.inv.icons.creature(C.c.spId, C.c.v)}">`; hd.style.setProperty('--rc', RARITY[C.c.sp.rarity].css); }
      T.querySelector('.tfill i').style.height = Math.round(b.catch * 100) + '%';
      T.querySelector('.tfill').classList.toggle('low', b.catch < 0.2);
      const fsh = G.catching.F?.fishing, big = G.catching.F?.big;
      T.querySelector('.tlabel').textContent = b.over > 0.2 ? (fsh ? 'TOO STRONG FOR THIS ROD' : 'TOO STRONG FOR THIS ROPE') : b.rage ? 'FURIOUS!' : b.tier >= 4 ? (fsh ? 'LEGEND ON THE LINE' : 'LEGEND ON THE ROPE') : b.on > 0.5 ? 'ON IT!' : fsh ? (big ? 'SOMETHING BIG - KEEP IT IN THE ZONE' : 'KEEP IT IN THE ZONE') : 'KEEP ITS HEAD IN YOUR LOOP';
      T.classList.toggle('warn', b.over > 0.2);
      T.querySelector('.ttxt').textContent = (C.c ? C.c.sp.name : '') + (b.helpers ? '  +' + b.helpers + ' helping' : '');
      const L = $('lunge');
      L.classList.toggle('on', b.lunge !== 0);
      if (b.lunge) { L.classList.toggle('left', b.lunge < 0); L.classList.toggle('right', b.lunge > 0); L.querySelector('.lk').innerHTML = `BRACE <b class="key">${b.lunge < 0 ? 'D' : 'A'}</b>`; }
    } else $('lunge').classList.remove('on');
    this._ring(C);
    // ----- crosshair & nameplate
    const a = G.tools.assist, tool = G.tools.id;
    const plate = $('plate');
    const showPlate = a && !fight && C.state !== 'snare' && (TOOLS[tool]?.kind === 'catch' || TOOLS[tool]?.behavior === 'scan' || TOOLS[tool]?.behavior === 'photo' || a.d < 30);
    plate.classList.toggle('on', !!showPlate);
    if (showPlate) {
      const c = a.c, R = RARITY[c.sp.rarity], dex = W.dex[c.spId];
      const known = dex?.seen || dex?.caught || c.uid;
      plate.querySelector('.pn').textContent = (c.v ? VARIANTS[c.v].name + ' ' : '') + (known ? c.sp.name : '???') + (c.uid ? ' (yours)' : '');
      plate.querySelector('.pr').innerHTML = `<span style="color:${R.css}">${Array.from({ length: R.stars }, () => '&#9733;').join('')} ${R.name}</span> &middot; ${Math.round(a.d)} m`;
      const dif = !c.uid && TOOLS[tool]?.kind === 'catch' ? G.catching.difficulty(c, tool) : null;
      const pd = plate.querySelector('.pd'); pd.textContent = dif ? dif.toUpperCase() : ''; pd.className = 'pd ' + (dif || '').replace(' ', '');
    }
    $('cross').classList.toggle('hot', !!a && TOOLS[tool]?.kind === 'catch');
    $('cross').classList.toggle('hide', !!fight || P.koT > 0);
    // ----- prompt & hint
    const it = G.interactable;
    $('prompt').innerHTML = it && !fight ? `<b class="key">E</b> ${esc(it.label())}` : '';
    $('prompt').classList.toggle('on', !!it && !fight);
    let ht = '';
    if (C.state === 'snare') ht = 'CLICK when the shrinking ring is inside the <b>green band</b>!';
    else if (fight) ht = 'Hold <b class="key">LMB</b> to pull &nbsp; let go to give slack &nbsp; <b class="key">A</b>/<b class="key">D</b> to brace when it lunges';
    else if (C.state === 'charge') ht = 'Release to throw';
    else if (Fh.state === 'charge') ht = 'Release to cast - longer hold, farther cast';
    else if (Fh.state === 'fly' || Fh.state === 'wait') ht = 'Wait for a bite... &nbsp; <b class="key">LMB</b> reels in';
    else if (Fh.state === 'nibble') ht = 'Nibbling... not yet!';
    else if (Fh.state === 'bite') ht = '<b class="key">CLICK</b> NOW!';
    else if (Fh.state === 'reel') ht = 'Reeling in...';
    else if (Fh.state === 'idle' && TOOLS[G.tools.id]?.kind === 'rod' && !P.mount) ht = 'Hold <b class="key">LMB</b> to cast into the water';
    else if (C.state === 'assist') ht = 'Hold <b class="key">LMB</b> to help pull!';
    else if (P.mount) { const m = P.mount; ht = m.flyer ? (m.flying ? '<b class="key">W</b> fly where you look &nbsp; <b class="key">SPACE</b> climb &nbsp; <b class="key">CTRL</b> dive &nbsp; <b class="key">S</b> land' : '<b class="key">SPACE</b> take off') : m.swimmer ? '<b class="key">W</b> swim where you look &nbsp; <b class="key">SPACE</b> up &nbsp; <b class="key">CTRL</b> down' : ''; }
    $('hint').innerHTML = ht; $('hint').classList.toggle('on', !!ht);
    // ----- vitals
    const hk = 'h' + P.hearts + (P.hurtT > 0 ? 'x' : '');
    if (hk !== this._hk) { this._hk = hk; $('vitals').querySelector('.hearts').innerHTML = Array.from({ length: HEARTS }, (_, i) => `<i class="${i < P.hearts ? 'f' : ''}"></i>`).join(''); }
    const maxAir = P.upg('helmet').air, br = P.under || P.mount?.under ? (P.mount ? G.riding.air ?? P.breath : P.breath) / Math.min(maxAir, 60) : 1;
    $('vitals').querySelector('.breath').classList.toggle('on', br < 0.999 && maxAir < 9000);
    $('vitals').querySelector('.breath i').style.width = Math.round(clamp(br, 0, 1) * 100) + '%';
    $('vitals').querySelector('.cold').classList.toggle('on', P.cold > 0.02);
    $('vitals').querySelector('.cold i').style.width = Math.round(P.cold * 100) + '%';
    $('frost').style.opacity = P.cold * 0.85;
    // ----- mount panel
    const m = P.mount, mp = $('mountp');
    mp.classList.toggle('on', !!m);
    if (m) {
      const rec = W.creatures[m.uid];
      mp.querySelector('.mn').innerHTML = `${esc(rec?.name || m.sp.name)} <span style="color:${RARITY[m.sp.rarity].css}">${'&#9733;'.repeat(RARITY[m.sp.rarity].stars)}</span>`;
      mp.querySelector('.ms i').style.width = Math.round(G.riding.stamina * 100) + '%';
      mp.querySelector('.ms').classList.toggle('low', G.riding.stamina < 0.2);
      const a1 = G.abilities.primary(m);
      const keys = [];
      if (a1) keys.push(`<span class="${G.riding.cd > 0 ? 'cd' : ''}"><b class="key">F</b>${ABILITIES[a1].name}</span>`);
      if (m.has('sprint')) keys.push('<span><b class="key">SHIFT</b>Sprint</span>');
      if (m.has('jump')) keys.push('<span><b class="key">SPACE</b>Leap</span>');
      keys.push('<span><b class="key">E</b>Get off</span>');
      const k = keys.join('');
      if (k !== this._mk) { this._mk = k; mp.querySelector('.mk').innerHTML = k; }
    }
    // ----- compass
    this._compass(dt);
    // ----- floaters
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const F = this.floaters[i]; F.t += dt;
      if (F.t > 1.8) { F.el.remove(); this.floaters.splice(i, 1); continue; }
      if (F.pos) { _v.copy(F.pos); _v.y += F.t * 1.2; _v.project(cam); if (_v.z > 1) { F.el.style.display = 'none'; continue; } F.el.style.display = ''; F.el.style.left = (_v.x * 0.5 + 0.5) * innerWidth + 'px'; F.el.style.top = (-_v.y * 0.5 + 0.5) * innerHeight + 'px'; }
      else { F.el.style.right = '24px'; F.el.style.top = (60 + 40 - F.t * 30) + 'px'; }
      F.el.style.opacity = F.t > 1.2 ? (1.8 - F.t) / 0.6 : 1;
    }
    for (let i = this.marks.length - 1; i >= 0; i--) { const M = this.marks[i]; M.t -= dt; if (M.t <= 0 || (M.c && M.c.gone)) this.marks.splice(i, 1); }
    // ----- slow text
    this._tT -= dt; if (this._tT > 0) return; this._tT = 0.2;
    $('money').querySelector('b').textContent = money(W.money).replace('$', '');
    const Z = G.zoo;
    $('zoochip').innerHTML = `<span class="zs">${'&#9733;'.repeat(Z.level)}<i>${'&#9733;'.repeat(Math.max(0, 7 - Z.level))}</i></span><span class="za">Zoo income <b>+${money(Z.income || 0)}/min</b></span>`;
    const tod = W.tod, hh = Math.floor(tod * 24), mm = Math.floor((tod * 24 - hh) * 60);
    const wk = W.weather.kind, wi = { clear: G.sky.state.night > 0.5 ? 'Clear night' : 'Sunny', cloudy: 'Cloudy', rain: 'Rain', storm: 'Thunderstorm' }[wk];
    const b = G.terrain.biome(P.pos.x, P.pos.z);
    $('clock').innerHTML = `<b>Day ${W.day}</b> ${String(hh).padStart(2, '0')}:${String(mm - mm % 10).padStart(2, '0')} &middot; ${wi}<div class="rg">${esc(G.inInterior ? G.inInterior.name : BIOMES[b]?.name || '')}</div>`;
    const O = G.quests.objective();
    const nowEl = $('obj').querySelector('.onow'), nowH = O.now ? '<b>DO THIS NOW</b>' + esc(O.now).replace(/\[([^\]]+)\]/g, '<b class="key">$1</b>') : '';
    if (nowH !== this._now) { this._now = nowH; nowEl.innerHTML = nowH; nowEl.style.display = nowH ? '' : 'none'; }
    const ok = JSON.stringify({ ...O, now: 0 });
    if (ok !== this._ok) { this._ok = ok; $('obj').querySelector('.ot').textContent = O.title; $('obj').querySelector('.ox').textContent = O.text; $('obj').querySelector('.oh').textContent = (O.hint || '') + (G.quests.inTutorial ? '  (H: hear the professor again)' : ''); $('obj').classList.remove('pop'); void $('obj').offsetWidth; $('obj').classList.add('pop'); }
  }
  /** the snare ring: drawn around the creature on screen */
  _ring(C) {
    const cv = this.ring, ctx = this.ringCtx;
    if (C.state !== 'snare' || !C.c) { if (this._ringOn) { ctx.clearRect(0, 0, cv.width, cv.height); this._ringOn = false; cv.style.display = 'none'; } return; }
    this._ringOn = true; cv.style.display = 'block';
    if (cv.width !== innerWidth) { cv.width = innerWidth; cv.height = innerHeight; }
    ctx.clearRect(0, 0, cv.width, cv.height);
    C.c.centre(_v); _v.project(this.g.camera);
    const x = (_v.x * 0.5 + 0.5) * cv.width, y = (-_v.y * 0.5 + 0.5) * cv.height;
    const R = Math.min(cv.height * 0.22, 170);
    // the target band
    ctx.lineWidth = R * (0.42 - 0.18); ctx.strokeStyle = 'rgba(80, 230, 120, 0.35)';
    ctx.beginPath(); ctx.arc(x, y, R * 0.3, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = '#7aff9a'; ctx.beginPath(); ctx.arc(x, y, R * 0.29, 0, Math.PI * 2); ctx.stroke();
    // the shrinking ring
    const r = Math.max(2, C.ring * R);
    const inBand = C.ring > 0.18 && C.ring < 0.42;
    ctx.lineWidth = 6; ctx.strokeStyle = inBand ? '#ffffff' : '#ffd040';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '900 18px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
    ctx.strokeText(inBand ? 'NOW!' : 'WAIT...', x, y - R - 10); ctx.fillText(inBand ? 'NOW!' : 'WAIT...', x, y - R - 10);
  }
  _compass(dt) {
    const G = this.g, P = G.player.pos, yaw = G.cam.yaw + Math.PI;   // direction the camera looks
    const strip = $('compass').querySelector('.cstrip'), marks = $('compass').querySelector('.cmarks');
    const W = 420, fov = Math.PI * 0.9;
    const place = (ang) => { const d = Math.atan2(Math.sin(ang - yaw), Math.cos(ang - yaw)); return Math.abs(d) > fov / 2 ? null : (d / fov + 0.5) * W; };
    // cardinal letters: north is -z (heading yaw = PI)
    let html = '';
    for (const [l, a] of [['N', Math.PI], ['E', Math.PI / 2], ['S', 0], ['W', -Math.PI / 2], ['NE', Math.PI * 0.75], ['SE', Math.PI * 0.25], ['SW', -Math.PI * 0.25], ['NW', -Math.PI * 0.75]]) { const x = place(a); if (x != null) html += `<span class="${l.length > 1 ? 'mi' : ''}" style="left:${x}px">${l}</span>`; }
    strip.innerHTML = html;
    let mh = '';
    const mark = (x, z, cls, label, y) => { const a = Math.atan2(x - P.x, z - P.z), px = place(a); if (px == null) return; const d = Math.hypot(x - P.x, z - P.z); mh += `<span class="cm ${cls}" style="left:${px}px">${label}<em>${d > 999 ? (d / 1000).toFixed(1) + 'km' : Math.round(d) + 'm'}</em></span>`; void y; };
    if (!G.inInterior) {
      mark(ZOO.x, ZOO.z, 'zoo', svg('box'));
      const wp = G.quests.waypoint(); if (wp) mark(wp.x, wp.z, 'wp', svg('star') + '<b>' + esc(wp.label || '') + '</b>');
      for (const B of BEACONS) if (G.W.beacons[B.id]) mark(B.x, B.z, 'bea', svg('sun'));
      for (const M of this.marks) { if (M.c) mark(M.c.pos.x, M.c.pos.z, 'cr', `<i style="background:${RARITY[M.c.sp.rarity].css}"></i>`); else mark(M.p.x, M.p.z, 'pt', svg('star')); }
    }
    marks.innerHTML = mh;
    void PLACES; void fmtM;
  }
}
