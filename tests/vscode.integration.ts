// SPDX-License-Identifier: GPL-3.0-or-later
import * as vscode from 'vscode';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import { writeFile, access, readdir } from 'node:fs/promises';
const delay = (ms: number) => new Promise(resolve=>setTimeout(resolve,ms));
export async function run() {
  const root = process.env.NPZSEE_ROOT!;
  await vscode.workspace.getConfiguration('npzsee').update('language','en',vscode.ConfigurationTarget.Global);
  const clipboard = await vscode.env.clipboard.readText();
  const extension=vscode.extensions.getExtension('npzsee-local.npzsee');
  assert.ok(extension);const api=await extension.activate();
  await vscode.commands.executeCommand('vscode.openWith',vscode.Uri.file(path.join(root,'validation-output','extension-fixtures.npz')),'npzsee.viewer');
  assert.ok(vscode.window.tabGroups.all.flatMap(g=>g.tabs).some(tab=>tab.input instanceof vscode.TabInputCustom&&tab.input.viewType==='npzsee.viewer'));
  assert.equal(api.getSessionCount(),1);
  await writeFile(path.join(root,'validation-output','vscode-ready'),'ready');
  if(process.env.NPZSEE_UI_TEST==='1') {
    let openedReal = false;
    for(let n=0;n<180;n++) {
      try {await access(path.join(root,'validation-output','vscode-ui-done'));break;}catch {await delay(1000);}
      if(!openedReal) {
        try {
          await access(path.join(root,'validation-output','vscode-open-real'));
          const name=(await readdir(path.join(root,'data'))).find(name=>name.endsWith('.npz'));
          assert.ok(name);
          await vscode.commands.executeCommand('vscode.openWith',vscode.Uri.file(path.join(root,'data',name)),'npzsee.viewer');
          assert.equal(api.getSessionCount(),2);
          openedReal=true;await writeFile(path.join(root,'validation-output','vscode-real-ready'),'ready');
        } catch(error) {if(!(error instanceof Error)||!('code' in error)||error.code!=='ENOENT') throw error;}
      }
      if(n===179) throw new Error('UI test driver did not finish');
    }
  }
  assert.equal(await vscode.env.clipboard.readText(),'18446744073709551615');
  await vscode.env.clipboard.writeText(clipboard);
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  for(let n=0;n<50&&api.getSessionCount()!==0;n++) await delay(100);
  assert.equal(api.getSessionCount(),0,'Closing all editors releases document sessions');
  await writeFile(path.join(root,'validation-output','vscode-result.json'),JSON.stringify({passed:true,activation:true,customEditor:true,documentDisposal:true}));
}
