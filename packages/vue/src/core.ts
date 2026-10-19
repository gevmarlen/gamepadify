import { createGamepadify } from 'gamepadify/core';
import { createPlugin } from './shared.js';
import type { GamepadifyOptions } from 'gamepadify';

export function createGamepadifyPlugin(options: GamepadifyOptions = {}): ReturnType<typeof createPlugin> {
  return createPlugin(createGamepadify, options);
}

export { useGamepadify } from './shared.js';
export type { BindingInput, GamepadifyOptions } from 'gamepadify';
