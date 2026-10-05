/* Colliders.js - the solid things on top of the heightfield: tree trunks and
   boulders (circles), buildings, fences and gates (oriented boxes), and
   floors you can stand on (box tops: platforms, temple steps, decks).
   A spatial hash keeps lookups local. */
export class Colliders {
  constructor(cell = 16) { this.cell = cell; this.map = new Map(); this.n = 0; }
  _key(i, j) { return i * 100003 + j; }
  _cells(o, f) {
    const c = this.cell, r = o.br;
    const i0 = Math.floor((o.x - r) / c), i1 = Math.floor((o.x + r) / c), j0 = Math.floor((o.z - r) / c), j1 = Math.floor((o.z + r) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) f(this._key(i, j));
  }
  _add(o) { this._cells(o, k => { let s = this.map.get(k); if (!s) this.map.set(k, (s = [])); s.push(o); }); this.n++; return o; }
  remove(o) { if (!o) return; this._cells(o, k => { const s = this.map.get(k); if (s) { const i = s.indexOf(o); if (i >= 0) s.splice(i, 1); } }); this.n--; }
  circle(x, z, r, y0 = -1e9, y1 = 1e9, tag) { return this._add({ t: 'c', x, z, r, br: r, y0, y1, tag }); }
  /** box centred at x,z with half sizes hw (local x) and hd (local z), rotated by rot */
  box(x, z, hw, hd, rot, y0 = -1e9, y1 = 1e9, tag, floor = false) { return this._add({ t: 'b', x, z, hw, hd, rot, c: Math.cos(rot), s: Math.sin(rot), br: Math.hypot(hw, hd), y0, y1, tag, floor }); }
  near(x, z, f) { const s = this.map.get(this._key(Math.floor(x / this.cell), Math.floor(z / this.cell))); if (s) for (const o of s) f(o); }
  /** push a circle of radius r at pos (feet y .. y + h) out of everything solid. Returns true if it hit. */
  push(pos, r, h = 1.8, ignore) {
    let hit = false;
    const seen = new Set();
    const c = this.cell, i0 = Math.floor((pos.x - r) / c), i1 = Math.floor((pos.x + r) / c), j0 = Math.floor((pos.z - r) / c), j1 = Math.floor((pos.z + r) / c);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const s = this.map.get(this._key(i, j)); if (!s) continue;
      for (const o of s) {
        if (seen.has(o) || o === ignore || (ignore && o.tag && o.tag === ignore)) continue; seen.add(o);
        if (pos.y > o.y1 - 0.05 || pos.y + h < o.y0) continue;
        if (o.floor && pos.y >= o.y1 - 0.45) continue;   // standing on it
        if (o.t === 'c') {
          const dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz), m = r + o.r;
          if (d < m && d > 1e-5) { pos.x = o.x + dx / d * m; pos.z = o.z + dz / d * m; hit = true; }
        } else {
          const dx = pos.x - o.x, dz = pos.z - o.z;
          const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
          const cx = Math.max(-o.hw, Math.min(o.hw, lx)), cz = Math.max(-o.hd, Math.min(o.hd, lz));
          let ex = lx - cx, ez = lz - cz, d = Math.hypot(ex, ez);
          if (d < r) {
            if (d < 1e-5) { // inside: push out along the shallowest side
              const px = o.hw - Math.abs(lx), pz = o.hd - Math.abs(lz);
              if (px < pz) { ex = Math.sign(lx) || 1; ez = 0; d = 1; const nl = Math.sign(lx) * (o.hw + r); const nlx = nl; const wx = nlx * o.c + lz * o.s, wz = -nlx * o.s + lz * o.c; pos.x = o.x + wx; pos.z = o.z + wz; }
              else { const nlz = Math.sign(lz) * (o.hd + r); const wx = lx * o.c + nlz * o.s, wz = -lx * o.s + nlz * o.c; pos.x = o.x + wx; pos.z = o.z + wz; }
            } else {
              const k = (r - d) / d; const mx = ex * k, mz = ez * k;
              pos.x += mx * o.c + mz * o.s; pos.z += -mx * o.s + mz * o.c;
            }
            hit = true;
          }
        }
      }
    }
    return hit;
  }
  /** the highest floor top under (x, z) that is no more than `step` above y */
  floorAt(x, z, y, step = 0.6) {
    let best = -Infinity;
    this.near(x, z, o => {
      if (!o.floor || o.y1 > y + step) return;
      const dx = x - o.x, dz = z - o.z, lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
      if (Math.abs(lx) <= o.hw && Math.abs(lz) <= o.hd && o.y1 > best) best = o.y1;
    });
    return best;
  }
  /** anything solid on the segment? (line of sight, camera) - cheap: samples points */
  blocked(ax, az, bx, bz, y) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 2);
    const p = { x: 0, y, z: 0 };
    for (let i = 1; i < n; i++) { p.x = ax + (bx - ax) * i / n; p.z = az + (bz - az) * i / n; p.y = y; const q = { ...p }; if (this.push(q, 0.05, 0.1)) return true; }
    return false;
  }
}
