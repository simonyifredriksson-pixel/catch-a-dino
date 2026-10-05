/* Sky.js - time of day, weather, and the air you see through.

   tod runs 0..1 (0 midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset). The sky
   dome, the sun and moon, the light colours and the fog are keyed off it,
   then greyed and darkened by cloud and storm. The fog also takes a tint
   from the biome you stand in, goes blue-green underwater, black in a cave
   and white inside the Whiteout. Rain, snow and lightning follow the camera. */
import * as THREE from '../../lib/three.module.js';
import { clamp, lerp, smoothstep } from '../core/Util.js';
import { BIOMES } from '../data/Biomes.js';

const KEYS = [
  [0.00, '#0e1838', '#24345e', '#9ab4ff', 0.0, 0.62, '#5a6aa8', '#202838'],
  [0.20, '#182448', '#30406e', '#9ab4ff', 0.0, 0.64, '#5a6aa8', '#222a3a'],
  [0.245, '#3a5aa0', '#f2a272', '#ffb070', 1.0, 0.8, '#a8a0c0', '#4a4048'],
  [0.30, '#5aa6e6', '#cde6f2', '#fff0d8', 2.3, 1.15, '#d8ecff', '#6a7a50'],
  [0.50, '#4598e4', '#d6edf8', '#fff6ea', 2.7, 1.25, '#e0f0ff', '#6e7e52'],
  [0.70, '#559ce0', '#eee2ca', '#ffe8c8', 2.3, 1.15, '#e0e8f8', '#6a7050'],
  [0.765, '#4a58a0', '#ff8c5c', '#ff9a50', 1.0, 0.8, '#c0a0b8', '#4a3a3a'],
  [0.82, '#1a2450', '#5a4a7a', '#9ab4ff', 0.0, 0.62, '#5a5a98', '#22222e'],
  [1.00, '#0e1838', '#24345e', '#9ab4ff', 0.0, 0.62, '#5a6aa8', '#202838'],
];
const _a = new THREE.Color(), _b = new THREE.Color(), _c = new THREE.Color(), _g = new THREE.Color('#7c8696');

