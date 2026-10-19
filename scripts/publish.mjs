import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { npm } from './npm.mjs';

const manifest = JSON.parse(await readFile('.artifacts/packages/manifest.json', 'utf8'));
const version = manifest.core.version;
const releaseTag = process.env.GAMEPADIFY_RELEASE_TAG || (process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined);
if (process.env.GITHUB_ACTIONS === 'true') assert.ok(releaseTag, 'CI publication requires a version tag');
for (const item of Object.values(manifest)) assert.equal(item.version, version);
if (releaseTag) {
  assert.equal(releaseTag, `v${version}`);
  const revision = ref => execFileSync('git', ['rev-parse', '--verify', ref], { encoding: 'utf8' }).trim();
  assert.equal(revision('HEAD'), revision(`refs/tags/${releaseTag}^{commit}`), 'Publication must use the tagged source');
}

for (const name of ['core', 'react', 'vue', 'angular', 'jquery']) {
  const item = manifest[name];
  const response = await fetch(`https://registry.npmjs.org/${item.name}/${item.version}`);
  if (response.ok) {
    const existing = await response.json();
    assert.equal(existing.dist.integrity, item.integrity, `${item.name}: a different archive is already published`);
    console.log(`${item.name}@${item.version}: identical archive already published`);
    continue;
  }
  if (response.status !== 404) throw new Error(`Registry returned ${response.status} for ${item.name}`);
  npm(['publish', item.path, '--access', 'public', ...process.argv.includes('--provenance') ? ['--provenance'] : []], process.cwd(), 'inherit');
}
