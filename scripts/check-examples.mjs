import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
try {
  for (const framework of ['vanilla', 'react', 'vue', 'angular', 'jquery']) {
    const root = path.resolve('examples', framework, framework === 'angular' ? 'dist/browser' : 'dist');
    const server = createServer(async (request, response) => {
      try {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
        response.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' })[path.extname(file)] ?? 'application/octet-stream');
        response.end(await readFile(file));
      } catch { response.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/?simulate`);
      await page.waitForSelector('button');
      const press = async key => { await page.keyboard.press(key, { delay: 60 }); await page.waitForTimeout(50); };
      await press('z'); await press('x');
      assert.equal(await page.locator('output').textContent(), '1 actions', framework);
      await page.waitForFunction(() => [...document.querySelectorAll('.gamepadify-glyph img')].length > 0 && [...document.querySelectorAll('.gamepadify-glyph img')].every(img => img.complete && img.naturalWidth > 0));
      await press('ArrowRight'); await press('z');
      assert.equal(await page.locator('output').textContent(), '2 actions', framework);
      assert.deepEqual(errors, [], framework);
      console.log(`${framework} example: production build, activation, navigation and PNGs passed.`);
    } finally { await page.close(); await new Promise(resolve => server.close(resolve)); }
  }
} finally { await browser.close(); }
