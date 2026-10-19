# API reference

All public types are exported by `gamepadify`. See `packages/core/src/types.ts` for the complete declarations.

## Controller

```ts
createGamepadify(options?: GamepadifyOptions): GamepadifyController
```

| Method | Result | Behavior |
| --- | --- | --- |
| `start()` | controller | Idempotent client startup; SSR is a no-op |
| `stop()` | void | Stop polling, remove DOM resources and release claimed classes |
| `destroy()` | void | Stop and permanently release registrations/subscriptions |
| `configure(options)` | void | Shallow merge options; merge `hints` fields; replace maps/navigation/profiles |
| `bind(element, input)` | disposer | Register a typed trigger or binding object |
| `pushScope(element)` | disposer | Limit all bindings/navigation to a subtree |
| `on(event, listener)` | disposer | Subscribe to a typed event |
| `getState()` | state snapshot | Running state, mode, device, focused navigation element, diagnostics |

Disposers are idempotent. Calling `start`, `bind` or `configure` after `destroy` throws. Keep a scope inside the controller's root. Pop scopes when closing dialogs; removed scope nodes are automatically pruned.

Multiple instances may own disjoint roots. Overlapping running roots are rejected with `overlapping-root` so the same input cannot activate multiple controllers on the same subtree.

## Options

`root` defaults to the current document at startup. Use an element to isolate a widget. Mouse cursor hiding is limited to that root; `bodyClass` always applies to its document's body.

`bindings` is a selector-to-`BindingInput` map. All matching elements register; duplicates on different visible elements produce a conflict.

`navigation` defaults to disabled. It accepts `confirm`, `selector`, `dpad`, `threshold`, `releaseThreshold`, `repeatDelay` and `repeatInterval`. Supply finite positive values for sizes/timings and a release threshold below the engagement threshold.

`showHints` defaults to true. `bodyClass` and `elementClass` default to an empty string. Both class settings accept whitespace-separated names. Classes belong to the active scope and only exist during gamepad mode. Preexisting classes are preserved and disjoint controllers share reference-counted ownership.

`hints` accepts `size`, `placement`, `offset`, `offsetX`, `offsetY` and `skin`. Placements: `top`, `top-start`, `top-end`, `bottom`, `bottom-start`, `bottom-end`, `left`, `right`. Start/end are physical left/right. Positions are clamped inside the viewport. Prompts follow moving and scrolling elements.

`warnings: false` disables console logging, not diagnostic events or conflict blocking. `chordWindow` defaults to 80 milliseconds.

## Binding

```ts
interface Binding {
  button?: Button | readonly [Button, Button, ...Button[]];
  focusable?: boolean;
  enabled?: boolean;
  action?: (activation: Activation) => void;
  hint?: HintOptions;
}
```

A string button or tuple is shorthand for `{ button }`. `enabled: false` unregisters this effective binding. `focusable: true` includes an element in explicit navigation. A binding can have both fields, but its button must not contain a reserved navigation button.

In data attributes, `data-gamepad="left-shoulder+north"` is parsed at runtime. Invalid/duplicate button names produce a diagnostic. `data-gamepad-focusable="false"` opts out of the default navigation selector. A custom selector explicitly includes its matches. Framework focusable directives accept `false` directly.

At the same precedence level, the last registered field wins. Releasing that registration restores the preceding registration. Element contents and event handlers remain owned by the application.

## Events

| Event | Payload |
| --- | --- |
| `modechange` | `'pointer' \| 'gamepad'` |
| `devicechange` | `DeviceInfo \| null` |
| `focuschange` | `HTMLElement \| null` |
| `activate` | `{ element, buttons, gamepad, source: 'binding' \| 'confirm' }` |
| `warning` | `{ code, message, buttons, elements }` |
| `statechange` | `GamepadifyState` |

Diagnostic codes: `duplicate-binding`, `reserved-button`, `ambiguous-chord`, `invalid-binding`, `invalid-selector`, `unsupported-gamepad`, `unavailable`, `overlapping-root`.

Callbacks run synchronously. Handle application errors inside your callbacks when appropriate; an uncaught error is reported by the browser while the next polling frame remains scheduled. State snapshots copy diagnostics and device metadata; element references are live DOM objects.

## Profiles

```ts
import type { DeviceProfile } from 'gamepadify';

const profile: DeviceProfile = {
  name: 'My USB controller',
  family: 'generic',
  match: /My USB controller/i,
  buttons: { south: 2, east: 1, west: 3, north: 0, start: 9 },
  axes: [0, 1],
};

const pad = createGamepadify({ profiles: [profile] });
```

Custom profiles are checked in order before the browser's standard mapping. `match` also accepts a function receiving the raw Gamepad. Axis indices must refer to normalized left/right and up/down axes. Profile remapping does not currently invert axes or convert analog axes into trigger buttons.

A button is down when its `pressed` flag is true or its value reaches 0.5. Any raw available button can wake a mapped controller. All raw buttons must be released before actions are armed.

## Testing source

```ts
import { createGamepadSimulator } from 'gamepadify/testing';

const source = createGamepadSimulator('xbox');
const pad = createGamepadify({ source });
pad.start();

source.press('home');
source.release('home');
source.press('south');
source.release('south');
source.axes(1, 0);
source.axes(0, 0);
source.disconnect();
```

Allow at least one animation frame between a press and release. The simulator has `connect(family)`, `disconnect()` and `reset()` methods. It implements the public `GamepadSource` interface and never patches `navigator`. The browser-only optional bundle exposes `GamepadifyTesting.createGamepadSimulator`; it is separate from the production core.

Custom sources can expose multiple controllers for tests or an external input bridge.
