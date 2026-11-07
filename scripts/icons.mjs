// Génère les icônes PNG à partir de public/icons/icon.svg (nécessite Playwright).
// Usage : npm run icons
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
// Version plein cadre (sans coins arrondis) : iOS et Android arrondissent eux-mêmes.
const square = svg.replace('rx="27"', 'rx="0"');
const out = [
  ['icon-192.png', 192, svg],
  ['icon-512.png', 512, svg],
  ['maskable-512.png', 512, square.replace('<rect width="120" height="120" rx="0" fill="#1F5C52"/>', '<rect width="120" height="120" fill="#1F5C52"/>').replace(/<circle cx="60"[^>]*\/>|<path[^>]*\/>/g, (m) => `<g transform="translate(12 12) scale(.8)">${m}</g>`)],
  ['apple-touch-icon.png', 180, square],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, src] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${src}`);
  await page.screenshot({ path: new URL(`../public/icons/${name}`, import.meta.url).pathname, omitBackground: true });
}
await browser.close();
console.log('Icônes générées.');
