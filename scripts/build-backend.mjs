// SPDX-License-Identifier: GPL-3.0-or-later
import { spawnSync } from 'node:child_process';
import { mkdir, copyFile, chmod } from 'node:fs/promises';
import path from 'node:path';
const target = process.env.NPZSEE_TARGET;
const useZig=process.env.NPZSEE_ZIG==='1';
const buildTarget=target&&useZig&&target.includes('linux-gnu')?`${target}.2.28`:target;
const args = [useZig?'zigbuild':'build', '--release', '--locked', '--bin', 'npzsee-backend', ...(buildTarget ? ['--target', buildTarget] : [])];
const result = spawnSync('cargo', args, { stdio: 'inherit', env: { ...process.env, CARGO_TARGET_DIR: path.resolve('target') } });
if (result.status !== 0) process.exit(result.status ?? 1);
const platform = process.env.NPZSEE_PLATFORM ?? `${process.platform}-${process.arch}`;
const exe = platform.startsWith('win32-') ? 'npzsee-backend.exe' : 'npzsee-backend';
const directory = path.join('bin', platform);
await mkdir(directory, { recursive: true });
await copyFile(path.join('target', ...(target ? [target] : []), 'release', exe), path.join(directory, exe));
if (!platform.startsWith('win32-')) await chmod(path.join(directory, exe), 0o755);
console.log(`Backend ready: ${directory}/${exe}`);
