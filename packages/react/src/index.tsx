import { createElement } from 'react';
import type { ReactNode } from 'react';
import { createGamepadify } from 'gamepadify';
import { Provider } from './shared.js';
import type { GamepadProviderProps } from './shared.js';

export function GamepadProvider(props: GamepadProviderProps): ReactNode {
  return createElement(Provider, { ...props, factory: createGamepadify });
}

export { useGamepad, useGamepadController } from './shared.js';
export type { GamepadProviderProps } from './shared.js';
export type { BindingInput, GamepadifyOptions } from 'gamepadify';
