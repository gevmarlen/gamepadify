import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createGamepadify } from '../../packages/core/src/index.js';
import { createGamepadify as createCore } from '../../packages/core/src/core.js';
import { createGamepadify as createNavigation } from '../../packages/core/src/navigation.js';
import { createGamepadify as createHints } from '../../packages/core/src/hints.js';
import { createGamepadSimulator } from '../../packages/core/src/testing.js';
import { Provider, useGamepad } from '../../packages/react/src/shared.js';
import type { Button, DeviceProfile, GamepadifyController, GamepadifyFactory, GamepadifyOptions } from '../../packages/core/src/types.js';

let source: ReturnType<typeof createGamepadSimulator>;
let frames: Map<number, FrameRequestCallback>;
let time: number;
let sequence: number;
const controllers: GamepadifyController[] = [];
const unmounts: (() => void)[] = [];
const originalSource = Object.getOwnPropertyDescriptor(navigator, 'getGamepads');

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  source = createGamepadSimulator(); frames = new Map(); time = 0; sequence = 0;
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: vi.fn(() => source.getGamepads()) });
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++sequence, callback); return sequence; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
  const rect = function (this: HTMLElement) { return this.classList.contains('gamepadify-layer') ? new DOMRect() : new DOMRect(100, 150, 80, 40); };
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(rect);
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function () { return [rect.call(this)] as unknown as DOMRectList; });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  unmounts.splice(0).forEach(unmount => unmount());
  controllers.splice(0).forEach(controller => controller.destroy());
  document.body.replaceChildren(); document.body.className = '';
  if (originalSource) Object.defineProperty(navigator, 'getGamepads', originalSource);
  else delete (navigator as Partial<Navigator>).getGamepads;
});

async function frame() {
  await act(async () => {
    await Promise.resolve();
    const pending = [...frames.values()]; frames.clear(); time += 16;
    pending.forEach(callback => callback(time));
  });
}

async function tap(button: Button, simulator = source) {
  simulator.press(button); await frame(); simulator.release(button); await frame();
}

function mount(factory: GamepadifyFactory = createGamepadify, strict = false) {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const click = vi.fn();
  const create = vi.fn((options?: GamepadifyOptions) => {
    const controller = factory(options);
    controllers.push(controller);
    for (const method of ['configure', 'bind', 'start', 'stop'] as const) vi.spyOn(controller, method);
    return controller;
  });
  function Surface() {
    const ref = useGamepad({ button: 'xbox:x', focusable: true });
    return createElement('div', null,
      createElement('button', { id: 'action', className: 'original', ref, onClick: click }, 'Action'),
      createElement('button', { id: 'mapped', 'data-gamepad': 'xbox:y', onClick: click }, 'Mapped'));
  }
  let mounted = true;
  const unmount = () => { if (mounted) { act(() => root.unmount()); mounted = false; } };
  unmounts.push(unmount);
  return {
    host, click, create, unmount,
    get controller() { return controllers.at(-1)!; },
    async render(options?: GamepadifyOptions) {
      await act(async () => {
        const provider = createElement(Provider, { factory: create, options }, createElement(Surface));
        root.render(strict ? createElement(StrictMode, null, provider) : provider);
      });
      await frame();
    },
  };
}

const hint = () => document.querySelector<HTMLElement>('.gamepadify-hint')!;

it.each([
  ['full', createGamepadify, true], ['core', createCore, false],
  ['navigation', createNavigation, false], ['hints', createHints, true],
] as const)('%s restores its own showHints default without resetting input or refs', async (_, factory, showHints) => {
  const app = mount(factory);
  await app.render({ showHints: !showHints }); await tap('xbox:home');
  const registrations = vi.mocked(app.controller.bind).mock.calls.length;
  await app.render({});
  expect(document.querySelector('.gamepadify-hint') !== null).toBe(showHints);
  expect(app.controller.getState().mode).toBe('gamepad');
  expect(app.controller.getState().diagnostics).toEqual([]);
  expect(app.controller.bind).toHaveBeenCalledTimes(registrations);
  expect(app.controller.stop).not.toHaveBeenCalled();
  expect(app.create).toHaveBeenCalledOnce();
  await tap('xbox:x'); expect(app.click).toHaveBeenCalledOnce();
  await app.render();
  expect(app.controller.configure).toHaveBeenCalledOnce();
});

