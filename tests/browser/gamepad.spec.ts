import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('/tests/browser/fixture.html');
  await page.waitForFunction(() => (window as any).ready);
  await page.bringToFront();
}
async function tap(page: Page, ...buttons: string[]) { await page.evaluate(values => (window as any).tap(...values), buttons); }
async function wake(page: Page) { await tap(page, 'home'); }

test.beforeEach(async ({ page }) => { await open(page); });

test('first press, native activation and input-mode restoration', async ({ page }) => {
  await page.evaluate(() => (window as any).setup('<button id="save" data-gamepad="south">Save</button>'));
  await tap(page, 'south');
  expect(await page.evaluate(() => (window as any).events)).toEqual([]);
  await expect(page.locator('body')).toHaveCSS('cursor', 'none');
  await tap(page, 'south');
  expect(await page.evaluate(() => (window as any).events)).toEqual(['save']);
  await page.keyboard.press('Tab');
  await expect(page.locator('.gamepadify-layer')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/gamepadify-mode/);
});

for (const family of ['xbox', 'playstation', 'switch']) test(`loads the ${family} PNG from the stylesheet location`, async ({ page }) => {
  await page.evaluate(family => (window as any).setup('<button data-gamepad="south">Save</button>', {}, family), family);
  await wake(page);
  const glyph = page.locator(`.gamepadify-glyph[data-family="${family}"] img`);
  await expect(glyph).toHaveCount(1);
  await expect.poll(() => glyph.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.locator('.gamepadify-glyph > span')).toBeHidden();
});

test('all three display settings update and restore owned classes', async ({ page }) => {
  await page.evaluate(() => {
    document.body.className = 'existing';
    (window as any).setup('<button id="save" class="original" data-gamepad="south">Save</button>', { bodyClass: 'existing playing', elementClass: 'original assigned', showHints: false });
  });
  await wake(page);
  await expect(page.locator('body')).toHaveClass(/playing/);
  await expect(page.locator('#save')).toHaveClass(/assigned/);
  await expect(page.locator('.gamepadify-hint')).toHaveCount(0);
  await page.evaluate(() => (window as any).pad.configure({ showHints: true }));
  await expect(page.locator('.gamepadify-hint')).toHaveCount(1);
  await page.evaluate(() => {
    const button = document.createElement('button'); button.id = 'new'; button.dataset.gamepad = 'north'; button.textContent = 'New'; document.getElementById('root')!.append(button);
  });
  await expect(page.locator('#new')).toHaveClass(/assigned/);
  await page.evaluate(() => (window as any).pad.destroy());
  await expect(page.locator('body')).toHaveClass('existing');
  await expect(page.locator('#save')).toHaveClass('original');
  await expect(page.locator('#new')).toHaveClass('');
  await expect(page.locator('.gamepadify-layer')).toHaveCount(0);
});

test('conflicts follow visibility, disabled state and DOM changes', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()); });
  await page.evaluate(() => (window as any).setup('<button id="a" data-gamepad="south">A</button><button id="b" data-gamepad="xbox:a">B</button>'));
  await wake(page); await tap(page, 'south');
  expect(await page.evaluate(() => (window as any).events)).toEqual([]);
  expect(warnings.filter(value => value.includes('duplicate-binding'))).toHaveLength(1);
  await page.locator('#b').evaluate((element: HTMLButtonElement) => { element.disabled = true; });
  await tap(page, 'south');
  expect(await page.evaluate(() => (window as any).events)).toEqual(['a']);
  await page.locator('#b').evaluate((element: HTMLButtonElement) => { element.disabled = false; element.style.display = 'none'; });
  await tap(page, 'south'); expect(await page.evaluate(() => (window as any).events)).toEqual(['a', 'a']);
});

test('chords win without leaking single actions on release', async ({ page }) => {
  await page.evaluate(() => (window as any).setup('<button id="a" data-gamepad="south">A</button><button id="combo" data-gamepad="south+left-shoulder">Combo</button>'));
  await wake(page);
  await tap(page, 'south', 'left-shoulder');
  expect(await page.evaluate(() => (window as any).events)).toEqual(['combo']);
  await tap(page, 'south');
  expect(await page.evaluate(() => (window as any).events)).toEqual(['combo', 'a']);
});

