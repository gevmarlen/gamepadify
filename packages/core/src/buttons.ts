import type { Binding, BindingInput, Family, PhysicalButton, Trigger } from './types.js';

export const buttons = [
  'south', 'east', 'west', 'north', 'left-shoulder', 'right-shoulder',
  'left-trigger', 'right-trigger', 'select', 'start', 'left-stick', 'right-stick',
  'dpad-up', 'dpad-down', 'dpad-left', 'dpad-right', 'home',
] as const satisfies readonly PhysicalButton[];

const aliases = new Map<string, PhysicalButton>();
const names: Record<Exclude<Family, 'generic'>, readonly string[]> = {
  xbox: ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'view', 'menu', 'ls', 'rs', 'home'],
  playstation: ['cross', 'circle', 'square', 'triangle', 'l1', 'r1', 'l2', 'r2', 'create', 'options', 'l3', 'r3', 'home'],
  switch: ['b', 'a', 'y', 'x', 'l', 'r', 'zl', 'zr', 'minus', 'plus', 'ls', 'rs', 'home'],
};

for (const [family, labels] of Object.entries(names)) {
  labels.forEach((label, index) => aliases.set(`${family === 'playstation' ? 'ps' : family}:${label}`, buttons[index === 12 ? 16 : index]!));
}

export function normalizeButton(button: unknown): PhysicalButton | null {
  if (typeof button !== 'string') return null;
  const value = button.trim().toLowerCase();
  return buttons.includes(value as PhysicalButton) ? value as PhysicalButton : aliases.get(value) ?? null;
}

export function normalizeTrigger(value: unknown): PhysicalButton[] | null {
  const parts = typeof value === 'string' ? value.split('+') : Array.isArray(value) ? value : [];
  if (!parts.length || parts.some(part => typeof part !== 'string')) return null;
  const normalized = parts.map(normalizeButton).filter((button): button is PhysicalButton => button !== null);
  if (normalized.length !== parts.length || new Set(normalized).size !== parts.length) return null;
  return normalized.sort((a, b) => buttons.indexOf(a) - buttons.indexOf(b));
}

export function asBinding(input: BindingInput): Binding {
  return typeof input === 'string' || Array.isArray(input) ? { button: input as Trigger } : input as Binding;
}

export function buttonLabel(button: PhysicalButton, family: Family): string {
  const index = buttons.indexOf(button);
  if (family !== 'generic' && (index < 12 || index === 16)) {
    const label = names[family][index === 16 ? 12 : index]!;
    return ({ cross: '×', circle: '○', square: '□', triangle: '△' } as Record<string, string>)[label] ?? label.toUpperCase();
  }
  return ({ south: '↓', east: '→', west: '←', north: '↑', 'dpad-up': 'D↑', 'dpad-down': 'D↓', 'dpad-left': 'D←', 'dpad-right': 'D→' } as Partial<Record<PhysicalButton, string>>)[button] ?? button.toUpperCase();
}
