import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { npm } from './npm.mjs';

const manifest = JSON.parse(await readFile('.artifacts/packages/manifest.json', 'utf8'));
const version = manifest.core.version;
for (const item of Object.values(manifest)) assert.equal(item.version, version);
if (process.env.GITHUB_REF_TYPE === 'tag') assert.equal(process.env.GITHUB_REF_NAME, `v${version}`);

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
