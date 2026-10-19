import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const dist = path.resolve(process.argv[2] ?? 'packages/core/dist');
const scriptHash = createHash('sha256').update(await readFile(path.join(dist, 'gamepadify.min.js'))).digest('hex');
const output = path.resolve(process.argv[3] ?? '.artifacts/benchmark.json');
const frames = Number(process.env.BENCH_FRAMES ?? 60);
const runs = Number(process.env.BENCH_RUNS ?? 3);
const server = createServer(async (request, response) => {
  const name = new URL(request.url, 'http://localhost').pathname.slice(1);
  if (!name) {
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><link rel="stylesheet" href="/gamepadify.css"><style>body{margin:40px}#grid{display:grid;grid-template-columns:repeat(40,36px);gap:8px}button{height:28px;padding:0}</style><div id="grid"></div><script src="/gamepadify.min.js"></script>');
    return;
  }
  const file = path.resolve(dist, name);
  if (!file.startsWith(dist + path.sep)) { response.writeHead(403).end(); return; }
  try {
    response.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' })[path.extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
const measurements = [];
try {
  for (const scenario of ['navigation', 'hints'].filter(value => !process.env.BENCH_SCENARIO || process.env.BENCH_SCENARIO === value)) for (const count of [10, 100, 500, 1000].filter(value => !process.env.BENCH_COUNT || Number(process.env.BENCH_COUNT) === value)) for (let run = 0; run < runs; run++) {
    const page = await browser.newPage({ viewport: { width: 1840, height: 1280 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(async ({ count, scenario }) => {
      const nativeFrame = requestAnimationFrame.bind(window);
      const step = () => new Promise(resolve => nativeFrame(resolve));
      const samples = [];
      let recording = false, current = null;
      for (const [object, name] of [[window, 'getComputedStyle'], [Element.prototype, 'getBoundingClientRect'], [Element.prototype, 'getClientRects'], [Document.prototype, 'elementFromPoint'], [Element.prototype, 'querySelectorAll'], [Document.prototype, 'querySelectorAll']]) {
        const original = object[name];
        object[name] = function (...args) { if (current) current[name] = (current[name] ?? 0) + 1; return original.apply(this, args); };
      }
      window.requestAnimationFrame = callback => nativeFrame(time => {
        current = recording ? {} : null;
        const start = performance.now();
        try { callback(time); } finally {
          if (current) samples.push({ cpu: performance.now() - start, ...current });
          current = null;
        }
      });
      const names = ['south', 'west', 'north', 'left-shoulder', 'right-shoulder', 'left-trigger', 'right-trigger', 'select', 'start', 'left-stick', 'right-stick', 'dpad-up', 'dpad-down', 'dpad-left', 'dpad-right'];
      const chords = [];
      for (let mask = 1; chords.length < count; mask++) chords.push(names.filter((_, i) => mask & (1 << i)).join('+'));
      const grid = document.getElementById('grid');
      function add(index) {
        const element = document.createElement('button');
        element.textContent = String(index);
        element.dataset.gamepadFocusable = '';
        if (!index) element.dataset.gamepad = 'home';
        else if (scenario === 'hints' && index < count) element.dataset.gamepad = chords[index];
        grid.append(element);
        return element;
      }
      for (let i = 0; i < count; i++) add(i);
      const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
      const device = { id: 'Benchmark standard controller', index: 0, connected: true, mapping: 'standard', buttons, axes: [0, 0], timestamp: 0 };
      const pads = [device];
      const controller = Gamepadify.createGamepadify({ source: { getGamepads: () => pads }, family: 'generic', warnings: false, elementClass: 'registered', navigation: scenario === 'navigation' ? { confirm: 'east' } : false });
      controller.start();
      buttons[16].pressed = true;
      await step();
      buttons[16].pressed = false;
      for (let i = 0; i < 30; i++) await step();
      window.bench = {
        sample: async frames => { samples.length = 0; recording = true; for (let i = 0; i < frames; i++) await step(); recording = false; return samples; },
        interactions: async () => {
          const latencies = [];
          for (let i = 0; i < 8; i++) {
            const start = performance.now();
            grid.firstElementChild.addEventListener('click', () => latencies.push(performance.now() - start), { once: true });
            buttons[16].pressed = true;
            await step();
            buttons[16].pressed = false;
            await step();
          }
          const start = performance.now();
          let last;
          for (let i = 0; i < Math.max(1, count / 10); i++) last = add(count + i);
          for (let i = 0; i < 10 && !last.classList.contains('registered'); i++) await step();
          return { latencies, insertion: performance.now() - start, inserted: last.classList.contains('registered') };
        },
        stop: () => controller.destroy(),
      };
    }, { count, scenario });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    if (process.env.BENCH_PROFILE) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
    const before = (await cdp.send('Performance.getMetrics')).metrics;
    const samples = await page.evaluate(frames => window.bench.sample(frames), frames);
    const after = (await cdp.send('Performance.getMetrics')).metrics;
    const { profile } = await cdp.send('HeapProfiler.stopSampling');
    if (process.env.BENCH_PROFILE) await writeFile(process.env.BENCH_PROFILE, JSON.stringify(await cdp.send('Profiler.stop')));
    function allocated(node) { return node.selfSize + node.children.reduce((sum, child) => sum + allocated(child), 0); }
    const metrics = Object.fromEntries(after.map(item => [item.name, item.value - before.find(other => other.name === item.name).value]));
    const interactions = await page.evaluate(() => window.bench.interactions());
    assert.equal(interactions.latencies.length, 8, 'each input must activate exactly once');
    assert.equal(interactions.inserted, true, 'dynamic elements must be registered');
    assert.deepEqual(errors, [], 'benchmark must not hide runtime errors');
    const row = { scenario, count, run, samples, metrics, sampledAllocatedBytes: allocated(profile.head), ...interactions };
    measurements.push(row);
    console.log(`${scenario} ${count} run ${run + 1}: ${(samples.reduce((sum, item) => sum + item.cpu, 0) / samples.length).toFixed(3)} ms/frame`);
    await page.evaluate(() => window.bench.stop());
    await page.close();
  }
  await mkdir(path.dirname(output), { recursive: true });
  assert.equal(createHash('sha256').update(await readFile(path.join(dist, 'gamepadify.min.js'))).digest('hex'), scriptHash, 'build changed during measurement');
  await writeFile(output, JSON.stringify({ date: new Date().toISOString(), browser: browser.version(), node: process.version, platform: `${os.platform()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0].model, frames, runs, dist, scriptHash, measurements }, null, 2) + '\n');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
