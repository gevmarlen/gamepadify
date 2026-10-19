# Gamepadify

[![Checks](https://github.com/gevmarlen/gamepadify/actions/workflows/ci.yml/badge.svg)](https://github.com/gevmarlen/gamepadify/actions/workflows/ci.yml)
[![Pages](https://github.com/gevmarlen/gamepadify/actions/workflows/pages.yml/badge.svg)](https://gevmarlen.github.io/gamepadify/)
[![MIT](https://img.shields.io/badge/license-MIT-25624d.svg)](LICENSE)

Add gamepad controls to ordinary web buttons: direct bindings, stick navigation, and controller button prompts. The TypeScript core has no runtime dependencies; Angular, React, Vue and jQuery use separate adapters.

[Playground](https://gevmarlen.github.io/gamepadify/) · [API and integrations](docs/api.md) · [Runnable examples](examples/README.md) · [Build sizes](docs/bundles.md)

## Install and start

The latest release is [0.2.0 on npm](https://www.npmjs.com/package/gamepadify/v/0.2.0). Archives are also available on [GitHub Releases](https://github.com/gevmarlen/gamepadify/releases/tag/v0.2.0).

```sh
npm install gamepadify
```

```html
<button data-gamepad="south">Save</button>
<button data-gamepad="left-shoulder+north">More</button>
```

```ts
import { createGamepadify } from 'gamepadify';
import 'gamepadify/styles.css';

const pad = createGamepadify();
pad.start();
```

Connect a controller and press any button to enter gamepad mode. Release it before activating an action. Bindings focus the element and call `.click()`. Mouse, keyboard or touch input restores the ordinary interface.

Names refer to physical positions: `south`, `east`, `west`, `north`, shoulder buttons, triggers, sticks and D-pad. Explicit aliases such as `xbox:a`, `ps:cross` and `switch:b` all mean `south`. Unprefixed `A` and `X` are rejected.

For a plain script tag, load the script and stylesheet from the same fixed version:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gamepadify@0.2.0/dist/gamepadify.css">
<script src="https://cdn.jsdelivr.net/npm/gamepadify@0.2.0/dist/gamepadify.min.js"></script>
<script>Gamepadify.createGamepadify().start();</script>
```

To self-host, unpack the browser ZIP and keep its `assets/` directory beside the stylesheet. Changes after the `v0.2.0` tag are unreleased and are not in the npm package or release archive.

## Configure

Data attributes also work with dynamically inserted elements. Alternatively, supply a selector map or call [`pad.bind()`](docs/api.md#binding):

```ts
const pad = createGamepadify({
  bindings: { '#save': 'south', '#more': ['left-shoulder', 'north'] },
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
const pad = createGamepadify({ navigation: { confirm: 'east' } });
pad.start();
```

The left stick moves real DOM focus toward the nearest eligible element in that direction, scrolling when needed. The confirm button is reserved and must not appear in a binding. [Dialog scopes, D-pad and repeat settings](docs/api.md#navigation-and-dialogs) are optional.

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
