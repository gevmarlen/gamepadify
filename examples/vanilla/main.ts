import { createGamepadify } from 'gamepadify';
import { options } from '../input';
import '../style.css';

const pad = createGamepadify(options);
let count = 0;
document.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
  document.querySelector('output')!.textContent = `${++count} actions`;
}));
pad.start();
window.addEventListener('pagehide', () => pad.destroy(), { once: true });