export class Sky {
  constructor(scene, lights) {
    this.scene = scene; this.L = lights;
    this.u = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sun: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, glow: { value: 1 } };
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1900, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.u, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sun; uniform vec3 sunCol; uniform float glow; varying vec3 vD;
        void main(){ float h = clamp(vD.y, -0.2, 1.0); vec3 c = mix(hor, top, smoothstep(0.0, 0.55, h));
          c = mix(c, hor * 0.7, smoothstep(0.0, -0.2, h));
          float s = max(0.0, dot(normalize(vD), normalize(sun)));
          c += sunCol * (pow(s, 8.0) * 0.35 + pow(s, 120.0) * 0.8) * glow;
          gl_FragColor = vec4(c, 1.0); }`,
    }));
    dome.renderOrder = -10; dome.frustumCulled = false;
    this.dome = dome; scene.add(dome);
    // sun and moon discs
    this.sunM = new THREE.Mesh(new THREE.CircleGeometry(60, 20), new THREE.MeshBasicMaterial({ color: '#fff4d0', fog: false, transparent: true }));
    this.moonM = new THREE.Mesh(new THREE.CircleGeometry(38, 20), new THREE.MeshBasicMaterial({ color: '#e8eeff', fog: false, transparent: true }));
    scene.add(this.sunM, this.moonM);
    // stars
    const sp = [];
    for (let i = 0; i < 1600; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); if (u < -0.1) continue; sp.push(Math.cos(a) * r * 1700, u * 1700, Math.sin(a) * r * 1700); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.frustumCulled = false; scene.add(this.stars);
    // clouds: chunky low-poly puffs drifting around
    this.clouds = new THREE.Group();
    this.cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25, fog: false, transparent: true, opacity: 0.95 });
    const cg = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < 34; i++) {
      const c = new THREE.Group();
      const n = 3 + Math.floor(Math.random() * 4);
      for (let k = 0; k < n; k++) { const m = new THREE.Mesh(cg, this.cloudMat); m.position.set((k - n / 2) * 14 + Math.random() * 6, Math.random() * 6, Math.random() * 10 - 5); m.scale.set(16 + Math.random() * 12, 8 + Math.random() * 6, 12 + Math.random() * 6); c.add(m); }
      const a = Math.random() * Math.PI * 2, d = 200 + Math.random() * 900;
      c.position.set(Math.cos(a) * d, 230 + Math.random() * 120, Math.sin(a) * d);
      c.rotation.y = Math.random() * 3;
      this.clouds.add(c);
    }
    scene.add(this.clouds);
    // rain: streaks that fall around the camera
    const RN = 2400, rp = new Float32Array(RN * 6);
    for (let i = 0; i < RN; i++) { const x = (Math.random() - 0.5) * 80, y = Math.random() * 40, z = (Math.random() - 0.5) * 80; rp.set([x, y, z, x + 0.1, y - 0.9, z], i * 6); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#b8cce0', transparent: true, opacity: 0.0, depthWrite: false }));
    this.rain.frustumCulled = false; scene.add(this.rain);
    const SN = 1800, snp = new Float32Array(SN * 3);
    for (let i = 0; i < SN; i++) snp.set([(Math.random() - 0.5) * 70, Math.random() * 35, (Math.random() - 0.5) * 70], i * 3);
    const sng = new THREE.BufferGeometry(); sng.setAttribute('position', new THREE.BufferAttribute(snp, 3));
    this.snow = new THREE.Points(sng, new THREE.PointsMaterial({ color: '#ffffff', size: 0.22, transparent: true, opacity: 0, depthWrite: false }));
    this.snow.frustumCulled = false; scene.add(this.snow);
    // lightning bolt
    this.bolt = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#f4f8ff', fog: false }));
    this.bolt.visible = false; this.bolt.frustumCulled = false; scene.add(this.bolt);
    this.flash = 0; this.boltT = 0; this.nextBolt = 6;
    this.state = { night: 0, sunUp: 1 };
    this.fogTint = new THREE.Color('#cfe8f0');
    this.local = { snow: 0, sand: 0, ash: 0, white: 0 };
    this.onBolt = null;
  }

  /** env: { tod, cloud, rain, storm, biome, under, depth, cave, whiteout, cam (Vector3), dt } */
  update(dt, env) {
    const tod = ((env.tod % 1) + 1) % 1;
    let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= tod) i++;
    const A = KEYS[i], B = KEYS[i + 1], f = smoothstep(A[0], B[0], tod);
    const top = _a.set(A[1]).lerp(_c.set(B[1]), f).clone(), hor = _a.set(A[2]).lerp(_c.set(B[2]), f).clone();
    const sunCol = _a.set(A[3]).lerp(_c.set(B[3]), f).clone();
    const sunI = lerp(A[4], B[4], f), hemiI = lerp(A[5], B[5], f);
    const hSky = _a.set(A[6]).lerp(_c.set(B[6]), f).clone(), hGnd = _a.set(A[7]).lerp(_c.set(B[7]), f).clone();
    const cloud = clamp(env.cloud || 0, 0, 1), storm = clamp(env.storm || 0, 0, 1);
    const grey = cloud * 0.55 + storm * 0.35;
    top.lerp(_g, grey); hor.lerp(_b.set('#9aa4b0'), grey * 0.8);
    if (storm > 0) { top.multiplyScalar(1 - storm * 0.45); hor.multiplyScalar(1 - storm * 0.35); }
    // biome tint near the horizon (sandy in the desert, steamy in the swamp...)
    const bf = BIOMES[env.biome]?.fog;
    if (bf) { this.fogTint.lerp(_b.set(bf), 1 - Math.exp(-dt * 0.8)); }
    hor.lerp(this.fogTint, 0.28 * (1 - grey));
    // sun direction: rises in the east (+x), sets in the west
    const ang = (tod - 0.25) * Math.PI * 2;
    const sun = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.25).normalize();
    const moon = sun.clone().multiplyScalar(-1);
    const night = smoothstep(0.02, -0.12, sun.y);
    this.state.night = night; this.state.sunUp = smoothstep(-0.05, 0.1, sun.y);
    this.u.top.value.copy(top); this.u.hor.value.copy(hor); this.u.sun.value.copy(sun); this.u.sunCol.value.copy(sunCol); this.u.glow.value = (1 - grey) * (1 - night);
    const cam = env.cam;
    this.dome.position.copy(cam);
    this.sunM.position.copy(cam).addScaledVector(sun, 1500); this.sunM.lookAt(cam); this.sunM.material.opacity = (1 - grey) * this.state.sunUp;
    this.moonM.position.copy(cam).addScaledVector(moon, 1500); this.moonM.lookAt(cam); this.moonM.material.opacity = night * (1 - grey * 0.8);
    this.stars.position.copy(cam); this.stars.material.opacity = night * (1 - cloud) * 0.95;
    // lights
    const L = this.L;
    const useMoon = night > 0.5;
    const ldir = useMoon ? moon : sun;
    L.sun.color.copy(useMoon ? _b.set('#9ab4ff') : sunCol);
    L.sun.intensity = (useMoon ? 0.85 * night : sunI) * (1 - grey * 0.55);
    L.sun.position.copy(cam).addScaledVector(ldir, 220); L.sun.target.position.copy(cam);
    L.hemi.color.copy(hSky); L.hemi.groundColor.copy(hGnd); L.hemi.intensity = hemiI * (1 - grey * 0.3) + this.flash * 3;
    // fog
    const F = this.scene.fog;
    let fogC = hor.clone(), near = 80, far = 900 - storm * 450 - cloud * 120;
    const loc = this.local, k = 1 - Math.exp(-dt * 1.5);
    loc.snow = lerp(loc.snow, env.biome === 'tundra' ? 0.6 : 0, k); loc.white = lerp(loc.white, env.whiteout ? 1 : 0, k);
    loc.sand = lerp(loc.sand, env.sand || 0, k); loc.ash = lerp(loc.ash, env.biome === 'volcano' ? 0.5 : 0, k);
    if (loc.white > 0.01) { fogC.lerp(_b.set('#eef4fa'), loc.white); near = lerp(near, 2, loc.white); far = lerp(far, 55, loc.white); }
    if (loc.sand > 0.01) { fogC.lerp(_b.set('#e0c090'), loc.sand); near = lerp(near, 4, loc.sand); far = lerp(far, 110, loc.sand); }
    if (loc.ash > 0.01) { fogC.lerp(_b.set('#8a7068'), loc.ash * 0.5); far = lerp(far, 420, loc.ash); }
    if (env.cave) { fogC.set('#0e0c18'); near = 4; far = 70; L.sun.intensity *= 0.05; L.hemi.intensity = 0.25 + this.flash; }
    if (env.under) {
      const d = clamp(env.depth / 120, 0, 1);
      fogC.set('#2a8aa8').lerp(_b.set('#06182a'), d).multiplyScalar(1 - night * 0.6);
      near = 1; far = lerp(70, 26, d);
      L.sun.intensity *= 1 - d * 0.8; L.hemi.intensity *= 1 - d * 0.6;
    }
    F.color.copy(fogC); F.near = near; F.far = Math.max(near + 10, far);
    this.scene.background = fogC;
    // clouds drift and darken
    this.cloudMat.color.set('#ffffff').lerp(_b.set('#5a6070'), storm * 0.8 + cloud * 0.25).multiplyScalar(1 - night * 0.75);
    this.cloudMat.emissive.copy(this.cloudMat.color);
    this.cloudMat.emissiveIntensity = 0.62 * (1 - night * 0.8) * (1 - storm * 0.5);
    this.clouds.position.set(cam.x, 0, cam.z);
    this.clouds.children.forEach((c, j) => { c.position.x += dt * (2 + (j % 3)) * (1 + storm * 2); if (c.position.x > 1100) c.position.x -= 2200; c.visible = j < 10 + cloud * 24; });
    // rain and snow around the camera
    const rain = clamp(env.rain || 0, 0, 1) * (env.under || env.cave ? 0 : 1) * (env.biome === 'tundra' || env.biome === 'desert' ? 0.2 : 1);
    this.rain.material.opacity = rain * 0.55; this.rain.visible = rain > 0.02;
    if (this.rain.visible) {
      const p = this.rain.geometry.attributes.position.array, fall = dt * 32;
      for (let j = 0; j < p.length; j += 6) { p[j + 1] -= fall; p[j + 4] -= fall; if (p[j + 1] < -4) { p[j + 1] += 44; p[j + 4] += 44; } }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.position.set(cam.x, cam.y - 18, cam.z);
    }
    const snow = Math.max(loc.snow, loc.white) * (env.under || env.cave ? 0 : 1);
    this.snow.material.opacity = snow; this.snow.visible = snow > 0.02;
    if (this.snow.visible) {
      const p = this.snow.geometry.attributes.position.array, t = performance.now() * 0.001;
      for (let j = 0; j < p.length; j += 3) { p[j + 1] -= dt * (1.4 + loc.white * 3); p[j] += Math.sin(t + j) * dt * (0.4 + loc.white * 6); if (p[j + 1] < 0) p[j + 1] += 35; }
      this.snow.geometry.attributes.position.needsUpdate = true;
      this.snow.position.set(cam.x, cam.y - 12, cam.z);
    }
    // lightning
    this.flash = Math.max(0, this.flash - dt * 6);
    if (this.boltT > 0) { this.boltT -= dt; if (this.boltT <= 0) this.bolt.visible = false; }
    if (storm > 0.5 && !env.under && !env.cave) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) { this.nextBolt = 3 + Math.random() * 9 / storm; this.strike(cam.x + (Math.random() - 0.5) * 500, cam.z + (Math.random() - 0.5) * 500, env.groundAt); }
    }
  }
  /** a lightning strike at x,z (ground height from groundAt) */
  strike(x, z, groundAt) {
    const g = groundAt ? Math.max(0, groundAt(x, z)) : 0;
    const pts = []; let px = x, pz = z;
    for (let y = 320; y > g; y -= 18 + Math.random() * 14) { pts.push(new THREE.Vector3(px, y, pz)); px += (Math.random() - 0.5) * 22; pz += (Math.random() - 0.5) * 22; }
    pts.push(new THREE.Vector3(x, g, z));
    this.bolt.geometry.dispose(); this.bolt.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    this.bolt.visible = true; this.boltT = 0.18; this.flash = 1;
    if (this.onBolt) this.onBolt(x, z);
  }
}
