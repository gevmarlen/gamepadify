import { Controller } from './controller.js';
import { SpatialNavigation } from './navigation-controller.js';
import { FocusRenderer } from './focus-renderer.js';
import type { GamepadifyController, GamepadifyOptions } from './types.js';

export function createGamepadify(options: GamepadifyOptions = {}): GamepadifyController {
  return new Controller(options, { navigation: context => new SpatialNavigation(context), presentation: document => new FocusRenderer(document) });
}

export { buttons, normalizeButton, normalizeTrigger } from './buttons.js';
export { detectFamily } from './devices.js';
export type * from './types.js';
