export type PhysicalButton =
  | 'south' | 'east' | 'west' | 'north'
  | 'left-shoulder' | 'right-shoulder' | 'left-trigger' | 'right-trigger'
  | 'select' | 'start' | 'left-stick' | 'right-stick'
  | 'dpad-up' | 'dpad-down' | 'dpad-left' | 'dpad-right' | 'home';

export type ButtonAlias =
  | `xbox:${'a' | 'b' | 'x' | 'y' | 'lb' | 'rb' | 'lt' | 'rt' | 'view' | 'menu' | 'ls' | 'rs' | 'home'}`
  | `ps:${'cross' | 'circle' | 'square' | 'triangle' | 'l1' | 'r1' | 'l2' | 'r2' | 'create' | 'options' | 'l3' | 'r3' | 'home'}`
  | `switch:${'b' | 'a' | 'y' | 'x' | 'l' | 'r' | 'zl' | 'zr' | 'minus' | 'plus' | 'ls' | 'rs' | 'home'}`;

export type Button = PhysicalButton | ButtonAlias;
export type Chord = readonly [Button, Button, ...Button[]];
export type Trigger = Button | Chord;
export type Family = 'xbox' | 'playstation' | 'switch' | 'generic';
export type InputMode = 'pointer' | 'gamepad';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Placement = 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'right';

export interface Glyph {
  url: string;
  label?: string;
  atlas?: { x: number; y: number; width: number; height: number; sheetWidth: number; sheetHeight: number };
}

export interface Skin {
  name: string;
  glyphs: Partial<Record<PhysicalButton, string | Glyph>>;
}

export interface HintOptions {
  size?: number;
  placement?: Placement;
  offset?: number;
  offsetX?: number;
  offsetY?: number;
  skin?: 'auto' | Family | Skin;
}

export interface Activation {
  element: HTMLElement;
  buttons: readonly PhysicalButton[];
  gamepad: Gamepad | null;
  source: 'binding' | 'confirm';
}

export interface Binding {
  button?: Trigger;
  focusable?: boolean;
  enabled?: boolean;
  action?: (activation: Activation) => void;
  hint?: HintOptions;
}

export type BindingInput = Trigger | Binding;

export interface DeviceProfile {
  name: string;
  family: Family;
  match: RegExp | ((gamepad: Gamepad) => boolean);
  buttons: Partial<Record<PhysicalButton, number>>;
  axes?: readonly [number, number];
}

export interface NavigationOptions {
  confirm: Button;
  selector?: string;
  dpad?: boolean;
  threshold?: number;
  releaseThreshold?: number;
  repeatDelay?: number;
  repeatInterval?: number;
}

export interface GamepadSource {
  getGamepads(): readonly (Gamepad | null)[];
}

export interface GamepadifyOptions {
  root?: Document | HTMLElement;
  bindings?: Readonly<Record<string, BindingInput>>;
  navigation?: NavigationOptions | false;
  showHints?: boolean;
  bodyClass?: string;
  elementClass?: string;
  hints?: HintOptions;
  family?: Family | 'auto';
  profiles?: readonly DeviceProfile[];
  chordWindow?: number;
  warnings?: boolean;
  source?: GamepadSource;
}

export type DiagnosticCode = 'duplicate-binding' | 'reserved-button' | 'ambiguous-chord' | 'invalid-binding' | 'invalid-selector' | 'unsupported-gamepad' | 'unavailable' | 'overlapping-root';

export interface Diagnostic {
  code: DiagnosticCode;
  message: string;
  buttons: readonly PhysicalButton[];
  elements: readonly HTMLElement[];
}

export interface DeviceInfo {
  id: string;
  index: number;
  family: Family;
  profile: string;
}

export interface GamepadifyState {
  running: boolean;
  mode: InputMode;
  device: DeviceInfo | null;
  focusedElement: HTMLElement | null;
  diagnostics: readonly Diagnostic[];
}

export interface GamepadifyEvents {
  modechange: InputMode;
  devicechange: DeviceInfo | null;
  focuschange: HTMLElement | null;
  activate: Activation;
  warning: Diagnostic;
  statechange: GamepadifyState;
}

export interface GamepadifyController {
  start(): GamepadifyController;
  stop(): void;
  destroy(): void;
  configure(options: Partial<GamepadifyOptions>): void;
  bind(element: HTMLElement, binding: BindingInput): () => void;
  pushScope(element: HTMLElement): () => void;
  on<K extends keyof GamepadifyEvents>(event: K, listener: (value: GamepadifyEvents[K]) => void): () => void;
  getState(): GamepadifyState;
}
