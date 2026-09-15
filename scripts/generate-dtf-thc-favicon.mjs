import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const SIZE = 512;
const outPath = resolve(process.argv[2] || 'site/wordpress/assets/brand/dtf-thc-potleaf-512.png');
const rgba = new Uint8Array(SIZE * SIZE * 4);

const palette = {
  bg: [7, 21, 13, 255],
  leaf: [75, 214, 105, 255],
  edge: [217, 255, 224, 255],
  text: [255, 255, 255, 255],
};

function setPixel(x, y, color) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const index = (y * SIZE + x) * 4;
  rgba[index] = color[0];
  rgba[index + 1] = color[1];
  rgba[index + 2] = color[2];
  rgba[index + 3] = color[3];
}

function fill(color) {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) setPixel(x, y, color);
  }
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const hit = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi);
    if (hit) inside = !inside;
  }
  return inside;
}

function polygon(points, color) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(SIZE - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(SIZE - 1, Math.ceil(Math.max(...ys)));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInPolygon(x + 0.5, y + 0.5, points)) setPixel(x, y, color);
    }
  }
}

function thickLine(x0, y0, x1, y1, width, color) {
  const minX = Math.floor(Math.min(x0, x1) - width);
  const maxX = Math.ceil(Math.max(x0, x1) + width);
  const minY = Math.floor(Math.min(y0, y1) - width);
  const maxY = Math.ceil(Math.max(y0, y1) + width);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lengthSquared = dx * dx + dy * dy;
  const radiusSquared = (width / 2) ** 2;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let t = lengthSquared ? (((x - x0) * dx + (y - y0) * dy) / lengthSquared) : 0;
      t = Math.max(0, Math.min(1, t));
      const px = x0 + t * dx;
      const py = y0 + t * dy;
      if ((x - px) ** 2 + (y - py) ** 2 <= radiusSquared) setPixel(x, y, color);
    }
  }
}

function blade(cx, cy, tx, ty, halfWidth, color) {
  const dx = tx - cx;
  const dy = ty - cy;
  const length = Math.hypot(dx, dy);
  const nx = -dy / length;
  const ny = dx / length;
  const mx = cx + dx * 0.55;
  const my = cy + dy * 0.55;

  polygon([
    [cx, cy],
    [mx + nx * halfWidth, my + ny * halfWidth],
    [tx, ty],
    [mx - nx * halfWidth, my - ny * halfWidth],
  ], palette.edge);

  const inset = 8;
  polygon([
    [cx + dx * 0.035, cy + dy * 0.035],
    [mx + nx * (halfWidth - inset), my + ny * (halfWidth - inset)],
    [tx - dx * 0.035, ty - dy * 0.035],
    [mx - nx * (halfWidth - inset), my - ny * (halfWidth - inset)],
  ], color);
}

fill(palette.bg);

const center = [256, 304];
blade(...center, 256, 58, 42, palette.leaf);
blade(...center, 190, 94, 38, palette.leaf);
blade(...center, 322, 94, 38, palette.leaf);
blade(...center, 132, 154, 34, palette.leaf);
blade(...center, 380, 154, 34, palette.leaf);
blade(...center, 92, 226, 30, palette.leaf);
blade(...center, 420, 226, 30, palette.leaf);
thickLine(256, 292, 256, 350, 18, palette.edge);
thickLine(256, 296, 256, 350, 10, palette.leaf);

const font = {
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
};
const scale = 18;
const gap = 18;
const glyphWidth = 5 * scale;
const totalWidth = glyphWidth * 3 + gap * 2;
let textX = Math.floor((SIZE - totalWidth) / 2);
const textY = 370;

for (const character of 'THC') {
  const rows = font[character];
  for (let row = 0; row < 7; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      if (rows[row][column] !== '1') continue;
      for (let yy = 0; yy < scale; yy += 1) {
        for (let xx = 0; xx < scale; xx += 1) {
          setPixel(textX + column * scale + xx, textY + row * scale + yy, palette.text);
        }
      }
    }
  }
  textX += glyphWidth + gap;
}

function crc32(buffer) {
  let checksum = 0xffffffff;
  for (const byte of buffer) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      checksum = (checksum >>> 1) ^ (0xedb88320 & -(checksum & 1));
    }
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y += 1) {
  const row = y * (SIZE * 4 + 1);
  raw[row] = 0;
  Buffer.from(rgba.buffer, y * SIZE * 4, SIZE * 4).copy(raw, row + 1);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, png);
console.log(`Generated THC potleaf favicon: ${outPath} (${SIZE}x${SIZE}, ${png.length} bytes)`);
