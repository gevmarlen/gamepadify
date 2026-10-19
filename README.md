# Gamepadify

[![Checks](https://github.com/gevmarlen/gamepadify/actions/workflows/ci.yml/badge.svg)](https://github.com/gevmarlen/gamepadify/actions/workflows/ci.yml)
[![Pages](https://github.com/gevmarlen/gamepadify/actions/workflows/pages.yml/badge.svg)](https://gevmarlen.github.io/gamepadify/)
[![MIT](https://img.shields.io/badge/license-MIT-25624d.svg)](LICENSE)

Add gamepad controls to ordinary web buttons: direct bindings, stick navigation, and controller button prompts. The TypeScript core has no runtime dependencies; Angular, React, Vue and jQuery use separate adapters.

[Playground](https://gevmarlen.github.io/gamepadify/) · [API and integrations](docs/api.md) · [Runnable examples](examples/README.md) · [Build sizes](docs/bundles.md)

## Install and start

The latest release is [0.2.2 on npm](https://www.npmjs.com/package/gamepadify/v/0.2.2). Archives are also available on [GitHub Releases](https://github.com/gevmarlen/gamepadify/releases/tag/v0.2.2).

```sh
npm install gamepadify
```

```html
<button data-gamepad="xbox:x">Save</button>
<button data-gamepad="xbox:lb+xbox:y">More</button>
```

```ts
import { createGamepadify } from 'gamepadify';
import 'gamepadify/styles.css';

const pad = createGamepadify();
pad.start();
```

Connect a controller and press any button to enter gamepad mode. Release it before activating an action. Bindings focus the element and call `.click()`. Mouse, keyboard or touch input restores the ordinary interface.

Press **X** to save or **LB + Y** together for More on an Xbox controller. These bindings also work on other controllers; prompts show their corresponding buttons. See [button names and physical positions](#button-names-and-physical-positions).

For a plain script tag, load the script and stylesheet from the same fixed version:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gamepadify@0.2.2/dist/gamepadify.css">
<script src="https://cdn.jsdelivr.net/npm/gamepadify@0.2.2/dist/gamepadify.min.js"></script>
<script>Gamepadify.createGamepadify().start();</script>
```

To self-host, unpack the browser ZIP and keep its `assets/` directory beside the stylesheet. Use matching versions of the script, stylesheet and adapters.

## Button names and physical positions

Start with familiar names such as `xbox:a`, `xbox:b`, `xbox:x`, `xbox:y`, `xbox:lb` and `xbox:rb`. The prefix identifies the naming convention; it does not restrict the binding to Xbox hardware.

The neutral names `south`, `east`, `west` and `north` describe the positions of the four face buttons, not the D-pad:

| Xbox alias | Face button position | Neutral name | PlayStation alias | Switch alias |
| --- | --- | --- | --- | --- |
| `xbox:a` | Bottom | `south` | `ps:cross` | `switch:b` |
| `xbox:b` | Right | `east` | `ps:circle` | `switch:a` |
| `xbox:x` | Left | `west` | `ps:square` | `switch:y` |
| `xbox:y` | Top | `north` | `ps:triangle` | `switch:x` |

Names in the same row are interchangeable. For example, `xbox:a` uses the bottom face button: A on Xbox, × on PlayStation or B on Switch. Prompts follow the connected controller automatically. Include the prefix: plain `A` or `X` is ambiguous and rejected.

Use Xbox aliases in bindings, combinations and navigation settings. Event payloads, custom skin keys and device profile keys use the neutral names. See the [complete button reference](docs/api.md#buttons-and-chords) for triggers, stick clicks and D-pad controls.

## Configure

Data attributes also work with dynamically inserted elements. Alternatively, supply a selector map or call [`pad.bind()`](docs/api.md#binding):

```ts
const pad = createGamepadify({
  bindings: { '#save': 'xbox:x', '#more': ['xbox:lb', 'xbox:y'] },
  showHints: true,
  bodyClass: 'using-gamepad',
  elementClass: 'gamepad-action',
});
pad.start();
```

| Setting | Default | Effect in gamepad mode |
| --- | --- | --- |
| `showHints` | `true` | Display button prompts |
| `bodyClass` | `''` | Add space-separated classes to `body` |
| `elementClass` | `''` | Add classes to assigned and explicitly focusable elements |

Existing classes are preserved. `showHints: false` keeps controls and the focus ring working. Call `pad.configure()` to update settings, `pad.stop()` for a reversible stop, or `pad.destroy()` when finished.

Identical bindings on different visible, available elements are blocked and reported once per conflict change. Chords are simultaneous, order-independent button combinations; overlapping shorter bindings wait up to 80 ms. See [bindings, combinations and events](docs/api.md).

## Navigate with the stick

```html
<button data-gamepad-focusable>First</button>
<button data-gamepad-focusable>Second</button>
```

```ts
const pad = createGamepadify({ navigation: { confirm: 'xbox:a' } });
pad.start();
```

The left stick moves real DOM focus toward the nearest eligible element in that direction, scrolling when needed. Press A on Xbox to activate the focused element. The confirm button is reserved and must not appear in another binding. The Save binding above uses X, so it can coexist with A for confirmation. [Dialog scopes, D-pad and repeat settings](docs/api.md#navigation-and-dialogs) are optional.

## Frameworks and smaller builds

Install the matching adapter alongside `gamepadify`. Framework packages remain peer dependencies.

| Adapter | Supported versions | Integration guide |
| --- | --- | --- |
| `gamepadify-angular` | Angular 20–22 | [`provideGamepadify`, standalone directives](docs/api.md#angular) |
| `gamepadify-react` | React 18–19 | [`GamepadProvider`, typed refs](docs/api.md#react) |
| `gamepadify-vue` | Vue 3.3–3.5 | [Plugin, directives, composable](docs/api.md#vue) |
| `gamepadify-jquery` | jQuery 3.7 and 4 | [Explicit plugin installation](docs/api.md#jquery) |

The default build includes everything. Use `gamepadify/core` for bindings alone, `/navigation` to add spatial focus, or `/hints` to add prompts. Adapters expose the same suffixes. The API stays the same; [choose the matching stylesheet](docs/bundles.md).

Prompts use [Kenney Input Prompts](https://kenney.nl/assets/input-prompts) CC0 artwork for Xbox, PlayStation and Switch. They are community assets. [Custom PNGs, atlases, sizes and positions](docs/api.md#prompts-skins-and-focus) are supported.

## Limits and verification

Use HTTPS or localhost. Device recognition depends on the browser's Gamepad API; unknown nonstandard layouts need a profile. Polling cannot create trusted browser activation for fullscreen, file pickers or similar protected APIs. Automatic shadow-root and iframe traversal is not supported.

Tests cover controlled input, real browser DOM behavior, package installation and framework lifecycles. Physical controllers have **not been tested**. See [test evidence, performance measurements and the hardware checklist](docs/compatibility.md).

![Playground with controller prompts and spatial focus](docs/playground.png)

[Architecture](docs/architecture.md) · [Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md)

MIT code; CC0 artwork. See [third-party notices](THIRD_PARTY_NOTICES.md).
