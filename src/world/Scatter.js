/* Scatter.js - plants and rocks, streamed in around the camera.

   The world is cut into 128 m cells. A cell is built (deterministically, from
   its coordinates) when the camera comes within range and thrown away when it
   leaves: one InstancedMesh per prop variant per cell, so whole cells are
   frustum-culled and memory stays flat however far you travel. Small plants
   only draw near the camera. Solid props register colliders while their
   cell is alive. */
import * as THREE from '../../lib/three.module.js';
import { FLORA, SOLID, SMALL } from '../art/FloraArt.js';
import { vcMat, vcGlow } from '../art/Mesher.js';
import { rng, hash3, clamp } from '../core/Util.js';
import { ZOO, WORLD_HALF } from '../data/Biomes.js';

const CELL = 128, VARS = 3;
// per biome: [type, chance per 5 m sample point]
const TABLE = {
  meadow: [['fern', 0.05], ['grass', 0.12], ['flowers', 0.05], ['bush', 0.02], ['rock', 0.005], ['pebbles', 0.008], ['cycad', 0.016], ['tfern', 0.01], ['araucaria', 0.005], ['ginkgo', 0.004], ['palm', 0.002], ['log', 0.002]],
  jungle: [['jtree', 0.05], ['tfern', 0.04], ['fern', 0.09], ['bush', 0.03], ['palm', 0.008], ['cycad', 0.02], ['rock', 0.007], ['log', 0.005], ['flowers', 0.012], ['mushroom', 0.002], ['horsetail', 0.01]],
  valley: [['jtree', 0.04], ['tfern', 0.05], ['fern', 0.09], ['palm', 0.012], ['flowers', 0.02], ['cycad', 0.02], ['bush', 0.02], ['horsetail', 0.01]],
  elder: [['redwood', 0.016], ['araucaria', 0.01], ['ginkgo', 0.008], ['fern', 0.08], ['tfern', 0.02], ['mushroom', 0.006], ['log', 0.008], ['rock', 0.006], ['bush', 0.02]],
  desert: [['succulent', 0.018], ['deadtree', 0.005], ['sandrock', 0.01], ['bones', 0.004], ['cycad', 0.003]],
  swamp: [['swamptree', 0.03], ['reeds', 0.06], ['horsetail', 0.05], ['mushroom', 0.008], ['fern', 0.03], ['log', 0.008]],
  peaks: [['rock', 0.03], ['pebbles', 0.03], ['snowpine', 0.008], ['grass', 0.01]],
  tundra: [['snowpine', 0.014], ['icespire', 0.01], ['rock', 0.008], ['pebbles', 0.01]],
  volcano: [['lavarock', 0.02], ['deadtree', 0.005], ['rock', 0.016], ['pebbles', 0.02]],
  beach: [['palm', 0.018], ['rock', 0.004], ['pebbles', 0.01], ['succulent', 0.003]],
  isle: [['palm', 0.05], ['fern', 0.05], ['flowers', 0.02], ['bush', 0.02], ['tfern', 0.01]],
  skull: [['jtree', 0.035], ['palm', 0.02], ['fern', 0.07], ['rock', 0.02], ['bones', 0.004], ['tfern', 0.02]],
  ocean: [['coral', 0.02], ['kelp', 0.016], ['rock', 0.008]],
  deep: [['kelp', 0.006], ['rock', 0.004]],
};
const WATERY = new Set(['coral', 'kelp']);
const TALL = new Set(['jtree', 'redwood', 'araucaria', 'ginkgo', 'palm', 'swamptree', 'snowpine', 'tfern']);

