import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const SRC = new URL('./icon.svg', import.meta.url).pathname;
const OUT = new URL('../public/', import.meta.url).pathname;
await mkdir(OUT + 'icons', { recursive: true });

const jobs = [
  { file: 'icons/icon-192.png', size: 192 },
  { file: 'icons/icon-512.png', size: 512 },
  { file: 'icons/apple-touch-icon.png', size: 180 },
  // maskable: obsah zmenšený do bezpečné zóny na plném gradientu
  { file: 'icons/icon-maskable-512.png', size: 512, maskable: true },
];

for (const { file, size, maskable } of jobs) {
  if (maskable) {
    const inner = await sharp(SRC).resize(Math.round(size * 0.78)).png().toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: '#4f46e5' } })
      .composite([{ input: inner, gravity: 'center' }])
      .png().toFile(OUT + file);
  } else {
    await sharp(SRC).resize(size).png().toFile(OUT + file);
  }
  console.log('OK', file);
}

// favicon
await sharp(SRC).resize(64).png().toFile(OUT + 'favicon.png');
console.log('OK favicon.png');
