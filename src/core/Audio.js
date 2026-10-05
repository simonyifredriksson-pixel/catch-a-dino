/* Audio.js - every sound is synthesised; there are no audio files.

   Creature voices are noise and oscillators pushed through formant filters:
   the bigger the animal, the lower and longer the roar. Footsteps of heavy
   animals are sub-bass thumps you feel more than hear. Beds (wind, rain,
   jungle chatter, surf, lava rumble, crowd murmur, rope creak) fade with
   where you are. The music is a small generative adventure loop that goes
   tense during a catch fight and big events. */
let ctx = null;

export class Audio {
  constructor() {
    this.enabled = false; this.vol = 0.8; this.musicVol = 0.5;
    this.listener = { x: 0, y: 0, z: 0 };
    this.step = 0; this.next = 0; this.mood = 'calm'; this.musicOn = true; this.bar = 0;
  }
  unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.enabled = true;
    this.master = ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(ctx.destination);
    this.comp = ctx.createDynamicsCompressor(); this.comp.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.connect(this.comp);
    this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.4; this.music.connect(this.comp);
    const n = ctx.sampleRate * 2; this.noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // brown noise for rumbles
    this.brown = ctx.createBuffer(1, n, ctx.sampleRate); const b = this.brown.getChannelData(0); let last = 0;
    for (let i = 0; i < n; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
    this.beds = {
      wind: this._bed('bandpass', 500, 0.6), rain: this._bed('highpass', 2600, 0.5), surf: this._bed('lowpass', 700, 0.7, true),
      jungle: this._bed('bandpass', 3800, 3), lava: this._bed('lowpass', 160, 0.9, true), crowd: this._bed('bandpass', 900, 1.2), creak: this._bed('bandpass', 260, 8),
      under: this._bed('lowpass', 300, 0.8, true), fire: this._bed('bandpass', 1800, 0.7),
    };
    this.chirpT = 0;
  }
  _bed(type, freq, q, brown) {
    const src = ctx.createBufferSource(); src.buffer = brown ? this.brown : this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(this.sfx); src.start();
    return { src, f, g };
  }
  setVolume(v, m) { this.vol = v; this.musicVol = m; if (!ctx) return; this.master.gain.value = v; this.music.gain.value = m * 0.4; }
  _att(pos, ref = 14) { if (!pos) return 1; const d = Math.hypot(pos.x - this.listener.x, (pos.y || 0) - this.listener.y, pos.z - this.listener.z); return 1 / (1 + d / ref); }
  tone(freq, dur, type = 'sine', vol = 0.2, att = 0.005, slide = 0, delay = 0, dest = null) {
    if (!ctx || vol < 0.002) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, vol, type = 'lowpass', freq = 1000, q = 1, sweep = 0, delay = 0, dest = null, brown = false) {
    if (!ctx || vol < 0.002) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = brown ? this.brown : this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, freq * sweep), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  /* ---------------- creatures ---------------- */
  /** a roar: size 0 (chirp) .. 1 (tyrant); kind 'roar' | 'bellow' | 'screech' | 'honk' */
  roar(pos, size = 0.5, kind = 'roar') {
    if (!ctx) return;
    const a = this._att(pos, 30 + size * 60), t = ctx.currentTime;
    const dur = 0.5 + size * 1.6, base = 260 - size * 200;
    if (kind === 'honk') { for (let i = 0; i < 2; i++) { this.tone(base * 0.9, 0.5, 'sawtooth', 0.12 * a, 0.03, 1.08, i * 0.55); this.tone(base * 1.8, 0.5, 'triangle', 0.06 * a, 0.03, 1.08, i * 0.55); } return; }
    if (kind === 'screech') { this.tone(900 - size * 300, dur * 0.6, 'sawtooth', 0.08 * a, 0.02, 0.55); this.noise(dur * 0.6, 0.12 * a, 'bandpass', 2400 - size * 800, 4, 0.5); return; }
    // body: filtered noise through two moving formants, plus a growling oscillator
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 6; f1.frequency.setValueAtTime(base * 2.2, t); f1.frequency.linearRampToValueAtTime(base * 3.2, t + dur * 0.3); f1.frequency.linearRampToValueAtTime(base * 1.4, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * a, t + 0.08); g.gain.setValueAtTime(0.45 * a, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f1); f1.connect(g); g.connect(this.sfx); src.start(t); src.stop(t + dur + 0.1);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(base * 0.55, t); o.frequency.linearRampToValueAtTime(base * 0.8, t + dur * 0.25); o.frequency.linearRampToValueAtTime(base * 0.45, t + dur);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 28 - size * 12; const lg = ctx.createGain(); lg.gain.value = base * 0.08; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur);
    const of = ctx.createBiquadFilter(); of.type = 'lowpass'; of.frequency.value = 600 + (1 - size) * 900;
    const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime((kind === 'bellow' ? 0.2 : 0.14) * a, t + 0.1); og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(of); of.connect(og); og.connect(this.sfx); o.start(t); o.stop(t + dur + 0.1);
    if (size > 0.6) this.noise(dur * 0.8, 0.3 * a, 'lowpass', 120, 1, 0.5, 0, null, true);
  }
  chirp(pos, pitch = 1) { const a = this._att(pos, 12); for (let i = 0; i < 3; i++) this.tone((1200 + Math.random() * 600) * pitch, 0.07, 'triangle', 0.05 * a, 0.004, 1.4, i * 0.09); }
  stomp(pos, weight = 1) { const a = this._att(pos, 18 + weight * 25); if (a < 0.02) return; this.tone(55 + (1 - weight) * 60, 0.25 + weight * 0.2, 'sine', Math.min(0.5, 0.15 + weight * 0.3) * a, 0.004, 0.5); this.noise(0.15, 0.1 * a, 'lowpass', 300, 1); }
  flap(pos, size = 0.5) { const a = this._att(pos, 20); this.noise(0.25, 0.12 * a, 'bandpass', 500 - size * 250, 1.2, 0.4); }
  bite(pos) { const a = this._att(pos, 16); this.noise(0.08, 0.3 * a, 'highpass', 1200, 1); this.tone(180, 0.1, 'square', 0.08 * a, 0.002, 0.5); }
  splash(pos, s = 1) { const a = this._att(pos, 20); this.noise(0.3 + s * 0.4, Math.min(0.6, 0.2 * s) * a, 'lowpass', 1500, 0.8, 0.3); this.noise(0.2, 0.1 * a, 'highpass', 3000, 1); }
  crash(pos) { const a = this._att(pos, 40); this.noise(1.2, 0.6 * a, 'lowpass', 800, 0.7, 0.2, 0, null, true); this.noise(0.6, 0.3 * a, 'bandpass', 1200, 1, 0.4); for (let i = 0; i < 5; i++) this.tone(90 + Math.random() * 120, 0.3, 'sine', 0.15 * a, 0.005, 0.5, i * 0.08); }
  thunder(dist = 200) { const a = 1 / (1 + dist / 150), dl = Math.min(3, dist / 340); this.noise(2.6, 0.6 * a, 'lowpass', 400, 0.7, 0.3, dl, null, true); this.noise(0.4, 0.4 * a, 'highpass', 900, 1, 0.5, dl); }

  /* ---------------- you and your rope ---------------- */
  click() { this.tone(900, 0.04, 'triangle', 0.07); }
  open() { this.tone(520, 0.06, 'triangle', 0.06); this.tone(780, 0.08, 'triangle', 0.05, 0.005, 0, 0.05); }
  close() { this.tone(620, 0.05, 'triangle', 0.05); this.tone(440, 0.07, 'triangle', 0.04, 0.005, 0, 0.04); }
  coin() { this.tone(1320, 0.07, 'square', 0.04); this.tone(1760, 0.2, 'square', 0.04, 0.005, 0, 0.06); }
  cash() { for (let i = 0; i < 4; i++) this.tone(1100 + i * 220, 0.12, 'square', 0.035, 0.003, 0, i * 0.06); this.noise(0.2, 0.06, 'highpass', 4000, 1, 0, 0.25); }
  deny() { this.tone(200, 0.18, 'square', 0.07, 0.005, 0.7); }
  jump() { this.noise(0.12, 0.06, 'bandpass', 700, 1, 1.6); }
  hurt() { this.tone(300, 0.25, 'sawtooth', 0.12, 0.005, 0.5); this.noise(0.15, 0.15, 'lowpass', 800); }
  whoosh(s = 1) { this.noise(0.35, 0.12 * s, 'bandpass', 600, 1.4, 3); }
  whirl(on, rate = 1) { this._whirlT = on ? (this._whirlT || 0) : 0; if (!on || !ctx) return; this._whirlN = (this._whirlN || 0) + 1; if (this._whirlN % Math.max(4, Math.round(10 / rate)) === 0) this.noise(0.18, 0.05, 'bandpass', 900 + rate * 300, 2, 1.5); }
  latch() { this.noise(0.08, 0.25, 'highpass', 1500, 1); this.tone(140, 0.15, 'triangle', 0.15, 0.003, 0.6); }
  snap() { this.noise(0.12, 0.4, 'highpass', 2000, 1); this.tone(900, 0.2, 'square', 0.06, 0.002, 0.3); }
  reel() { this.tone(2200 + Math.random() * 300, 0.02, 'square', 0.015); }
  strike(perfect) { if (perfect) { this.tone(1046, 0.1, 'triangle', 0.12); this.tone(1568, 0.25, 'triangle', 0.1, 0.005, 0, 0.07); } else this.tone(660, 0.12, 'triangle', 0.1); }
  brace() { this.tone(240, 0.12, 'square', 0.08, 0.004, 1.4); this.noise(0.15, 0.1, 'lowpass', 600); }
  shutter() { this.noise(0.05, 0.25, 'highpass', 3000, 1); this.tone(1800, 0.03, 'square', 0.05, 0.001, 0, 0.06); }
  slash() { this.noise(0.25, 0.25, 'highpass', 2500, 1, 0.5); }
  dig() { this.noise(0.2, 0.2, 'lowpass', 600, 1, 0.5); this.tone(120, 0.12, 'sine', 0.1, 0.004, 0.6); }

  /* ---------------- fanfares ---------------- */
  caught(r = 1) {
    const notes = [523, 659, 784, 1046, 1318, 1568];
    const n = Math.min(notes.length, 3 + r);
    for (let i = 0; i < n; i++) this.tone(notes[i], 0.3, 'triangle', 0.1, 0.005, 0, i * 0.09);
    this.tone(notes[n - 1] * 0.5, 0.9, 'sine', 0.1, 0.01, 0, n * 0.09);
  }
  discover() { [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.09, 0.02, 0, i * 0.14)); this.tone(196, 1.4, 'triangle', 0.08, 0.05); }
  level() { [523, 659, 784, 1046].forEach((f, i) => { this.tone(f, 0.25, 'square', 0.05, 0.005, 0, i * 0.1); this.tone(f * 1.5, 0.25, 'triangle', 0.04, 0.005, 0, i * 0.1); }); this.tone(1046, 1.2, 'triangle', 0.08, 0.01, 0, 0.4); }
  fail() { [392, 349, 294].forEach((f, i) => this.tone(f, i === 2 ? 0.6 : 0.2, 'sawtooth', 0.05, 0.01, i === 2 ? 0.9 : 0, i * 0.2)); }
  alarm() { for (let i = 0; i < 4; i++) { this.tone(880, 0.15, 'square', 0.06, 0.005, 0, i * 0.3); this.tone(660, 0.15, 'square', 0.06, 0.005, 0, i * 0.3 + 0.15); } }
  wow(pos) { const a = this._att(pos, 25); for (let i = 0; i < 3; i++) this.tone(300 + Math.random() * 200, 0.4, 'triangle', 0.035 * a, 0.05, 1.3, i * 0.05); }
  scream(pos) { const a = this._att(pos, 30); this.tone(700, 0.8, 'sawtooth', 0.06 * a, 0.02, 1.5); this.noise(0.8, 0.08 * a, 'bandpass', 1600, 2, 1.3); }

  /* ---------------- per frame ---------------- */
  /** env: { wind, rain, surf, jungle, lava, crowd, creak, under, fire, mood } */
  update(dt, env) {
    if (!ctx) return;
    const t = ctx.currentTime, B = this.beds;
    const set = (k, v, r = 0.4) => B[k].g.gain.setTargetAtTime(Math.max(0, v), t, r);
    set('wind', (env.wind || 0) * 0.1); set('rain', (env.rain || 0) * 0.13); set('surf', (env.surf || 0) * 0.18);
    set('jungle', (env.jungle || 0) * 0.012); set('lava', (env.lava || 0) * 0.3); set('crowd', (env.crowd || 0) * 0.05);
    set('creak', (env.creak || 0) * 0.08, 0.05); B.creak.f.frequency.setTargetAtTime(180 + (env.creak || 0) * 300, t, 0.05);
    set('under', (env.under || 0) * 0.25); set('fire', (env.fire || 0) * 0.06);
    if (env.surf) B.surf.f.frequency.setTargetAtTime(500 + Math.sin(t * 0.4) * 300, t, 0.5);
    // ambient life: birds by day, insects at night, frogs in the swamp
    this.chirpT -= dt;
    if (this.chirpT <= 0) {
      this.chirpT = 0.6 + Math.random() * 2.5;
      const L = env.life || 0;
      if (L > 0 && Math.random() < L) {
        if (env.night) { for (let i = 0; i < 5; i++) this.tone(4200 + Math.random() * 400, 0.03, 'sine', 0.012, 0.002, 1, i * 0.06); }
        else if (env.swamp) { this.tone(140 + Math.random() * 40, 0.18, 'square', 0.025, 0.01, 1.3); this.tone(150, 0.14, 'square', 0.02, 0.01, 1.3, 0.22); }
        else { const f = 1800 + Math.random() * 1600; this.tone(f, 0.12, 'sine', 0.025, 0.01, 1.3); this.tone(f * 1.2, 0.1, 'sine', 0.02, 0.01, 0.85, 0.14); }
      }
    }
    this.mood = env.mood || 'calm';
    this._music(t);
  }
  _music(t) {
    if (!this.musicOn) return;
    if (this.next < t - 1) this.next = t + 0.1;
    const tense = this.mood === 'tense', night = this.mood === 'night';
    const tempo = tense ? 0.14 : 0.22;
    // pentatonic adventure: C D E G A, minor-ish when tense
    const scale = tense ? [220, 261.6, 293.7, 329.6, 392, 440] : [261.6, 293.7, 329.6, 392, 440, 523.3];
    while (this.next < t + 0.25) {
      const st = this.step++, at = this.next - t, bar = Math.floor(st / 16);
      const chords = tense ? [[110, 165], [98, 147], [104, 156], [98, 147]] : [[130.8, 196], [110, 164.8], [146.8, 220], [98, 146.8]];
      const ch = chords[bar % 4];
      if (st % 16 === 0) { for (const f of ch) this.tone(f, tempo * 15, 'triangle', night ? 0.05 : 0.07, 0.4, 0, at, this.music); }
      // marimba arpeggio
      const pat = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 3, 5, 4, 2, 1, 2];
      const p = pat[st % 16];
      if ((st % 2 === 0 || tense) && Math.random() < (night ? 0.5 : 0.85)) this.tone(scale[p % scale.length] * (bar % 8 >= 4 ? 1 : 1), tempo * 2.2, 'sine', 0.05, 0.004, 0, at, this.music);
      // soft drums
      if (st % 8 === 0) this.tone(70, 0.18, 'sine', tense ? 0.16 : 0.09, 0.004, 0.5, at, this.music);
      if (st % 8 === 4 && !night) this.noise(0.08, tense ? 0.06 : 0.03, 'bandpass', 1800, 1, 0, at, this.music);
      if (tense && st % 2 === 1) this.noise(0.04, 0.02, 'highpass', 7000, 1, 0, at, this.music);
      this.next += tempo;
    }
  }
}
