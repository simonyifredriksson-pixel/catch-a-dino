/* main.js - boot: renderer, the title screen, the loop. */
import * as THREE from '../lib/three.module.js';
import { Input } from './core/Input.js';
import { Audio } from './core/Audio.js';
import { Net } from './net/Net.js';
import { Game } from './game/Game.js';
import { loadProfile, saveProfile, loadWorld, wipeWorld } from './game/State.js';
import { LOOKS } from './art/PeopleArt.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
window.__log = (m) => {
  (window.__logs ||= []).push(m); console.log(m);
  const L = $('loading');
  if (L && !L.classList.contains('gone') && /^(ERR|REJ)/.test(m)) L.insertAdjacentHTML('beforeend', '<div class="lerr">' + String(m).replace(/</g, '&lt;').slice(0, 600) + '</div>');
  const E = $('errlog'); if (E && /^(ERR|REJ|UPDATE)/.test(m)) { E.style.display = 'block'; E.textContent += m + '\n'; }
};
addEventListener('error', e => window.__log('ERR ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
addEventListener('unhandledrejection', e => window.__log('REJ ' + (e.reason?.stack || e.reason)));

async function boot() {
  try { await Promise.race([document.fonts.load('40px "Lilita One"'), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* */ }
  const canvas = $('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.25, 4200);
  scene.add(camera);

  const profile = loadProfile();
  const input = new Input(canvas);
  input.sensitivity = profile.sens; input.invertY = profile.invert;
  input.requireLock = true;
  const audio = new Audio(); audio.setVolume(profile.vol, profile.music);
  const net = new Net();
  const game = new Game({ renderer, scene, camera, input, audio, net, profile });
  $('loadtxt').textContent = 'Growing the jungle...';
  await new Promise(r => setTimeout(r, 30));
  game.buildWorld();
  renderer.shadowMap.enabled = profile.shadows !== false;
  window.__game = game;
  input.canLock = () => game.phase === 'play' && !game.ui.panel && !game.chatOpen && !game.inv.open && !game.build.active;
  input.onLockChange = (locked) => { if (!locked && game.phase === 'play' && !game.ui.panel && !game.chatOpen && !game.inv.open && !game.build.active && !game.ui.cardT) game.panels.open('pause'); };
  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
  addEventListener('beforeunload', () => { if (game.isHost && game.phase === 'play') game.saveNow(); });

  /* ---------------- the title screen ---------------- */
  $('tname').value = profile.name;
  const looks = $('tlooks');
  LOOKS.forEach((l, i) => { const b = document.createElement('button'); b.style.background = l.shirt; b.title = l.name; b.onclick = () => { profile.look = i; game.player.look = i; game.player._mk(); mark(); }; looks.appendChild(b); });
  const mark = () => [...looks.children].forEach((b, i) => b.classList.toggle('on', i === profile.look));
  mark();
  const save = loadWorld();
  if (!save) $('bcont').style.display = 'none'; else $('bnew').classList.remove('big');
  const keep = () => { profile.name = ($('tname').value || 'Ranger').replace(/[<>]/g, '').slice(0, 16); saveProfile(profile); audio.unlock(); };
  const go = (W) => { keep(); $('title').classList.add('gone'); game.player.look = profile.look; game.player._mk(); game.begin(W); canvas.requestPointerLock?.(); };
  $('bcont').onclick = () => go(loadWorld());
  $('bnew').onclick = () => { if (save && !confirm('Start a new zoo? Your saved zoo will be gone.')) return; wipeWorld(); go(null); };
  $('bhost').onclick = async () => {
    keep(); $('tmsg').textContent = 'Opening a room...';
    try { const code = await net.host({ name: profile.name, look: profile.look, key: profile.key }); go(loadWorld()); game.ui.banner('ROOM CODE: ' + code, 'Tell your friends this code - they press JOIN on the title screen.', 'good', 8); }
    catch (e) { $('tmsg').textContent = e.message; }
  };
  $('bjoin').onclick = async () => {
    keep(); $('tmsg').textContent = 'Connecting...';
    try { const d = await net.join($('tcode').value, { name: profile.name, look: profile.look, key: profile.key }); game.me = d.id; profile.keyOnline = d.id; $('title').classList.add('gone'); game.player.look = profile.look; game.player._mk(); game.begin(d.save); canvas.requestPointerLock?.(); }
    catch (e) { $('tmsg').textContent = e.message; }
  };
  $('tcode').addEventListener('keydown', e => { if (e.key === 'Enter') $('bjoin').click(); });

  // test hooks: ?play starts a fresh game, ?script=<name> runs a test suite, ?shot=<name> stages a screenshot
  if (params.has('play') || params.has('shot') || params.has('script')) {
    $('title').classList.add('gone');
    if (!params.has('keep')) wipeWorld();
    game.begin(params.has('keep') ? loadWorld() : null);
  }
  $('loading').classList.add('gone');
  if (params.has('shot') || params.has('script')) {
    const T = await import('./debug/Tests.js');
    try { if (params.has('shot')) await T.shot(game, params.get('shot'), params); else T.run(game, params.get('script')); }
    catch (e) { window.__log('UPDATE shot failed: ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 5).join(' | ')); }
  }

  let last = performance.now();
  const frame = (now) => {
    const dt = (now - last) / 1000; last = now;
    try { if (!game.paused) game.update(dt * (game.timeScale ?? 1)); } catch (e) { if (!game._errN || game._errN < 6) { game._errN = (game._errN || 0) + 1; window.__log('UPDATE ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')); } }
    if (!game.noRender || now - (game._lastDraw || 0) > 1000) { renderer.render(scene, camera); game._lastDraw = now; }
    input.endFrame();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  window.__tick = (dt) => { game.update(dt); input.endFrame(); };
}
boot();
