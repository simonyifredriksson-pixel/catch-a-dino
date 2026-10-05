/* Water.js - one sea level for the whole world (rivers, swamp pools and the
   ocean are all y = 0, the land is carved down to meet it), and lava.

   The surface is a faceted grid that follows the camera, with waves done in
   the vertex shader. From below it is the ceiling of the underwater world. */
import * as THREE from '../../lib/three.module.js';
import { VOLCANO } from '../data/Biomes.js';

export class Water {
  constructor(scene) {
    const seg = 120, size = 1600;
    const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2).toNonIndexed();
    this.uniforms = { uTime: { value: 0 }, uStorm: { value: 0 } };
    const m = new THREE.MeshStandardMaterial({ color: '#2f9fc4', roughness: 0.22, metalness: 0.08, transparent: true, opacity: 0.84, flatShading: true, side: THREE.DoubleSide });
    m.onBeforeCompile = (s) => {
      s.uniforms.uTime = this.uniforms.uTime; s.uniforms.uStorm = this.uniforms.uStorm;
      s.vertexShader = 'uniform float uTime; uniform float uStorm;\n' + s.vertexShader.replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        vec4 wpos = modelMatrix * vec4(position, 1.0);
        float a = 0.22 + uStorm * 0.55;
        transformed.y += sin(wpos.x * 0.11 + uTime * 1.3) * a + cos(wpos.z * 0.13 + uTime * 1.1) * a * 0.8 + sin((wpos.x + wpos.z) * 0.31 + uTime * 2.1) * a * 0.35;
      `);
    };
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.snap = size / seg;
    // lava: the crater lake, glowing
    const lg = new THREE.CircleGeometry(VOLCANO.crater * 1.05, 28).rotateX(-Math.PI / 2);
    this.lavaU = { uTime: { value: 0 } };
    const lm = new THREE.MeshBasicMaterial({ color: '#ff6a1a' });
    lm.onBeforeCompile = (s) => {
      s.uniforms.uTime = this.lavaU.uTime;
      s.vertexShader = 'varying vec3 vW;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(position,1.0)).xyz;');
      s.fragmentShader = 'uniform float uTime;\nvarying vec3 vW;\n' + s.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
        float n = sin(vW.x * 0.35 + uTime * 0.7) * sin(vW.z * 0.3 - uTime * 0.5) + sin((vW.x - vW.z) * 0.8 + uTime) * 0.4;
        vec3 c = mix(vec3(0.95, 0.25, 0.04), vec3(1.0, 0.85, 0.3), smoothstep(0.2, 1.1, n));
        vec4 diffuseColor = vec4(c * 1.2, 1.0);`);
    };
    this.lava = new THREE.Mesh(lg, lm);
    this.lava.position.set(VOLCANO.x, VOLCANO.lava, VOLCANO.z);
    scene.add(this.lava);
    this.lavaLight = new THREE.PointLight('#ff7a2a', 3, 260, 1.2);
    this.lavaLight.position.set(VOLCANO.x, VOLCANO.lava + 30, VOLCANO.z);
    scene.add(this.lavaLight);
  }
  update(dt, cam, storm) {
    this.uniforms.uTime.value += dt;
    this.uniforms.uStorm.value = storm;
    this.lavaU.uTime.value += dt;
    // follow the camera in whole grid steps so the facets don't swim
    this.mesh.position.set(Math.round(cam.x / this.snap) * this.snap, 0, Math.round(cam.z / this.snap) * this.snap);
  }
  /** wave height at a point (matches the shader closely enough for floating things) */
  waveAt(x, z, t, storm = 0) {
    const a = 0.22 + storm * 0.55;
    return Math.sin(x * 0.11 + t * 1.3) * a + Math.cos(z * 0.13 + t * 1.1) * a * 0.8 + Math.sin((x + z) * 0.31 + t * 2.1) * a * 0.35;
  }
}

/** is (x, z) in molten lava? (the crater lake, or one of the flows down the slope) */
export function lavaAt(x, z, flows) {
  const d = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
  if (d < VOLCANO.crater * 1.02) return true;
  if (flows) for (const F of flows) for (let i = 0; i < F.length - 1; i++) {
    const [ax, az, w] = F[i], [bx, bz] = F[i + 1];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    if (Math.hypot(x - ax - dx * t, z - az - dz * t) < w) return true;
  }
  return false;
}
