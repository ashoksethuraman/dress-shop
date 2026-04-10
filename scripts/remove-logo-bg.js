/**
 * Removes the cream/white background from app-logo.jpeg and saves
 * a transparent PNG as client/public/app-logo.png
 *
 * Run once:  node scripts/remove-logo-bg.js
 * Requires:  npm install jimp  (run in the repo root first)
 */

const { Jimp } = require('jimp');
const path = require('path');

const INPUT  = path.join(__dirname, '../client/public/app-logo.jpeg');
const OUTPUT = path.join(__dirname, '../client/public/app-logo.png');

const TOLERANCE = 60;

async function run() {
  const img = await Jimp.read(INPUT);

  // Sample background colour from a safe corner pixel
  const bgColor = img.getPixelColor(2, 2);
  const bgR = (bgColor >>> 24) & 0xff;
  const bgG = (bgColor >>> 16) & 0xff;
  const bgB = (bgColor >>>  8) & 0xff;
  console.log(`Background sample: rgb(${bgR}, ${bgG}, ${bgB})`);

  img.scan(0, 0, img.width, img.height, function (x, y, idx) {
    const r = this.bitmap.data[idx + 0];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    const dist = Math.sqrt(
      Math.pow(r - bgR, 2) +
      Math.pow(g - bgG, 2) +
      Math.pow(b - bgB, 2),
    );
    if (dist < TOLERANCE) {
      this.bitmap.data[idx + 3] = 0; // fully transparent
    }
  });

  await img.write(OUTPUT);
  console.log(`✅  Saved transparent PNG → ${OUTPUT}`);
}

run().catch((err) => console.error('❌  Error:', err.message));
