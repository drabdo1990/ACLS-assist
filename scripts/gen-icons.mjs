// Generates ResusCode PWA icons as PNGs with zero third-party dependencies.
// Renders the same ECG-heartbeat mark used by favicon.svg at 4x supersampling
// and box-downsamples for smooth edges. Run with: npm run icons
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'icons');

const COLORS = {
  bg: [6, 8, 14],
  border: [34, 48, 73],
  red: [239, 68, 68],
  cyan: [6, 182, 212],
  amber: [245, 158, 11],
};

// Normalised ECG polyline (x, y in 0..1).
const ECG = [
  [0.094, 0.594],
  [0.3125, 0.594],
  [0.406, 0.3125],
  [0.516, 0.781],
  [0.609, 0.453],
  [0.6875, 0.594],
  [0.906, 0.594],
];
const STROKE_W = 0.075;
const DOT_R = 0.05;

function blend(dst, i, [r, g, b], a) {
  const inv = 1 - a;
  dst[i] = r * a + dst[i] * inv;
  dst[i + 1] = g * a + dst[i + 1] * inv;
  dst[i + 2] = b * a + dst[i + 2] * inv;
  dst[i + 3] = Math.min(255, a * 255 + dst[i + 3] * inv);
}

function insideRoundedRect(x, y, size, radius) {
  if (x < 0 || y < 0 || x > size || y > size) return false;
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len2 = vx * vx + vy * vy || 1e-9;
  let t = (wx * vx + wy * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (ax + t * vx);
  const dy = py - (ay + t * vy);
  return Math.sqrt(dx * dx + dy * dy);
}

function renderIcon(size, { maskable }) {
  const SS = 4;
  const W = size * SS;
  const buf = new Float32Array(W * W * 4); // rgba 0..255, a 0..255

  const radius = maskable ? 0 : size * 0.22 * SS;
  const artScale = maskable ? 0.7 : 0.9;
  const scale = W;
  const center = W / 2;

  const mapPoint = ([nx, ny]) => [
    center + (nx * scale - center) * artScale,
    center + (ny * scale - center) * artScale,
  ];
  const pts = ECG.map(mapPoint);
  const strokeW = STROKE_W * scale * artScale;
  const dotR = DOT_R * scale * artScale;

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;

      // background
      const bgIn = maskable ? true : insideRoundedRect(px, py, W, radius);
      if (bgIn) {
        blend(buf, i, COLORS.bg, 1);
      }

      // ECG polyline
      let d = Infinity;
      for (let s = 0; s < pts.length - 1; s++) {
        const [ax, ay] = pts[s];
        const [bx, by] = pts[s + 1];
        d = Math.min(d, distToSegment(px, py, ax, ay, bx, by));
      }
      if (d <= strokeW / 2) {
        blend(buf, i, COLORS.red, 1);
      }

      // end dots
      const [fx, fy] = pts[0];
      const [lx, ly] = pts[pts.length - 1];
      if (Math.hypot(px - fx, py - fy) <= dotR) blend(buf, i, COLORS.cyan, 1);
      if (Math.hypot(px - lx, py - ly) <= dotR) blend(buf, i, COLORS.amber, 1);
    }
  }

  // down-sample
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * W + (x * SS + sx)) * 4;
          r += buf[i];
          g += buf[i + 1];
          b += buf[i + 2];
          a += buf[i + 3];
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

// --- Minimal PNG encoder ------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLen = size * 4 + 1;
  const raw = Buffer.alloc(rowLen * size);
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // filter: none
    rgba.copy(raw, y * rowLen + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'maskable-512.png', size: 512, maskable: true },
];

for (const t of targets) {
  const rgba = renderIcon(t.size, { maskable: t.maskable });
  const png = encodePng(rgba, t.size);
  writeFileSync(resolve(OUT_DIR, t.file), png);
  console.log(`wrote icons/${t.file} (${png.length} bytes)`);
}
