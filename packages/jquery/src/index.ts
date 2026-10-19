import { createGamepadify } from 'gamepadify';
import { install } from './shared.js';

export function installGamepadify($: JQueryStatic): void {
  install($, createGamepadify);
}

export type { GamepadifyOptions } from './shared.js';
