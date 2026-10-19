import { createGamepadify } from 'gamepadify/navigation';
import { provideGamepadify as provide } from 'gamepadify-angular/core';
import type { EnvironmentProviders } from '@angular/core';
import type { GamepadifyOptions } from 'gamepadify';

export function provideGamepadify(options: GamepadifyOptions = {}): EnvironmentProviders {
  return provide(options, createGamepadify);
}

export { GamepadifyService, GamepadDirective, GamepadFocusableDirective } from 'gamepadify-angular/core';
export type { BindingInput, GamepadifyOptions } from 'gamepadify';