test('spatial navigation scrolls a container and keeps real DOM focus', async ({ page }) => {
  await page.evaluate(() => (window as any).setup('<div id="scroll"><button id="first" data-gamepad-focusable>First</button><button id="last" data-gamepad-focusable>Last</button></div>', { navigation: { confirm: 'east' } }));
  await wake(page);
  await expect(page.locator('#first')).toBeFocused();
  await page.evaluate(async () => { (window as any).sim.axes(0, 1); await (window as any).step(); (window as any).sim.axes(0, 0); });
  await expect(page.locator('#last')).toBeFocused();
  expect(await page.locator('#scroll').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await tap(page, 'east'); expect(await page.evaluate(() => (window as any).events)).toEqual(['last']);
});

test('native dialog scopes render hints in the top layer and restore focus', async ({ page }) => {
  await page.evaluate(() => (window as any).setup('<button id="outside" data-gamepad-focusable>Outside</button><dialog id="dialog"><button id="inside" data-gamepad-focusable>Inside</button></dialog>', { navigation: { confirm: 'east' } }));
  await wake(page);
  await page.evaluate(() => { const dialog = document.getElementById('dialog') as HTMLDialogElement; dialog.showModal(); (window as any).pop = (window as any).pad.pushScope(dialog); });
  await expect(page.locator('#inside')).toBeFocused();
  await expect(page.locator('#dialog .gamepadify-hint')).toHaveCount(1);
  await page.evaluate(() => { (document.getElementById('dialog') as HTMLDialogElement).close(); (window as any).pop(); });
  await expect(page.locator('#outside')).toBeFocused();
});

test('custom skins fall back to text when an image cannot load', async ({ page }) => {
  await page.evaluate(() => (window as any).setup('<button data-gamepad="south">Save</button>', { hints: { size: 32, placement: 'right', skin: { name: 'missing', glyphs: { south: { url: '/missing-image.png', label: 'Go' } } } } }));
  await wake(page);
  await expect(page.locator('.gamepadify-glyph > span')).toHaveText('Go');
  await expect(page.locator('.gamepadify-glyph > span')).toBeVisible();
  await expect(page.locator('.gamepadify-glyph')).toHaveCSS('width', '32px');
});

test('script bundle starts independently of the module loader', async ({ page }) => {
  await page.addScriptTag({ url: '/packages/core/dist/gamepadify.min.js' });
  await page.addScriptTag({ url: '/packages/core/dist/gamepadify-testing.min.js' });
  const result = await page.evaluate(() => {
    const api = (window as any).Gamepadify;
    const controller = api.createGamepadify({ source: (window as any).GamepadifyTesting.createGamepadSimulator() });
    controller.start(); const state = controller.getState(); controller.destroy(); return state.running;
  });
  expect(result).toBe(true);
});

test('CSS size, per-element placement and atlas PNGs render correctly', async ({ page }) => {
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--gamepadify-size', '30px');
    (window as any).setup('<button id="save">Save</button>');
    (window as any).pad.bind(document.getElementById('save'), { button: 'south', hint: { placement: 'right', offset: 10, skin: { name: 'atlas', glyphs: { south: { url: '/packages/core/dist/assets/xbox-south.png', atlas: { x: 0, y: 0, width: 64, height: 64, sheetWidth: 64, sheetHeight: 64 } } } } } });
  });
  await wake(page);
  await expect(page.locator('.gamepadify-glyph')).toHaveCSS('width', '30px');
  await expect(page.locator('.gamepadify-glyph > span')).toBeHidden();
  await expect(page.locator('.gamepadify-glyph')).toHaveCSS('background-size', '30px 30px');
  const button = await page.locator('#save').boundingBox();
  const hint = await page.locator('.gamepadify-hint').boundingBox();
  expect(hint!.x).toBeCloseTo(button!.x + button!.width + 10);
  await tap(page, 'south');
  await expect(page.locator('#save')).toBeFocused();
  await expect(page.locator('.gamepadify-focus')).toBeVisible();
});

test('repeated stop/start keeps one overlay and restores pointer input', async ({ page }) => {
  await page.evaluate(() => (window as any).setup('<button data-gamepad="west">Action</button>'));
  for (let index = 0; index < 5; index++) {
    await wake(page);
    await expect(page.locator('.gamepadify-layer')).toHaveCount(1);
    await page.evaluate(() => { (window as any).pad.stop(); (window as any).pad.start(); });
    await expect(page.locator('.gamepadify-layer')).toHaveCount(0);
  }
  await wake(page); await page.mouse.move(50, 50);
  await expect(page.locator('body')).not.toHaveClass(/gamepadify-mode/);
  await wake(page); await page.dispatchEvent('body', 'pointerdown', { pointerType: 'touch' });
  await expect(page.locator('body')).not.toHaveClass(/gamepadify-mode/);
});
