import type { Binding, Diagnostic, DeviceProfile, Family, GamepadifyOptions, NavigationOptions, PhysicalButton } from './types.js';

export interface Entry { id: string; element: HTMLElement; binding: Binding; buttons: PhysicalButton[] }

export interface NavigationContext {
  options(): NavigationOptions | false | undefined;
  document(): Document | null;
  active(): boolean;
  entries(): readonly Entry[];
  scope(): Document | HTMLElement;
  changed(element: HTMLElement | null): void;
}

export interface Navigation {
  focused: HTMLElement | null;
  readonly confirm: PhysicalButton | null;
  readonly selector: string | null;
  candidates(): HTMLElement[];
  ensureFocus(): void;
  setFocus(element: HTMLElement | null, move: boolean): void;
  navigate(pad: Gamepad, profile: DeviceProfile, pressed: ReadonlySet<PhysicalButton>, time: number, blocked: ReadonlySet<PhysicalButton>): void;
  diagnostics(entries: readonly Entry[]): Diagnostic[];
  reset(): void;
  stop(): void;
}

export interface RenderState {
  entries: readonly Entry[];
  visible: readonly Entry[];
  focused: HTMLElement | null;
  confirm: PhysicalButton | null;
  scope: Document | HTMLElement;
  family: Family;
  options: GamepadifyOptions;
}

export interface Presentation {
  render(state: RenderState): void;
  hide(): void;
  destroy(): void;
}

export interface Features {
  navigation?: (context: NavigationContext) => Navigation;
  presentation?: (document: Document) => Presentation;
  hints?: boolean;
}
