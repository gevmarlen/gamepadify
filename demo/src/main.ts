import { createGamepadify } from 'gamepadify';
import type { Family, GamepadifyController, HintOptions, PhysicalButton, Skin } from 'gamepadify';
import { createCollection } from './collection.js';
import { createDemoSimulator } from './simulator.js';
import './style.css';

const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = get('stage');
const inspector = get('settings');
const dialog = get<HTMLDialogElement>('detail-dialog');
const search = get<HTMLInputElement>('search');
const simulation = createDemoSimulator(get('virtual-pad'));
let simulated = false;
let pad: GamepadifyController;
let closeScope: (() => void) | undefined;
let closeHelpScope: (() => void) | undefined;
let family: Family = 'xbox';
const labels: Record<Family, Partial<Record<PhysicalButton, string>>> = {
  xbox: { south: 'A', east: 'B', west: 'X', north: 'Y', 'left-shoulder': 'LB', 'right-shoulder': 'RB' },
  playstation: { south: '×', east: '○', west: '□', north: '△', 'left-shoulder': 'L1', 'right-shoulder': 'R1' },
  switch: { south: 'B', east: 'A', west: 'Y', north: 'X', 'left-shoulder': 'L', 'right-shoulder': 'R' },
  generic: { south: '1', east: '2', west: '3', north: '4', 'left-shoulder': '5', 'right-shoulder': '6' },
};
const actions: Partial<Record<PhysicalButton, string>> = { south: 'open world', east: 'go back', west: 'help', north: 'shuffle', 'left-shoulder': 'focus search' };
const descriptions: Record<string, string> = {
  Dune: 'Warm light, shifting sand. A quiet landscape shaped by the wind.',
  Orbit: 'A small planet with a long way to go. Follow the ring around its path.',
  Tide: 'Three currents, one rhythm. Let the lines carry your eye across the water.',
  Mono: 'One shape inside another. A study in balance, contrast and symmetry.',
  Bloom: 'A little room to grow. Soft petals gathered around a quiet centre.',
  Echo: 'A signal moving outward. Each circle carries a little of the last.',
};
const paperGlyph = (symbol: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="1" y="1" width="30" height="30" rx="7" fill="#f1e9cf" stroke="#5a6654" stroke-width="2"/><text x="16" y="17" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="18" fill="#25362a">${symbol}</text></svg>`)}`;
const skin: Skin = { name: 'Paper', glyphs: { south: paperGlyph('↗'), east: paperGlyph('↶'), west: paperGlyph('?'), north: paperGlyph('⇄'), 'left-shoulder': paperGlyph('⌕') } };

function record(kind: string, message: string) {
  const row = document.createElement('li');
  const label = document.createElement('span'); label.textContent = kind;
  row.append(label, document.createTextNode(message));
  if (kind === 'WARNING') row.className = 'warning';
  get('log').prepend(row);
  while (get('log').children.length > 15) get('log').lastElementChild!.remove();
}

// Keep native settings usable without reaching the controller's capture listeners.
for (const type of ['pointermove', 'pointerdown', 'keydown']) document.addEventListener(type, event => {
  if (inspector.contains(event.target as Node)) event.stopImmediatePropagation();
}, { capture: true });

function settings() {
  const artwork = get<HTMLSelectElement>('skin').value;
  return {
    showHints: get<HTMLInputElement>('show-hints').checked,
    hints: {
      size: Number(get<HTMLInputElement>('size').value),
      placement: get<HTMLSelectElement>('placement').value as HintOptions['placement'],
      skin: artwork === 'custom' ? skin : artwork as HintOptions['skin'],
    },
  };
}

function currentLabels() {
  const artwork = get<HTMLSelectElement>('skin').value;
  return labels[artwork === 'auto' || artwork === 'custom' ? family : artwork as Family];
}

function updateLabels() {
  const names = currentLabels();
  for (const label of document.querySelectorAll<HTMLElement>('[data-button-label]')) label.textContent = names[label.dataset.buttonLabel as PhysicalButton]!;
  for (const button of document.querySelectorAll<HTMLElement>('[data-pad-button]')) {
    const name = button.dataset.padButton as PhysicalButton;
    button.setAttribute('aria-label', `${names[name]} — ${actions[name]}`);
  }
}

function closeHelp(restoreFocus = false) {
  const active = document.activeElement as HTMLElement | null;
  const release = closeHelpScope;
  get('help-panel').hidden = true;
  closeHelpScope = undefined; release?.();
  get('help').setAttribute('aria-expanded', 'false');
  if (restoreFocus) get('help').focus({ preventScroll: true });
  else if (release && active && !get('help-panel').contains(active)) {
    if (active === document.body) (document.activeElement as HTMLElement | null)?.blur();
    else active.focus({ preventScroll: true });
  }
}

function boot() {
  closeHelp();
  closeScope?.(); closeScope = undefined;
  if (dialog.open) dialog.close();
  pad?.destroy(); simulation.enable(simulated);
  pad = createGamepadify({ root: stage, source: simulated ? simulation.source : undefined, navigation: { confirm: 'xbox:a' }, ...settings() });
  pad.on('modechange', mode => {
    get('mode').textContent = mode === 'gamepad' ? 'GAMEPAD MODE' : 'POINTER MODE';
    get('mode').classList.toggle('active', mode === 'gamepad');
    record('INPUT', mode === 'gamepad' ? 'Controller prompts on.' : 'Pointer / keyboard restored.');
  });
  pad.on('devicechange', device => {
    family = device?.family ?? 'xbox';
    get('device').textContent = device ? `${simulated ? 'Simulated · ' : ''}${device.family.toUpperCase()}` : 'Waiting for a controller';
    get('device-dot').classList.toggle('active', !!device);
    get('profile').textContent = device ? `${device.profile.toUpperCase()} MAPPING` : 'GAMEPAD API';
    updateLabels();
  });
  pad.on('warning', warning => record('WARNING', warning.message));
  pad.on('activate', event => record('ACTION', `${event.buttons.map(button => currentLabels()[button] ?? button).join(' + ')} → ${event.element.dataset.world ?? event.element.getAttribute('placeholder') ?? event.element.textContent?.trim()}`));
  pad.start();
  if (simulated) simulation.wake();
}

for (const id of ['simulate', 'hardware']) get(id).addEventListener('click', () => {
  simulated = id === 'simulate';
  for (const mode of ['simulate', 'hardware']) {
    get(mode).classList.toggle('selected', mode === id);
    get(mode).setAttribute('aria-pressed', String(mode === id));
  }
  get('simulator').hidden = !simulated;
  get('input-note').textContent = simulated ? 'Use the controller below or the keyboard shortcuts.' : 'Connect a gamepad and press any button. The first press shows your controls.';
  boot();
});
for (const id of ['show-hints', 'size', 'skin', 'placement']) get(id).addEventListener('input', () => {
  get('size-value').textContent = `${get<HTMLInputElement>('size').value} px`;
  pad.configure(settings()); updateLabels();
});

const collection = createCollection(get('collection'), count => {
  get('collection-count').textContent = `${count} ${count === 1 ? 'world' : 'worlds'}`;
  get('empty-collection').hidden = count !== 0;
  get<HTMLButtonElement>('shuffle').disabled = count < 2;
});
search.addEventListener('input', () => {
  get('clear-search').hidden = search.value.length === 0;
  void collection.filter(search.value);
});
get('clear-search').addEventListener('click', () => {
  search.value = ''; get('clear-search').hidden = true;
  void collection.filter(''); search.focus();
});
get('shuffle').addEventListener('click', () => {
  const state = pad.getState();
  if (state.mode === 'gamepad') state.focusedElement?.focus({ preventScroll: true });
  void collection.shuffle();
  get('last-action').textContent = 'A new order. Same small worlds.';
});
get('collection').addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-world]');
  if (!target) return;
  closeHelp();
  const name = target.dataset.world!;
  get('detail-title').textContent = name;
  get('detail-description').textContent = descriptions[name]!;
  get('detail-art').replaceChildren(target.querySelector('.art')!.cloneNode(true));
  get('last-action').textContent = `Opened ${name}.`;
  dialog.showModal(); closeScope = pad.pushScope(dialog);
});
get('close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { closeScope?.(); closeScope = undefined; });
get('help').addEventListener('click', () => {
  if (!get('help-panel').hidden) { closeHelp(); return; }
  get('help-panel').hidden = false;
  get('help').setAttribute('aria-expanded', 'true');
  closeHelpScope = pad.pushScope(get('help-panel'));
  get('close-help').focus({ preventScroll: true });
});
get('close-help').addEventListener('click', () => closeHelp(true));
document.addEventListener('click', event => {
  if (!(event.target as Element).closest('.help-anchor, #virtual-pad')) closeHelp();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !get('help-panel').hidden) closeHelp(true);
});
boot();
