/* WaterSigns.js - how you spot what is swimming below.

   Every client draws these locally for the swimmers near its player:
     SHADOWS  a dark shape on the surface over anything big enough, darker the
              shallower it swims (deep ones are only a faint smudge)
     BUBBLES  little trails rising from swimmers, more from big ones
     WAKES    foam and V-ripples behind anything cruising at the surface
              (fins break the water)
     GLINTS   rare creatures (4+ stars) now and then flash a sparkle
   Hunting from the back of an aquatic mount means reading these signs. */
import * as THREE from '../../lib/three.module.js';
import { RARITY } from '../data/Species.js';

const N = 24, RANGE = 110;

export class WaterSigns {
  constructor(game) {
    this.g = game;
    const geo = new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2);
    this.shadows = [];
    for (let i = 0; i < N; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#0a2230', transparent: true, opacity: 0, depthWrite: false }));
      m.renderOrder = 2; m.visible = false; game.scene.add(m); this.shadows.push(m);
    }
    this.t = 0;
  }
  update(dt) {
    const G = this.g, P = G.player.pos, fx = G.fx;
    this.t += dt;
    let n = 0;
    const list = G.wild.list.filter(c => c.swimmer && !c.gone && c.visible && Math.hypot(c.pos.x - P.x, c.pos.z - P.z) < RANGE && c !== G.player.mount)
      .sort((a, b) => (a.pos.x - P.x) ** 2 + (a.pos.z - P.z) ** 2 - (b.pos.x - P.x) ** 2 - (b.pos.z - P.z) ** 2);
    for (const c of list) {
      const depth = -c.pos.y, big = c.height, stars = RARITY[c.sp.rarity]?.stars || 1;
      // shadow on the surface
      if (n < N && depth > 0.2 && big > 0.6) {
        const S = this.shadows[n++];
        const op = Math.max(0, Math.min(0.42, (0.45 - depth / 40) * Math.min(1, big / 2)));
        S.visible = op > 0.02; S.material.opacity = op;
        S.position.set(c.pos.x, 0.06, c.pos.z);
        S.rotation.y = c.yaw;
        S.scale.set(c.radius * 0.9 + depth * 0.03, 1, (c.len || c.radius * 3) * 0.55 + depth * 0.05);
      }
      // bubbles
      if (depth > 0.5 && Math.random() < dt * (0.6 + big * 0.3)) fx.burst(c.pos.x + (Math.random() - 0.5) * c.radius, Math.min(-0.2, c.pos.y + 0.5), c.pos.z + (Math.random() - 0.5) * c.radius, 'bubble', 2 + Math.round(big), { scale: Math.min(2.5, 0.6 + big * 0.2) });
      // the surface breaks: foam wake (fins, shallow cruisers)
      if (depth < Math.max(1.2, big * 0.45) && c.speed > 1 && Math.random() < dt * 6) {
        const bx = c.pos.x - Math.sin(c.yaw) * c.radius, bz = c.pos.z - Math.cos(c.yaw) * c.radius;
        fx.burst(bx, 0.05, bz, 'foam', 2, { scale: Math.min(2, 0.5 + big * 0.25), spread: 1 });
        if (Math.random() < dt * 4) fx.ring(bx, 0.04, bz, 1 + big * 0.6, '#ffffff', 1.1);
      }
      // rare ones glint
      if (stars >= 4 && Math.random() < dt * 0.35) fx.burst(c.pos.x, Math.max(0.2, c.pos.y + big * 0.5), c.pos.z, 'spark', 3, { scale: 1.4 });
    }
    for (let i = n; i < N; i++) this.shadows[i].visible = false;
  }
}