it('adds and removes class options while preserving existing classes and focus', async () => {
  document.body.className = 'original';
  const app = mount();
  const navigation = { confirm: 'xbox:a' as const };
  await app.render({ navigation }); await tap('xbox:home');
  const focused = app.controller.getState().focusedElement;
  await app.render({ navigation, bodyClass: 'original body-active', elementClass: 'original element-active' });
  expect(document.body.classList.contains('body-active')).toBe(true);
  expect(document.getElementById('action')!.classList.contains('element-active')).toBe(true);
  await app.render({ navigation });
  expect(document.body.classList.contains('body-active')).toBe(false);
  expect(document.getElementById('action')!.classList.contains('element-active')).toBe(false);
  expect(document.body.classList.contains('original')).toBe(true);
  expect(document.getElementById('action')!.classList.contains('original')).toBe(true);
  expect(app.controller.getState().focusedElement).toBe(focused);
  await tap('xbox:a'); expect(app.click).toHaveBeenCalledOnce();
});

it('replaces navigation, releases reserved buttons and disables removed navigation', async () => {
  const app = mount();
  await app.render({ navigation: { confirm: 'xbox:a', dpad: true } }); await tap('xbox:home');
  await tap('xbox:a'); expect(app.click).toHaveBeenCalledTimes(1);
  await app.render({ navigation: { confirm: 'xbox:b' } });
  await tap('xbox:a'); expect(app.click).toHaveBeenCalledTimes(1);
  await tap('xbox:b'); expect(app.click).toHaveBeenCalledTimes(2);
  await app.render({ navigation: { confirm: 'xbox:x' } });
  expect(app.controller.getState().diagnostics.map(issue => issue.code)).toContain('reserved-button');
  await app.render({});
  expect(app.controller.getState().diagnostics).toEqual([]);
  expect(app.controller.getState().focusedElement).toBeNull();
  await tap('xbox:b'); expect(app.click).toHaveBeenCalledTimes(2);
  await tap('xbox:x'); expect(app.click).toHaveBeenCalledTimes(3);
});

it('replaces nested hints and restores CSS size when fields or the entire option are removed', async () => {
  const style = document.createElement('style'); style.textContent = '.gamepadify-layer { --gamepadify-size: 32px }'; document.body.append(style);
  const app = mount();
  await app.render({ hints: { size: 48, offset: 12, placement: 'bottom', offsetX: 9, skin: 'generic' } }); await tap('xbox:home');
  expect(hint().style.width).toBe('48px');
  expect(hint().style.top).toBe('202px');
  await app.render({ hints: { offset: 10 } });
  expect(hint().style.width).toBe('32px');
  expect(hint().style.top).toBe('108px');
  expect(hint().style.left).toBe('148px');
  await app.render({});
  expect(hint().style.width).toBe('32px');
  expect(hint().style.top).toBe('112px');
  expect(app.controller.getState().mode).toBe('gamepad');
});

it('compares nested options by value and callbacks by identity, independent of key order', async () => {
  const app = mount();
  const action = vi.fn(), replacement = vi.fn();
  const options: GamepadifyOptions = {
    hints: { offset: 8, skin: { name: 'custom', glyphs: { west: { url: '/x.png', label: 'X' } } } },
    navigation: { confirm: 'xbox:a', dpad: true },
    bindings: { '#mapped': { button: 'xbox:b', action } },
  };
  await app.render(options); await tap('xbox:home');
  const registrations = vi.mocked(app.controller.bind).mock.calls.length;
  await app.render({
    bindings: { '#mapped': { action, button: 'xbox:b' } },
    navigation: { dpad: true, confirm: 'xbox:a' },
    hints: { skin: { glyphs: { west: { label: 'X', url: '/x.png' } }, name: 'custom' }, offset: 8 },
  });
  expect(app.controller.configure).not.toHaveBeenCalled();
  await tap('xbox:b'); expect(action).toHaveBeenCalledOnce();
  await app.render({ ...options, bindings: { '#mapped': { button: 'xbox:b', action: replacement } } });
  await tap('xbox:b'); expect(replacement).toHaveBeenCalledOnce(); expect(action).toHaveBeenCalledOnce();
  await app.render({ hints: options.hints, navigation: options.navigation });
  await tap('xbox:b'); expect(replacement).toHaveBeenCalledOnce();
  await tap('xbox:y'); expect(app.click).toHaveBeenCalledOnce();
  expect(app.controller.bind).toHaveBeenCalledTimes(registrations);
});

