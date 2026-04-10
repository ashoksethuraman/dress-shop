/**
 * Generates client/public/favicon.png — the app logo composited on top of
 * the brand green background (#DAF9DE), sized 64×64 px for browser tabs.
 */
const { Jimp } = require('jimp');
const path = require('path');

const INPUT  = path.join(__dirname, '../client/public/app-logo.png');
const OUTPUT = path.join(__dirname, '../client/public/favicon.png');

const SIZE = 64;
// Brand green from tailwind.config.js
const BG_COLOR = 0xDAF9DEff; // RGBA hex

(async () => {
  // Create brand-green background
  const bg = new Jimp({ width: SIZE, height: SIZE, color: BG_COLOR });

  // Load logo and resize to fit inside with padding
  const logo = await Jimp.read(INPUT);
  const pad  = 6;
  logo.resize({ w: SIZE - pad * 2, h: SIZE - pad * 2 });

  // Composite logo centred on background
  bg.composite(logo, pad, pad);

  await bg.write(OUTPUT);
  console.log('✅ favicon.png written to', OUTPUT);
})();
