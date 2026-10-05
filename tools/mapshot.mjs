// mapshot.mjs - draw the continent top-down (terrain colours + hill shading)
// to a PNG without a browser:  node tools/mapshot.mjs <out.png> [scale]
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Terrain, N } from '../src/world/Terrain.js';
import * as THREE from '../lib/three.module.js';

const out = process.argv[2] || 'map.png';
const t0 = Date.now();
const T = new Terrain();
T.generate();
console.log('generated', N, 'x', N, 'in', Date.now() - t0, 'ms');
const W = N, H = N, px = Buffer.alloc((W * 3 + 1) * H);
const c = new THREE.Color();
for (let j = 0; j < H; j++) {
  px[j * (W * 3 + 1)] = 0;
  for (let i = 0; i < W; i++) {
    T._color(i, j, c);
    const h = T.H[i * N + j], hx = T.H[Math.min(N - 1, i + 1) * N + j] - h, hz = T.H[i * N + Math.min(N - 1, j + 1)] - h;
    let k = 1 + (-hx - hz) * 0.06; k = Math.max(0.5, Math.min(1.4, k));
    let r = c.r * k, g = c.g * k, b = c.b * k;
    if (h < 0) { const d = Math.min(1, -h / 60); r = r * 0.35 + 0.15 * (1 - d); g = g * 0.4 + 0.45 * (1 - d) + 0.1; b = b * 0.3 + 0.75 - d * 0.3; }
    const o = j * (W * 3 + 1) + 1 + i * 3;
    px[o] = Math.min(255, Math.round(Math.pow(r, 1 / 2.2) * 255)); px[o + 1] = Math.min(255, Math.round(Math.pow(g, 1 / 2.2) * 255)); px[o + 2] = Math.min(255, Math.round(Math.pow(b, 1 / 2.2) * 255));
  }
}
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cr]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(px)), chunk('IEND', Buffer.alloc(0))]));
let lo = Infinity, hi = -Infinity; for (const v of T.H) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
console.log('wrote', out, 'height range', lo.toFixed(1), hi.toFixed(1));
