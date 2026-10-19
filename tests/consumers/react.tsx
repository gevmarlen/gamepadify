import { createElement, StrictMode, useEffect, useState } from 'react';
import { GamepadProvider, useGamepad, useGamepadController } from 'gamepadify-react';
import type { GamepadifyOptions } from 'gamepadify';

function Surface() {
  const [count, setCount] = useState(0);
  const [show, setShow] = useState(true);
  const ref = useGamepad<HTMLButtonElement>('west');
  const pad = useGamepadController();
  useEffect(() => { Object.assign(window, { pad, toggle: () => setShow(value => !value) }); }, [pad]);
  return createElement('div', null, createElement('output', { id: 'count' }, count), show && createElement('button', { id: 'action', ref, onClick: () => setCount(value => value + 1) }, 'Action'));
}
export function App({ options }: { options?: GamepadifyOptions }) {
  return createElement(StrictMode, null, createElement(GamepadProvider, { options }, createElement(Surface)));
}
