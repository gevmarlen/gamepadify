import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/browser/fixture.html');
  await page.waitForFunction(() => (window as any).ready);
  await page.bringToFront();
});

for (const preset of ['full', 'core', 'navigation', 'hints']) {
  const hints = preset === 'full' || preset === 'hints';
  const navigation = preset === 'full' || preset === 'navigation';

  test(`${preset}: bindings, chords, dynamic classes and cleanup`, async ({ page }) => {
    const images: string[] = [];
    page.on('request', request => { if (request.url().endsWith('.png')) images.push(request.url()); });
    await page.evaluate(preset => {
      (window as any).setup('<button id="action" data-gamepad="west">Action</button><button id="combo" data-gamepad="west+left-shoulder">Combo</button>', { bodyClass: 'playing', elementClass: 'assigned' }, 'xbox', preset);
      document.getElementById('action')!.style.outline = '3px solid red';
    }, preset);
    await page.evaluate(async () => { await (window as any).tap('home'); await (window as any).tap('west', 'left-shoulder'); });
    expect(await page.evaluate(() => (window as any).events)).toEqual(['combo']);
    await expect(page.locator('.gamepadify-hint')).toHaveCount(hints ? 2 : 0);
    await page.evaluate(async () => { (window as any).sim.press('west'); await new Promise(resolve => setTimeout(resolve, 120)); (window as any).sim.release('west'); await (window as any).step(); });
    expect(await page.evaluate(() => (window as any).events)).toEqual(['combo', 'action']);
    await expect(page.locator('#action')).toBeFocused();
    await expect(page.locator('#action')).toHaveCSS('outline-style', preset === 'core' ? 'solid' : 'none');
    await expect(page.locator('.gamepadify-layer')).toHaveCount(preset === 'core' ? 0 : 1);
    if (hints) await expect.poll(() => page.locator('.gamepadify-glyph img').evaluateAll(images => images.every(img => (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
    else expect(images).toEqual([]);
    await page.evaluate(() => { const node = document.createElement('button'); node.id = 'dynamic'; node.dataset.gamepad = 'north'; document.getElementById('root')!.append(node); });
    await expect(page.locator('#dynamic')).toHaveClass(/assigned/);
    await page.evaluate(() => (window as any).pad.stop());
    await expect(page.locator('body')).not.toHaveClass(/playing/);
    await expect(page.locator('#dynamic')).not.toHaveClass(/assigned/);
    await expect(page.locator('.gamepadify-layer')).toHaveCount(0);
    await page.evaluate(async () => { (window as any).pad.start(); await (window as any).tap('home'); await (window as any).tap('north'); });
    expect(await page.evaluate(() => (window as any).events)).toEqual(['combo', 'action', 'dynamic']);
    await page.evaluate(() => (window as any).pad.destroy());
    await expect(page.locator('.gamepadify-layer')).toHaveCount(0);
  });

  test(`${preset}: navigation and missing-feature diagnostics`, async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()); });
    await page.evaluate(preset => (window as any).setup('<button id="left" data-gamepad-focusable>Left</button><button id="right" data-gamepad-focusable>Right</button>', { navigation: { confirm: 'south' } }, 'xbox', preset), preset);
    await page.evaluate(async () => { await (window as any).tap('home'); (window as any).sim.axes(1, 0); await (window as any).step(); (window as any).sim.axes(0, 0); await (window as any).tap('south'); });
    expect(await page.evaluate(() => (window as any).events)).toEqual(navigation ? ['right'] : []);
    if (navigation) await expect(page.locator('#right')).toBeFocused();
    expect(warnings.filter(warning => warning.includes('missing-feature'))).toHaveLength(navigation ? 0 : 1);
    await page.evaluate(async () => { (window as any).pad.configure({ navigation: false }); await (window as any).step(); });
    expect(await page.evaluate(() => (window as any).pad.getState().diagnostics)).toEqual([]);
    await page.evaluate(async () => { (window as any).pad.configure({ showHints: true }); await (window as any).step(10); });
    expect(warnings.filter(warning => warning.includes('Hints are not included'))).toHaveLength(hints ? 0 : 1);
  });
}

test('entry points share root and body-class ownership', async ({ page }) => {
  await page.evaluate(async () => {
    (window as any).setup('<div id="a"></div><div id="b"></div>', { bodyClass: 'shared' }, 'xbox', 'core');
    const other = (window as any).factories.hints({ root: document.body, source: (window as any).sim, warnings: false });
    other.start();
    if (other.getState().running || other.getState().diagnostics[0]?.code !== 'overlapping-root') throw Error('Root ownership was not shared');
    other.destroy();
    (window as any).pad.destroy();
    const options = { source: (window as any).sim, bodyClass: 'shared' };
    (window as any).pad = (window as any).factories.core({ ...options, root: document.getElementById('a') });
    (window as any).other = (window as any).factories.navigation({ ...options, root: document.getElementById('b') });
    (window as any).pad.start(); (window as any).other.start();
    await (window as any).tap('home');
    (window as any).pad.destroy();
  });
  await expect(page.locator('body')).toHaveClass(/shared/);
  await page.evaluate(() => (window as any).other.destroy());
  await expect(page.locator('body')).not.toHaveClass(/shared/);
});

for (const preset of ['core', 'navigation', 'hints']) test(`${preset}: standalone script`, async ({ page }) => {
  await page.addScriptTag({ url: `/packages/core/dist/gamepadify-${preset}.min.js` });
  await page.evaluate(preset => {
    (window as any).factories[preset] = (window as any).Gamepadify.createGamepadify;
    (window as any).setup('<button id="save" data-gamepad="west">Save</button>', {}, 'xbox', preset);
  }, preset);
  await page.evaluate(async () => { await (window as any).tap('west'); await (window as any).tap('west'); });
  expect(await page.evaluate(() => (window as any).events)).toEqual(['save']);
  await expect(page.locator('.gamepadify-hint')).toHaveCount(preset === 'hints' ? 1 : 0);
});
