import { normalizeButton } from './buttons.js';
import { available, inRoot, onScreen } from './dom.js';
import { nearest } from './geometry.js';
import type { Entry, Navigation, NavigationContext } from './features.js';
import type { DeviceProfile, Diagnostic, Direction, PhysicalButton } from './types.js';

const dpad: readonly PhysicalButton[] = ['dpad-up', 'dpad-down', 'dpad-left', 'dpad-right'];

export class SpatialNavigation implements Navigation {
  focused: HTMLElement | null = null;
  private tabIndices = new Map<HTMLElement, string | null>();
  private direction: Direction | null = null;
  private nextMove = 0;

  constructor(private context: NavigationContext) {}

  get confirm(): PhysicalButton | null {
    const options = this.context.options();
    return options ? normalizeButton(options.confirm) : null;
  }

  get selector(): string | null {
    const options = this.context.options();
    return options ? options.selector ?? '[data-gamepad-focusable]:not([data-gamepad-focusable="false"])' : null;
  }

  diagnostics(entries: readonly Entry[]): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const navigation = this.context.options();
    if (navigation) {
      const confirm = normalizeButton(navigation.confirm);
      if (!confirm) diagnostics.push({ code: 'invalid-binding', message: 'Navigation requires a valid confirm button.', buttons: [], elements: [] });
      const reserved = [...confirm ? [confirm] : [], ...navigation.dpad ? dpad : []];
      for (const button of reserved) {
        const conflicts = entries.filter(entry => entry.buttons.includes(button));
        if (conflicts.length) diagnostics.push({ code: 'reserved-button', message: `${button} is reserved by navigation and also appears in a binding. Both uses are blocked.`, buttons: [button], elements: conflicts.map(entry => entry.element) });
      }
    }
    return diagnostics;
  }

  reset(): void { this.direction = null; }

  stop(): void {
    this.reset();
    for (const [element, value] of this.tabIndices) {
      if (element.getAttribute('tabindex') === '-1') {
        if (value === null) element.removeAttribute('tabindex'); else element.setAttribute('tabindex', value);
      }
    }
    this.tabIndices.clear();
  }

  candidates(): HTMLElement[] {
    if (!this.context.options() || !this.context.document()) return [];
    return this.context.entries().filter(entry => entry.binding.focusable && inRoot(this.context.scope(), entry.element) && available(entry.element)).map(entry => entry.element);
  }

  ensureFocus(): void {
    if (!this.context.active()) return;
    const candidates = this.candidates();
    if (this.focused && candidates.includes(this.focused)) return;
    const active = this.context.document()?.activeElement as HTMLElement | null;
    this.setFocus(active && candidates.includes(active) ? active : candidates[0] ?? null, true);
  }

  setFocus(element: HTMLElement | null, move: boolean): void {
    const changed = this.focused !== element;
    this.focused = element;
    if (element && move) {
      if (element.tabIndex < 0 && !element.hasAttribute('tabindex') && !element.matches('button, input, select, textarea, a[href], [contenteditable="true"]')) {
        this.tabIndices.set(element, null);
        element.setAttribute('tabindex', '-1');
      }
      element.focus({ preventScroll: true });
      if (!onScreen(element)) element.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }
    if (changed) this.context.changed(element);
  }

  navigate(pad: Gamepad, profile: DeviceProfile, pressed: ReadonlySet<PhysicalButton>, time: number, reservedConflicts: ReadonlySet<PhysicalButton>): void {
    const options = this.context.options();
    if (!options) return;
    const axes = profile.axes ?? [0, 1];
    let x = pad.axes[axes[0]] ?? 0, y = pad.axes[axes[1]] ?? 0;
    if (options.dpad) {
      if (pressed.has('dpad-left') && !reservedConflicts.has('dpad-left')) x = -1;
      if (pressed.has('dpad-right') && !reservedConflicts.has('dpad-right')) x = 1;
      if (pressed.has('dpad-up') && !reservedConflicts.has('dpad-up')) y = -1;
      if (pressed.has('dpad-down') && !reservedConflicts.has('dpad-down')) y = 1;
    }
    const magnitude = Math.max(Math.abs(x), Math.abs(y));
    if (magnitude < (options.releaseThreshold ?? 0.35)) { this.direction = null; return; }
    if (!this.direction && magnitude < (options.threshold ?? 0.55)) return;
    const direction: Direction = Math.abs(x) >= Math.abs(y) ? x > 0 ? 'right' : 'left' : y > 0 ? 'down' : 'up';
    const changed = direction !== this.direction;
    if (!changed && time < this.nextMove) return;
    this.direction = direction;
    this.nextMove = time + (changed ? options.repeatDelay ?? 300 : options.repeatInterval ?? 100);
    this.ensureFocus();
    if (!this.focused) return;
    const target = nearest(this.focused, this.candidates(), direction);
    if (target) this.setFocus(target, true);
  }
}
