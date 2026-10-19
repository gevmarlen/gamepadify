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
      const warnings = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'warning' && message.text().startsWith('[gamepadify:')) warnings.push(message.text()); });
      await page.addInitScript(() => {
        window.__demoAnimations = [];
        window.__demoPopupEvents = [];
        for (const type of ['animationstart', 'transitionrun']) document.addEventListener(type, event => {
          if (event.target.matches('#detail-dialog, #menu-panel, #help-panel')) window.__demoPopupEvents.push({ id: event.target.id, type });
        });
        const animate = Element.prototype.animate;
        Element.prototype.animate = function (...args) {
          const animation = animate.apply(this, args);
          if (this.matches('#collection > .world, .demo-page, #detail-dialog')) window.__demoAnimations.push({
            target: this.id || this.className,
            duration: animation.effect.getTiming().duration,
            delay: animation.effect.getTiming().delay,
            moves: animation.effect.getKeyframes().some(frame => frame.transform && frame.transform !== 'none'),
          });
          return animation;
        };
      });
      const keyTargets = { ArrowRight: '.direction-right', ArrowLeft: '.direction-left', ArrowDown: '.direction-down', ArrowUp: '.direction-up', z: '.face-south', v: '.face-east', x: '.face-west', c: '.face-north', q: '.pad-shoulder' };
      const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const press = async key => {
        const native = await page.evaluate(() => document.activeElement.matches('input, select, textarea, [contenteditable]'));
        if (native) { await page.keyboard.press(key); return; }
        const target = keyTargets[key];
        assert(target, `Missing simulator selector for ${key}`);
        await page.keyboard.down(key);
        try { await page.waitForFunction(selector => document.querySelector(selector).classList.contains('pressed'), target); }
        finally { await page.keyboard.up(key); }
        await page.waitForFunction(selector => !document.querySelector(selector).classList.contains('pressed'), target);
      };
      const animationCount = () => page.evaluate(() => window.__demoAnimations.length);
      const animatedSince = count => page.evaluate(index => window.__demoAnimations.slice(index).some(animation => animation.moves && animation.duration > 0), count);
      const mode = () => page.locator('#mode').textContent();
      const visible = () => page.locator('#collection .world:visible').evaluateAll(cards => cards.map(card => card.dataset.world));
      const settle = () => page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
      const closedPanel = async id => {
        const panel = page.locator(`#${id}`);
        assert(await panel.evaluate(element => element.hidden && element.inert), 'closing panels must stop accepting input immediately');
        await panel.waitFor({ state: 'hidden' });
      };
      const route = async key => {
        try { await page.waitForFunction(value => location.hash === `#/${value}`, key); }
        catch (error) {
          await mkdir('test-results', { recursive: true });
          await page.screenshot({ path: `test-results/demo-${name}-route.png`, fullPage: true });
          console.error(await page.evaluate(() => ({
            hash: location.hash,
            mode: document.querySelector('#mode').textContent,
            focused: document.activeElement.outerHTML,
            back: document.querySelector('#back-page').getBoundingClientRect().toJSON(),
            viewport: { width: innerWidth, height: innerHeight, scrollY },
            events: document.querySelector('#log').textContent,
          })));
          throw error;
        }
        await frames();
        assert.equal(await page.locator('[data-page]:visible').count(), 1);
      };
      const simulate = async () => {
        await page.locator('#simulate').click();
        await page.waitForFunction(() => document.querySelector('#mode').textContent === 'GAMEPAD MODE');
        await frames();
      };
      await page.goto(url);
      await page.bringToFront();
      const hasGamepadApi = await page.evaluate(() => typeof navigator.getGamepads === 'function');
      assert.equal(await page.locator('.brand-mark').getAttribute('src'), await page.locator('link[rel=icon]').getAttribute('href'));
      assert(await page.locator('.brand-mark').evaluate(image => image.complete && image.naturalWidth > 0));
      assert.equal(await page.locator('#body-class, #element-class, #conflict, #favorite, #duplicate, #search, #clear-search').count(), 0);
      assert.equal(await page.locator('#stage input, #stage textarea').count(), 0);
      await simulate();
      const stationaryPointer = { bubbles: true, pointerType: 'mouse', clientX: 100, clientY: 100 };
      await page.locator('#settings').dispatchEvent('pointermove', stationaryPointer);
      await page.locator('#stage').dispatchEvent('pointermove', stationaryPointer);
      assert.equal(await mode(), 'GAMEPAD MODE', 'scrolling under a stationary pointer must preserve controller mode');
      await page.waitForFunction(() => {
        const images = [...document.querySelectorAll('.gamepadify-glyph img')];
        return images.length >= 3 && images.every(image => image.complete && image.naturalWidth > 0);
      });
      await settle();
      if (name === 'chromium') await page.screenshot({ path: `${screenshots}/playground.png`, fullPage: true });
      await press('ArrowRight');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.world), 'Orbit');
      await press('z');
      await page.waitForFunction(() => document.querySelector('dialog').open);
      assert.equal(await page.locator('#detail-title').textContent(), 'Orbit');
      await page.waitForFunction(() => window.__demoPopupEvents.some(event => event.id === 'detail-dialog' && event.type === 'animationstart'));
      assert.equal(await page.locator('dialog .gamepadify-glyph[data-button=east]').count(), 1);
      assert.equal(await page.locator('dialog .gamepadify-glyph[data-button=south]').count(), 0);
      await press('v');
      await page.waitForFunction(() => !document.querySelector('dialog').open);
      assert(await page.evaluate(() => window.__demoAnimations.some(animation => animation.target === 'detail-dialog' && animation.moves)), 'dialog dismissal must animate');
      await press('x');
      assert.equal(await page.locator('#help').getAttribute('aria-expanded'), 'true');
      assert(await page.locator('#help-panel').isVisible());
      assert.equal(await page.locator('.gamepadify-glyph').count(), 1, 'help scope must hide background prompts');
      if (name === 'chromium') await page.screenshot({ path: '.artifacts/playground-help.png', fullPage: true });
      await press('v');
      await closedPanel('help-panel');
      assert(await page.evaluate(() => window.__demoPopupEvents.filter(event => event.id === 'help-panel' && event.type === 'transitionrun').length >= 4), 'help must transition on entry and exit');
      const nativeFocus = () => page.evaluate(() => ({ tag: document.activeElement.tagName, id: document.activeElement.id }));
      await page.locator('#size').click();
      const settingsFocus = await nativeFocus();
      await page.locator('[data-pad-button=west]').click();
      await page.waitForFunction(() => !document.querySelector('#help-panel').hidden);
      await page.locator('#size').click();
      await closedPanel('help-panel');
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
      await page.waitForFunction(() => !document.querySelector('#menu-panel').hidden);
      await page.waitForFunction(() => document.querySelectorAll('.gamepadify-glyph').length === 3);
      assert.equal(await mode(), 'GAMEPAD MODE');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.route), 'collection');
      assert.equal(await page.locator('.gamepadify-glyph').count(), 3, 'menu must contain only LB, B and the selected link prompt');
      const menuOrder = await visible();
      await press('c');
      assert.deepEqual(await visible(), menuOrder, 'menu scope must block background shortcuts');
      await press('q');
      await closedPanel('menu-panel');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.world), 'Orbit');
      await press('q');
      await press('v');
      await closedPanel('menu-panel');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.world), 'Orbit');

      await press('q');
      await page.locator('#size').click();
      await closedPanel('menu-panel');
      assert.deepEqual(await nativeFocus(), settingsFocus, 'dismissing the menu must preserve native settings focus');
      assert.equal(await mode(), 'GAMEPAD MODE');
      await page.locator('[data-pad-button=left-shoulder]').click();
      await page.waitForFunction(() => !document.querySelector('#menu-panel').hidden);
      await settle();
      if (name === 'chromium') await page.locator('.preview-column').screenshot({ path: '.artifacts/playground-menu.png' });
      const pageTransition = await animationCount();
      await press('ArrowDown');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.route), 'journeys');
      await press('z');
      await route('journeys');
      await closedPanel('menu-panel');
      assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'), 'false');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.route), 'journeys/slow');
      assert(await animatedSince(pageTransition), 'page changes must animate');
      await settle();
      if (name === 'chromium') await page.locator('.preview-column').screenshot({ path: '.artifacts/playground-journeys.png' });
      await press('z');
      await route('journeys/slow');
      assert.deepEqual(await visible(), ['Dune', 'Tide', 'Bloom']);
      assert.equal(await page.locator('#collection-count').textContent(), '3 worlds');
      assert.equal(await page.locator('#back-page').textContent(), '← Back to journeys');
      await press('z');
      await page.waitForFunction(() => document.querySelector('dialog').open);
      assert.equal(await page.locator('#detail-title').textContent(), 'Dune');
      await press('v');
      await page.waitForFunction(() => !document.querySelector('dialog').open);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.world), 'Dune');
      await press('v');
      await route('journeys');
      await press('q');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.route), 'journeys');
      await press('ArrowDown');
      await press('z');
      await route('journal');
      assert.equal(await page.locator('#journal-count').textContent(), '2 / 6 visited');
      assert.deepEqual(await page.locator('#journal-list [data-world]').evaluateAll(cards => cards.map(card => card.dataset.world)), ['Orbit', 'Dune']);
      await settle();
      if (name === 'chromium') await page.locator('.preview-column').screenshot({ path: '.artifacts/playground-journal.png' });
      await press('z');
      await page.waitForFunction(() => document.querySelector('dialog').open);
      assert.equal(await page.locator('#detail-title').textContent(), 'Orbit');
      assert.equal(await page.locator('#close-dialog').textContent(), 'Back to journal');
      await press('v');
      await page.waitForFunction(() => !document.querySelector('dialog').open);
      assert.equal(await page.locator('#journal-count').textContent(), '2 / 6 visited');
      await press('ArrowDown');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'clear-journal');
      await press('z');
      assert(await page.locator('#empty-journal').isVisible());
      assert.equal(await page.locator('#journal-list [data-world]').count(), 0);
      await press('z');
      await route('collection');
      await page.goBack();
      await route('journal');
      assert(await page.locator('#empty-journal').isVisible());
      await page.goForward();
      await route('collection');
      assert.equal(await mode(), 'GAMEPAD MODE');
      await settle();
      const before = await visible();
      const focused = await page.evaluate(() => document.activeElement.dataset.world);
      const shuffling = await animationCount();
      await press('c');
      assert.notDeepEqual(await visible(), before);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.world), focused);
      assert(await animatedSince(shuffling), 'shuffle must animate its layout');
      assert(await page.evaluate(index => window.__demoAnimations.slice(index).some(animation => animation.delay > 0), shuffling), 'shuffle must stagger card movement');
      await press('c');
      await press('c');
      assert.equal(new Set(await visible()).size, 6, 'repeated shuffle must preserve every world');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.world), focused, 'repeated shuffle must preserve gamepad focus');
      await settle();
      await page.locator('[data-pad-button=west]').click();
      await page.waitForFunction(() => !document.querySelector('#help-panel').hidden);
      await page.locator('[data-pad-button=east]').click();
      await page.waitForFunction(() => document.querySelector('#help-panel').hidden);
      await page.locator('[data-pad-button=south]').click();
      await page.waitForFunction(() => document.querySelector('dialog').open);
      await press('v');
      await page.waitForFunction(() => !document.querySelector('dialog').open);
      await page.locator('[data-pad-direction=down]').click();
      await frames();
      assert.equal(await page.locator('#virtual-pad .pressed').count(), 0);
      await page.keyboard.down('ArrowDown');
      await page.waitForFunction(() => document.querySelector('.direction-down').classList.contains('pressed'));
      await page.keyboard.up('ArrowDown');

      await press('z');
      await page.waitForFunction(() => document.querySelector('dialog').open);
      await press('v');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => !document.querySelector('dialog').open);
      assert.equal(await page.evaluate(() => document.getAnimations().length), 0, 'reduced motion must finish an in-progress dialog dismissal');
      await press('c');
      assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      await press('q');
      await press('ArrowDown');
      await press('z');
      await route('journeys');
      assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
      await press('v');
      await route('collection');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('#stage').scrollIntoViewIfNeeded();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile layout must not overflow');
      if (name === 'chromium') {
        await page.screenshot({ path: '.artifacts/demo-mobile.png', fullPage: true });
        await page.locator('.preview-column').screenshot({ path: '.artifacts/playground-mobile.png' });
      }
      await press('q');
      assert(await page.locator('#menu-panel').isVisible());
      const menu = await page.locator('#menu-panel').boundingBox();
      assert(menu.x >= 0 && menu.x + menu.width <= 390, 'mobile menu must fit the viewport');
      await press('ArrowDown');
      await press('z');
      await route('journeys');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile journeys must not overflow');
      await settle();
      if (name === 'chromium') await page.locator('.preview-column').screenshot({ path: '.artifacts/playground-journeys-mobile.png' });
      await press('v');
      await route('collection');
      await page.locator('#hardware').click();
      assert(!(await page.locator('#simulator').isVisible()));
      assert.equal(await mode(), 'POINTER MODE');
      await page.locator('#menu-toggle').click();
      await page.keyboard.press('Escape');
      await closedPanel('menu-panel');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'menu-toggle');
      await page.locator('#menu-toggle').click();
      await page.locator('.page-links [data-route=journeys]').focus();
      await page.keyboard.press('Enter');
      await route('journeys');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'page-title');
      await page.goto(`${url}#/journeys/motion`);
      await page.reload();
      await page.bringToFront();
      await route('journeys/motion');
      assert.deepEqual(await visible(), ['Orbit', 'Tide', 'Echo']);
      await simulate();
      await press('v');
      await route('journeys');
      await page.locator('#help').hover();
      assert.equal(await mode(), 'POINTER MODE', 'pointer input in the preview must still exit controller mode');
      assert.deepEqual(warnings.filter(message => hasGamepadApi || !message.startsWith('[gamepadify:unavailable]')), [], 'page and overlay shortcuts must not conflict');
      assert.deepEqual(errors, []);
      console.log(`Demo ${name}: LB menu, gamepad-only pages, journeys, journal, history, deep links, scoped controls, settings, animations, skins and mobile layout passed.`);
    } finally { await browser.close(); }
  }
} finally { preview?.kill(); }
