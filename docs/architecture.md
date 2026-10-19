# Architecture

## Package boundaries

The workspace contains a DOM-based core and four independent adapters. Only the core polls input, resolves bindings, owns focus and renders prompts. Adapters register elements and translate framework lifecycle events into controller lifecycle calls. Framework packages and the core remain peer dependencies of adapters.

The core has no runtime dependencies. Angular uses `tslib` and is distributed as APF with Partial-Ivy declarations compiled by Angular 20. The consumer's Angular compiler links those declarations. Other packages ship ESM and CommonJS with declarations and source maps. A separate minified IIFE exports `Gamepadify`.

No module reads window, document or navigator at import time. Controller construction records options. Client startup acquires document resources; adapters defer it until after mounting/rendering.

## Input flow

1. Sample the configured Gamepad source once per animation frame while the document is visible and focused.
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

A mutation observer invalidates the registration cache. Reconciliation combines data attributes, selector maps and explicit registrations in that precedence order. A separate element identity prevents multiple registration paths from becoming duplicate-element conflicts.

Availability excludes hidden, disabled, inert and zero-sized elements. Screen visibility intersects the viewport and clipping ancestors and uses a center-point hit test where supported. A partially covered element can be excluded if its visible center is covered; complex occlusion is not pixel-perfect.

Duplicates are grouped by normalized trigger among visible targets in the active scope. Conflict identities include their participating elements; unchanged conflicts do not log every frame. Reserved confirmation and D-pad buttons are checked throughout the scope, even on currently offscreen mappings.

## Focus and spatial navigation

Navigation candidates are explicitly marked. Real DOM focus is retained. Non-native focus targets temporarily receive `tabindex="-1"`; the previous state is restored during teardown. The visual focus overlay follows an eligible active DOM element.

The dominant stick axis selects one direction. Candidate centers must be ahead of the current center. Candidates sharing the relevant directional lane rank first, followed by rectangle distance and DOM order. Hysteresis and timed repeat avoid noisy stick movement. There is no wraparound. Native `scrollIntoView` handles nested scroll containers.

A scope stack limits both registration and navigation. Each scope remembers the previous focus. Native modal dialogs need a scope; their overlay is mounted inside the dialog's top layer.

## Rendering and ownership

The renderer owns one pointer-transparent, aria-hidden layer. It never rewrites application element contents. Geometry is refreshed during active polling so scrolling, animation and CSS changes are reflected without framework updates. Resize observers track only changed registration memberships.

Default PNG URLs come from the stylesheet, relative to that file. Built-in or custom failed images retain a text label. Atlas glyphs map pixel rectangles to the configured prompt size. Applications can replace a skin without changing input mapping.

Classes use per-element, per-token reference counts across instances. Preexisting classes are not removed. Consumer class changes using the exact same token while the library owns it cannot be distinguished from library ownership; use distinct application/library tokens when mutating classes concurrently.

## Lifecycle

`stop` cancels animation frames, disconnects observers, removes listeners and overlays, releases class claims and restores temporary tabindex values. Registrations remain for restart. `destroy` additionally clears explicit registrations, scopes, listeners and document references.

React uses reversible stop/start in its provider effect to tolerate Strict Mode's development effect replay. Callback refs own registrations. Vue counts mounted directive/composable consumers. Angular starts outside NgZone after rendering and destroys its scoped service. jQuery keeps controllers in a WeakMap and exposes explicit destroy.

## Build and release

`scripts/build.mjs` compiles every package and copies licensed assets. Package smoke tests inspect actual npm archives, import ESM/CommonJS without a DOM, and confirm adapters do not bundle the core. Consumer fixtures install those archives in isolated directories, so Angular's TypeScript versions cannot mask incompatibility.

GitHub Actions repeats unit, browser and consumer tests. Pages deploys the playground. Publishing uses npm Trusted Publishing after the owner bootstraps each package and configures its trusted publisher. See [releasing](releasing.md).
