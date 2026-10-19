# API reference

All public types are exported by `gamepadify`. See `packages/core/src/types.ts` for the complete declarations.

The same factory, controller interface and types are exported by `gamepadify/core`, `gamepadify/navigation` and `gamepadify/hints`. These entry points choose the included features; see [smaller builds](bundles.md).

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

Disposers are idempotent. Calling `start`, `bind`, `configure` or `pushScope` after `destroy` throws. Keep a scope inside the controller's root. Pop scopes when closing dialogs; removed scope nodes are automatically pruned. Changing roots discards old scopes, including while stopped.

Multiple instances may own disjoint roots. Overlapping running roots are rejected with `overlapping-root` so the same input cannot activate multiple controllers on the same subtree.

## Options

`root` defaults to the current document at startup. Use an element to isolate a widget. Mouse cursor hiding is limited to that root; `bodyClass` always applies to its document's body.

`bindings` is a selector-to-`BindingInput` map. All matching elements register; duplicates on different visible elements produce a conflict.

Use structural selectors for registration. DOM changes invalidate selector matches; transient pseudo-classes such as `:hover` are not continuously queried. Visibility, CSS animation, clipping and disabled state are checked separately during polling.

`navigation` defaults to disabled. It accepts `confirm`, `selector`, `dpad`, `threshold`, `releaseThreshold`, `repeatDelay` and `repeatInterval`. Supply finite positive values for sizes/timings and a release threshold below the engagement threshold.

`showHints` defaults to true in the full and hints builds, and false in core and navigation. `bodyClass` and `elementClass` default to an empty string. Both class settings accept whitespace-separated names. Classes belong to the active scope and only exist during gamepad mode. Preexisting classes are preserved and disjoint controllers share reference-counted ownership.

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

Explicit registrations override selector maps, which override data attributes. The default action focuses the element and calls `.click()`; `action` replaces that click. Re-register a binding after changing its trigger. Framework adapters track changes through their lifecycle APIs.

## Events

| Event | Payload |
| --- | --- |
| `modechange` | `'pointer' \| 'gamepad'` |
| `devicechange` | `DeviceInfo \| null` |
| `focuschange` | `HTMLElement \| null` |
| `activate` | `{ element, buttons, gamepad, source: 'binding' \| 'confirm' }` |
| `warning` | `{ code, message, buttons, elements }` |
| `statechange` | `GamepadifyState` |

Diagnostic codes: `duplicate-binding`, `reserved-button`, `ambiguous-chord`, `invalid-binding`, `invalid-selector`, `unsupported-gamepad`, `unavailable`, `overlapping-root`, `missing-feature`.

`missing-feature` reports enabled navigation or prompts absent from the selected build. Import a build containing that feature; configuration changes cannot add code that was excluded at build time.

Callbacks run synchronously. Errors propagate to the caller or the browser; the next polling frame remains scheduled. `stop()` and `destroy()` finish resource cleanup before notifying listeners. Diagnostics are committed before warning callbacks run. Exceptions from a custom input source are propagated, while browser Gamepad API permission failures produce `unavailable`. State snapshots copy diagnostics and device metadata; element references are live DOM objects.

Changing only presentation settings keeps input armed. Changes to bindings, navigation, source, profiles, chord timing or scopes reset pending combinations and wait for release.

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

## Buttons and chords

| Position | Xbox alias | PlayStation alias | Switch alias |
| --- | --- | --- | --- |
| `south` | `xbox:a` | `ps:cross` | `switch:b` |
| `east` | `xbox:b` | `ps:circle` | `switch:a` |
| `west` | `xbox:x` | `ps:square` | `switch:y` |
| `north` | `xbox:y` | `ps:triangle` | `switch:x` |

Other physical names: `left-shoulder`, `right-shoulder`, `left-trigger`, `right-trigger`, `left-stick`, `right-stick`, `select`, `start`, `home`, and `dpad-up/down/left/right`.

Aliases always denote a physical position, regardless of the connected controller. Plain `A` or `X` is rejected. In TypeScript use a typed tuple for a chord; in HTML use `+`:

```ts
import type { Chord } from 'gamepadify';

const favorite: Chord = ['left-shoulder', 'north'];
```

