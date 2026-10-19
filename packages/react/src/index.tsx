import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode, RefCallback } from 'react';
import { createGamepadify } from 'gamepadify';
import type { BindingInput, GamepadifyController, GamepadifyOptions } from 'gamepadify';

const Context = createContext<GamepadifyController | null>(null);
const defaults: GamepadifyOptions = {};

export function GamepadProvider({ options = defaults, children }: { options?: GamepadifyOptions; children?: ReactNode }): ReactNode {
  const [controller] = useState(() => createGamepadify(options));
  useEffect(() => { controller.configure(options); }, [controller, options]);
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
  return useCallback((element: T | null) => {
    release.current?.();
    release.current = element ? controller.bind(element, binding) : undefined;
  }, [controller, binding]);
}

export type { BindingInput, GamepadifyOptions } from 'gamepadify';
