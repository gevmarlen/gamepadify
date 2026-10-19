import { createGamepadify } from '../../packages/core/dist/index.js';
import type { Button, GamepadifyController, HintOptions, Skin } from '../../packages/core/dist/index.js';
import { createGamepadSimulator } from '../../packages/core/dist/testing.js';
import southImage from '../../packages/core/assets/switch-south.png?url';
import northImage from '../../packages/core/assets/switch-north.png?url';
import './style.css';

const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const simulation = createGamepadSimulator();
const stage = get('stage');
const dialog = get<HTMLDialogElement>('detail-dialog');
let simulated = false;
let pad: GamepadifyController;
let closeScope: (() => void) | undefined;
const keys: Record<string, Button> = { KeyZ: 'south', KeyX: 'west', KeyC: 'north', KeyQ: 'left-shoulder' };
const arrows = new Set<string>();
const skin: Skin = { name: 'Paper', glyphs: { south: { url: southImage, label: 'Open' }, north: { url: northImage, label: 'Mix' } } };

function record(kind: string, message: string) {
  const row = document.createElement('li');
  const label = document.createElement('span'); label.textContent = kind;
  row.append(label, document.createTextNode(message));
  if (kind === 'WARNING') row.className = 'warning';
  get('log').prepend(row);
  while (get('log').children.length > 15) get('log').lastElementChild!.remove();
}

document.addEventListener('keydown', event => {
  if (!simulated || (event.target as HTMLElement).matches('input, select, textarea, [contenteditable]')) return;
  const button = keys[event.code];
  if (!button && !event.key.startsWith('Arrow')) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (button) simulation.press(button);
  else { arrows.add(event.key); updateAxes(); }
}, { capture: true });
document.addEventListener('keyup', event => {
  if (!simulated) return;
  if (keys[event.code]) simulation.release(keys[event.code]!);
  arrows.delete(event.key); updateAxes();
});
window.addEventListener('blur', () => { simulation.reset(); arrows.clear(); });

function updateAxes() {
  simulation.axes(Number(arrows.has('ArrowRight')) - Number(arrows.has('ArrowLeft')), Number(arrows.has('ArrowDown')) - Number(arrows.has('ArrowUp')));
}

function settings() {
  return {
    showHints: get<HTMLInputElement>('show-hints').checked,
    bodyClass: get<HTMLInputElement>('body-class').value,
    elementClass: get<HTMLInputElement>('element-class').value,
    hints: {
      size: Number(get<HTMLInputElement>('size').value),
      placement: get<HTMLSelectElement>('placement').value as HintOptions['placement'],
      skin: get<HTMLSelectElement>('skin').value === 'custom' ? skin : get<HTMLSelectElement>('skin').value as HintOptions['skin'],
    },
  };
}

function boot() {
  closeScope?.(); closeScope = undefined; if (dialog.open) dialog.close();
  pad?.destroy(); simulation.reset(); arrows.clear();
  pad = createGamepadify({ root: stage, source: simulated ? simulation : undefined, navigation: { confirm: 'south' }, ...settings() });
  pad.on('modechange', mode => {
    get('mode').textContent = mode === 'gamepad' ? 'GAMEPAD MODE' : 'POINTER MODE';
    get('mode').classList.toggle('active', mode === 'gamepad');
    record('INPUT', mode === 'gamepad' ? 'Controller prompts on.' : 'Pointer / keyboard restored.');
  });
  pad.on('devicechange', device => {
    get('device').textContent = device ? `${simulated ? 'Simulated · ' : ''}${device.family.toUpperCase()}` : 'Waiting for a controller';
    get('device-dot').classList.toggle('active', !!device);
    get('profile').textContent = device ? `${device.profile.toUpperCase()} MAPPING` : 'GAMEPAD API';
  });
  pad.on('warning', warning => record('WARNING', warning.message));
  pad.on('activate', event => record('ACTION', `${event.buttons.join(' + ')} → ${event.element.dataset.world ?? event.element.textContent?.trim()}`));
  pad.start();
  if (simulated) {
    simulation.press('home');
    setTimeout(() => simulation.release('home'), 100);
  }
}

get('simulate').addEventListener('click', () => {
  simulated = true; get('simulate').classList.add('selected'); get('hardware').classList.remove('selected');
  get('sim-keys').hidden = false;
  get('input-note').textContent = 'No controller needed. Use the keys below. If you move the mouse, press Z once to return.';
  boot();
});
get('hardware').addEventListener('click', () => {
  simulated = false; get('hardware').classList.add('selected'); get('simulate').classList.remove('selected');
  get('sim-keys').hidden = true; get('input-note').textContent = 'Connect a gamepad and press any button. The first press shows your controls.'; boot();
});
for (const id of ['show-hints', 'body-class', 'element-class', 'size', 'skin', 'placement']) get(id).addEventListener('input', () => {
  get('size-value').textContent = `${get<HTMLInputElement>('size').value} px`;
  pad.configure(settings());
});
get('conflict').addEventListener('change', () => { get('duplicate').hidden = !get<HTMLInputElement>('conflict').checked; });
get('collection').addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-world]');
  if (!target) return;
  get('detail-title').textContent = target.dataset.world!;
  get('last-action').textContent = `Opened ${target.dataset.world}.`;
  dialog.showModal(); closeScope = pad.pushScope(dialog);
});
get('close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { closeScope?.(); closeScope = undefined; });
get('help').addEventListener('click', () => { get('last-action').textContent = 'Left stick moves. South opens. West helps. North shuffles.'; });
get('shuffle').addEventListener('click', () => {
  const collection = get('collection'); collection.append(collection.firstElementChild!);
  get('last-action').textContent = 'Collection rotated. Navigation follows the new layout.';
});
get('favorite').addEventListener('click', () => { get('last-action').textContent = 'All six worlds saved to favorites. ☆'; });
boot();
