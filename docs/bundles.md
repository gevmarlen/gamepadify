# Choosing a smaller build

The default `gamepadify` import includes every feature and keeps the existing API. Most applications can keep it unchanged. If an application only needs part of the library, change its import path. No plugin registration or additional package is required.

| Import | Included features | Stylesheet | Script gzip |
| --- | --- | --- | ---: |
| `gamepadify` | Bindings, navigation, prompts and focus ring | `gamepadify/styles.css` | 10,235 B |
| `gamepadify/core` | Bindings, chords, conflicts, scopes and input modes | `gamepadify/core.css` | 7,327 B |
| `gamepadify/navigation` | Core, stick/D-pad navigation and focus ring | `gamepadify/navigation.css` | 8,854 B |
| `gamepadify/hints` | Core, prompts and focus ring | `gamepadify/styles.css` | 9,091 B |

Sizes are for the standalone minified scripts compressed with gzip. The same builds, bundled from ESM with only `createGamepadify` imported, measure 9,946 / 7,036 / 8,563 / 8,809 bytes gzip respectively. These figures exclude CSS and PNGs. See [the recorded measurements](bundles.json) and run `npm run test:bundles` to reproduce them.

These measurements describe 0.2.3. The previous 0.2.2 scripts measured 10,150 / 7,242 / 8,770 / 9,011 bytes gzip (full/core/navigation/hints); the options reset fix adds 85 bytes gzip to the full build. The core build remains 28% smaller than full. The historical [CPU/memory comparison](compatibility.md#performance) describes the earlier 0.2.1 optimization, not a new performance claim for 0.2.3.

Gzip budgets are now 10,300 / 7,400 / 8,900 / 9,100 bytes respectively, with limited headroom above these measured builds. Bundle inclusion checks and the minimum 25% core saving remain enforced. Runtime core dependencies remain zero.

## Plain JavaScript

```ts
import { createGamepadify } from 'gamepadify/core';
import 'gamepadify/core.css';

const pad = createGamepadify({
  bindings: { '#save': 'xbox:x' },
  bodyClass: 'using-gamepad',
});
pad.start();
```

The controller methods, types, data attributes and registration precedence are identical across entry points. `core` keeps native DOM focus styling. Its CSS only hides the cursor in gamepad mode; omit that stylesheet if cursor hiding is unwanted. Navigation and hint builds supply the configurable focus ring.

To include navigation without prompts:

```ts
import { createGamepadify } from 'gamepadify/navigation';
import 'gamepadify/navigation.css';

const pad = createGamepadify({ navigation: { confirm: 'xbox:a' } });
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

Load one pair from the same release. All files are in the GitHub browser archive and at `https://cdn.jsdelivr.net/npm/gamepadify@0.2.3/dist/`.

Core and navigation stylesheets contain no image URLs and request no PNGs. When served directly, the full and hints stylesheets load only the glyphs used by the displayed controls. A bundler may instead inline PNGs into CSS, increasing its initial download; asset inlining follows the application's bundler settings. Keep `assets/` beside the stylesheet when serving the browser builds locally.

## Build checks

ESM and CommonJS preserve shared modules; a bundler can remove unused entry points. The browser scripts are already bundled and minified. The published archives contain all variants, declarations, source maps, styles and artwork, so archive size is larger than a single browser download.

`npm run test:bundles` inspects esbuild output metadata for all four presets and all adapters. It rejects a core bundle containing navigation geometry or either renderer, checks image-free stylesheets, and enforces per-preset gzip budgets. It also verifies that importing default hooks/directives alongside a smaller provider preserves those exclusions.
