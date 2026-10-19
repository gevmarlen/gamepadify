import { afterEach, expect, it, vi } from 'vitest';
import { act, createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createApp, h, nextTick, reactive, resolveDirective, withDirectives } from 'vue';
import $ from 'jquery';
import { createGamepadify } from '../../packages/core/src/index.js';
import { createGamepadSimulator } from '../../packages/core/src/testing.js';
import { Provider, useGamepad } from '../../packages/react/src/shared.js';
import { createPlugin } from '../../packages/vue/src/shared.js';
import { install } from '../../packages/jquery/src/shared.js';
import type { Binding, BindingInput, GamepadifyController, GamepadifyFactory, GamepadifyOptions } from '../../packages/core/src/types.js';

const controllers: GamepadifyController[] = [];
const unmounts: (() => void)[] = [];
const factory: GamepadifyFactory = options => {
  const controller = createGamepadify({ source: createGamepadSimulator(), ...options });
  controllers.push(controller);
  vi.spyOn(controller, 'bind');
  vi.spyOn(controller, 'configure');
  return controller;
};
function host() { const element = document.createElement('div'); document.body.append(element); return element; }
afterEach(() => {
  unmounts.splice(0).forEach(unmount => unmount());
  controllers.splice(0).forEach(controller => controller.destroy());
  document.body.replaceChildren();
});

it('React keeps equivalent refs and options stable, including Strict Mode replay', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(host());
  unmounts.push(() => { act(() => root.unmount()); });
  function Button({ binding }: { binding: BindingInput }) { return createElement('button', { ref: useGamepad(binding) }, 'Action'); }
  const render = async (binding: BindingInput, options: GamepadifyOptions = {}) => {
    await act(async () => root.render(createElement(StrictMode, null, createElement(Provider, { factory, options }, createElement(Button, { binding })))));
  };
  const action = vi.fn();
  await render({ button: 'west', action }, { navigation: { confirm: 'east' } });
  const controller = controllers.at(-1)!;
  const registrations = vi.mocked(controller.bind).mock.calls.length;
  await render({ button: 'west', action }, { navigation: { confirm: 'east' } });
  expect(controller.bind).toHaveBeenCalledTimes(registrations);
  expect(controller.configure).not.toHaveBeenCalled();
  const binding: Binding = { button: 'north', action };
  await render(binding, { navigation: { confirm: 'east' }, showHints: false });
  expect(controller.bind).toHaveBeenCalledTimes(registrations + 1);
  expect(controller.configure).toHaveBeenLastCalledWith({ showHints: false });
  binding.button = 'south';
  await render(binding, { navigation: { confirm: 'east' }, showHints: false });
  expect(controller.bind).toHaveBeenCalledTimes(registrations + 2);
  binding.action = vi.fn();
  await render(binding);
  expect(controller.bind).toHaveBeenCalledTimes(registrations + 3);
});

it('Vue skips unchanged directives and observes in-place object, tuple and callback updates', async () => {
  const plugin = createPlugin(factory, {});
  const state = reactive<{ count: number; binding: Binding }>({ count: 0, binding: { button: ['left-shoulder', 'west'] } });
  const app = createApp({ render: () => withDirectives(h('button', String(state.count)), [[resolveDirective('gamepad')!, state.binding]]) });
  app.use(plugin);
  app.mount(host());
  unmounts.push(() => app.unmount());
  const bind = vi.mocked(plugin.controller.bind);
  expect(bind).toHaveBeenCalledOnce();
  state.count++;
  await nextTick();
  expect(bind).toHaveBeenCalledOnce();
  state.binding.button = ['left-shoulder', 'north'];
  await nextTick();
  expect(bind).toHaveBeenCalledTimes(2);
  const tuple = state.binding.button as ['left-shoulder', 'north' | 'south'];
  tuple[1] = 'south';
  await nextTick();
  expect(bind).toHaveBeenCalledTimes(3);
  state.binding.action = vi.fn();
  await nextTick();
  expect(bind).toHaveBeenCalledTimes(4);
  expect(bind.mock.calls.at(-1)?.[1]).toBe(state.binding);
});

it('jQuery reuses one controller, preserves its root and forgets it even when destroy throws', () => {
  install($, factory);
  const element = host(), other = host();
  const root = $(element);
  root.gamepadify();
  const controller = root.gamepadify('instance')!;
  root.gamepadify({ root: other });
  expect(root.gamepadify('instance')).toBe(controller);
  expect(controller.configure).toHaveBeenLastCalledWith({ root: element });
  root.gamepadify('configure', { root: other, bodyClass: 'playing' });
  expect(controller.configure).toHaveBeenLastCalledWith({ root: element, bodyClass: 'playing' });
  const destroy = vi.spyOn(controller, 'destroy').mockImplementationOnce(() => { throw new Error('cleanup failed'); });
  expect(() => root.gamepadify('destroy')).toThrow('cleanup failed');
  expect(root.gamepadify('instance')).toBeUndefined();
  destroy.mockRestore();
});
