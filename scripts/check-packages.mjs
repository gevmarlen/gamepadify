import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { npm } from './npm.mjs';
import { pack } from './pack.mjs';

const packages = await pack();
const fixture = path.resolve('.artifacts/package-smoke');
await mkdir(fixture, { recursive: true });
await writeFile(path.join(fixture, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { gamepadify: packages.core.path } }));
npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', packages.core.path], fixture);
for (const file of ['index.js', 'controller.js']) assert.equal(await readFile(path.join(fixture, 'node_modules/gamepadify/dist', file), 'utf8'), await readFile(`packages/core/dist/${file}`, 'utf8'));
execFileSync(process.execPath, ['--input-type=module', '-e', `import assert from 'node:assert/strict'; import {createRequire} from 'node:module'; import {createGamepadSimulator} from 'gamepadify/testing'; const require=createRequire(import.meta.url); for(const suffix of ['', '/core', '/navigation', '/hints']) { const {createGamepadify}=await import('gamepadify'+suffix); const pad=createGamepadify(); pad.start(); assert.equal(pad.getState().running,false); assert.equal(require('gamepadify'+suffix).createGamepadify().getState().mode,'pointer'); pad.destroy(); } assert.equal(createGamepadSimulator().getGamepads().length,1); assert.equal(typeof window,'undefined');`], { cwd: fixture, stdio: 'inherit' });
const imports = ['', '/core', '/navigation', '/hints'].map((suffix, index) => `import {createGamepadify as create${index}} from 'gamepadify${suffix}'; create${index}();`).join('\n');
for (const extension of ['mts', 'cts']) {
  const file = path.join(fixture, `types.${extension}`);
  await writeFile(file, imports);
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'Node16', '--moduleResolution', 'Node16', file], { stdio: 'inherit' });
}
for (const name of ['react', 'vue', 'jquery']) {
  const source = await readFile(`packages/${name}/dist/index.js`, 'utf8');
  assert.match(source, /from "gamepadify"/);
  assert.doesNotMatch(source, /class Controller|class ChordMatcher/);
}
for (const [name, metadata] of Object.entries(packages)) {
  assert(metadata.files.some(file => file.path === 'LICENSE'), `${name}: missing license`);
  assert(metadata.files.some(file => file.path.endsWith('.d.ts')), `${name}: missing declarations`);
  assert(!metadata.files.some(file => /node_modules|\.artifacts|\.test\./.test(file.path)), `${name}: unexpected package contents`);
}
assert.equal(packages.core.files.filter(file => file.path.endsWith('.png')).length, 50);
const minified = await readFile('packages/core/dist/gamepadify.min.js');
const sizes = { minified: minified.length, gzip: gzipSync(minified).length, tarballs: Object.fromEntries(Object.entries(packages).map(([name, value]) => [name, value.size])) };
await writeFile('.artifacts/sizes.json', JSON.stringify(sizes, null, 2));
console.log(`Package checks passed. Core: ${sizes.minified} bytes minified / ${sizes.gzip} bytes gzip.`);
