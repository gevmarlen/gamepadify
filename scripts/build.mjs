import { build } from 'esbuild';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const run = (file, args) => execFileSync(process.execPath, [file, ...args], { stdio: 'inherit' });
const packages = ['core', 'react', 'vue', 'jquery'];
for (const name of packages) {
  const dir = `packages/${name}`;
  const output = path.resolve(dir, 'dist');
  if (path.dirname(output) !== path.resolve('packages', name)) throw new Error('Invalid build output directory');
  await rm(output, { recursive: true, force: true });
  await mkdir(`${dir}/dist`, { recursive: true });
  const entries = (await readdir(`${dir}/src`)).filter(file => /\.tsx?$/.test(file)).map(file => `${dir}/src/${file}`);
  for (const format of ['esm', 'cjs']) {
    await build({ entryPoints: entries, outdir: `${dir}/dist${format === 'cjs' ? '/cjs' : ''}`, outbase: `${dir}/src`, format, platform: 'neutral', target: 'es2022', sourcemap: true, tsconfig: 'tsconfig.json' });
  }
  await writeFile(`${dir}/dist/cjs/package.json`, '{"type":"commonjs"}\n');
  for (const entry of ['index', 'core', 'navigation', 'hints', ...(name === 'core' ? ['testing'] : [])]) await writeFile(`${dir}/dist/${entry}.cjs`, `module.exports = require('./cjs/${entry}.js');\n`);
  const configPath = `${dir}/tsconfig.build.json`;
  run('node_modules/typescript/bin/tsc', ['-p', configPath]);
  await cp('LICENSE', `${dir}/LICENSE`);
}
for (const entry of ['index', 'core', 'navigation', 'hints']) await build({ entryPoints: [`packages/core/src/${entry}.ts`], outfile: `packages/core/dist/gamepadify${entry === 'index' ? '' : '-' + entry}.min.js`, format: 'iife', globalName: 'Gamepadify', bundle: true, minify: true, target: 'es2022', sourcemap: true });
await build({ entryPoints: ['packages/core/src/testing.ts'], outfile: 'packages/core/dist/gamepadify-testing.min.js', format: 'iife', globalName: 'GamepadifyTesting', bundle: true, minify: true, target: 'es2022', sourcemap: true });
await cp('packages/core/assets', 'packages/core/dist/assets', { recursive: true });
const css = await readFile('packages/core/src/styles.css', 'utf8');
const manifest = JSON.parse(await readFile('packages/core/assets/manifest.json', 'utf8'));
const glyphs = Object.entries(manifest).flatMap(([family, buttons]) => Object.entries(buttons).map(([button, file]) => `.gamepadify-glyph[data-family="${family}"][data-button="${button}"] { --gamepadify-image: url("./assets/${file}"); }`)).join('\n');
await writeFile('packages/core/dist/gamepadify.css', css + '\n' + glyphs + '\n');
await writeFile('packages/core/dist/gamepadify-core.css', css.split('\n')[0] + '\n');
await writeFile('packages/core/dist/gamepadify-navigation.css', css.split('\n').filter(line => !/\.gamepadify-(hint|glyph|plus)/.test(line)).join('\n'));
await cp('THIRD_PARTY_NOTICES.md', 'packages/core/THIRD_PARTY_NOTICES.md');
await cp('LICENSE', 'packages/angular/LICENSE');
run('node_modules/ng-packagr/src/cli/main.js', ['-p', 'packages/angular/ng-package.json', '-c', 'packages/angular/tsconfig.json']);
console.log('Built core, adapters, declarations, styles and assets.');
