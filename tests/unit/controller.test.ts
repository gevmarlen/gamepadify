import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGamepadify } from '../../packages/core/src/index.js';
import { createGamepadSimulator } from '../../packages/core/src/testing.js';
import { nearest } from '../../packages/core/src/dom.js';
import type { Button, GamepadifyController, GamepadifyOptions } from '../../packages/core/src/types.js';

let time = 0;
let callbacks = new Map<number, FrameRequestCallback>();
let sequence = 0;
let controllers: GamepadifyController[] = [];
const rect = (element: HTMLElement) => {
  const [x, y, width, height] = (element.dataset.rect ?? '20,40,80,30').split(',').map(Number);
  return new DOMRect(x, y, width, height);
};

beforeEach(() => {
  document.body.innerHTML = '';
  document.body.className = '';
  time = 0; callbacks = new Map(); sequence = 0; controllers = [];
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callbacks.set(++sequence, callback); return sequence; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { callbacks.delete(id); });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) { return rect(this); });
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) { return [rect(this)] as unknown as DOMRectList; });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { controllers.forEach(controller => controller.destroy()); });

async function frame(delta = 16) {
  await Promise.resolve();
  time += delta;
  const next = [...callbacks.values()]; callbacks.clear();
  next.forEach(callback => callback(time));
  await Promise.resolve();
}

function setup(html: string, options: GamepadifyOptions = {}) {
  document.body.innerHTML = html;
  const source = createGamepadSimulator();
  const pad = createGamepadify({ source, ...options });
  controllers.push(pad);
  pad.start();
  return { pad, source };
}

async function wake(source: ReturnType<typeof createGamepadSimulator>) {
  source.press('home'); await frame(); source.release('home'); await frame();
}
async function tap(source: ReturnType<typeof createGamepadSimulator>, button: Button) {
  source.press(button); await frame(); source.release(button); await frame();
}

describe('controller lifecycle and modes', () => {
  it('consumes the first press and activates only after release', async () => {
    const { pad, source } = setup('<button data-gamepad="south">Save</button>');
    const click = vi.fn(); document.querySelector('button')!.addEventListener('click', click);
    await tap(source, 'south'); expect(click).not.toHaveBeenCalled(); expect(pad.getState().mode).toBe('gamepad');
    await tap(source, 'south'); expect(click).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(pad.getState().mode).toBe('pointer');
    await tap(source, 'south'); expect(click).toHaveBeenCalledTimes(1);
  });
  it('preserves preexisting classes and styles while applying configurable classes', async () => {
    const { pad, source } = setup('<button class="existing" data-gamepad="south">Save</button>', { bodyClass: 'original game-mode', elementClass: 'existing assigned', showHints: false });
    document.body.classList.add('original');
    await wake(source);
    expect(document.body.classList.contains('game-mode')).toBe(true);
    expect(document.querySelector('button')!.classList.contains('assigned')).toBe(true);
    expect(document.querySelectorAll('.gamepadify-hint')).toHaveLength(0);
    const next = document.createElement('button'); next.dataset.gamepad = 'north'; document.body.append(next); await frame();
    expect(next.classList.contains('assigned')).toBe(true);
    pad.configure({ bodyClass: 'replacement', elementClass: 'replacement-element' }); await frame();
    expect(document.body.classList.contains('game-mode')).toBe(false);
    expect(document.body.classList.contains('replacement')).toBe(true);
    pad.stop();
    expect(document.body.className).toBe('original');
    expect(document.querySelector('button')!.className).toBe('existing');
    expect(next.className).toBe('');
    expect(callbacks.size).toBe(0);
    expect(document.querySelector('.gamepadify-layer')).toBeNull();
  });
  it('does not add configured classes by default', async () => {
    const { source } = setup('<button data-gamepad="south">Save</button>');
    await wake(source);
    expect(document.body.className).toBe('gamepadify-mode');
    expect(document.querySelector('button')!.className).toBe('gamepadify-native-focus');
  });
  it('restores the normal interface on disconnect and can restart cleanly', async () => {
    const { pad, source } = setup('<button data-gamepad="south">Save</button>');
    await wake(source); source.disconnect(); await frame();
    expect(pad.getState().mode).toBe('pointer'); expect(pad.getState().device).toBeNull();
    pad.stop(); pad.start(); source.connect('playstation'); await wake(source);
    expect(pad.getState().device?.family).toBe('playstation');
    pad.destroy(); pad.destroy(); expect(callbacks.size).toBe(0);
  });
  it('prevents two controllers from owning overlapping roots', () => {
    const { source } = setup('<button data-gamepad="south">Save</button>');
    const second = createGamepadify({ root: document.body, source }); controllers.push(second); second.start();
    expect(second.getState().running).toBe(false);
    expect(second.getState().diagnostics[0]?.code).toBe('overlapping-root');
  });
  it('keeps polling after a consumer callback throws', async () => {
    const { pad, source } = setup('<button id="action">Action</button>');
    const release = pad.bind(document.getElementById('action')!, { button: 'west', action: () => { throw new Error('consumer callback'); } });
    await wake(source); source.press('west');
    await expect(frame()).rejects.toThrow('consumer callback');
    expect(callbacks.size).toBe(1);
    release(); source.release('west'); await frame();
    const click = vi.fn(); document.getElementById('action')!.addEventListener('click', click);
    pad.bind(document.getElementById('action')!, 'west'); await frame(); await tap(source, 'west');
    expect(click).toHaveBeenCalledTimes(1);
  });
  it('pauses polling while the document lacks focus and consumes the resume press', async () => {
    const { pad, source } = setup('<button data-gamepad="west">Action</button>');
    const click = vi.fn(); document.querySelector('button')!.addEventListener('click', click);
    await wake(source);
    vi.mocked(document.hasFocus).mockReturnValue(false);
    window.dispatchEvent(new Event('blur')); await frame();
    expect(callbacks.size).toBe(0); expect(pad.getState().mode).toBe('pointer');
    vi.mocked(document.hasFocus).mockReturnValue(true); window.dispatchEvent(new Event('focus'));
    await tap(source, 'west'); expect(click).not.toHaveBeenCalled();
    await tap(source, 'west'); expect(click).toHaveBeenCalledTimes(1);
  });
  it('requires a fresh activation after changing the gamepad source', async () => {
    const { pad, source } = setup('<button data-gamepad="west">Action</button>');
    await wake(source);
    const replacement = createGamepadSimulator('switch');
    pad.configure({ source: replacement });
    expect(pad.getState().mode).toBe('pointer');
    await wake(replacement); expect(pad.getState().device?.family).toBe('switch');
  });
});

