import { expect, test } from '@playwright/test';
import type { GamepadifyController, GamepadifyOptions } from '../../packages/core/src/types.js';
import type { createGamepadSimulator } from '../../packages/core/src/testing.js';

interface Fixture extends Window {
  ready: boolean;
  setup(html: string, options?: GamepadifyOptions, family?: string): void;
  step(frames?: number): Promise<void>;
  tap(...buttons: string[]): Promise<void>;
  pad: GamepadifyController;
  sim: ReturnType<typeof createGamepadSimulator>;
  events: string[];
}

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser/fixture.html');
  await page.waitForFunction(() => (window as Fixture).ready);
  await page.bringToFront();
});

test('one frame shares DOM measurements and leaves registrations unchanged', async ({ page }) => {
  const counts = await page.evaluate(async () => {
    const fixture = window as Fixture;
    const names = ['south', 'west', 'north', 'left-shoulder', 'right-shoulder', 'select', 'start'];
    const html = Array.from({ length: 100 }, (_, index) => `<button style="min-width:30px;margin:3px" data-gamepad="${names.filter((_, bit) => (index + 1) & (1 << bit)).join('+')}">${index}</button>`).join('');
    fixture.setup(html, {}, 'generic');
    await fixture.tap('home'); await fixture.step(5);
    let styles = 0, rects = 0, hits = 0, queries = 0;
    const style = window.getComputedStyle, rect = Element.prototype.getBoundingClientRect, hit = document.elementFromPoint, query = Document.prototype.querySelectorAll;
    window.getComputedStyle = (...args) => { styles++; return style(...args); };
    Element.prototype.getBoundingClientRect = function () { rects++; return rect.call(this); };
    document.elementFromPoint = (...args) => { hits++; return hit.apply(document, args); };
    Document.prototype.querySelectorAll = function (...args) { queries++; return query.apply(this, args); };
    try {
      await fixture.step(6);
      return { styles, rects, hits, queries, restored: document.querySelector<HTMLElement>('.gamepadify-layer')?.style.contentVisibility !== 'hidden' };
    } finally {
      window.getComputedStyle = style; Element.prototype.getBoundingClientRect = rect;
      document.elementFromPoint = hit; Document.prototype.querySelectorAll = query;
    }
  });
  expect(counts.styles).toBeLessThanOrEqual(6 * 110);
  expect(counts.rects).toBeLessThanOrEqual(6 * 104);
  expect(counts.hits).toBeLessThanOrEqual(6 * 101);
  expect(counts.queries).toBe(0);
  expect(counts.restored).toBe(true);
});

test('CSS animation, resizing and occlusion invalidate visibility without rebinding', async ({ page }) => {
  await page.evaluate(async () => {
    const fixture = window as Fixture;
    fixture.setup('<button id="moving" data-gamepad="west">Move</button>', { hints: { placement: 'right', offset: 8 } }, 'generic');
    await fixture.tap('home');
    const button = document.getElementById('moving')!;
    const motion = button.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(200px)' }], { duration: 1000, fill: 'forwards' });
    motion.pause(); motion.currentTime = 500;
    await fixture.step();
  });
  const button = await page.locator('#moving').boundingBox();
  const hint = await page.locator('.gamepadify-hint').boundingBox();
  expect(hint!.x).toBeCloseTo(button!.x + button!.width + 8);
  await page.locator('#moving').evaluate(element => { (element as HTMLElement).style.width = '200px'; });
  await page.evaluate(() => (window as Fixture).step());
  const resized = await page.locator('#moving').boundingBox();
  expect((await page.locator('.gamepadify-hint').boundingBox())!.x).toBeCloseTo(resized!.x + resized!.width + 8);
  await page.evaluate(() => {
    const rect = document.getElementById('moving')!.getBoundingClientRect();
    const cover = document.createElement('div'); cover.id = 'cover';
    Object.assign(cover.style, { position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, background: 'black', zIndex: '10' });
    document.body.append(cover);
  });
  await expect(page.locator('.gamepadify-hint')).toHaveCount(0);
  await page.evaluate(() => (window as Fixture).tap('west'));
  expect(await page.evaluate(() => (window as Fixture).events)).toEqual([]);
  await page.locator('#cover').evaluate(element => element.remove());
  await expect(page.locator('.gamepadify-hint')).toHaveCount(1);
  await page.evaluate(() => {
    const fade = document.getElementById('moving')!.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, fill: 'forwards' });
    fade.pause(); fade.currentTime = 100;
  });
  await expect(page.locator('.gamepadify-hint')).toHaveCount(0);
});

test('restart removes every document/window listener and cancels its animation frame', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const fixture = window as Fixture;
    const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
    const listeners: { target: EventTarget; name: string; listener: EventListenerOrEventListenerObject; capture: boolean }[] = [];
    EventTarget.prototype.addEventListener = function (name, listener, options) {
      const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
      if (listener && (this === document || this === window) && !listeners.some(entry => entry.target === this && entry.name === name && entry.listener === listener && entry.capture === capture)) listeners.push({ target: this, name, listener, capture });
      add.call(this, name, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (name, listener, options) {
      const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
      const index = listeners.findIndex(entry => entry.target === this && entry.name === name && entry.listener === listener && entry.capture === capture);
      if (index >= 0) listeners.splice(index, 1);
      remove.call(this, name, listener, options);
    };
    try {
      fixture.setup('<button data-gamepad="west">Action</button>');
      const initial = listeners.length;
      for (let i = 0; i < 5; i++) { await fixture.tap('home'); fixture.pad.stop(); fixture.pad.start(); }
      const restarted = listeners.length;
      let samples = 0;
      const get = fixture.sim.getGamepads;
      fixture.sim.getGamepads = () => { samples++; return get(); };
      fixture.pad.stop(); await fixture.step(4);
      return { initial, restarted, remaining: listeners.length, samples };
    } finally { EventTarget.prototype.addEventListener = add; EventTarget.prototype.removeEventListener = remove; }
  });
  expect(result.initial).toBeGreaterThan(0);
  expect(result.restarted).toBe(result.initial);
  expect(result.remaining).toBe(0);
  expect(result.samples).toBe(0);
});
