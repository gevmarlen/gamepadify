# Changelog

## Unreleased

- Share DOM measurements within each frame, update registrations only when needed, and separate visibility reads from prompt writes. Exclude the prompt layer during hit tests to avoid traversing its glyphs repeatedly.
- Preserve input on presentation-only configuration updates and avoid equivalent React/Vue registrations. Track Vue reactive object and tuple mutations.
- Finish lifecycle cleanup when listeners throw, commit diagnostics before callbacks, and propagate custom source exceptions.
- Cancel pending actions when their trigger changes; stop activation when focus callbacks stop the controller. Reset scopes when changing stopped roots and recognize a replacement device at the same index.
- Keep consecutive quick taps working when actions resolve on release inside the chord window.
- Keep jQuery instances tied to their selected root and remove destroyed instances even when cleanup reports an error.
- Supply separate ESM/CommonJS declaration conditions so TypeScript Node16 consumers can use `require` without TS1479.
- Add repeatable DOM benchmarks, regression tests, expanded packed-consumer checks and a manual hardware checklist. No new release has been published.

## 0.2.0 — 2026-10-19

- Add optional `/core`, `/navigation` and `/hints` entry points to the core and all four adapters. The default import and API remain unchanged.
- Add matching standalone browser scripts and image-free core/navigation stylesheets.
- Preserve shared controller ownership, adapter contexts and Angular directive/service identities across entry points.
- Keep native focus styling in the core-only build and report requests for excluded features through `missing-feature` diagnostics.
- Add bundle inclusion checks, gzip budgets, browser coverage for each preset and four-preset packed consumer verification.

The core-only script is 6,779 bytes gzip, 25% smaller than the 0.1.0 full script. The full 0.2.0 script is 9,400 bytes gzip. The 0.2.0 packages are available on npm; GitHub release archives contain all builds.

## 0.1.0 — 2026-10-19

First public release.

- Physical button bindings through data attributes, selector maps and typed registrations.
- Explicit platform aliases, simultaneous chords and conflict diagnostics.
- Stick navigation, optional D-pad input, reserved confirmation and dialog scopes.
- Automatic input-mode switching with real DOM focus and configurable prompts.
- Xbox, PlayStation and Switch PNG artwork from Kenney Input Prompts (CC0).
- Custom PNG/atlas skins and global/per-element hint placement.
- `showHints`, `bodyClass` and `elementClass` settings with owned-class cleanup.
- Separate Angular 20–22, React 18–19, Vue 3.3–3.5 and jQuery 3.7/4 adapters.
- SSR-safe imports, ESM/CommonJS builds, browser IIFE and TypeScript declarations.
- Interactive playground, controlled-input simulator and automated package/consumer checks.

Physical controller verification remains pending; automated browser tests use a controlled Gamepad source.