describe('binding resolution', () => {
  it('blocks duplicate visible actions and warns once until membership changes', async () => {
    const { pad, source } = setup('<button id="a" data-gamepad="south">A</button><button id="b" data-gamepad="xbox:a">B</button>');
    const click = vi.fn(); document.body.addEventListener('click', click);
    await wake(source); await tap(source, 'south'); await frame();
    expect(click).not.toHaveBeenCalled(); expect(console.warn).toHaveBeenCalledTimes(1);
    document.getElementById('b')!.hidden = true; await frame(); await tap(source, 'south');
    expect(click).toHaveBeenCalledTimes(1); expect(pad.getState().diagnostics).toEqual([]);
    document.getElementById('b')!.hidden = false; await frame(); expect(console.warn).toHaveBeenCalledTimes(2);
  });
  it.each(['disabled', 'inert', 'hidden', 'aria-disabled="true"', 'style="display:none"', 'data-rect="2000,2000,20,20"'])('ignores an unavailable duplicate: %s', async attribute => {
    const { pad, source } = setup(`<button data-gamepad="south">A</button><button data-gamepad="south" ${attribute}>B</button>`);
    await wake(source); expect(pad.getState().diagnostics).toEqual([]);
  });
  it('honors explicit > selector > attribute priority and restores lower-priority registrations', async () => {
    const { pad, source } = setup('<button id="a" data-gamepad="south">A</button>', { bindings: { '#a': 'north' } });
    const element = document.getElementById('a')!; const click = vi.fn(); element.addEventListener('click', click);
    const unbind = pad.bind(element, 'west'); const extra = pad.bind(element, { focusable: true });
    await wake(source); await tap(source, 'south'); await tap(source, 'north'); expect(click).not.toHaveBeenCalled();
    await tap(source, 'west'); expect(click).toHaveBeenCalledTimes(1);
    unbind(); extra(); await frame(); await tap(source, 'north'); expect(click).toHaveBeenCalledTimes(2);
  });
  it('reports invalid selectors and buttons without breaking valid actions', async () => {
    const { pad, source } = setup('<button data-gamepad="A">Bad</button><button id="good" data-gamepad="south">Good</button>', { bindings: { '[': 'north' } });
    const click = vi.fn(); document.getElementById('good')!.addEventListener('click', click);
    await wake(source); await tap(source, 'south'); expect(click).toHaveBeenCalledTimes(1);
    expect(pad.getState().diagnostics.map(issue => issue.code)).toEqual(['invalid-selector', 'invalid-binding']);
  });
});