Button order does not matter. When a single binding overlaps a longer chord, only the ambiguous action waits for the default 80 ms chord window. The longest match wins. Releasing a chord does not fire its shorter bindings; adding a button after an action has already fired does not trigger another overlapping action. You can hold a modifier and repeatedly press the other button. Equally long overlapping matches are blocked and reported.

These are simultaneous controller combinations, not keyboard shortcuts or input sequences.


## Navigation and dialogs

```html
<button data-gamepad-focusable>First</button>
<button data-gamepad-focusable>Second</button>
```

```ts
const pad = createGamepadify({
  navigation: {
    confirm: 'east',
    selector: '[data-gamepad-focusable]',
    dpad: false,
  },
});

dialog.showModal();
const closeScope = pad.pushScope(dialog);
dialog.addEventListener('close', closeScope, { once: true });
```

Navigation is opt-in; `confirm` is required. It is reserved throughout the active scope, including inside chords. A conflicting binding and that reserved action are blocked until the conflict disappears. Enabling D-pad navigation reserves its four buttons too.

The left stick chooses one direction using its dominant axis. Navigation prefers elements in the same directional lane, then the nearest rectangle, then DOM order. It starts at the current eligible DOM focus or the first eligible element. Offscreen targets scroll into view, including nested containers. There is no wraparound.

Default stick thresholds are **0.55** to engage and **0.35** to release. Repeat starts after **300 ms**, then every **100 ms**. Closing a scope restores the previous scope and available focus. Native `<dialog>` overlays are supported when the dialog is passed to `pushScope`.


## Framework adapters

Use matching versions of the core and adapter packages. Install from npm as shown below, or use the `.tgz` files from the GitHub release.

Frameworks are peer dependencies and are never bundled. The adapters use public lifecycle APIs and share one core controller.

| Package | Supported range | Integration |
| --- | --- | --- |
| `gamepadify-angular` | Angular 20–22 | Standalone directives and environment providers |
| `gamepadify-react` | React 18–19 | Provider and typed callback refs |
| `gamepadify-vue` | Vue 3.3–3.5 | Directives, plugin and composable |
| `gamepadify-jquery` | jQuery 3.7 and 4 | Explicit plugin installation |

### Angular

```sh
npm install gamepadify gamepadify-angular
```

```ts
import { Component, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  GamepadDirective,
  GamepadFocusableDirective,
  provideGamepadify,
} from 'gamepadify-angular';

@Component({
  selector: 'app-root',
  imports: [GamepadDirective, GamepadFocusableDirective],
  template: `
    <button [gamepad]="'west'" (click)="save()">Save</button>
    <button gamepadFocusable (click)="next()">Continue</button>
  `,
})
class App {
  saved = signal(false);
  save() { this.saved.set(true); }
  next() {}
}

bootstrapApplication(App, {
  providers: [provideGamepadify({ navigation: { confirm: 'south' } })],
});
```

Add `gamepadify/styles.css` to your application stylesheet imports. Inject `GamepadifyService` to access `.controller`. Polling runs outside Angular's zone; normal template events and signals still update the UI. The package is compiled with Angular 20 in Partial-Ivy/APF format and checked against Angular 20, 21 and 22, including zoneless hydration.

### React

```sh
npm install gamepadify gamepadify-react
```

```tsx
import { GamepadProvider, useGamepad } from 'gamepadify-react';
import 'gamepadify/styles.css';

function SaveButton() {
  const ref = useGamepad<HTMLButtonElement>('west');
  return <button ref={ref} onClick={() => console.log('Saved')}>Save</button>;
}

export function App() {
  return <GamepadProvider><SaveButton /></GamepadProvider>;
}
```

Use `useGamepad({ focusable: true })` for navigation targets and `useGamepadController()` for scopes or subscriptions. Equivalent object bindings retain their callback ref. Changed callbacks or binding values re-register the element. Equivalent hint/navigation options do not call `configure()` again; presentation updates do not reset controls. Keep source, root and profile references stable when unchanged. The provider merges changed options like `configure()` and starts/stops in an effect, including Strict Mode replay.

### Vue

