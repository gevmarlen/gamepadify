import { createGamepadSimulator } from 'gamepadify/testing';
import type { Button } from 'gamepadify';

type Direction = 'up' | 'right' | 'down' | 'left';
const keys: Record<string, Button> = { KeyZ: 'south', KeyV: 'east', Escape: 'east', KeyX: 'west', KeyC: 'north', KeyQ: 'left-shoulder' };
const directions: Record<string, Direction> = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' };

export function createDemoSimulator(element: HTMLElement) {
  const source = createGamepadSimulator();
  const pressed = new Map<string, Button>();
  const moved = new Map<string, Direction>();
  const pointers = new Map<number, string>();
  const pending: (() => void)[] = [];
  let enabled = false;
  let sequence = 0;

  function update() {
    source.reset();
    source.press(...pressed.values());
    const values = [...moved.values()];
    const x = Number(values.includes('right')) - Number(values.includes('left'));
    const y = Number(values.includes('down')) - Number(values.includes('up'));
    source.axes(x, y);
    for (const button of element.querySelectorAll<HTMLElement>('[data-pad-button]')) button.classList.toggle('pressed', [...pressed.values()].includes(button.dataset.padButton as Button));
    for (const button of element.querySelectorAll<HTMLElement>('[data-pad-direction]')) button.classList.toggle('pressed', values.includes(button.dataset.padDirection as Direction));
    element.style.setProperty('--stick-x', `${x * 12.5}%`);
    element.style.setProperty('--stick-y', `${y * 12.5}%`);
  }

  function reset() {
    pending.length = 0; pointers.clear(); pressed.clear(); moved.clear(); update();
  }

  function pulse(button?: Button, direction?: Direction) {
    const token = `tap-${++sequence}`;
    pending.push(() => {
      if (button) pressed.set(token, button);
      if (direction) moved.set(token, direction);
    }, () => { pressed.delete(token); moved.delete(token); });
  }

  document.addEventListener('keydown', event => {
    if (!enabled || event.altKey || event.ctrlKey || event.metaKey || (event.target as HTMLElement).closest('input, select, textarea, [contenteditable]')) return;
    const button = keys[event.code], direction = directions[event.code];
    if (!button && !direction) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat) return;
    pending.push(() => {
      if (button) pressed.set(event.code, button);
      if (direction) moved.set(event.code, direction);
    });
  }, { capture: true });
  document.addEventListener('keyup', event => {
    if (!enabled || !keys[event.code] && !directions[event.code]) return;
    pending.push(() => { pressed.delete(event.code); moved.delete(event.code); });
  });
  document.addEventListener('pointerdown', event => {
    if (!enabled || event.button !== 0) return;
    const button = (event.target as Element).closest<HTMLElement>('[data-pad-button], [data-pad-direction]');
    if (!button || !element.contains(button)) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    const token = `pointer-${++sequence}`;
    pointers.set(event.pointerId, token);
    pending.push(() => {
      if (button.dataset.padButton) pressed.set(token, button.dataset.padButton as Button);
      if (button.dataset.padDirection) moved.set(token, button.dataset.padDirection as Direction);
    });
  }, { capture: true });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) document.addEventListener(type, event => {
    const token = pointers.get(event.pointerId);
    if (!token) return;
    pointers.delete(event.pointerId);
    pending.push(() => { pressed.delete(token); moved.delete(token); });
  }, { capture: true });
  element.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLElement>('[data-pad-button], [data-pad-direction]');
    if (enabled && event.detail === 0 && button) pulse(button.dataset.padButton as Button | undefined, button.dataset.padDirection as Direction | undefined);
  });
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });

  const sampledSource = { getGamepads() {
    // Each transition gets a poll, including release between quick clicks.
    const next = pending.shift();
    if (next) { next(); update(); }
    return source.getGamepads();
  } };
  return { source: sampledSource, reset, wake: () => pulse('home'), enable(value: boolean) { enabled = value; reset(); } };
}
