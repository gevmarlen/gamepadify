import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const run = (file, args) => execFileSync(process.execPath, [file, ...args], { stdio: 'inherit' });
const packages = ['core', 'react', 'vue', 'jquery'];
for (const name of packages) {
  const dir = `packages/${name}`;
  await mkdir(`${dir}/dist`, { recursive: true });
  const entry = `${dir}/src/index.${name === 'react' ? 'tsx' : 'ts'}`;
  for (const format of ['esm', 'cjs']) {
    await build({ entryPoints: [entry], outfile: `${dir}/dist/index.${format === 'esm' ? 'js' : 'cjs'}`, format, bundle: true, packages: 'external', external: ['gamepadify'], platform: 'neutral', target: 'es2022', sourcemap: true, tsconfig: 'tsconfig.json' });
    if (name === 'core') await build({ entryPoints: [`${dir}/src/testing.ts`], outfile: `${dir}/dist/testing.${format === 'esm' ? 'js' : 'cjs'}`, format, bundle: true, platform: 'neutral', target: 'es2022', sourcemap: true });
  }
  const configPath = `${dir}/tsconfig.build.json`;
  run('node_modules/typescript/bin/tsc', ['-p', configPath]);
  await cp('LICENSE', `${dir}/LICENSE`);
}
await build({ entryPoints: ['packages/core/src/index.ts'], outfile: 'packages/core/dist/gamepadify.min.js', format: 'iife', globalName: 'Gamepadify', bundle: true, minify: true, target: 'es2022', sourcemap: true });
await build({ entryPoints: ['packages/core/src/testing.ts'], outfile: 'packages/core/dist/gamepadify-testing.min.js', format: 'iife', globalName: 'GamepadifyTesting', bundle: true, minify: true, target: 'es2022', sourcemap: true });
await cp('packages/core/assets', 'packages/core/dist/assets', { recursive: true });
const css = await readFile('packages/core/src/styles.css', 'utf8');
const manifest = JSON.parse(await readFile('packages/core/assets/manifest.json', 'utf8'));
const glyphs = Object.entries(manifest).flatMap(([family, buttons]) => Object.entries(buttons).map(([button, file]) => `.gamepadify-glyph[data-family="${family}"][data-button="${button}"] { --gamepadify-image: url("./assets/${file}"); }`)).join('\n');
await writeFile('packages/core/dist/gamepadify.css', css + '\n' + glyphs + '\n');
await cp('THIRD_PARTY_NOTICES.md', 'packages/core/THIRD_PARTY_NOTICES.md');
await cp('LICENSE', 'packages/angular/LICENSE');
run('node_modules/ng-packagr/src/cli/main.js', ['-p', 'packages/angular/ng-package.json', '-c', 'packages/angular/tsconfig.json']);
console.log('Built core, adapters, declarations, styles and assets.');
