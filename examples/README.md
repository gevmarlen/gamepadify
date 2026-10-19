# Local examples

Build the workspace once:

```sh
npm ci
npm run build
```

Then choose `vanilla`, `react`, `vue`, `angular` or `jquery`:

```sh
cd examples/react
npm install
npm run dev
```

Each example uses the local built packages through `file:` dependencies. Angular consumes `packages/angular/dist`, which is APF output. Examples are outside the root npm workspaces to keep framework versions isolated. In a real app, replace local dependencies with npm package versions.

Connect a controller and press a button once to enter gamepad mode, or add `?simulate` to the local URL. On Xbox, **X** activates Save and **A** activates the focused card. Other controllers show their corresponding button prompts.

All examples use `xbox:x` for Save and `xbox:a` for navigation confirmation. These aliases work on every supported controller family. See [button names and physical positions](../README.md#button-names-and-physical-positions) for the separate explanation of `south`, `east`, `west` and `north`.

In simulation, keyboard **Z** presses Xbox A, keyboard **X** presses Xbox X, and arrow keys move the left stick. Each key press should last at least one frame. Keyboard simulation is example code; it is not installed by the library.

Each example supports `npm run build`. For full SSR/hydration and version coverage, use the packed consumers documented in [CONTRIBUTING](../CONTRIBUTING.md).
