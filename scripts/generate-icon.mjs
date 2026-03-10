import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pngPath = join(root, 'public', 'inked-logo.png');
const svgPath = join(root, 'public', 'inked-icon.svg');
const outDir = join(root, 'build');
const outPath = join(outDir, 'icon.png');

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('sharp not installed; run: npm install --save-dev sharp');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const publicDir = join(root, 'public');
mkdirSync(publicDir, { recursive: true });
let input;
try {
  input = readFileSync(pngPath);
} catch {
  input = readFileSync(svgPath);
}
const img = sharp(input);
const png1024 = await img.resize(1024, 1024).png().toBuffer();
writeFileSync(outPath, png1024);
const png512 = await sharp(input).resize(512, 512).png().toBuffer();
writeFileSync(join(publicDir, 'pwa-512.png'), png512);
const png192 = await sharp(input).resize(192, 192).png().toBuffer();
writeFileSync(join(publicDir, 'pwa-192.png'), png192);

// Generate macOS .icns for Electron app icon
const iconset = join(outDir, 'icon.iconset');
mkdirSync(iconset, { recursive: true });
const sizes = [
  [16, 'icon_16x16.png'],
  [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'],
  [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'],
  [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'],
  [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png'],
];
for (const [size, name] of sizes) {
  const buf = await sharp(input).resize(size, size).png().toBuffer();
  writeFileSync(join(iconset, name), buf);
}
execSync(`iconutil -c icns "${iconset}" -o "${join(outDir, 'icon.icns')}"`);
rmSync(iconset, { recursive: true });

console.log('Wrote build/icon.png, build/icon.icns, public/pwa-192.png, public/pwa-512.png');
