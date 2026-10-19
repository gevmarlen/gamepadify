import { createElement, StrictMode, useEffect, useState } from 'react';
import { GamepadProvider, useGamepad, useGamepadController } from 'gamepadify-react';
import type { Button, GamepadifyOptions } from 'gamepadify';

function Surface() {
  const [count, setCount] = useState(0);
  const [show, setShow] = useState(true);
  const [button, changeBinding] = useState<Button>('west');
  const ref = useGamepad<HTMLButtonElement>({ button });
  const pad = useGamepadController();
  useEffect(() => { Object.assign(window, { pad, changeBinding, toggle: () => setShow(value => !value) }); }, [pad]);
  return createElement('div', null, createElement('output', { id: 'count' }, count), show && createElement('button', { id: 'action', ref, onClick: () => setCount(value => value + 1) }, 'Action'));
}
export function App({ options }: { options?: GamepadifyOptions }) {
  const [, refresh] = useState(0);
  const [settings, changeOptions] = useState(options);
  useEffect(() => { Object.assign(window, { rerender: () => refresh(value => value + 1), changeOptions }); }, []);
  return createElement(StrictMode, null, createElement(GamepadProvider, { options: { ...settings, hints: settings?.hints && { ...settings.hints } } }, createElement(Surface)));
}
