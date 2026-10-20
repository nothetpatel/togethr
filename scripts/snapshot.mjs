// Saves today's screenshots of the app to progress/, to track how it grows.
// Usage: npm run snapshot   →  progress/2026-10-19-desktop.png, -mobile.png

import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = new URL('../progress/', import.meta.url);

const now = new Date();
const date = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
].join('-');

const viewports = [
  { name: 'desktop', width: 1280, height: 800, deviceScaleFactor: 2 },
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 3 },
];

const server = await createServer({
  root,
  logLevel: 'error',
  server: { port: 5199, strictPort: true },
});
await server.listen();

// Real GPU (Metal) on macOS; SwiftShader software WebGL elsewhere.
const glArgs =
  process.platform === 'darwin'
    ? ['--use-angle=metal', '--enable-gpu']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: glArgs });

try {
  await mkdir(outDir, { recursive: true });
  for (const { name, ...viewport } of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.deviceScaleFactor });
    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas');
    await page.waitForTimeout(2500); // let models load and shadows settle
    const file = new URL(`${date}-${name}.png`, outDir);
    await page.screenshot({ path: fileURLToPath(file) });
    console.log(`saved progress/${date}-${name}.png`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