describe('navigation and scopes', () => {
  it('moves real focus, activates with confirm and obeys stick repeat timing', async () => {
    const { pad, source } = setup('<button id="a" data-gamepad-focusable data-rect="10,40,60,30">A</button><button id="b" data-gamepad-focusable data-rect="100,40,60,30">B</button><button id="c" data-gamepad-focusable data-rect="190,40,60,30">C</button>', { navigation: { confirm: 'east' } });
    await wake(source); expect(document.activeElement?.id).toBe('a');
    source.axes(0.8, 0.2); await frame(); expect(document.activeElement?.id).toBe('b');
    await frame(100); expect(document.activeElement?.id).toBe('b');
    await frame(201); expect(document.activeElement?.id).toBe('c');
    source.axes(0, 0); const click = vi.fn(); document.getElementById('c')!.addEventListener('click', click);
    await tap(source, 'east'); expect(click).toHaveBeenCalledTimes(1); expect(pad.getState().focusedElement?.id).toBe('c');
  });
  it('reserves confirm inside chords and blocks both conflicting uses', async () => {
    const { pad, source } = setup('<button data-gamepad-focusable>Focus</button><button data-gamepad="east+left-shoulder">Bad</button>', { navigation: { confirm: 'east' } });
    const click = vi.fn(); document.body.addEventListener('click', click);
    await wake(source); await tap(source, 'east'); expect(click).not.toHaveBeenCalled();
    expect(pad.getState().diagnostics[0]?.code).toBe('reserved-button');
  });
  it('limits D-pad reservation conflicts to the conflicting button', async () => {
    const { source } = setup('<button data-gamepad-focusable>Focus</button><button data-gamepad="dpad-left">Bad</button>', { navigation: { confirm: 'south', dpad: true } });
    const click = vi.fn(); document.querySelector('button')!.addEventListener('click', click);
    await wake(source); await tap(source, 'south'); expect(click).toHaveBeenCalledTimes(1);
  });
  it('isolates a scope and restores focus when it closes', async () => {
    const { pad, source } = setup('<button id="a" data-gamepad-focusable>Outside</button><section id="modal"><button id="b" data-gamepad-focusable>Inside</button></section>', { navigation: { confirm: 'east' } });
    await wake(source); expect(document.activeElement?.id).toBe('a');
    const pop = pad.pushScope(document.getElementById('modal')!); await frame(); expect(document.activeElement?.id).toBe('b');
    pop(); await frame(); expect(pad.getState().focusedElement?.id).toBe('a'); expect(document.activeElement?.id).toBe('a');
  });
  it('restores a temporary tabindex on stop', async () => {
    const { pad, source } = setup('<div data-gamepad-focusable>Item</div>', { navigation: { confirm: 'east' } });
    await wake(source); expect(document.querySelector('[data-gamepad-focusable]')!.getAttribute('tabindex')).toBe('-1');
    pad.stop(); expect(document.querySelector('[data-gamepad-focusable]')!.hasAttribute('tabindex')).toBe(false);
  });
  it('skips explicitly excluded targets and recovers after the current target is removed', async () => {
    const { source } = setup('<button id="skip" data-gamepad-focusable="false">Skip</button><button id="first" data-gamepad-focusable>First</button><button id="next" data-gamepad-focusable>Next</button>', { navigation: { confirm: 'south' }, elementClass: 'target' });
    await wake(source); expect(document.activeElement?.id).toBe('first');
    expect(document.getElementById('skip')!.classList.contains('target')).toBe(false);
    document.getElementById('first')!.remove(); await frame();
    expect(document.activeElement?.id).toBe('next');
  });
  it('prioritizes a directional lane over a closer diagonal candidate', () => {
    document.body.innerHTML = '<button id="a" data-rect="10,10,30,30"></button><button id="b" data-rect="100,10,30,30"></button><button id="c" data-rect="50,60,30,30"></button>';
    const [a, b, c] = [...document.querySelectorAll('button')];
    expect(nearest(a!, [a!, b!, c!], 'right')).toBe(b);
    expect(nearest(a!, [a!, b!, c!], 'left')).toBeNull();
  });
});
