import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { npm } from './npm.mjs';

export async function pack() {
  const destination = path.resolve('.artifacts/packages');
  await mkdir(destination, { recursive: true });
  const result = {};
  for (const name of ['core', 'react', 'vue', 'jquery', 'angular']) {
    const cwd = path.resolve(`packages/${name}${name === 'angular' ? '/dist' : ''}`);
    const [metadata] = JSON.parse(npm(['pack', '--json', '--pack-destination', destination], cwd));
    result[name] = { ...metadata, path: path.join(destination, metadata.filename) };
    console.log(`${metadata.name}: ${metadata.filename} (${metadata.size} bytes)`);
  }
  await writeFile('.artifacts/packages/manifest.json', JSON.stringify(result, null, 2));
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/pack.mjs')) await pack();
