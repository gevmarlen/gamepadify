import { inject, onMounted, onUnmounted } from 'vue';
import type { App, InjectionKey, ObjectDirective, Plugin } from 'vue';
import { createGamepadify } from 'gamepadify';
import type { BindingInput, GamepadifyController, GamepadifyOptions } from 'gamepadify';

interface Context { controller: GamepadifyController; retain(): () => void }
const key: InjectionKey<Context> = Symbol('gamepadify');

export function createGamepadifyPlugin(options: GamepadifyOptions = {}): Plugin & { controller: GamepadifyController } {
  const controller = createGamepadify(options);
  let users = 0;
  const context: Context = {
    controller,
    retain() {
      users++;
      queueMicrotask(() => { if (users) controller.start(); });
      let released = false;
      return () => { if (!released) { released = true; if (--users === 0) controller.stop(); } };
    },
  };
  const createDirective = (focusable: boolean): ObjectDirective<HTMLElement, BindingInput | boolean | undefined> => {
    const entries = new WeakMap<HTMLElement, { unbind: () => void; release: () => void }>();
    const input = (value: BindingInput | boolean | undefined): BindingInput => focusable ? { focusable: value !== false } : value === undefined || typeof value === 'boolean' ? { enabled: false } : value;
    return {
      mounted(element, binding) {
        entries.set(element, { unbind: controller.bind(element, input(binding.value)), release: context.retain() });
      },
      updated(element, binding) {
        const entry = entries.get(element);
        if (entry) { entry.unbind(); entry.unbind = controller.bind(element, input(binding.value)); }
      },
      unmounted(element) {
        const entry = entries.get(element);
        entry?.unbind(); entry?.release(); entries.delete(element);
      },
    };
  };
  return {
    controller,
    install(app: App) {
      app.provide(key, context);
      app.directive('gamepad', createDirective(false));
      app.directive('gamepad-focusable', createDirective(true));
    },
  };
}

export function useGamepadify(): GamepadifyController {
  const context = inject(key);
  if (!context) throw new Error('Install createGamepadifyPlugin before calling useGamepadify.');
  let release: (() => void) | undefined;
  onMounted(() => { release = context.retain(); });
  onUnmounted(() => release?.());
  return context.controller;
}

declare module 'vue' {
  interface GlobalDirectives {
    vGamepad: ObjectDirective<HTMLElement, BindingInput>;
    vGamepadFocusable: ObjectDirective<HTMLElement, boolean | undefined>;
  }
}

export type { BindingInput, GamepadifyOptions } from 'gamepadify';
