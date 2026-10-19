# Compatibility and verification

The 0.2.2 release updates documentation and the playground; library runtime code is unchanged. Its fresh package, browser and consumer checks, archive integrities and public CDN verification are recorded with the [0.2.2 release](https://github.com/gevmarlen/gamepadify/releases/tag/v0.2.2). The detailed 0.2.1 measurements below remain available as the runtime baseline.

These are local validation results for 0.2.1, recorded on 2026-10-19 with Node v24.22.0 on Windows. GitHub Actions repeats the tests on Ubuntu; its results are available in the [Checks workflow](https://github.com/gevmarlen/gamepadify/actions/workflows/ci.yml). Exact versions, archive integrities, baseline measurements and run summaries are in [compatibility.json](compatibility.json).

## Packed consumers

Each consumer installs the actual core and adapter npm archives in a separate directory. All ten framework versions are checked with the full, core, navigation and hints presets: 40 combinations. Smaller providers are also paired with hooks/directives imported from the default entry point. The test checks installed archive integrity, strict TypeScript, client activation, binding changes, repeated rendering, dynamic registration and teardown. React/Vue/jQuery also compile a CommonJS consumer with TypeScript Node16 resolution. React, Vue and Angular also render on the server and hydrate without replacing the server-rendered button. React runs in Strict Mode; the 40-case matrix runs Angular zoneless. A 41st case verifies Angular 20 with Zone.js, including SSR/hydration and polling outside the Angular zone. Vue SFC directive typing is checked with vue-tsc, including rejection of an invalid button. jQuery has no SSR renderer and is tested through its explicit plugin lifecycle.

| Target | Framework version | TypeScript | Result |
| --- | --- | --- | --- |
| angular20 | 20.3.34 | 5.9.3 | Passed |
| angular21 | 21.2.25 | 5.9.3 | Passed |
| angular22 | 22.2.3 | 6.0.3 | Passed |
| jquery3 | 3.7.1 | 5.9.3 | Passed |
| jquery4 | 4.0.0 | 5.9.3 | Passed |
| react18 | 18.3.1 | 5.9.3 | Passed |
| react19 | 19.3.1 | 5.9.3 | Passed |
| vue33 | 3.3.13 | 5.9.3 | Passed |
| vue34 | 3.4.38 | 5.9.3 | Passed |
| vue35 | 3.5.44 | 5.9.3 | Passed |

## Core and browser checks

- 53 unit tests: normalization, aliases, profiles, chord timing and overlap, classes, conflicts, scopes, focus, lifecycle and recovery.
- 84 browser tests: 28 scenarios in each of Chromium 156.0.8078.4, Firefox 157.0 and WebKit 27.2.
- PNG loading for Xbox/PlayStation/Switch, failed-image fallback, atlas rendering, CSS size, per-element placement, dialogs and nested scrolling.
- ESM and CommonJS imports without browser globals, plus Node16 TypeScript declaration resolution; independent browser IIFE execution for all presets.
- Bundle metadata checks prove excluded features are absent, including when adapters mix smaller providers with default hooks/directives.
- Native focus preservation in core, missing-feature diagnostics and shared ownership across entry points.
- Repeated start/stop with listener/polling accounting, callback exceptions, trigger changes during a pending chord, analog trigger thresholds, device replacement, keyboard/mouse/touch restoration, first-press consumption and class ownership.
- DOM-read bounds in stable frames, CSS animation/occlusion/resize updates and restoration of the prompt layer after measurements.
- Five locally built framework examples exercised in Chromium, including activation, navigation and PNGs.
- Playground exercised at desktop and mobile widths with the controlled simulator.

## Size

| Artifact | Bytes |
| --- | ---: |
| Full IIFE, minified | 29264 |
| Full IIFE, gzip | 10150 |
| Core-only IIFE, gzip | 7242 |
| Navigation IIFE, gzip | 8770 |
| Hints IIFE, gzip | 9011 |
| gamepadify npm archive | 188275 |
| gamepadify-react npm archive | 5559 |
| gamepadify-vue npm archive | 5658 |
| gamepadify-jquery npm archive | 4660 |
| gamepadify-angular npm archive | 4767 |

The core archive includes all four presets, ESM, CommonJS, declarations, source maps, the optional simulator, CSS and 50 PNGs. Its archive size is not the size transferred to a browser. Runtime core dependencies: zero. See [build measurements and tradeoffs](bundles.md) for CSS, Brotli and consumer-bundled sizes.

## Performance

Baseline: commit `5f0daaa` (0.2.0). The 0.2.1 standalone script has the same SHA-256 as the audited build measured below, so its timing samples are retained. Both builds ran sequentially on 13th Gen Intel(R) Core(TM) i9-13900K, Windows x64, headless Chromium 156.0.8078.4. Each case used 30 warm-up frames and three 60-frame measured runs. CPU below is the median of the three run means; run means and frame p95 are also recorded in the JSON. The harness instruments DOM calls and uses CDP sampling, so these are comparisons with profiling overhead, not a universal frame-time promise.

The navigation case has N focusable elements, one mapped action and a stationary stick. The hints case deliberately stresses N visible actions with unique chords and neutral text prompts. CPU measures steady frames; navigation candidate scans still run when the stick moves. Latency is simulated source press to click, not physical controller latency. Insertion adds 10% extra focusable elements and waits for their assigned class.

| Scenario | Elements | Before CPU ms/frame | After CPU ms/frame | Input p95 ms, before → after | Insert ms, before → after |
| --- | ---: | ---: | ---: | ---: | ---: |
| navigation | 10 | 1.627 | 0.287 | 17.7 → 18.2 | 16.8 → 17.4 |
| navigation | 100 | 4.732 | 0.202 | 17.1 → 17.4 | 17.4 → 17.2 |
| navigation | 500 | 21.338 | 0.225 | 12.5 → 17.9 | 25.6 → 19.0 |
| navigation | 1000 | 45.928 | 0.363 | 26.3 → 18.5 | 55.6 → 20.3 |
| hints | 10 | 1.763 | 0.677 | 17.5 → 17.9 | 17.2 → 17.4 |
| hints | 100 | 7.270 | 2.742 | 14.0 → 19.1 | 17.0 → 18.2 |
| hints | 500 | 126.875 | 4.703 | 66.2 → 19.9 | 145.2 → 19.2 |
| hints | 1000 | 534.253 | 10.740 | 270.5 → 20.5 | 601.9 → 23.6 |

DOM calls and sampled allocation estimates per frame at 1000 elements:

| Scenario | Computed style calls | Rectangle calls | Hit tests | Sampled KiB/frame | Layouts/frame | Style recalculations/frame |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| navigation | 36034 → 5 | 15028 → 2 | 2004 → 1 | 3046.8 → 10.2 | 0 → 0 | 0 → 0 |
| hints | 24002 → 1004 | 16000 → 1001 | 2000 → 1000 | 4852.7 → 1214.7 | 0 → 2.017 | 2.033 → 2.017 |

Dense overlays intentionally add about two layout/style updates per frame while excluding their glyph tree from hit testing. Small overlays avoid this path. The baseline had no layout work in these static fixtures; fewer DOM calls must not be described as fewer layouts in every scenario. Allocation estimates include the page and harness and vary between runs; retained memory, exact allocation counts, GPU time and physical input latency were not measured. A thousand visible chord prompts is a stress case, and the baseline showed substantial run-to-run variance. All dynamic insertion cases and all eight activations per run passed.

Run `npm run benchmark` or see [reproduction commands](../CONTRIBUTING.md#performance). Raw local samples are under `.artifacts/audit/before.json` and `after.json`; compact run data and build hashes are retained in [compatibility.json](compatibility.json).

## Remaining verification

Physical controllers have not been tested. Browser tests use controlled Gamepad sources; they do not certify USB/Bluetooth detection or operating-system mappings.

Release files and checksums are attached to [v0.2.1](https://github.com/gevmarlen/gamepadify/releases/tag/v0.2.1). Use matching core and adapter versions. CDN scripts and stylesheets are pinned to 0.2.1 in the README.

## Manual hardware checklist

Every cell below is **not run**. Record USB and Bluetooth separately; a successful simulated run does not fill a cell.

| Controller | USB | Bluetooth |
| --- | --- | --- |
| Xbox Controller (record exact generation) | Not run | Not run |
| Sony DualSense | Not run | Not run |
| Sony DualShock 4 | Not run | Not run |
| Nintendo Switch Pro Controller | Not run | Not run |

Repeat for Chrome and Firefox on each available OS, and Safari on macOS. If an OS/controller combination cannot connect, record it as unavailable with a reason, not passed. Record the library commit/version, OS, browser version, controller firmware, transport, reported `Gamepad.id`, `mapping` and any custom profile.

- [ ] Connecting alone leaves pointer mode unchanged. The first button press enters gamepad mode without activating anything; releasing all buttons arms controls.
- [ ] Verify each face button, shoulder, trigger, stick click and D-pad direction against its physical binding and displayed prompt. Record OS-intercepted system buttons separately.
- [ ] Slowly cross each analog trigger's 0.5 threshold, hold it, release and press again. There must be no repeated activation while held.
- [ ] Test a single button overlapping a chord in both press orders, a late extra button, partial release and repeated action presses with a held modifier.
- [ ] Navigate an uneven grid, diagonal input, long lists and nested scrollers. Check neutral-stick jitter, thresholds and held-stick repeat.
- [ ] Open/close a native dialog scope, remove or disable the focused element and verify focus restoration. Conflicting/covered/disabled actions must not fire.
- [ ] Check family prompts, PNG loading, custom skin, all three display settings and their cleanup on pointer/keyboard/touch input.
- [ ] Blur/focus the window and hide/restore the tab while holding buttons. No stale action may run on resume.
- [ ] Disconnect/reconnect during a hold. With two devices, verify last-pressed selection and first-press consumption when switching.
- [ ] Repeat stop/start and mounting/unmounting. Check for duplicate clicks, lingering classes, overlays and browser-console errors.

Attach observed results and reproduction steps to the test record. Browser-specific permission/fullscreen/file-picker restrictions are separate from controller mapping correctness.
