import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { build } from 'esbuild';

const variants = ['full', 'core', 'navigation', 'hints'];
const sizes = {};
const fixture = path.resolve('.artifacts/package-smoke');
const external = ['react', 'vue', 'jquery', '@angular/*', 'tslib'];
const suffix = preset => preset === 'full' ? '' : '/' + preset;
const compressed = buffer => ({ bytes: buffer.length, gzip: gzipSync(buffer).length, brotli: brotliCompressSync(buffer).length });
const usedInputs = result => Object.values(result.metafile.outputs).flatMap(output => Object.entries(output.inputs).filter(([, data]) => data.bytesInOutput > 0).map(([file]) => file.replaceAll('\\', '/')));

function assertFeatures(inputs, preset) {
  const includes = file => inputs.some(input => input.endsWith('/' + file));
  assert.equal(includes('navigation-controller.js'), preset === 'full' || preset === 'navigation', `${preset}: navigation inclusion`);
  assert.equal(includes('geometry.js'), preset === 'full' || preset === 'navigation', `${preset}: geometry inclusion`);
  assert.equal(includes('renderer.js'), preset === 'full' || preset === 'hints', `${preset}: hints inclusion`);
  assert.equal(includes('focus-renderer.js'), preset !== 'core', `${preset}: focus renderer inclusion`);
}

for (const preset of variants) {
  const specifier = 'gamepadify' + suffix(preset);
  const result = await build({ stdin: { contents: `import {createGamepadify} from '${specifier}'; window.pad=createGamepadify();`, resolveDir: fixture }, absWorkingDir: fixture, tsconfigRaw: {}, bundle: true, format: 'esm', target: 'es2022', minify: true, write: false, metafile: true });
  assertFeatures(usedInputs(result), preset);
  const script = await readFile(`packages/core/dist/gamepadify${preset === 'full' ? '' : '-' + preset}.min.js`);
  const css = await readFile(`packages/core/dist/gamepadify${preset === 'core' || preset === 'navigation' ? '-' + preset : ''}.css`);
  sizes[preset] = { consumer: compressed(result.outputFiles[0].contents), script: compressed(script), css: compressed(css) };
  const budget = { full: 10300, core: 7400, navigation: 8900, hints: 9100 }[preset];
  assert(sizes[preset].script.gzip <= budget, `${preset}: exceeds ${budget} byte gzip budget`);
  if (preset === 'core' || preset === 'navigation') assert.doesNotMatch(css.toString(), /url\(|gamepadify-glyph/);

  for (const framework of ['react', 'vue', 'jquery', 'angular']) {
    const dir = path.resolve(`packages/${framework}/dist`);
    const adapter = framework === 'angular' ? `${dir}/fesm2022/gamepadify-angular${preset === 'full' ? '' : '-' + preset}.mjs` : `${dir}/${preset === 'full' ? 'index' : preset}.js`;
    const shared = framework === 'angular' ? `${dir}/fesm2022/gamepadify-angular.mjs` : `${dir}/index.js`;
    const imports = {
      react: `import {GamepadProvider} from ${JSON.stringify(adapter)}; import {useGamepad} from ${JSON.stringify(shared)}; window.api=[GamepadProvider,useGamepad];`,
      vue: `import {createGamepadifyPlugin} from ${JSON.stringify(adapter)}; import {useGamepadify} from ${JSON.stringify(shared)}; window.api=[createGamepadifyPlugin,useGamepadify];`,
      jquery: `import {installGamepadify} from ${JSON.stringify(adapter)}; window.api=installGamepadify;`,
      angular: `import {provideGamepadify} from ${JSON.stringify(adapter)}; import {GamepadDirective} from ${JSON.stringify(shared)}; window.api=[provideGamepadify,GamepadDirective];`,
    };
    const buildResult = await build({ stdin: { contents: imports[framework], resolveDir: fixture }, absWorkingDir: fixture, tsconfigRaw: {}, external, bundle: true, format: 'esm', minify: true, write: false, metafile: true });
    assertFeatures(usedInputs(buildResult), preset);
  }
}
assert(sizes.core.script.gzip < sizes.full.script.gzip * 0.75, 'core must save at least 25% versus the full preset');
await writeFile('.artifacts/bundles.json', JSON.stringify(sizes, null, 2) + '\n');
console.table(Object.fromEntries(Object.entries(sizes).map(([preset, size]) => [preset, { 'script gzip': size.script.gzip, 'consumer gzip': size.consumer.gzip, 'CSS gzip': size.css.gzip }])));
console.log('All entry points and adapters exclude unused features. Bundle budgets passed.');
