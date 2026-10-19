import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode, RefCallback } from 'react';
import type { BindingInput, GamepadifyController, GamepadifyFactory, GamepadifyOptions } from 'gamepadify';

const Context = createContext<GamepadifyController | null>(null);
const defaults: GamepadifyOptions = {};
const action = (value: BindingInput) => typeof value === 'object' && 'action' in value ? value.action : undefined;

function optionValues(options: GamepadifyOptions): Map<string, readonly unknown[]> {
  return new Map(Object.entries(options).map(([key, value]) => {
    if (key === 'bindings') return [key, [JSON.stringify(value), ...Object.values(options.bindings ?? {}).map(action)]];
    return [key, [key === 'hints' || key === 'navigation' ? JSON.stringify(value) : value]];
  }));
}

export interface GamepadProviderProps { options?: GamepadifyOptions; children?: ReactNode }

export function Provider({ options = defaults, children, factory }: GamepadProviderProps & { factory: GamepadifyFactory }): ReactNode {
  const [controller] = useState(() => factory(options));
  const previous = useRef<ReturnType<typeof optionValues> | undefined>(undefined);
  useEffect(() => {
    const current = optionValues(options);
    const prior = previous.current;
    previous.current = current;
    if (!prior) return;
    const changed = Object.entries(options).filter(([key]) => {
      const before = prior.get(key), after = current.get(key)!;
      return !before || before.length !== after.length || after.some((value, index) => !Object.is(value, before[index]));
    });
    if (changed.length) controller.configure(Object.fromEntries(changed));
  });
  useEffect(() => { controller.start(); return () => controller.stop(); }, [controller]);
  return createElement(Context.Provider, { value: controller }, children);
}

export function useGamepadController(): GamepadifyController {
  const controller = useContext(Context);
  if (!controller) throw new Error('useGamepad must be used inside GamepadProvider.');
  return controller;
}

export function useGamepad<T extends HTMLElement = HTMLElement>(binding: BindingInput): RefCallback<T> {
  const controller = useGamepadController();
  const release = useRef<(() => void) | undefined>(undefined);
  const signature = JSON.stringify(binding), handler = action(binding);
  return useCallback((element: T | null) => {
    release.current?.();
    release.current = element ? controller.bind(element, binding) : undefined;
  }, [controller, signature, handler]);
}

export type { BindingInput, GamepadifyOptions } from 'gamepadify';
