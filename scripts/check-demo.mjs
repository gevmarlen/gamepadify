import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, firefox, webkit } from '@playwright/test';

const url = process.env.DEMO_URL ?? 'http://127.0.0.1:4174/gamepadify/';
const screenshots = process.env.DEMO_SCREENSHOT_DIR ?? 'docs';
const preview = process.env.DEMO_URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', 'demo', '--base=/gamepadify/', '--host', '127.0.0.1', '--port', '4174', '--strictPort'], { stdio: 'pipe' });
let previewLog = '';
preview?.stdout.on('data', chunk => { previewLog += chunk; });
preview?.stderr.on('data', chunk => { previewLog += chunk; });

try {
  if (preview) {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      assert.equal(preview.exitCode, null, previewLog);
      try { ready = (await fetch(url)).ok; } catch { /* Server is starting. */ }
      if (ready) break;
      await delay(200);
    }
    assert(ready, previewLog);
  }
  await mkdir(screenshots, { recursive: true });
  await mkdir('.artifacts', { recursive: true });
  for (const [name, browserType] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await browserType.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const press = async key => { await page.keyboard.press(key, { delay: 65 }); await page.waitForTimeout(50); };
      const mode = () => page.locator('#mode').textContent();
      const visible = () => page.locator('#collection .world:visible').evaluateAll(cards => cards.map(card => card.dataset.world));
      const settle = () => page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
      const simulate = async () => {
        await page.locator('#simulate').click();
        await page.waitForFunction(() => document.querySelector('#mode').textContent === 'GAMEPAD MODE');
        await page.waitForTimeout(140);
      };
      await page.goto(url);
      await page.bringToFront();
      assert.equal(await page.locator('.brand-mark').getAttribute('src'), await page.locator('link[rel=icon]').getAttribute('href'));
      assert(await page.locator('.brand-mark').evaluate(image => image.complete && image.naturalWidth > 0));
      assert.equal(await page.locator('#body-class, #element-class, #conflict, #favorite, #duplicate').count(), 0);
      await simulate();
      await page.waitForFunction(() => {
        const images = [...document.querySelectorAll('.gamepadify-glyph img')];
        return images.length >= 3 && images.every(image => image.complete && image.naturalWidth > 0);
      });
      if (name === 'chromium') await page.screenshot({ path: `${screenshots}/playground.png`, fullPage: true });
      await press('ArrowRight');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.world), 'Orbit');
      await press('z');
      await page.waitForFunction(() => document.querySelector('dialog').open);
      assert.equal(await page.locator('#detail-title').textContent(), 'Orbit');
      assert.equal(await page.locator('dialog .gamepadify-glyph[data-button=east]').count(), 1);
      assert.equal(await page.locator('dialog .gamepadify-glyph[data-button=south]').count(), 0);
      await press('v');
      await page.waitForFunction(() => !document.querySelector('dialog').open);
      await press('x');
      assert.equal(await page.locator('#help').getAttribute('aria-expanded'), 'true');
      assert(await page.locator('#help-panel').isVisible());
      assert.equal(await page.locator('.gamepadify-glyph').count(), 1, 'help scope must hide background prompts');
      if (name === 'chromium') await page.screenshot({ path: '.artifacts/playground-help.png', fullPage: true });
      await press('v');
      assert(!(await page.locator('#help-panel').isVisible()));
      const nativeFocus = () => page.evaluate(() => ({ tag: document.activeElement.tagName, id: document.activeElement.id }));
      await page.locator('#size').click();
      const settingsFocus = await nativeFocus();
      await page.locator('[data-pad-button=west]').click();
      await page.waitForFunction(() => !document.querySelector('#help-panel').hidden);
      await page.locator('#size').click();
      assert(!(await page.locator('#help-panel').isVisible()));
      assert.deepEqual(await nativeFocus(), settingsFocus, 'dismissing help must preserve native settings focus');
      assert.equal(await mode(), 'GAMEPAD MODE');

      await page.locator('.panel-heading', { hasText: 'Make it yours' }).hover();
      assert.equal(await mode(), 'GAMEPAD MODE');
      assert.equal(await page.locator('#settings').evaluate(element => getComputedStyle(element).cursor), 'auto');
      await page.locator('#show-hints').uncheck();
      assert.equal(await mode(), 'GAMEPAD MODE');
      assert.equal(await page.locator('.gamepadify-hint').count(), 0);
      await page.locator('#show-hints').check();
      const range = await page.locator('#size').boundingBox();
      await page.mouse.click(range.x + range.width * .8, range.y + range.height / 2);
      assert.equal(await mode(), 'GAMEPAD MODE');
      assert(Number(await page.locator('#size').inputValue()) > 24);
      await page.locator('#size').focus();
      await press('ArrowLeft');
      assert.equal(await mode(), 'GAMEPAD MODE', 'native settings keyboard input must preserve controller mode');
      for (const [artwork, symbol] of [['playstation', '×'], ['switch', 'B'], ['auto', 'A']]) {
        await page.locator('#skin').selectOption(artwork);
        assert.equal(await page.locator('.face-south').textContent(), symbol);
        assert.equal(await mode(), 'GAMEPAD MODE');
      }
      await page.locator('#skin').selectOption('custom');
      await page.waitForFunction(() => [...document.querySelectorAll('.gamepadify-glyph img')].every(image => image.complete && image.naturalWidth > 0 && image.src.startsWith('data:image/svg+xml')));
      await page.locator('#skin').selectOption('auto');
      await page.locator('#placement').selectOption('bottom-end');
      assert.equal(await mode(), 'GAMEPAD MODE');
      await page.locator('[data-pad-button=left-shoulder]').click();
      await page.waitForFunction(() => document.activeElement.id === 'search');
      assert.equal(await mode(), 'GAMEPAD MODE');

      await page.locator('#search').click();
      assert.equal(await mode(), 'POINTER MODE', 'pointer input in the preview must still exit controller mode');
      await page.locator('#search').fill('o');
      await page.waitForFunction(() => document.querySelector('#collection-count').textContent === '4 worlds');
      assert.deepEqual(await visible(), ['Orbit', 'Mono', 'Bloom', 'Echo']);
      assert(await page.evaluate(() => document.getAnimations().some(animation => animation.playState === 'running')), 'filter must animate its layout');
      await page.locator('#search').fill('orb');
      await page.locator('#search').fill('missing');
      await page.locator('#search').fill('tide');
      await page.waitForFunction(() => document.querySelector('#collection-count').textContent === '1 world');
      assert.deepEqual(await visible(), ['Tide']);
      assert(await page.locator('#shuffle').isDisabled());
      await page.locator('#search').fill('missing');
      await page.waitForFunction(() => !document.querySelector('#empty-collection').hidden);
      assert.deepEqual(await visible(), []);
      await page.locator('#clear-search').click();
      await page.waitForFunction(() => document.querySelector('#collection-count').textContent === '6 worlds');
      await settle();
      await simulate();
      const before = await visible();
      const focused = await page.evaluate(() => document.activeElement.dataset.world);
      await press('c');
      assert.notDeepEqual(await visible(), before);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.world), focused);
      assert(await page.evaluate(() => document.getAnimations().some(animation => animation.playState === 'running')), 'shuffle must animate its layout');
      await settle();
      await page.locator('[data-pad-button=west]').click();
      await page.waitForFunction(() => !document.querySelector('#help-panel').hidden);
      await page.locator('[data-pad-button=east]').click();
      await page.waitForFunction(() => document.querySelector('#help-panel').hidden);
      await page.waitForTimeout(120);
      await page.locator('[data-pad-button=south]').click();
      await page.waitForFunction(() => document.querySelector('dialog').open);
      await press('v');
      await page.waitForFunction(() => !document.querySelector('dialog').open);
      await page.locator('[data-pad-direction=down]').click();
      await page.waitForTimeout(150);
      assert.equal(await page.locator('#virtual-pad .pressed').count(), 0);
      await page.keyboard.down('ArrowDown');
      await page.waitForFunction(() => document.querySelector('.direction-down').classList.contains('pressed'));
      await page.keyboard.up('ArrowDown');

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.locator('#search').fill('orbit');
      await page.waitForFunction(() => document.querySelector('#collection-count').textContent === '1 world');
      assert.deepEqual(await visible(), ['Orbit']);
      assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      await page.locator('#clear-search').click();
      await simulate();
      await press('c');
      assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('#stage').scrollIntoViewIfNeeded();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile layout must not overflow');
      if (name === 'chromium') {
        await page.screenshot({ path: '.artifacts/demo-mobile.png', fullPage: true });
        await page.locator('.preview-column').screenshot({ path: '.artifacts/playground-mobile.png' });
      }
      await page.locator('#hardware').click();
      assert(!(await page.locator('#simulator').isVisible()));
      assert.equal(await mode(), 'POINTER MODE');
      assert.deepEqual(errors, []);
      console.log(`Demo ${name}: controls, B/back, help scope, settings isolation, search, animated shuffle, virtual inputs, skins, reduced motion and mobile layout passed.`);
    } finally { await browser.close(); }
  }
} finally { preview?.kill(); }
