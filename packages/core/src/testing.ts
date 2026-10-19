import { buttons, normalizeButton } from './buttons.js';
import type { Button, Family, GamepadSource } from './types.js';

export function createGamepadSimulator(family: Family = 'xbox'): GamepadSource & {
  press(...buttons: Button[]): void;
  release(...buttons: Button[]): void;
  axes(x: number, y: number): void;
  connect(family?: Family): void;
  disconnect(): void;
  reset(): void;
} {
  let connected = true;
  let currentFamily = family;
  const pressed = new Set<number>();
  let x = 0, y = 0;
  const ids: Record<Family, string> = { xbox: 'Xbox Wireless Controller', playstation: 'DualSense Wireless Controller (054c)', switch: 'Nintendo Switch Pro Controller (057e)', generic: 'Generic Standard Controller' };
  return {
    getGamepads: () => connected ? [{
      id: ids[currentFamily], index: 0, connected: true, mapping: 'standard', timestamp: performance.now(),
      axes: [x, y, 0, 0], buttons: buttons.map((_, index) => ({ pressed: pressed.has(index), touched: pressed.has(index), value: pressed.has(index) ? 1 : 0 })),
      vibrationActuator: null,
    } as unknown as Gamepad] : [],
    press: (...values) => values.forEach(value => { const normalized = normalizeButton(value); if (normalized) pressed.add(buttons.indexOf(normalized)); }),
    release: (...values) => values.forEach(value => { const normalized = normalizeButton(value); if (normalized) pressed.delete(buttons.indexOf(normalized)); }),
    axes: (nextX, nextY) => { x = Math.max(-1, Math.min(1, nextX)); y = Math.max(-1, Math.min(1, nextY)); },
    connect: (nextFamily = currentFamily) => { connected = true; currentFamily = nextFamily; pressed.clear(); x = y = 0; },
    disconnect: () => { connected = false; pressed.clear(); x = y = 0; },
    reset: () => { pressed.clear(); x = y = 0; },
  };
}
