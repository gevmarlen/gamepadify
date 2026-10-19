import { createGamepadSimulator } from 'gamepadify/testing';
import type { Button, GamepadifyOptions } from 'gamepadify';

const simulated = new URLSearchParams(location.search).has('simulate');
const source = createGamepadSimulator();
const buttons: Record<string, Button> = { z: 'south', x: 'west' };
const held = new Set<string>();
function update() {
  source.axes(Number(held.has('ArrowRight')) - Number(held.has('ArrowLeft')), Number(held.has('ArrowDown')) - Number(held.has('ArrowUp')));
}
if (simulated) {
  document.addEventListener('keydown', event => {
    if (!buttons[event.key] && !event.key.startsWith('Arrow')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (buttons[event.key]) source.press(buttons[event.key]!);
    held.add(event.key); update();
  }, { capture: true });
  document.addEventListener('keyup', event => {
    if (buttons[event.key]) source.release(buttons[event.key]!);
    held.delete(event.key); update();
  });
  window.addEventListener('blur', () => { held.clear(); source.reset(); });
}
export const options: GamepadifyOptions = {
  source: simulated ? source : undefined,
  navigation: { confirm: 'south' },
  bodyClass: 'using-gamepad',
};
