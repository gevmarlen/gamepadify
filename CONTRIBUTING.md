# Contributing

Use Node 24.22 or later. This is a build/test requirement; the shipped browser library targets ES2022.

```sh
npm ci
npm run check
npx playwright install --with-deps
npm run test:browser
npm run dev
```

Core sources live in `packages/core/src`; each adapter has a separate package. Keep runtime dependencies out of the core and framework internals out of adapters. Do not introduce import-time DOM access. Prefer clear names and small functions; comments should explain a non-obvious constraint.

Add behavioral tests for input state, timing, focus, conflicts and lifecycle changes. For framework changes, run the relevant packed consumer tests:

```sh
npm run test:packages
npm run test:consumer -- angular20
npm run test:consumer -- angular21
npm run test:consumer -- angular22
npm run test:consumer -- react18
npm run test:consumer -- react19
npm run test:consumer -- vue33
npm run test:consumer -- vue34
npm run test:consumer -- vue35
npm run test:consumer -- jquery3
npm run test:consumer -- jquery4
```

Fixtures are isolated under `.artifacts/consumers` and install actual archives produced by `npm pack`. The Angular consumers select their own TypeScript versions. Run `npm run build` after changing sources before packaging.

Each consumer command checks the full, core, navigation and hints presets. Add a preset argument, such as `npm run test:consumer -- react19 core`, to isolate a failure. `npm run check` also verifies tree shaking and gzip budgets through `test:bundles`. Keep shared adapter contexts independent of the controller factory.

To inspect the demo, run `npm run dev -- --port 4174`, then `node scripts/check-demo.mjs` in another terminal. The latter exercises the simulator and updates the README screenshot. `DEMO_URL` can point it at a deployed Pages URL.

Hardware reports should include controller model, USB/Bluetooth transport, browser/OS versions, reported Gamepad ID and mapping, and exact reproduction steps. Do not report simulator coverage as physical-device verification. Avoid posting sensitive data in issues.

The PNG subset is checked in. To reproduce it, run `scripts/import-assets.ps1` in PowerShell; it verifies the archive checksum before extracting approved files. Preserve source and license notices.

Open a focused pull request describing the behavior changed and checks performed. Update documentation and the changelog for public API changes.
