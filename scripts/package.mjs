// SPDX-License-Identifier: GPL-3.0-or-later
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile } from 'node:fs/promises';
const target = process.env.NPZSEE_PLATFORM ?? `${process.platform}-${process.arch}`;
if(!['win32-x64','win32-arm64','linux-x64','linux-arm64','darwin-x64','darwin-arm64'].includes(target))throw new Error(`Unsupported target: ${target}`);
const manifest=JSON.parse(await readFile('package.json','utf8'));
await access(`bin/${target}/npzsee-backend${target.startsWith('win32-') ? '.exe' : ''}`);
await mkdir('dist', { recursive: true });
const result = spawnSync(process.execPath, ['node_modules/@vscode/vsce/vsce', 'package', '--target', target, '--ignore-other-target-folders', '--out', `dist/NPZSee-vscode-${manifest.version}-${target}.vsix`], { stdio: 'inherit' });
process.exit(result.status ?? 1);
