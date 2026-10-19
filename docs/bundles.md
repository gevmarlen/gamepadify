# Choosing a smaller build

The default `gamepadify` import includes every feature and keeps the existing API. Most applications can keep it unchanged. If an application only needs part of the library, change its import path. No plugin registration or additional package is required.

| Import | Included features | Stylesheet | Script gzip |
| --- | --- | --- | ---: |
| `gamepadify` | Bindings, navigation, prompts and focus ring | `gamepadify/styles.css` | 9,400 B |
| `gamepadify/core` | Bindings, chords, conflicts, scopes and input modes | `gamepadify/core.css` | 6,779 B |
| `gamepadify/navigation` | Core, stick/D-pad navigation and focus ring | `gamepadify/navigation.css` | 8,200 B |
| `gamepadify/hints` | Core, prompts and focus ring | `gamepadify/styles.css` | 8,322 B |

Sizes are for the standalone minified scripts compressed with gzip. The same builds, bundled from ESM with only `createGamepadify` imported, measure 9,113 / 6,490 / 7,912 / 8,033 bytes gzip respectively. These figures exclude CSS and PNGs. See [the recorded measurements](bundles.json) and run `npm run test:bundles` to reproduce them.

`core` is 28% smaller than the current full script, or 25% smaller than the 0.1.0 full script (8,992 bytes gzip). The current full script is about 408 bytes gzip larger than 0.1.0 because it shares the configurable controller with the other entry points. There is no runtime dependency or extra network request for feature discovery.

## Plain JavaScript

```ts
import { createGamepadify } from 'gamepadify/core';
import 'gamepadify/core.css';

const pad = createGamepadify({
  bindings: { '#save': 'south' },
  bodyClass: 'using-gamepad',
});
pad.start();
```

The controller methods, types, data attributes and registration precedence are identical across entry points. `core` keeps native DOM focus styling. Its CSS only hides the cursor in gamepad mode; omit that stylesheet if cursor hiding is unwanted. Navigation and hint builds supply the configurable focus ring.

To include navigation without prompts:

```ts
import { createGamepadify } from 'gamepadify/navigation';
import 'gamepadify/navigation.css';

const pad = createGamepadify({ navigation: { confirm: 'south' } });
pad.start();
```

Navigation remains opt-in. `core` and `navigation` default `showHints` to `false`; `hints` and the full entry point default it to `true`. Enabling a feature absent from the chosen entry point emits a deduplicated `missing-feature` warning with the appropriate import path. Change the import to include that feature. `configure()` cannot load missing modules.

Setting `showHints: false` on the full build hides prompts at runtime; it does not remove their implementation from the bundle. Hint options and per-binding skins only take effect in builds with prompts.

## Frameworks

Each adapter has the same `/core`, `/navigation` and `/hints` entry points. Change the setup import and stylesheet; existing bindings, directives and hooks stay the same.

```ts
import { GamepadProvider } from 'gamepadify-react/core';
import { useGamepad } from 'gamepadify-react';
```

```ts
import { provideGamepadify } from 'gamepadify-angular/navigation';
import { GamepadDirective, GamepadFocusableDirective } from 'gamepadify-angular';
```

```ts
import { createGamepadifyPlugin } from 'gamepadify-vue/hints';
import { useGamepadify } from 'gamepadify-vue';
```

```ts
import { installGamepadify } from 'gamepadify-jquery/core';
```

React contexts, Vue injection keys and Angular service identities are shared across entry points. Importing hooks or directives from the default adapter does not bring back the full controller in a tree-shaken production build. Choose the jQuery installer once per jQuery instance; repeated installation is idempotent and keeps its original factory.

Use the same package version throughout the application. Each package keeps one controller module per module format, including shared root ownership and body-class bookkeeping. Do not mix ESM and CommonJS copies or load multiple standalone scripts on the same page.

## Browser scripts

All four standalone scripts expose `Gamepadify.createGamepadify()`:

| Preset | Script | Stylesheet |
| --- | --- | --- |
| Full | `gamepadify.min.js` | `gamepadify.css` |
| Core | `gamepadify-core.min.js` | `gamepadify-core.css` |
| Navigation | `gamepadify-navigation.min.js` | `gamepadify-navigation.css` |
| Hints | `gamepadify-hints.min.js` | `gamepadify.css` |

Load one pair from the same release. All files are in the GitHub browser archive. After npm publication, their CDN base will be `https://cdn.jsdelivr.net/npm/gamepadify@0.2.0/dist/`.

Core and navigation stylesheets contain no image URLs and request no PNGs. When served directly, the full and hints stylesheets load only the glyphs used by the displayed controls. A bundler may instead inline PNGs into CSS, increasing its initial download; asset inlining follows the application's bundler settings. Keep `assets/` beside the stylesheet when serving the browser builds locally.

## Build checks

ESM and CommonJS preserve shared modules; a bundler can remove unused entry points. The browser scripts are already bundled and minified. The published archives contain all variants, declarations, source maps, styles and artwork, so archive size is larger than a single browser download.

`npm run test:bundles` inspects esbuild output metadata for all four presets and all adapters. It rejects a core bundle containing navigation geometry or either renderer, checks image-free stylesheets, and enforces per-preset gzip budgets. It also verifies that importing default hooks/directives alongside a smaller provider preserves those exclusions.
