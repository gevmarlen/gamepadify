# Compatibility and verification

Verified on 2026-10-19 using Node v24.22.0 on Windows. GitHub Actions repeats the checks on Ubuntu. Exact dependency versions are recorded in [compatibility.json](compatibility.json).

## Packed consumers

Each consumer installs the actual core and adapter npm archives in a separate directory. The test checks package installation, strict TypeScript, client activation, dynamic registration and teardown. React, Vue and Angular also render on the server and hydrate without replacing the server-rendered button. React runs in Strict Mode; Angular runs zoneless. Vue SFC directive typing is checked with vue-tsc, including rejection of an invalid button. jQuery has no SSR renderer and is tested through its explicit plugin lifecycle.

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

- 37 unit tests: normalization, aliases, profiles, chord timing and overlap, classes, conflicts, scopes, focus, lifecycle and recovery.
- 39 browser tests: 13 scenarios in each of Chromium 156.0.8078.4, Firefox 157.0 and WebKit 27.2.
- PNG loading for Xbox/PlayStation/Switch, failed-image fallback, atlas rendering, CSS size, per-element placement, dialogs and nested scrolling.
- ESM and CommonJS imports without browser globals; independent browser IIFE execution.
- Repeated start/stop, keyboard/mouse/touch restoration, first-press consumption and class ownership.
- Five locally built framework examples exercised in Chromium, including activation, navigation and PNGs.
- Playground exercised at desktop and mobile widths with the controlled simulator.

## Size

| Artifact | Bytes |
| --- | ---: |
| Core IIFE, minified | 25556 |
| Core IIFE, gzip | 8992 |
| gamepadify npm archive | 123100 |
| gamepadify-react npm archive | 3189 |
| gamepadify-vue npm archive | 3876 |
| gamepadify-jquery npm archive | 3263 |
| gamepadify-angular npm archive | 3911 |

The core archive includes ESM, CommonJS, declarations, source maps, the optional test simulator, CSS and 50 PNGs. Runtime core dependencies: zero. Sizes are uncompressed byte counts except the explicitly gzip row and already-compressed npm archives.

## Remaining verification

Physical controllers have not been tested. Browser tests use controlled Gamepad sources; they do not certify USB/Bluetooth detection or operating-system mappings. The published npm and jsDelivr endpoints are pending the owner's npm publication. GitHub Release archives can be installed locally in the meantime.
