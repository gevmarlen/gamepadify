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
<button data-gamepad="xbox:x">Save</button>
<button data-gamepad="xbox:lb+xbox:y">More</button>
```

The first controller press enters gamepad mode. Release before activating actions.

On Xbox, X activates Save and LB + Y activates More. Xbox aliases also work on other controllers, with matching button prompts. See [button names and physical positions](https://github.com/gevmarlen/gamepadify#button-names-and-physical-positions) for the full mapping.

[Documentation](https://github.com/gevmarlen/gamepadify#readme) · [Playground](https://gevmarlen.github.io/gamepadify/) · [API](https://github.com/gevmarlen/gamepadify/blob/main/docs/api.md)

MIT code; bundled Kenney Input Prompts artwork is CC0. See THIRD_PARTY_NOTICES.md.

Optional smaller builds are available at `gamepadify/core`, `/navigation` and `/hints`. The default import retains all features. See [build choices](https://github.com/gevmarlen/gamepadify/blob/main/docs/bundles.md) for matching stylesheets and examples.
