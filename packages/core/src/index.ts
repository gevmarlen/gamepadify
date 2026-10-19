import { Controller } from './controller.js';
import type { GamepadifyController, GamepadifyOptions } from './types.js';

export function createGamepadify(options: GamepadifyOptions = {}): GamepadifyController {
  return new Controller(options);
}

export { buttons, normalizeButton, normalizeTrigger } from './buttons.js';
export { detectFamily } from './devices.js';
export type * from './types.js';
