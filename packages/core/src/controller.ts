import { asBinding, normalizeTrigger } from './buttons.js';
import { ChordMatcher } from './chords.js';
import { readButtons, resolveProfile } from './devices.js';
import { available, ClassClaims, classTokens, elements, inRoot, onScreen } from './dom.js';
import type { Entry, Features, Navigation, Presentation } from './features.js';
import type { Activation, Binding, BindingInput, DeviceInfo, DeviceProfile, Diagnostic, GamepadifyController, GamepadifyEvents, GamepadifyOptions, GamepadifyState, InputMode, PhysicalButton } from './types.js';

interface Scope { element: HTMLElement; previous: HTMLElement | null }
const roots = new WeakMap<Document, Set<Document | HTMLElement>>();

export class Controller implements GamepadifyController {
  private options: GamepadifyOptions;
  private document: Document | null = null;
  private root: Document | HTMLElement | null = null;
  private running = false;
  private destroyed = false;
  private mode: InputMode = 'pointer';
  private device: DeviceInfo | null = null;
  private gamepad: Gamepad | null = null;
  private profile: DeviceProfile | null = null;
  private navigation: Navigation | undefined;
  private get focused(): HTMLElement | null { return this.navigation?.focused ?? null; }
  private set focused(value: HTMLElement | null) { if (this.navigation) this.navigation.focused = value; }
  private scopes: Scope[] = [];
  private explicit = new Map<HTMLElement, Map<symbol, Binding>>();
  private entries: Entry[] = [];
  private ids = new WeakMap<HTMLElement, string>();
  private nextId = 0;
  private dirty = true;
  private observer: MutationObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private observed = new Set<HTMLElement>();
  private renderer: Presentation | null = null;
  private classes = new ClassClaims();
  private focusClasses = new ClassClaims();
  private frameId: number | null = null;
  private cleanups: (() => void)[] = [];
  private matcher = new ChordMatcher();
  private previousRaw = new Map<number, boolean[]>();
  private armed = false;
  private pointer: readonly [number, number] | null = null;
  private configIssues: Diagnostic[] = [];
  private deviceIssues: Diagnostic[] = [];
  private diagnostics: Diagnostic[] = [];
  private diagnosticKeys = new Set<string>();
  private listeners = new Map<keyof GamepadifyEvents, Set<(value: never) => void>>();

  constructor(options: GamepadifyOptions = {}, private features: Features = {}) {
    this.options = { showHints: features.hints ?? false, bodyClass: '', elementClass: '', chordWindow: 80, warnings: true, ...options };
    this.navigation = features.navigation?.({
      options: () => this.options.navigation,
      document: () => this.document,
      active: () => this.mode === 'gamepad',
      entries: () => this.entries,
      scope: () => this.scope(),
      changed: element => { this.emit('focuschange', element); this.emitState(); },
    });
  }

