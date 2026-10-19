# Architecture

## Package boundaries

The workspace contains a DOM-based core and four independent adapters. Only the core polls input, resolves bindings, owns focus and renders prompts. Adapters register elements and translate framework lifecycle events into controller lifecycle calls. Framework packages and the core remain peer dependencies of adapters.

The core has no runtime dependencies. Angular uses `tslib` and is distributed as APF with Partial-Ivy declarations compiled by Angular 20. The consumer's Angular compiler links those declarations. Other packages ship ESM and CommonJS with declarations and source maps. A separate minified IIFE exports `Gamepadify`.

No module reads window, document or navigator at import time. Controller construction records options. Client startup acquires document resources; adapters defer it until after mounting/rendering.

Four entry points select features without a public plugin API: the default includes everything, `/core` contains input and binding management, `/navigation` adds spatial focus, and `/hints` adds prompts. The controller depends only on feature interfaces; navigation geometry and rendering are separate modules. Native focus styling is preserved when no renderer is present.

ESM and CommonJS retain shared module boundaries and have separate declaration conditions, including TypeScript Node16 resolution. Root ownership, class claims and adapter contexts are shared across entry points within each module format. Angular uses APF secondary entry points; the core secondary owns the service and directive classes, while other providers select a controller factory. Browser scripts bundle one complete preset each. See [build choices](bundles.md).

## Input flow

1. Reconcile registrations when DOM/binding changes require it, then measure visible bindings once. Sample the configured Gamepad source once per animation frame while the document is visible and focused.
2. Detect raw button rising edges across connected controllers. A deliberate press selects a device and enters gamepad mode; connection alone has no UI effect.
3. Resolve an explicit profile or the browser's standard mapping. Reject unrecognized nonstandard layouts.
4. Wait until all raw buttons are released, then arm actions.
5. Resolve visible bindings and diagnostics, sample the chord state machine, activate valid targets and process directional navigation.
6. Update claimed classes, overlay geometry and PNG hints.

Keyboard, pointer or touch input leaves gamepad mode. Scope changes, disconnects and stop/reset paths discard pending matches. The last controller explicitly pressed becomes active; simultaneous edges observed in one polling frame prefer the existing active controller.

## Chord matching

Physical button names are canonicalized and sorted. The matcher tracks rising edges, pending ambiguous matches, latched actions and consumed button sets. Only a trigger that is a proper subset of another eligible trigger waits for the chord window.

Longer ready matches run first. A consumed action suppresses overlapping extensions until the relevant hold ends. Releasing part of a chord never creates a shorter action. Keeping a modifier down while releasing and pressing the action button allows repeating the same chord. Equally long overlapping matches are blocked for that press.

This model deliberately resolves simultaneous input; it does not interpret ordered sequences.

## Binding resolution and conflicts

A mutation observer invalidates the registration cache for structural/data-attribute changes. Custom selectors also observe other attributes and text changes. Overlay mutations are excluded. Reconciliation combines data attributes, selector maps and explicit registrations in that precedence order. Element identity prevents duplicate-element conflicts; matcher identity also includes the normalized trigger so pending input cannot transfer to a replacement binding.

Availability excludes hidden, disabled, inert and zero-sized elements. Screen visibility intersects the viewport and clipping ancestors and uses a center-point hit test where supported. A partially covered element can be excluded if its visible center is covered; complex occlusion is not pixel-perfect.

Duplicates are grouped by normalized trigger among visible targets in the active scope. Conflict identities include their participating elements; unchanged conflicts do not log every frame. Reserved confirmation and D-pad buttons are checked throughout the scope, even on currently offscreen mappings.

## Focus and spatial navigation

Navigation candidates are explicitly marked. Real DOM focus is retained. Non-native focus targets temporarily receive `tabindex="-1"`; the previous state is restored during teardown. The visual focus overlay follows an eligible active DOM element.

The dominant stick axis selects one direction. Candidate centers must be ahead of the current center. Candidates sharing the relevant directional lane rank first, followed by rectangle distance and DOM order. Hysteresis and timed repeat avoid noisy stick movement. There is no wraparound. Native `scrollIntoView` handles nested scroll containers.

A scope stack limits both registration and navigation. Each scope remembers the previous focus. Native modal dialogs need a scope; their overlay is mounted inside the dialog's top layer.

## Rendering and ownership

The renderer owns one pointer-transparent, aria-hidden layer. It never rewrites application element contents. A `Measurements` object shares styles, rectangles and visibility results within one frame. It is discarded on the next frame and after focus/scroll changes or application actions. There is no persistent geometry cache or resize observer; scrolling, animation and stylesheet changes are measured directly.

The loop checks screen visibility for mapped actions. Navigation checks the current focus each frame and measures other candidates when movement is needed. Classes synchronize when registrations, scopes or display options change. Stable frames do not rewrite identical ring attributes or reconcile registrations.

Chromium still traverses pointer-transparent glyph descendants during `elementFromPoint()`. At 100 or more hints, the prompt renderer temporarily sets `content-visibility: hidden` while measuring application hit targets, restoring it synchronously before rendering. Browsers without that property use `visibility`. Small overlays use normal hit testing to avoid extra layout work; dense overlays trade a bounded style/layout update for avoiding a glyph-tree traversal per target. Target geometry is shared; overlay origin is read once; newly created glyphs read their CSS image URLs together before adding images.

Default PNG URLs come from the stylesheet, relative to that file. Built-in or custom failed images retain a text label. Atlas glyphs map pixel rectangles to the configured prompt size. Applications can replace a skin without changing input mapping.

Classes use per-element, per-token reference counts across instances. Preexisting classes are not removed. Consumer class changes using the exact same token while the library owns it cannot be distinguished from library ownership; use distinct application/library tokens when mutating classes concurrently.

## Lifecycle

`stop` cancels animation frames, disconnects the observer, removes listeners and overlays, releases class claims and restores temporary tabindex values before dispatching mode/device events. Registrations remain for restart. `destroy` clears explicit registrations, scopes, listeners and document references in a `finally` block. User exceptions propagate; they do not prevent cleanup or scheduling the next frame.

React uses reversible stop/start in its provider effect to tolerate Strict Mode replay. Callback refs own registrations and compare binding data plus callback identity. Provider snapshots send only changed option fields to `configure`. Vue counts mounted consumers and compares directive snapshots, including reactive nested changes. Angular starts outside NgZone after rendering and destroys its scoped service. jQuery keeps controllers in a WeakMap and ties each instance to the selected root.

Polling, registration precedence and lifecycle remain in `Controller`: splitting them into independently stateful classes would add coordination without removing state. The shared measurement cache and the optional navigation/presentation modules have narrower, testable responsibilities. No public plugin registry or scheduler abstraction is needed.

## Build and release

`scripts/build.mjs` compiles every package and copies licensed assets. Package smoke tests inspect actual npm archives, import ESM/CommonJS without a DOM, and confirm adapters do not bundle the core. Consumer fixtures install those archives in isolated directories, so Angular's TypeScript versions cannot mask incompatibility.

GitHub Actions repeats unit, browser and consumer tests. Pages deploys the playground. Publishing uses npm Trusted Publishing after the owner bootstraps each package and configures its trusted publisher. See [releasing](releasing.md).
