import { createWriteStream } from 'fs';
import { deflateSync } from 'zlib';

function createPNG(size, r, g, b) {
  const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    let crc = 0xffffffff;
    for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
    return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw image data: for each row, filter byte (0) + RGB pixels
  const rawRows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filter type: None
    for (let x = 0; x < size; x++) {
      // Draw a circle
      const cx = size / 2, cy = size / 2, radius = size / 2 - 1;
      const dx = x - cx, dy = y - cy;
      const inCircle = dx * dx + dy * dy <= radius * radius;
      row[1 + x * 3 + 0] = inCircle ? r : 255;
      row[1 + x * 3 + 1] = inCircle ? g : 255;
      row[1 + x * 3 + 2] = inCircle ? b : 255;
    }
    rawRows.push(row);
  }

  const rawData = Buffer.concat(rawRows);
  const compressed = deflateSync(rawData);

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Purple color to match extension theme (#aa3bff)
const R = 0xaa, G = 0x3b, B = 0xff;

for (const size of [16, 48, 128]) {
  const png = createPNG(size, R, G, B);
  const path = `public/icons/icon-${size}.png`;
  createWriteStream(path).write(png);
  console.log(`Created ${path} (${size}x${size})`);
}
