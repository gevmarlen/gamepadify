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

Work on short-lived branches and merge through pull requests. GitHub deletes merged source branches automatically. After updating your local `main`, remove your merged branch with `git branch -d <branch>` and prune stale remote references with `git fetch --prune`.

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

For the additional Angular 20 Zone.js consumer, set `ANGULAR_ZONE=true` and run `npm run test:consumer -- angular20 full`. It checks SSR/hydration and asserts that polling runs outside Angular's zone. Other Angular fixtures remain zoneless.

## Performance

Run `npm run build`, then `npm run benchmark`. It records raw samples in `.artifacts/benchmark.json` using headless Chromium, a controlled Gamepad source, 30 warm-up frames and three 60-frame runs per case. Both navigation and dense prompt grids are measured at 10, 100, 500 and 1000 registered elements.

To compare with another build, preserve its entire `dist` directory and pass it explicitly:

```sh
node scripts/benchmark.mjs /path/to/old/dist .artifacts/before.json
node scripts/benchmark.mjs packages/core/dist .artifacts/after.json
```

Run the builds sequentially without other test/build jobs. `BENCH_FRAMES` and `BENCH_RUNS` adjust duration; `BENCH_SCENARIO` and `BENCH_COUNT` isolate a case. `BENCH_PROFILE` optionally saves a Chromium CPU profile. Results include callback CPU time, instrumented DOM reads, CDP layout/style counters, sampled allocations, activation latency and dynamic insertion. Allocation figures are statistical estimates for the page, including the harness; they are not exact byte counts or retained-heap measurements. Absolute timings depend on the machine and profiling overhead.

Browser regression tests enforce DOM-read bounds and cleanup behavior, not wall-clock thresholds. See [recorded comparisons](docs/compatibility.md#performance) for methodology and limits.

To inspect the demo, run `npm run dev -- --port 4174`, then `node scripts/check-demo.mjs` in another terminal. The latter exercises the simulator and updates the README screenshot. `DEMO_URL` can point it at a deployed Pages URL.

Hardware reports should include controller model, USB/Bluetooth transport, browser/OS versions, reported Gamepad ID and mapping, and exact reproduction steps. Do not report simulator coverage as physical-device verification. Avoid posting sensitive data in issues.

The PNG subset is checked in. To reproduce it, run `scripts/import-assets.ps1` in PowerShell; it verifies the archive checksum before extracting approved files. Preserve source and license notices.

Open a focused pull request describing the behavior changed and checks performed. Update documentation and the changelog for public API changes.

## Commit identity

Set repository-local `user.name` and `user.email` to the identity you intend to publish. The initial published commits contain a placeholder identity. Future commits use the owner's confirmed identity; existing commit and release tags remain unchanged.

Correcting author metadata inside those commits changes their hashes and every descendant hash. It also invalidates signed commits/tags and breaks references held by clones, releases and provenance. Keep published history unless all maintainers explicitly agree to a coordinated rewrite.

If a rewrite is approved: first create a separate mirror backup (`git clone --mirror`); work in a fresh disposable clone; verify the real authors before preparing a mailmap for `git filter-repo`; inspect every rewritten ref and verify that file contents are unchanged. Coordinate replacement tags, release references and consumers before pushing any explicit branch/tag ref. Use a checked lease for branch replacement and retain the backup. Do not run a blanket force/mirror push. A display-only `.mailmap`, after author confirmation, is an alternative that preserves commit hashes.
