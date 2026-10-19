# Gamepadify

Typed gamepad controls, spatial navigation and adaptive button prompts for web interfaces. Zero runtime dependencies.

```sh
npm install gamepadify
```

```ts
import { createGamepadify } from 'gamepadify';
import 'gamepadify/styles.css';
const pad = createGamepadify();
pad.start();
```

```html
<button data-gamepad="south">Save</button>
<button data-gamepad="left-shoulder+north">More</button>
```

The first controller press enters gamepad mode. Release before activating actions.

[Documentation](https://github.com/gevmarlen/gamepadify#readme) · [Playground](https://gevmarlen.github.io/gamepadify/) · [API](https://github.com/gevmarlen/gamepadify/blob/main/docs/api.md)

MIT code; bundled Kenney Input Prompts artwork is CC0. See THIRD_PARTY_NOTICES.md.

Optional smaller builds are available at `gamepadify/core`, `/navigation` and `/hints`. The default import retains all features. See [build choices](https://github.com/gevmarlen/gamepadify/blob/main/docs/bundles.md) for matching stylesheets and examples.
