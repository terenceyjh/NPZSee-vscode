// SPDX-License-Identifier: GPL-3.0-or-later
import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { createServer } from 'node:net';
import { mkdir,writeFile,readFile,rm,readdir } from 'node:fs/promises';
import path from 'node:path';
import { runUiChecks } from '../tests/ui-checks.mjs';
const root=process.cwd();
const code=process.env.NPZSEE_CODE ?? await downloadAndUnzipVSCode({version:process.env.NPZSEE_VSCODE_VERSION??'stable',cachePath:path.join(root,'.vscode-test'),timeout:30000});
await mkdir('validation-output/vscode-ui',{recursive:true});
await Promise.all(['vscode-ready','vscode-ui-done','vscode-result.json','vscode-open-real','vscode-real-ready'].map(name=>rm(path.join('validation-output',name),{force:true})));
await build({entryPoints:['tests/vscode.integration.ts'],bundle:true,platform:'node',format:'cjs',external:['vscode'],outfile:'out/test/vscode.integration.js'});
const portServer=createServer();await new Promise(resolve=>portServer.listen(0,'127.0.0.1',resolve));const port=portServer.address().port;await new Promise(resolve=>portServer.close(resolve));
await mkdir('.vscode-test/user/User',{recursive:true});
await writeFile('.vscode-test/user/User/settings.json',JSON.stringify({'workbench.startupEditor':'none','workbench.colorTheme':'Default Dark Modern','window.restoreWindows':'none','telemetry.telemetryLevel':'off','update.mode':'none','extensions.autoCheckUpdates':false,'extensions.autoUpdate':false,'workbench.enableExperiments':false,'window.titleBarStyle':'custom','window.newWindowDimensions':'maximized'}));
let runError;
// Spawn the executable directly: shell-based launchers split Windows paths with spaces.
const env={...process.env,NPZSEE_ROOT:root,NPZSEE_UI_TEST:'1'};delete env.ELECTRON_RUN_AS_NODE;
const installed=process.env.NPZSEE_TEST_INSTALLED==='1';
const manifest=JSON.parse(await readFile('package.json','utf8'));
const installedDirectory=installed?(await readdir('.vscode-test/extensions')).find(name=>name.toLowerCase().startsWith(`${manifest.publisher}.${manifest.name}-${manifest.version}`.toLowerCase())):undefined;
if(installed&&!installedDirectory) throw new Error('Install the VSIX into .vscode-test/extensions first.');
const developmentPath=installed?path.join(root,'.vscode-test/extensions',installedDirectory):root;
const child=spawn(code,[`--extensionDevelopmentPath=${developmentPath}`,'--disable-extensions',`--extensionTestsPath=${path.join(root,'out/test/vscode.integration.js')}`,'--skip-welcome','--skip-release-notes','--disable-workspace-trust',`--user-data-dir=${path.join(root,'.vscode-test/user')}`,`--extensions-dir=${path.join(root,'.vscode-test/extensions')}`,`--remote-debugging-port=${port}`,'--disable-updates','--new-window'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
const log=createWriteStream('validation-output/vscode-log.txt');child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
const running=new Promise(resolve=>{child.on('error',error=>{runError=error;resolve();});child.on('exit',code=>{if(code!==0)runError=new Error(`VS Code test exited with code ${code}; see validation-output/vscode-log.txt`);log.end();resolve();});});
// Attach to the isolated development window, never to the user's normal session.
let browser,ready=false;
try {
  for(let n=0;n<120;n++) {
    if(runError) throw runError;
    try {await readFile('validation-output/vscode-ready');ready=true;break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,500));
    if(n===119) throw new Error('VS Code integration test did not become ready.');
  }
  browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  let frame,page;
  for(let n=0;n<100;n++) {
    for(const context of browser.contexts()) for(const candidate of context.pages()) for(const child of candidate.frames()) {
      if(await child.locator('#array-list').count().catch(()=>0)) {frame=child;page=candidate;break;}
    }
    if(frame) break;
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  if(!frame||!page) throw new Error('The custom editor webview was not found.');
  const result=await runUiChecks(frame,name=>page.screenshot({path:`validation-output/vscode-ui/${name}.png`}));
  // The real host watcher must close old maps and let Reload create a fresh session.
  const fixture=path.join(root,'validation-output','extension-fixtures.npz');
  await writeFile(fixture,await readFile(fixture));
  await frame.locator('#changed:not([hidden])').waitFor({timeout:10000});
  await frame.locator('#reload').click();
  await frame.locator('tbody').waitFor({timeout:30000});
  if(!(await frame.locator('tbody').innerText()).includes('18446744073709551615')) throw new Error('Reload did not restore exact array values');
  result.fileWatcherReload=true;
  const privateRecording=(await readdir('data').catch(()=>[])).some(name=>name.endsWith('.npz'));
  if(privateRecording) {
    await writeFile('validation-output/vscode-open-real','open');
    for(let n=0;n<60;n++) {try{await readFile('validation-output/vscode-real-ready');break;}catch{await new Promise(resolve=>setTimeout(resolve,300));}}
    let real;
    for(let n=0;n<60;n++) {
      for(const candidate of page.frames()) if(await candidate.locator('.array-item').count().catch(()=>0)===22) {real=candidate;break;}
      if(real)break;await new Promise(resolve=>setTimeout(resolve,300));
    }
    if(!real) throw new Error('Real recording editor did not appear');
    await real.locator('.array-item').filter({has:real.locator('.array-name',{hasText:/^voltage$/})}).click();
    await real.locator('tbody').waitFor({timeout:30000});
    await real.getByRole('button',{name:'Last page',exact:true}).click();
    await real.locator('tr[data-row="12499999"]').waitFor({timeout:30000});
    await real.locator('[data-tab="Plot"]').click();
    await real.locator('canvas').waitFor({timeout:30000});
    if(!(await real.locator('#status').innerText()).includes('12,500,000 samples')) throw new Error('Real recording plot length mismatch');
    await page.screenshot({path:'validation-output/vscode-ui/private-voltage.png'});
    await real.locator('[data-tab="Histogram"]').click();
    await real.getByLabel('Exact: scan all values',{exact:true}).check();
    await real.locator('#status:not(.busy)').waitFor({timeout:30000});
    if(!(await real.locator('.analysis-note').innerText()).includes('12,500,000')) throw new Error('Real recording exact histogram failed');
    result.realRecording={samples:12500000,lastPage:true,plot:true,exactHistogram:true};
  }
  result.installedPackage=installed;
  await writeFile('validation-output/vscode-ui-result.json',JSON.stringify(result,null,2));
  console.log(`Actual VS Code webview: ${result.cases.length} interaction groups passed`);
} catch(error) {
  if(browser) for(const context of browser.contexts()) for(const page of context.pages()) {
    await page.screenshot({path:'validation-output/vscode-ui/failure.png'}).catch(()=>{});
    for(const frame of page.frames()) if(await frame.locator('#status').count().catch(()=>0)) {
      console.error('Viewer diagnostic:',JSON.stringify({status:await frame.locator('#status').innerText(),title:await frame.locator('#array-title').innerText(),error:await frame.locator('.error-state').innerText().catch(()=>''),language:await frame.locator('html').getAttribute('lang')}));
    }
  }
  throw error;
} finally {
  await writeFile('validation-output/vscode-ui-done','done');
  if(!ready) child.kill();
  await running;
  if(browser) await browser.close().catch(()=>{});
  if(runError) throw runError;
}
console.log(await readFile('validation-output/vscode-result.json','utf8'));
