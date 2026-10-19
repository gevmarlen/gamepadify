import { execFileSync } from 'node:child_process';
import path from 'node:path';

export function npm(args, cwd = process.cwd(), output = 'pipe') {
  const cli = process.env.npm_execpath ?? path.resolve(path.dirname(process.execPath), process.platform === 'win32' ? 'node_modules/npm/bin/npm-cli.js' : '../lib/node_modules/npm/bin/npm-cli.js');
  return execFileSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', stdio: output, maxBuffer: 10 * 1024 * 1024 });
}
