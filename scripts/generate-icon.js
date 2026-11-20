#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table for PNG chunks
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePngRgba(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter None
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

// Signed distance to a chamfered box centered at (0, 0) with half-extents (hx, hy) and chamfer c
function sdChamferBox(x, y, hx, hy, c) {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const dx = ax - hx;
  const dy = ay - hy;
  const dBox = Math.max(dx, dy);
  const dDiag = (ax + ay - (hx + hy - c)) * Math.SQRT1_2;
  return Math.max(dBox, dDiag);
}

function pointInRect(x, y, x0, y0, x1, y1) {
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

// Sample normalized coordinates u, v in [-1, 1] with 4x4 supersampling for crisp edges at all sizes
function samplePixel(u, v) {
  // Outer chamfered emblem
  const dOuter = sdChamferBox(u, v, 0.90, 0.90, 0.28);
  if (dOuter > 0.0) {
    return [0, 0, 0, 0];
  }

  // Border ring: Cyber Yellow (#FCEE09) top-left, Cyan (#00F0FF) bottom-right
  if (dOuter > -0.075) {
    if (u + v < 0.0) {
      return [252, 238, 9, 255]; // #FCEE09
    }
    return [0, 240, 255, 255]; // #00F0FF
  }

  // Inner dark fill (#06060A) with subtle inner chamfer accent
  let r = 6, g = 6, b = 10;
  if (dOuter > -0.115) {
    r = 16; g = 18; b = 28;
  }

  // Geometric "G" in Cyber Yellow (#FCEE09) on left half: u in [-0.58, -0.06], v in [-0.40, 0.40]
  const t = 0.13; // stroke thickness
  const inG =
    pointInRect(u, v, -0.58, -0.40, -0.06, -0.40 + t) || // top bar
    pointInRect(u, v, -0.58, 0.40 - t, -0.06, 0.40) ||   // bottom bar
    pointInRect(u, v, -0.58, -0.40, -0.58 + t, 0.40) ||  // left bar
    pointInRect(u, v, -0.06 - t, 0.02, -0.06, 0.40) ||   // right lower stem
    pointInRect(u, v, -0.32, 0.02, -0.06, 0.02 + t);     // inner crossbar

  if (inG) {
    return [252, 238, 9, 255]; // #FCEE09
  }

  // Geometric "C" in Cyan (#00F0FF) on right half: u in [0.06, 0.58], v in [-0.40, 0.40]
  const inC =
    pointInRect(u, v, 0.06, -0.40, 0.58, -0.40 + t) ||   // top bar
    pointInRect(u, v, 0.06, 0.40 - t, 0.58, 0.40) ||     // bottom bar
    pointInRect(u, v, 0.06, -0.40, 0.06 + t, 0.40);      // left bar

  if (inC) {
    return [0, 240, 255, 255]; // #00F0FF
  }

  return [r, g, b, 255];
}

function renderIconPng(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const sub = 4;
  const invSub2 = 1 / (sub * sub);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let rAcc = 0, gAcc = 0, bAcc = 0, aAcc = 0;
      for (let sy = 0; sy < sub; sy++) {
        for (let sx = 0; sx < sub; sx++) {
          const fx = (px + (sx + 0.5) / sub) / size;
          const fy = (py + (sy + 0.5) / sub) / size;
          const u = fx * 2.0 - 1.0;
          const v = fy * 2.0 - 1.0;
          const [r, g, b, a] = samplePixel(u, v);
          rAcc += r * (a / 255);
          gAcc += g * (a / 255);
          bAcc += b * (a / 255);
          aAcc += a;
        }
      }
      const aAvg = aAcc * invSub2;
      const idx = (py * size + px) * 4;
      if (aAvg > 0.5) {
        const norm = 255 / aAvg;
        rgba[idx] = Math.min(255, Math.round(rAcc * invSub2 * norm));
        rgba[idx + 1] = Math.min(255, Math.round(gAcc * invSub2 * norm));
        rgba[idx + 2] = Math.min(255, Math.round(bAcc * invSub2 * norm));
        rgba[idx + 3] = Math.min(255, Math.round(aAvg));
      } else {
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
      }
    }
  }
  return encodePngRgba(size, size, rgba);
}

function buildIco(sizes) {
  const images = sizes.map((size) => ({ size, data: renderIconPng(size) }));
  const headerSize = 6;
  const dirEntrySize = 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = 1 (ICO)
  header.writeUInt16LE(images.length, 4);

  let offset = headerSize + dirEntrySize * images.length;
  const entries = [];
  for (const img of images) {
    const entry = Buffer.alloc(dirEntrySize);
    entry[0] = img.size >= 256 ? 0 : img.size;
    entry[1] = img.size >= 256 ? 0 : img.size;
    entry[2] = 0; // color count
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(img.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += img.data.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

function main() {
  const outPath = path.join(__dirname, '..', 'assets', 'gamecheck.ico');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const icoBuf = buildIco([16, 32, 48, 256]);
  fs.writeFileSync(outPath, icoBuf);
  console.log(`Generated ${outPath} (${icoBuf.length} bytes, sizes: 16, 32, 48, 256)`);
}

main();
