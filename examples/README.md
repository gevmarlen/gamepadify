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

Connect a controller and press a button once to enter gamepad mode, or add `?simulate` to the local URL. In simulation, Z is south, X is west and arrow keys move the stick. Each key press should last at least one frame. Keyboard simulation is demo code; it is not installed by the library.

Each example supports `npm run build`. For full SSR/hydration and version coverage, use the packed consumers documented in [CONTRIBUTING](../CONTRIBUTING.md).