  start(): this {
    if (this.destroyed) throw new Error('Gamepadify has been destroyed. Create a new controller.');
    if (this.running) return this;
    const root = this.options.root ?? (typeof document !== 'undefined' ? document : null);
    if (!root) return this;
    const doc = root.nodeType === 9 ? root as Document : root.ownerDocument!;
    const view = doc.defaultView;
    if (!view || !doc.body) return this;
    const existing = roots.get(doc) ?? new Set();
    if ([...existing].some(other => other.contains(root) || root.contains(other))) {
      this.setDiagnostics([{ code: 'overlapping-root', message: 'Another running controller owns this root. Share its instance or use disjoint roots.', buttons: [], elements: [] }]);
      return this;
    }
    if (!this.options.source && typeof view.navigator.getGamepads !== 'function') {
      this.setDiagnostics([{ code: 'unavailable', message: 'Gamepad API is unavailable. Use HTTPS or localhost in a supported browser.', buttons: [], elements: [] }]);
      return this;
    }
    this.root = root;
    this.document = doc;
    existing.add(root);
    roots.set(doc, existing);
    this.running = true;
    this.renderer = this.features.presentation?.(doc) ?? null;
    this.dirty = true;
    this.observer = new view.MutationObserver(records => {
      if (records.some(record => !(record.target.nodeType === 1 ? record.target as Element : record.target.parentElement)?.closest('.gamepadify-layer'))) this.dirty = true;
    });
    this.observer.observe(root, { childList: true, subtree: true, attributes: true });
    if (view.ResizeObserver) this.resizeObserver = new view.ResizeObserver(() => { this.dirty = true; });

    const listen = (target: EventTarget, name: string, handler: EventListener, options?: AddEventListenerOptions) => {
      target.addEventListener(name, handler, options);
      this.cleanups.push(() => target.removeEventListener(name, handler, options));
    };
    const leave = () => this.leaveMode();
    listen(doc, 'keydown', leave, { capture: true });
    listen(doc, 'pointerdown', leave, { capture: true, passive: true });
    listen(doc, 'pointermove', event => {
      const pointer = event as PointerEvent;
      if (pointer.pointerType && pointer.pointerType !== 'mouse') return;
      const previous = this.pointer;
      this.pointer = [pointer.clientX, pointer.clientY];
      if (!previous || pointer.clientX !== previous[0] || pointer.clientY !== previous[1]) this.leaveMode();
    }, { capture: true, passive: true });
    listen(doc, 'focusin', event => {
      const target = event.target as HTMLElement;
      if (this.mode === 'gamepad' && this.navigation?.candidates().includes(target)) this.navigation.setFocus(target, false);
    });
    const suspend = () => { this.leaveMode(); this.previousRaw.clear(); this.cancelFrame(); };
    listen(view, 'blur', suspend);
    listen(view, 'focus', () => this.schedule());
    listen(doc, 'visibilitychange', () => { if (doc.hidden) suspend(); else this.schedule(); });
    listen(view, 'gamepadconnected', () => this.schedule());
    listen(view, 'gamepaddisconnected', event => {
      if ((event as GamepadEvent).gamepad.index === this.device?.index) this.disconnect();
    });
    this.reconcile();
    this.refresh();
    this.schedule();
    this.emitState();
    return this;
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.cancelFrame();
    this.leaveMode();
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    this.observer = null;
    this.resizeObserver = null;
    this.observed.clear();
    this.cleanups.splice(0).forEach(cleanup => cleanup());
    this.renderer?.destroy();
    this.renderer = null;
    if (this.document && this.root) roots.get(this.document)?.delete(this.root);
    this.navigation?.stop();
    this.previousRaw.clear();
    this.disconnect();
    this.entries = [];
    this.emitState();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.stop();
    this.destroyed = true;
    this.explicit.clear();
    this.scopes = [];
    this.focused = null;
    this.listeners.clear();
    this.diagnostics = [];
    this.configIssues = [];
    this.deviceIssues = [];
    this.document = null;
    this.root = null;
  }

  configure(options: Partial<GamepadifyOptions>): void {
    if (this.destroyed) throw new Error('Gamepadify has been destroyed.');
    const restart = this.running && options.root !== undefined && options.root !== this.root;
    if (restart) { this.stop(); this.scopes = []; this.focused = null; }
    if (options.source !== undefined && options.source !== this.options.source) { this.disconnect(); this.previousRaw.clear(); }
    this.options = { ...this.options, ...options, hints: { ...this.options.hints, ...options.hints } };
    this.matcher.reset();
    this.armed = false;
    this.navigation?.reset();
    this.dirty = true;
    if (this.gamepad) this.selectDevice(this.gamepad);
    if (restart) this.start();
    else if (this.running) { this.reconcile(); this.refresh(); }
  }

