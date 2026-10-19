import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { npm } from './npm.mjs';

const target = process.argv[2];
const supported = ['react18', 'react19', 'vue33', 'vue34', 'vue35', 'jquery3', 'jquery4', 'angular20', 'angular21', 'angular22'];
if (!supported.includes(target)) throw new Error(`Choose one of ${supported.join(', ')}`);
const preset = process.argv[3];
const presets = ['full', 'core', 'navigation', 'hints'];
if (!preset) {
  for (const variant of presets) execFileSync(process.execPath, [process.argv[1], target, variant], { stdio: 'inherit' });
  process.exit(0);
}
if (!presets.includes(preset)) throw new Error(`Choose one of ${presets.join(', ')}`);
const suffix = preset === 'full' ? '' : '/' + preset;
const hasHints = preset === 'full' || preset === 'hints';
const hasNavigation = preset === 'full' || preset === 'navigation';
const framework = target.replace(/\d+$/, '');
const version = target.slice(framework.length);
const root = process.cwd();
const dir = path.resolve(`.artifacts/consumers/${target}`);
const manifest = JSON.parse(await readFile('.artifacts/packages/manifest.json', 'utf8'));
const dependencies = { gamepadify: manifest.core.path, [`gamepadify-${framework}`]: manifest[framework].path };
if (framework === 'react') Object.assign(dependencies, { react: version, 'react-dom': version, '@types/react': version, '@types/react-dom': version, typescript: '~5.9.3' });
if (framework === 'vue') Object.assign(dependencies, { vue: `3.${version[1]}`, '@vue/server-renderer': `3.${version[1]}`, 'vue-tsc': '^3.3.13', typescript: '~5.9.3' });
if (framework === 'jquery') Object.assign(dependencies, { jquery: version === '3' ? '~3.7.1' : '^4.0.0', '@types/jquery': version === '3' ? '^3.5.32' : '^4.0.1', typescript: '~5.9.3' });
if (framework === 'angular') {
  for (const name of ['core', 'common', 'compiler', 'compiler-cli', 'platform-browser', 'platform-server', 'cli', 'build']) dependencies[`@angular/${name}`] = version;
  Object.assign(dependencies, { typescript: version === '22' ? '~6.0.0' : '~5.9.3', rxjs: '^7.8.0', tslib: '^2.8.0' });
}
await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: `consumer-${target}`, private: true, type: 'module', dependencies }, null, 2));
console.log(`Installing ${target}/${preset} from packed artifacts…`);
npm(['install', '--no-audit', '--no-fund', manifest.core.path, manifest[framework].path], dir, 'inherit');
for (const file of ['index.js', 'controller.js']) assert.equal(await readFile(path.join(dir, 'node_modules/gamepadify/dist', file), 'utf8'), await readFile(`packages/core/dist/${file}`, 'utf8'), 'consumer must install the current packed build');
const extension = framework === 'react' ? 'tsx' : 'ts';
let appSource = await readFile(`tests/consumers/${framework}.${extension}`, 'utf8');
if (framework === 'react') appSource = appSource.replace("import { GamepadProvider, useGamepad, useGamepadController } from 'gamepadify-react';", `import { GamepadProvider } from 'gamepadify-react${suffix}';\nimport { useGamepad, useGamepadController } from 'gamepadify-react';`);
if (framework === 'vue') appSource = appSource.replace("import { createGamepadifyPlugin, useGamepadify } from 'gamepadify-vue';", `import { createGamepadifyPlugin } from 'gamepadify-vue${suffix}';\nimport { useGamepadify } from 'gamepadify-vue';`);
if (framework === 'jquery') appSource = appSource.replace("from 'gamepadify-jquery'", `from 'gamepadify-jquery${suffix}'`).replace('showHints: true', `showHints: ${hasHints}`);
await writeFile(path.join(dir, `app.${extension}`), appSource);
await cp('packages/core/dist', path.join(dir, 'dist'), { recursive: true });
let serverHtml = '';
if (framework === 'react') {
  await writeFile(path.join(dir, 'server.ts'), `import {createElement} from 'react'; import {renderToString} from 'react-dom/server'; import {App} from './app'; console.log(renderToString(createElement(App)));`);
  await writeFile(path.join(dir, 'main.ts'), `import {createElement} from 'react'; import {hydrateRoot} from 'react-dom/client'; import {App} from './app'; import {createGamepadSimulator} from 'gamepadify/testing'; const sim=createGamepadSimulator(); const options={source:sim,bodyClass:'consumer-active'}; const root=hydrateRoot(document.getElementById('app')!,createElement(App,{options})); Object.assign(window,{sim,unmount:()=>root.unmount()});`);
} else if (framework === 'vue') {
  await writeFile(path.join(dir, 'server.ts'), `import {renderToString} from '@vue/server-renderer'; import {makeApp} from './app'; console.log(await renderToString(makeApp()));`);
  await writeFile(path.join(dir, 'main.ts'), `import {makeApp} from './app'; import {createGamepadSimulator} from 'gamepadify/testing'; const sim=createGamepadSimulator(); const app=makeApp({source:sim,bodyClass:'consumer-active'}); app.mount('#app'); Object.assign(window,{sim,unmount:()=>app.unmount()});`);
} else if (framework === 'jquery') await writeFile(path.join(dir, 'main.ts'), `import './app';`);
if (framework === 'react' || framework === 'vue') {
  await build({ entryPoints: [path.join(dir, 'server.ts')], outfile: path.join(dir, 'server.mjs'), platform: 'node', format: 'esm', packages: 'external', bundle: true, jsx: 'automatic' });
  serverHtml = execFileSync(process.execPath, ['server.mjs'], { cwd: dir, encoding: 'utf8' }).trim();
  assert.match(serverHtml, /id="action"/);
}
const config = { compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, skipLibCheck: true, lib: ['ES2022', 'DOM'], jsx: 'react-jsx', experimentalDecorators: true, noEmit: true }, include: ['*.ts', '*.tsx', '*.vue'] };
await writeFile(path.join(dir, 'types.ts'), `import type {BindingInput, GamepadifyOptions} from 'gamepadify${suffix}'; const valid: BindingInput = ['xbox:lb','south']; const opts:GamepadifyOptions={showHints:false,bodyClass:'pad',elementClass:'target'}; void valid; void opts;\n// @ts-expect-error Unprefixed face labels are deliberately unsupported.\nconst bad:BindingInput='A'; void bad;`);
await writeFile(path.join(dir, 'tsconfig.json'), JSON.stringify(config));
let served = path.join(dir, 'dist');
if (framework === 'angular') {
  await writeFile(path.join(dir, 'main.ts'), `import {bootstrapApplication,provideClientHydration} from '@angular/platform-browser'; import {provideZonelessChangeDetection} from '@angular/core'; import {provideGamepadify} from 'gamepadify-angular${suffix}'; import {createGamepadSimulator} from 'gamepadify/testing'; import {App} from './app'; const sim=createGamepadSimulator(); bootstrapApplication(App,{providers:[provideZonelessChangeDetection(),provideClientHydration(),provideGamepadify({source:sim,bodyClass:'consumer-active'})]}).then(app=>Object.assign(window,{sim,unmount:()=>app.destroy()}));`);
  config.compilerOptions.noEmit = false;
  config.angularCompilerOptions = { strictTemplates: true };
  await writeFile(path.join(dir, 'tsconfig.json'), JSON.stringify(config));
  await writeFile(path.join(dir, 'index.html'), '<!doctype html><html><head><base href="/"><link rel="stylesheet" href="/gamepadify.css"></head><body><app-root></app-root></body></html>');
  await writeFile(path.join(dir, 'angular.json'), JSON.stringify({ version: 1, projects: { consumer: { projectType: 'application', root: '', sourceRoot: '', architect: { build: { builder: '@angular/build:application', options: { browser: 'main.ts', index: 'index.html', tsConfig: 'tsconfig.json', outputPath: 'browser-dist', optimization: false, sourceMap: false, styles: [] } } } } } }));
  execFileSync(process.execPath, ['node_modules/@angular/cli/bin/ng.js', 'build'], { cwd: dir, stdio: 'inherit' });
  served = path.join(dir, 'browser-dist/browser');
  await cp('packages/core/dist/gamepadify.css', path.join(served, 'gamepadify.css'));
  await cp('packages/core/dist/assets', path.join(served, 'assets'), { recursive: true });
  await build({entryPoints:[path.join(dir,'app.ts')],outfile:path.join(dir,'app.server.mjs'),bundle:true,platform:'node',format:'esm',packages:'external'});
  const ssr = `import '@angular/compiler'; import {readFile,writeFile} from 'node:fs/promises'; import {provideZonelessChangeDetection} from '@angular/core'; import {bootstrapApplication,provideClientHydration} from '@angular/platform-browser'; import {renderApplication,provideServerRendering} from '@angular/platform-server'; import {provideGamepadify} from 'gamepadify-angular${suffix}'; import {App} from './app.server.mjs'; const file='browser-dist/browser/index.html'; const html=await renderApplication(context=>bootstrapApplication(App,{providers:[provideZonelessChangeDetection(),provideServerRendering(),provideClientHydration(),provideGamepadify()]},context),{document:await readFile(file,'utf8'),url:'http://localhost/',allowedHosts:['localhost']}); if(!html.includes('id="action"'))throw new Error('SSR failed'); await writeFile(file,html); console.log('SSR passed');`;
  await writeFile(path.join(dir, 'ssr.mjs'), ssr);
  execFileSync(process.execPath, ['ssr.mjs'], { cwd: dir, stdio: 'inherit' });
} else {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], { cwd: dir, stdio: 'inherit' });
  if (framework === 'vue') {
    const template = `<script setup lang="ts">import {useGamepadify} from 'gamepadify-vue'; useGamepadify();</script><template><button v-gamepad="'west'">Action</button><button v-gamepad-focusable>Focus</button></template>`;
    await writeFile(path.join(dir, 'directive.vue'), template);
    const args = ['node_modules/vue-tsc/bin/vue-tsc.js', '--noEmit', '-p', 'tsconfig.json'];
    execFileSync(process.execPath, args, { cwd: dir, stdio: 'inherit' });
    await writeFile(path.join(dir, 'directive.vue'), template.replace("'west'", "'A'"));
    assert.throws(() => execFileSync(process.execPath, args, { cwd: dir, stdio: 'pipe' }), 'invalid Vue directive button must be rejected');
    await writeFile(path.join(dir, 'directive.vue'), template);
  }
  await build({ entryPoints: [path.join(dir, 'main.ts')], outfile: path.join(served, 'app.js'), bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' } });
  await writeFile(path.join(served, 'index.html'), `<!doctype html><html><head><link rel="stylesheet" href="/gamepadify.css"><style>body{padding:80px}button{padding:20px;margin:20px}</style></head><body><div id="app">${serverHtml}</div><script type="module" src="/app.js"></script></body></html>`);
}
if (framework !== 'jquery') {
  const file = path.join(served, 'index.html');
  const html = await readFile(file, 'utf8');
  await writeFile(file, html.replace('</body>', '<script>window.ssrElement=document.getElementById("action")</script></body>'));
}
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(served, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(served + path.sep)) { response.writeHead(403).end(); return; }
    response.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' })[path.extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => window.pad && window.sim && window.pad.getState().running);
  if (framework !== 'jquery') assert.equal(await page.evaluate(() => window.ssrElement === document.getElementById('action')), true, 'hydration must preserve the server-rendered element');
  const press = async button => {
    await page.evaluate(async button => { window.sim.press(button); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); window.sim.release(button); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }, button);
  };
  await press('home'); await press('west');
  assert.equal(await page.locator('#count').textContent(), '1', 'activation must reach framework state once');
  await page.evaluate(() => window.toggle());
  await page.waitForFunction(() => !document.getElementById('action'));
  await press('west');
  assert.equal(await page.locator('#count').textContent(), '1');
  await page.evaluate(() => window.toggle());
  await page.waitForSelector('#action'); await press('west');
  assert.equal(await page.locator('#count').textContent(), '2');
  assert.equal(await page.locator('.gamepadify-hint').count(), hasHints ? 1 : 0);
  if (hasNavigation) {
    await page.evaluate(() => window.pad.configure({ navigation: { confirm: 'south', selector: '#action' } }));
    await page.waitForFunction(() => document.activeElement?.id === 'action');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await press('south');
    assert.equal(await page.locator('#count').textContent(), '3', 'confirm must reach framework state');
  }
  assert.deepEqual(await page.evaluate(() => window.pad.getState().diagnostics), []);
  await page.evaluate(() => window.unmount());
  assert.equal(await page.locator('.gamepadify-layer').count(), 0);
  assert.equal(await page.locator('body').evaluate(element => element.classList.contains('consumer-active')), false);
  assert.deepEqual(errors, []);
  const resolved = JSON.parse(npm(['ls', '--depth=0', '--json'], dir));
  await mkdir(path.join(root, '.artifacts/compatibility'), { recursive: true });
  await writeFile(path.join(root, `.artifacts/compatibility/${target}-${preset}.json`), JSON.stringify({ target, preset, passed: true, node: process.version, dependencies: Object.fromEntries(Object.entries(resolved.dependencies).map(([key, item]) => [key, item.version])) }, null, 2));
  console.log(`${target}/${preset}: package installation, types, ${framework === 'jquery' ? '' : 'SSR, '}hydration/lifecycle, activation and cleanup passed.`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