export class Scatter {
  constructor(game) {
    this.g = game; this.T = game.terrain;
    this.cells = new Map();
    this.protos = {};
    for (const k of Object.keys(FLORA)) { this.protos[k] = []; for (let v = 0; v < VARS; v++) this.protos[k].push(FLORA[k](1000 + v * 7919 + k.length * 31).geometry()); }
    this.mats = [vcMat(), vcGlow()];
    this.radius = 520; this.smallR = 230;
    this.exclude = [];   // [{x, z, r}] landmark footprints keep plants off
    this.queue = [];
  }
  _ok(x, z) {
    if (Math.abs(x - ZOO.x) < ZOO.half + 18 && Math.abs(z - ZOO.z) < ZOO.half + 18) return false;
    for (const e of this.exclude) if (Math.hypot(x - e.x, z - e.z) < e.r) return false;
    return true;
  }
  buildCell(ci, cj) {
    const key = ci + ',' + cj;
    const T = this.T, r = rng((ci * 73856093) ^ (cj * 19349663) ^ 0x5eed);
    const x0 = ci * CELL, z0 = cj * CELL;
    const lists = {};
    const cols = [];
    for (let gx = 0; gx < CELL; gx += 5) for (let gz = 0; gz < CELL; gz += 5) {
      const x = x0 + gx + r() * 5, z = z0 + gz + r() * 5;
      if (Math.abs(x) > WORLD_HALF - 6 || Math.abs(z) > WORLD_HALF - 6) continue;
      const h = T.ground(x, z);
      let b = T.biome(x, z);
      // river banks grow reeds whatever the biome
      if (h > -0.6 && h < 0.9 && b !== 'desert' && b !== 'tundra' && b !== 'beach' && b !== 'ocean' && r() < 0.05) { this._put(lists, cols, 'reeds', x, h, z, r); continue; }
      const tab = TABLE[b]; if (!tab) continue;
      const roll = r();
      let acc = 0, pick = null;
      for (const [t, p] of tab) { acc += p; if (roll < acc) { pick = t; break; } }
      if (!pick) continue;
      const wet = WATERY.has(pick);
      if (wet ? (h > -2.5 || (pick === 'coral' && h < -28)) : h < 0.5) continue;
      if (!wet && T.slope(x, z) > (TALL.has(pick) ? 0.25 : 0.5)) continue;
      if (!this._ok(x, z)) continue;
      if (b === 'peaks' && pick === 'snowpine' && h < 50) continue;
      this._put(lists, cols, pick, x, h, z, r);
    }
    const cell = { key, meshes: [], small: [], cols };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), col = new THREE.Color();
    for (const id in lists) {
      const [type, v] = id.split('|'), L = lists[id];
      const im = new THREE.InstancedMesh(this.protos[type][+v], this.mats, L.length);
      L.forEach((it, i) => {
        q.setFromAxisAngle(p3.set(0, 1, 0), it.rot);
        m4.compose(p3.set(it.x, it.y, it.z), q, s3.set(it.s, it.s * it.sy, it.s));
        im.setMatrixAt(i, m4);
        col.setRGB(it.tint, it.tint * (0.97 + it.tg * 0.06), it.tint * 0.98);
        im.setColorAt(i, col);
      });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = TALL.has(type) || type === 'rock' || type === 'lavarock'; im.receiveShadow = true;
      this.g.scene.add(im);
      (SMALL.has(type) ? cell.small : cell.meshes).push(im);
    }
    this.cells.set(key, cell);
    return cell;
  }
  _put(lists, cols, type, x, h, z, r) {
    const v = Math.floor(r() * VARS), s = (type === 'redwood' ? 0.85 : 0.75) + r() * 0.5;
    const id = type + '|' + v;
    (lists[id] || (lists[id] = [])).push({ x, y: h - 0.15, z, s, sy: 0.9 + r() * 0.2, rot: r() * Math.PI * 2, tint: 0.88 + r() * 0.2, tg: r() });
    if (SOLID[type]) cols.push(this.g.colliders.circle(x, z, SOLID[type] * s, h - 1, h + (TALL.has(type) ? 40 : 2.5 * s), 'flora'));
  }
  dropCell(cell) {
    for (const m of [...cell.meshes, ...cell.small]) { this.g.scene.remove(m); m.dispose(); }
    for (const c of cell.cols) this.g.colliders.remove(c);
    this.cells.delete(cell.key);
  }
  /** keep the cells around `at` built (a few per frame), drop the far ones */
  update(at, budget = 2) {
    const R = this.radius, ci0 = Math.floor((at.x - R) / CELL), ci1 = Math.floor((at.x + R) / CELL), cj0 = Math.floor((at.z - R) / CELL), cj1 = Math.floor((at.z + R) / CELL);
    const want = [];
    for (let i = ci0; i <= ci1; i++) for (let j = cj0; j <= cj1; j++) {
      const cx = (i + 0.5) * CELL, cz = (j + 0.5) * CELL, d = Math.hypot(cx - at.x, cz - at.z);
      if (d < R && !this.cells.has(i + ',' + j)) want.push([d, i, j]);
    }
    want.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < Math.min(budget, want.length); k++) this.buildCell(want[k][1], want[k][2]);
    for (const c of [...this.cells.values()]) {
      const [i, j] = c.key.split(',').map(Number);
      const d = Math.hypot((i + 0.5) * CELL - at.x, (j + 0.5) * CELL - at.z);
      if (d > R + 160) this.dropCell(c);
      else for (const m of c.small) m.visible = d < this.smallR + CELL * 0.7;
    }
  }
  /** build everything near a point right now (used at load and after a teleport) */
  warm(at) { this.update(at, 999); }
}
void clamp; void hash3;