it('tracks profile values, ignores RegExp lastIndex and restores standard mapping on removal', async () => {
  const app = mount();
  const matchPattern = /Xbox/g;
  const profile: DeviceProfile = { name: 'custom', family: 'playstation', match: matchPattern, buttons: { west: 0 } };
  await app.render({ profiles: [profile] }); await tap('xbox:home');
  expect(matchPattern.lastIndex).toBeGreaterThan(0);
  await app.render({ profiles: [{ ...profile, match: /Xbox/g, buttons: { west: 0 } }] });
  expect(app.controller.configure).not.toHaveBeenCalled();
  await tap('xbox:a'); expect(app.click).toHaveBeenCalledOnce();
  const iframe = document.createElement('iframe'); document.body.append(iframe);
  const RealmRegExp = (iframe.contentWindow as Window & typeof globalThis).RegExp;
  await app.render({ profiles: [{ ...profile, match: new RealmRegExp('Xbox', 'g') }] });
  expect(app.controller.configure).not.toHaveBeenCalled();
  await app.render({ profiles: [{ ...profile, match: new RealmRegExp('Other') }] });
  expect(app.controller.getState().device?.profile).toBe('standard');
  const match = vi.fn(() => true);
  await app.render({ profiles: [{ ...profile, match }] });
  expect(match).toHaveBeenCalled();
  await app.render({ profiles: [{ ...profile, match: () => false }] });
  expect(app.controller.getState().device?.profile).toBe('standard');
  await app.render({ profiles: [profile] });
  expect(app.controller.getState().device?.family).toBe('playstation');
  await app.render({});
  expect(app.controller.getState().device?.profile).toBe('standard');
  await tap('xbox:x'); expect(app.click).toHaveBeenCalledTimes(2);
});

it('restores the document root without losing explicit registrations', async () => {
  const outside = document.createElement('button'); outside.dataset.gamepad = 'xbox:b'; document.body.append(outside);
  const click = vi.fn(); outside.addEventListener('click', click);
  const app = mount();
  await app.render({ root: app.host }); await tap('xbox:home');
  await tap('xbox:b'); expect(click).not.toHaveBeenCalled();
  const registrations = vi.mocked(app.controller.bind).mock.calls.length;
  await app.render({});
  expect(app.controller.getState().running).toBe(true);
  await tap('xbox:home'); await tap('xbox:b'); expect(click).toHaveBeenCalledOnce();
  await tap('xbox:x'); expect(app.click).toHaveBeenCalledOnce();
  expect(app.controller.bind).toHaveBeenCalledTimes(registrations);
  const stops = vi.mocked(app.controller.stop).mock.calls.length;
  await app.render({ root: document }); await app.render({});
  expect(app.controller.stop).toHaveBeenCalledTimes(stops);
});

it('restores the browser source and consumes held input when a source is removed', async () => {
  const custom = createGamepadSimulator('playstation');
  const app = mount();
  await app.render({ source: custom }); await tap('xbox:home', custom);
  expect(app.controller.getState().device?.family).toBe('playstation');
  await app.render({ source: custom }); expect(app.controller.configure).not.toHaveBeenCalled();
  custom.getGamepads = vi.fn(custom.getGamepads);
  await app.render({ source: custom });
  expect(app.controller.configure).toHaveBeenCalledOnce();
  expect(custom.getGamepads).toHaveBeenCalled();
  source.press('xbox:x');
  await app.render({});
  expect(app.click).not.toHaveBeenCalled();
  expect(app.controller.getState().device?.family).toBe('xbox');
  source.release('xbox:x'); await frame();
  await tap('xbox:x', custom); expect(app.click).not.toHaveBeenCalled();
  await tap('xbox:x'); expect(app.click).toHaveBeenCalledOnce();
  expect(app.create).toHaveBeenCalledOnce();
});

it('keeps one live controller during Strict Mode replay and cleans up after option resets', async () => {
  const app = mount(createGamepadify, true);
  await app.render({ showHints: false, bodyClass: 'playing', elementClass: 'assigned' }); await tap('xbox:home');
  const creations = app.create.mock.calls.length;
  const registrations = vi.mocked(app.controller.bind).mock.calls.length;
  expect(app.controller.start).toHaveBeenCalledTimes(2);
  expect(app.controller.stop).toHaveBeenCalledOnce();
  expect(frames.size).toBe(1);
  await app.render({}); await app.render({});
  expect(app.create).toHaveBeenCalledTimes(creations);
  expect(app.controller.bind).toHaveBeenCalledTimes(registrations);
  expect(app.controller.configure).toHaveBeenCalledOnce();
  expect(frames.size).toBe(1);
  await tap('xbox:x'); expect(app.click).toHaveBeenCalledOnce();
  app.unmount();
  expect(frames.size).toBe(0);
  expect(document.querySelector('.gamepadify-layer')).toBeNull();
  expect(document.body.classList.contains('playing')).toBe(false);
  expect(app.controller.getState().running).toBe(false);
});
