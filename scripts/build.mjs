// SPDX-License-Identifier: GPL-3.0-or-later
import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('out/media', { recursive: true });
await Promise.all([
  build({ entryPoints: ['src/extension.ts'], bundle: true, platform: 'node', target: 'node20', format: 'cjs', external: ['vscode'], outfile: 'out/extension.js', sourcemap: false }),
  build({ entryPoints: ['media/main.ts'], bundle: true, platform: 'browser', target: 'es2022', outfile: 'out/media/main.js', sourcemap: false }),
  copyFile('media/style.css', 'out/media/style.css'),
]);
