import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode, RefCallback } from 'react';
import type { BindingInput, GamepadifyController, GamepadifyFactory, GamepadifyOptions } from 'gamepadify';

const Context = createContext<GamepadifyController | null>(null);
const defaults: GamepadifyOptions = {};
const action = (value: BindingInput) => typeof value === 'object' && 'action' in value ? value.action : undefined;

function optionValues(options: GamepadifyOptions): Map<string, readonly unknown[]> {
  return new Map(Object.entries(options).filter(([, value]) => value !== undefined).map(([key, value]) => {
    if (key === 'root') return [key, [value]];
    if (key === 'source') return [key, [value, options.source?.getGamepads]];
    const callbacks: unknown[] = [];
    const signature = JSON.stringify(value, (_, current) => {
      if (typeof current === 'function') return callbacks.push(current);
      if (Object.prototype.toString.call(current) === '[object RegExp]') return { source: current.source, flags: current.flags };
      if (current && typeof current === 'object' && !Array.isArray(current)) return Object.fromEntries(Object.keys(current).sort().map(key => [key, current[key]]));
      return current;
    });
    return [key, [signature, ...callbacks]];
  }));
}

export interface GamepadProviderProps { options?: GamepadifyOptions; children?: ReactNode }

export function Provider({ options = defaults, children, factory }: GamepadProviderProps & { factory: GamepadifyFactory }): ReactNode {
  const [controller] = useState(() => factory(options));
  const previous = useRef<{ values: ReturnType<typeof optionValues>; hints: string[] } | undefined>(undefined);
  useEffect(() => {
    const current = optionValues(options);
    const prior = previous.current;
    previous.current = { values: current, hints: Object.keys(options.hints ?? {}) };
    if (!prior) return;
    const changed = [...new Set([...prior.values.keys(), ...current.keys()])].filter(key => {
      const before = prior.values.get(key), after = current.get(key);
      return !before || !after || before.length !== after.length || after.some((value, index) => !Object.is(value, before[index]));
    }).map(key => {
      const value = options[key as keyof GamepadifyOptions];
      return [key, key === 'hints' && options.hints ? { ...Object.fromEntries(prior.hints.map(field => [field, undefined])), ...options.hints } : value];
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