  bind(element: HTMLElement, input: BindingInput): () => void {
    if (this.destroyed) throw new Error('Gamepadify has been destroyed.');
    const token = Symbol();
    const registrations = this.explicit.get(element) ?? new Map();
    registrations.set(token, asBinding(input));
    this.explicit.set(element, registrations);
    this.dirty = true;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      registrations.delete(token);
      if (!registrations.size) this.explicit.delete(element);
      this.dirty = true;
    };
  }

  pushScope(element: HTMLElement): () => void {
    const root = this.root ?? this.options.root;
    if (root && !inRoot(root, element)) throw new Error('The scope must belong to the controller root.');
    const scope = { element, previous: this.focused };
    this.scopes.push(scope);
    this.scopeChanged();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const top = this.scopes.at(-1) === scope;
      this.scopes = this.scopes.filter(item => item !== scope);
      if (top) { this.focused = scope.previous; this.scopeChanged(); }
    };
  }

  on<K extends keyof GamepadifyEvents>(event: K, listener: (value: GamepadifyEvents[K]) => void): () => void {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener as (value: never) => void);
    this.listeners.set(event, listeners);
    return () => { listeners.delete(listener as (value: never) => void); };
  }

  getState(): GamepadifyState {
    return { running: this.running, mode: this.mode, device: this.device ? { ...this.device } : null, focusedElement: this.focused, diagnostics: this.diagnostics.map(item => ({ ...item, buttons: [...item.buttons], elements: [...item.elements] })) };
  }

  private emit<K extends keyof GamepadifyEvents>(event: K, value: GamepadifyEvents[K]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(value as never);
  }

  private emitState(): void { this.emit('statechange', this.getState()); }
  private scope(): Document | HTMLElement { return this.scopes.at(-1)?.element ?? this.root!; }
  private id(element: HTMLElement): string {
    let id = this.ids.get(element);
    if (!id) { id = `e${++this.nextId}`; this.ids.set(element, id); }
    return id;
  }

  private schedule(): void {
    const view = this.document?.defaultView;
    if (this.running && view && !this.document!.hidden && this.document!.hasFocus() && this.frameId === null) this.frameId = view.requestAnimationFrame(time => {
      try { this.tick(time); } finally { this.schedule(); }
    });
  }

  private cancelFrame(): void {
    if (this.frameId !== null) this.document?.defaultView?.cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  private tick(time: number): void {
    this.frameId = null;
    if (!this.running || !this.document || this.document.hidden) return;
    if (!this.document.hasFocus()) { this.leaveMode(); return; }
    if (this.scopes.some(scope => !scope.element.isConnected)) {
      this.scopes = this.scopes.filter(scope => scope.element.isConnected);
      this.scopeChanged();
    }
    if (this.dirty) this.reconcile();
    const active = this.refresh();
    let pads: readonly (Gamepad | null)[];
    try { pads = this.options.source?.getGamepads() ?? this.document.defaultView!.navigator.getGamepads(); }
    catch {
      this.deviceIssues = [{ code: 'unavailable', message: 'The browser denied Gamepad API access. Check the secure context and gamepad Permissions Policy.', buttons: [], elements: [] }];
      this.refresh();
      this.leaveMode();
      return;
    }
    const connected = pads.filter((pad): pad is Gamepad => !!pad?.connected);
    if (this.device && !connected.some(pad => pad.index === this.device!.index)) this.disconnect();
    let pressedPad: Gamepad | null = null;
    for (const pad of connected) {
      const state = pad.buttons.map(button => button.pressed || button.value >= 0.5);
      const previous = this.previousRaw.get(pad.index) ?? [];
      if (state.some((pressed, index) => pressed && !previous[index]) && (!pressedPad || pad.index === this.device?.index)) pressedPad = pad;
      this.previousRaw.set(pad.index, state);
    }
    for (const index of this.previousRaw.keys()) if (!connected.some(pad => pad.index === index)) this.previousRaw.delete(index);
    if (pressedPad && (this.mode !== 'gamepad' || pressedPad.index !== this.device?.index)) {
      this.selectDevice(pressedPad);
      if (this.profile) {
        this.mode = 'gamepad';
        this.armed = false;
        this.matcher.reset();
        this.navigation?.ensureFocus();
        this.emit('modechange', this.mode);
        this.emitState();
      }
    }
    if (this.mode === 'gamepad' && this.device && this.profile) {
      const pad = connected.find(item => item.index === this.device!.index);
      if (pad) {
        this.gamepad = pad;
        const pressed = readButtons(pad, this.profile);
        if (!this.armed) {
          if (!pad.buttons.some(button => button.pressed || button.value >= 0.5)) { this.armed = true; this.matcher.reset(pressed); }
        } else {
          const confirm = this.navigation?.confirm;
          const reservedConflicts = new Set(this.diagnostics.filter(item => item.code === 'reserved-button').flatMap(item => item.buttons));
          const targets = active.filter(entry => !this.isBlocked(entry));
          const matches = targets.map(entry => ({ id: entry.id, buttons: entry.buttons }));
          if (confirm && !reservedConflicts.has(confirm) && this.focused && this.navigation?.candidates().includes(this.focused)) matches.push({ id: 'confirm', buttons: [confirm] });
          const result = this.matcher.sample(pressed, matches, time, Math.max(0, this.options.chordWindow ?? 80));
          for (const ids of result.ambiguous) {
            const entries = targets.filter(entry => ids.includes(entry.id));
            const warning: Diagnostic = { code: 'ambiguous-chord', message: 'Overlapping chords of equal length match this press. Neither action was activated.', buttons: [...new Set(entries.flatMap(entry => entry.buttons))], elements: entries.map(entry => entry.element) };
            this.emitWarning(warning);
          }
          for (const id of result.fired) {
            if (this.mode !== 'gamepad' || !this.running) break;
            if (id === 'confirm' && this.focused && confirm) {
              const entry = this.entries.find(item => item.element === this.focused);
              this.activate(this.focused, [confirm], 'confirm', entry?.binding);
            } else {
              const target = targets.find(entry => entry.id === id);
              if (target && inRoot(this.scope(), target.element) && onScreen(target.element)) this.activate(target.element, target.buttons, 'binding', target.binding);
            }
          }
          if (this.mode === 'gamepad' && this.running && this.armed) this.navigation?.navigate(pad, this.profile, pressed, time, reservedConflicts);
        }
      }
    }
    if (this.running) { this.refresh(); this.schedule(); }
  }

  private selectDevice(gamepad: Gamepad): void {
    const profile = resolveProfile(gamepad, this.options.profiles);
    this.profile = profile;
    this.gamepad = gamepad;
    this.deviceIssues = [];
    if (!profile) {
      this.deviceIssues = [{ code: 'unsupported-gamepad', message: `No standard mapping or custom profile for "${gamepad.id}". Supply a DeviceProfile before binding actions.`, buttons: [], elements: [] }];
      this.leaveMode();
      this.device = null;
    } else this.device = { id: gamepad.id, index: gamepad.index, profile: profile.name, family: this.options.family && this.options.family !== 'auto' ? this.options.family : profile.family };
    this.emit('devicechange', this.device);
    this.emitState();
  }

  private disconnect(): void {
    this.leaveMode();
    if (this.device) { this.device = null; this.emit('devicechange', null); }
    this.profile = null;
    this.gamepad = null;
    this.deviceIssues = [];
    this.emitState();
  }

  private leaveMode(): void {
    this.matcher.reset();
    this.armed = false;
    this.navigation?.reset();
    this.classes.clear();
    this.focusClasses.clear();
    this.renderer?.hide();
    if (this.mode === 'gamepad') { this.mode = 'pointer'; this.emit('modechange', this.mode); this.emitState(); }
  }

  private scopeChanged(): void {
    this.matcher.reset();
    this.armed = false;
    this.navigation?.reset();
    this.dirty = true;
    if (this.running) { this.reconcile(); this.navigation?.ensureFocus(); if (this.focused && this.mode === 'gamepad') this.navigation?.setFocus(this.focused, true); this.refresh(); }
  }

  private query(selector: string): HTMLElement[] {
    try { return elements(this.scope(), selector); }
    catch { this.configIssues.push({ code: 'invalid-selector', message: `Invalid CSS selector: ${selector}`, buttons: [], elements: [] }); return []; }
  }

  private reconcile(): void {
    this.dirty = false;
    this.configIssues = [];
    const values = new Map<HTMLElement, Binding>();
    for (const element of this.query('[data-gamepad], [data-gamepad-focusable]')) {
      const raw = element.getAttribute('data-gamepad');
      values.set(element, { ...(raw !== null ? { button: raw as Binding['button'] } : {}), focusable: element.hasAttribute('data-gamepad-focusable') && element.getAttribute('data-gamepad-focusable') !== 'false' });
    }
    if (this.navigation?.selector) for (const element of this.query(this.navigation.selector)) values.set(element, { ...values.get(element), focusable: true });
    for (const [selector, input] of Object.entries(this.options.bindings ?? {})) {
      for (const element of this.query(selector)) values.set(element, { focusable: values.get(element)?.focusable, ...asBinding(input) });
    }
    for (const [element, registrations] of this.explicit) {
      const binding: Binding = Object.assign({}, ...registrations.values());
      if (binding && inRoot(this.scope(), element)) values.set(element, { focusable: values.get(element)?.focusable, ...binding });
    }
    this.entries = [];
    for (const [element, binding] of values) {
      if (binding.enabled === false) continue;
      const buttons = binding.button === undefined ? [] : normalizeTrigger(binding.button);
      if (buttons === null) {
        this.configIssues.push({ code: 'invalid-binding', message: `Invalid button or chord: ${String(binding.button)}. Use physical names or platform-prefixed aliases.`, buttons: [], elements: [element] });
        continue;
      }
      if (!buttons.length && !binding.focusable) continue;
      this.entries.push({ id: this.id(element), element, binding, buttons });
    }
    this.entries.sort((a, b) => a.element.compareDocumentPosition(b.element) & 2 ? 1 : -1);
    const observed = new Set(this.entries.map(entry => entry.element));
    for (const element of this.observed) if (!observed.has(element)) this.resizeObserver?.unobserve(element);
    for (const element of observed) if (!this.observed.has(element)) this.resizeObserver?.observe(element);
    this.observed = observed;
  }

  private refresh(): Entry[] {
    if (!this.running) return [];
    const eligible = this.entries.filter(entry => available(entry.element) && inRoot(this.scope(), entry.element));
    const visible = eligible.filter(entry => onScreen(entry.element));
    const diagnostics = [...this.configIssues, ...this.deviceIssues];
    const groups = new Map<string, Entry[]>();
    for (const entry of visible) if (entry.buttons.length) {
      const key = entry.buttons.join('+');
      groups.set(key, [...groups.get(key) ?? [], entry]);
    }
    for (const [key, group] of groups) if (group.length > 1) diagnostics.push({ code: 'duplicate-binding', message: `Multiple visible elements use ${key}. These actions are blocked until the conflict is resolved.`, buttons: group[0]!.buttons, elements: group.map(entry => entry.element) });
    diagnostics.push(...(this.navigation?.diagnostics(this.entries) ?? []));
    if (!this.navigation && this.options.navigation) diagnostics.push({ code: 'missing-feature', message: 'Navigation is not included in this entry point. Import gamepadify/navigation or gamepadify.', buttons: [], elements: [] });
    if (!this.features.hints && this.options.showHints) diagnostics.push({ code: 'missing-feature', message: 'Hints are not included in this entry point. Import gamepadify/hints or gamepadify.', buttons: [], elements: [] });
    this.setDiagnostics(diagnostics);
    if (this.mode === 'gamepad') {
      this.navigation?.ensureFocus();
      const wanted = new Map<HTMLElement, Set<string>>();
      const add = (element: HTMLElement, tokens: string[]) => wanted.set(element, new Set([...(wanted.get(element) ?? []), ...tokens]));
      add(this.document!.body, classTokens(this.options.bodyClass));
      add(this.root!.nodeType === 9 ? this.document!.body : this.root as HTMLElement, ['gamepadify-mode']);
      for (const entry of this.entries) add(entry.element, classTokens(this.options.elementClass));
      this.classes.sync(wanted);
      if (this.renderer) {
        this.focusClasses.sync(new Map(this.entries.map(entry => [entry.element, new Set(['gamepadify-native-focus'])])));
        this.renderer.render({ entries: this.entries, visible, focused: this.focused, confirm: this.navigation?.confirm ?? null, scope: this.scope(), family: this.device?.family ?? 'generic', options: this.options });
      }
    }
    return visible.filter(entry => entry.buttons.length);
  }

  private isBlocked(entry: Entry): boolean {
    return this.diagnostics.some(issue => (issue.code === 'duplicate-binding' || issue.code === 'reserved-button') && issue.elements.includes(entry.element));
  }

  private setDiagnostics(diagnostics: Diagnostic[]): void {
    const keys = new Set(diagnostics.map(issue => `${issue.code}:${issue.message}:${issue.elements.map(element => this.id(element)).join(',')}`));
    for (const issue of diagnostics) {
      const key = `${issue.code}:${issue.message}:${issue.elements.map(element => this.id(element)).join(',')}`;
      if (!this.diagnosticKeys.has(key)) this.emitWarning(issue);
    }
    const changed = keys.size !== this.diagnosticKeys.size || [...keys].some(key => !this.diagnosticKeys.has(key));
    this.diagnosticKeys = keys;
    this.diagnostics = diagnostics;
    if (changed) this.emitState();
  }

  private emitWarning(issue: Diagnostic): void {
    if (this.options.warnings !== false) console.warn(`[gamepadify:${issue.code}] ${issue.message}`, ...issue.elements);
    this.emit('warning', issue);
  }

  private activate(element: HTMLElement, buttons: readonly PhysicalButton[], source: Activation['source'], binding?: Binding): void {
    if (!available(element) || !inRoot(this.scope(), element)) return;
    const activation = { element, buttons, gamepad: this.gamepad, source };
    element.focus({ preventScroll: true });
    if (binding?.action) binding.action(activation); else element.click();
    this.emit('activate', activation);
  }
}
