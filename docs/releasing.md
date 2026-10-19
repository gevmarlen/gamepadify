# Releasing

All five packages use the same version. Update their manifests, adapter peer ranges when necessary, changelog and fixed CDN examples together.

Changes after a version tag are not part of that release. Choose a new version and tag before publishing them; do not replace existing release archives with development builds carrying the same version.

## Validation

```sh
npm ci
npm run check
npx playwright install --with-deps
npm run test:browser
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
npm run demo:build
```

Archives are created in `.artifacts/packages`. Verify the public README, asset licenses and package sizes before publishing. Angular must be packed from `packages/angular/dist`; the packaging script already does this.

Consumer commands check all four presets. Copy the current `.artifacts/bundles.json` into `docs/bundles.json` and aggregate the `target-preset.json` compatibility reports. The browser archive must include all four scripts, their maps, the three stylesheets, optional simulator, artwork and licenses.

## Local publication

An npm owner must authenticate locally with `npm login` and complete npm's browser/2FA flow. Do not commit tokens or send them in issues/chat.

After login and the validation above:

```sh
node scripts/publish.mjs
```

This publishes core first, then the four adapters. Existing identical versions are skipped; a different already-published archive causes an error. If npm asks for an OTP, complete its interactive authentication flow and retry.

## Trusted Publishing

For each package, configure an npm trusted publisher:

| Field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization/user | `gevmarlen` |
| Repository | `gamepadify` |
| Workflow filename | `publish.yml` |
| Environment | Leave empty |
| Allowed action | Direct `npm publish` |

Then set the GitHub repository variable `NPM_PUBLISHING_ENABLED=true`. Publishing remains disabled until this explicit bootstrap is complete. There is no long-lived npm token in Actions.

The workflow uses GitHub-hosted runners, `id-token: write`, Node 24 and an npm CLI supporting OIDC. It runs the complete reusable verification workflow before publication. The `--provenance` flag requests a public provenance statement.

Reference: [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).

## GitHub and CDN

Create an annotated `vX.Y.Z` tag and a GitHub Release from the checked commit. Attach the five npm archives, browser bundle and checksums. Publishing a release triggers the npm workflow once enabled.

To retry after fixing release tooling, manually dispatch the current workflow from `main` and provide the existing tag in `release_tag`. Verification and package builds use that tag; publishing scripts come from the workflow revision. The publisher checks that the package version and checked-out commit match the tag. This allows tooling fixes without moving a published tag or changing package contents.

After publication, verify all five registry versions and fetch:

- `https://cdn.jsdelivr.net/npm/gamepadify@X.Y.Z/dist/gamepadify.min.js`
- `https://cdn.jsdelivr.net/npm/gamepadify@X.Y.Z/dist/gamepadify.css`
- `https://cdn.jsdelivr.net/npm/gamepadify@X.Y.Z/dist/assets/xbox-south.png`

Verify actual execution of the CDN script and loading of the CSS-relative PNGs. Do not count prepared URLs as published artifacts. Pages is independent of npm publication and deploys from `main`.
