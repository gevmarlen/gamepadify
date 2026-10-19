# gamepadify-angular

Standalone Angular directives for [Gamepadify](https://github.com/gevmarlen/gamepadify).

```sh
npm install gamepadify gamepadify-angular
```

Register `provideGamepadify(options)` in your application providers and import
`GamepadDirective` and `GamepadFocusableDirective` in the components that use them.

```html
<button [gamepad]="'xbox:x'">Save</button>
<button gamepadFocusable>Continue</button>
```

Include `gamepadify/styles.css` in your application styles. Supports Angular 20–22.
See the main repository for configuration, typed combinations, scopes and examples.

Use `navigation: { confirm: 'xbox:a' }` in the provider options to activate focusable elements with A. Xbox aliases work across controller families; see [button names and physical positions](https://github.com/gevmarlen/gamepadify#button-names-and-physical-positions).

Optional smaller builds are available at `gamepadify-angular/core`, `/navigation` and `/hints`. The default import retains all features. See [build choices](https://github.com/gevmarlen/gamepadify/blob/main/docs/bundles.md) for matching stylesheets and examples.