```sh
npm install gamepadify gamepadify-vue
```

```ts
import { createApp } from 'vue';
import { createGamepadifyPlugin } from 'gamepadify-vue';
import 'gamepadify/styles.css';
import App from './App.vue';

createApp(App)
  .use(createGamepadifyPlugin({ navigation: { confirm: 'south' } }))
  .mount('#app');
```

```vue
<script setup lang="ts">
import { useGamepadify } from 'gamepadify-vue';
const pad = useGamepadify();
function save() { console.log('Saved'); }
</script>

<template>
  <button v-gamepad="'west'" @click="save">Save</button>
  <button v-gamepad="['left-shoulder', 'north']">More</button>
  <button v-gamepad-focusable>Continue</button>
</template>
```

The plugin starts after a directive or composable mounts and stops when the final consumer unmounts. Equivalent directive values do not re-register. Reactive object fields, tuples and action callbacks are tracked, including in-place mutations. Create one plugin per app/SSR request. The composable exposes the controller; global directive types are exported for Vue language tooling.

### jQuery

```sh
npm install gamepadify gamepadify-jquery jquery
```

```ts
import $ from 'jquery';
import { installGamepadify } from 'gamepadify-jquery';
import 'gamepadify/styles.css';

installGamepadify($);
$('#app').gamepadify({ bindings: { '#save': 'west' } });
const pad = $('#app').gamepadify('instance');
$('#app').gamepadify('configure', { showHints: false });
$('#app').gamepadify('destroy');
```

Install `@types/jquery` for TypeScript projects. Plugin installation is explicit and idempotent. Reinitialization reuses the instance; the selected DOM element remains its root even if an options object contains another `root`. Destroy the controller when removing its root.


## Prompts, skins and focus

The bundled PNG artwork is [Kenney Input Prompts](https://kenney.nl/assets/input-prompts), licensed CC0. It includes Xbox, PlayStation and Switch sets. These are community assets, not official manufacturer assets. Unknown standard controllers use neutral text labels. Missing or failed images fall back to text.

```ts
import type { Skin } from 'gamepadify';

const skin: Skin = {
  name: 'My controls',
  glyphs: {
    south: '/controls/accept.png',
    north: {
      url: '/controls/atlas.png',
      label: 'More',
      atlas: { x: 32, y: 0, width: 32, height: 32, sheetWidth: 256, sheetHeight: 64 },
    },
  },
};

pad.configure({ hints: { skin, size: 28, placement: 'bottom-end', offset: 8 } });
```

Bindings can override `hint` settings individually. Prompts live in a separate, `aria-hidden`, pointer-transparent layer; React/Vue/Angular-owned element contents are untouched.

```css
:root {
  --gamepadify-size: 28px;
  --gamepadify-focus-color: #b9f56b;
  --gamepadify-focus-radius: 6px;
  --gamepadify-focus-width: 2px;
  --gamepadify-focus-shadow: #172026;
  --gamepadify-z-index: 2147483000;
}
```

An explicit `hints.size` or per-binding `hint.size` overrides the CSS size. The real DOM focus is preserved; gamepad mode replaces the native outline with the configurable ring.


## Browser limits

- Use HTTPS or localhost. Browser permissions and iframe `gamepad` Permissions Policy can restrict access.
- Recognition uses the browser's `Gamepad.id`. Bluetooth, USB, drivers and XInput can expose different IDs for the same hardware. Family detection is best effort; use `family`, `hints.skin` or custom `profiles` to override it.
- Nonstandard controller mappings need a matching `DeviceProfile`; they are not guessed.
- Polling cannot manufacture trusted user activation. File pickers, fullscreen, clipboard and similar protected APIs may still require a real browser-recognized gesture.
- Home/system buttons may be intercepted by the OS. Browser extensions and keyboard-to-gamepad tools may change behavior.
- This release targets light DOM, document scrolling and ordinary scroll containers. Automatic traversal across shadow roots and iframes is not provided.
- Automated tests use a controlled input source. Physical controllers have **not** been hardware-certified for this release.

See [architecture](architecture.md), [compatibility evidence](compatibility.md) and [contributing](../CONTRIBUTING.md).
