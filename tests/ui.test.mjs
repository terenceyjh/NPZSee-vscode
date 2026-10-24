// SPDX-License-Identifier: GPL-3.0-or-later
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { runUiChecks } from './ui-checks.mjs';
await build({entryPoints:['src/backend.ts'],bundle:true,platform:'node',format:'cjs',outfile:'out/test/backend.cjs'});
const {Backend}=await import('../out/test/backend.cjs');
const backend=new Backend(path.resolve(`bin/${process.platform}-${process.arch}/npzsee-backend${process.platform==='win32'?'.exe':''}`),path.resolve('validation-output/extension-fixtures.npz'));
const hostMessages=[],errors=[];
await mkdir('validation-output/ui',{recursive:true});
const server=createServer(async(req,res)=>{
  const file=req.url==='/main.js'?'out/media/main.js':req.url==='/style.css'?'out/media/style.css':undefined;
  res.setHeader('Content-Type',file?.endsWith('.js')?'application/javascript':file?'text/css':'text/html');
  res.end(file?await readFile(file):'<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body><div id="app"></div><script src="/main.js"></script></body></html>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1280,height:850},locale:'en-US'});
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',async dialog=>{errors.push(`Unexpected dialog: ${dialog.message()}`);await dialog.dismiss();});
  await page.exposeFunction('__hostMessage',async message=>{
    if(message.type==='request') {
      let response;try{response={type:'response',id:message.id,result:await backend.request(message.method,message.params)}}catch(error){response={type:'response',id:message.id,error:error.message,code:error.code}}
      await page.evaluate(message=>window.postMessage(message,'*'),response).catch(()=>{});
    } else hostMessages.push(message);
  });
  await page.addInitScript(()=>{window.acquireVsCodeApi=()=>({postMessage:message=>window.__hostMessage(message),getState:()=>JSON.parse(localStorage.getItem('npzsee-state')||'null'),setState:state=>localStorage.setItem('npzsee-state',JSON.stringify(state))});});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const result=await runUiChecks(page,name=>page.screenshot({path:`validation-output/ui/${name}.png`}),hostMessages);
  // Hidden/recreated webviews restore array, tab and paging through VS Code state.
  await page.reload();await page.locator('tbody').waitFor();assert.equal(await page.locator('#array-title').innerText(),'unsigned');
  await page.evaluate(()=>document.body.style.setProperty('--vscode-editor-background','#ffffff'));
  await page.setViewportSize({width:760,height:620});await page.screenshot({path:'validation-output/ui/narrow.png'});
  assert.deepEqual(errors,[]);assert.ok(hostMessages.some(m=>m.type==='copy'&&m.text==='18446744073709551615'));
  await writeFile('validation-output/ui-test-result.json',JSON.stringify({...result,pageErrors:errors},null,2));
  const svg=hostMessages.find(m=>m.type==='export').svg;await writeFile('validation-output/ui/plot.svg',svg);
  await mkdir('assets/screenshots',{recursive:true});
  const {copyFile}=await import('node:fs/promises');
  await Promise.all(['table-details','plot','metadata','language-ar'].map(name=>copyFile(`validation-output/ui/${name}.png`,`assets/screenshots/${name}.png`)));
  console.log(`UI passed: ${result.cases.length} interaction groups, state restore, narrow layout, no page errors`);
} catch(error) {
  const page=browser.contexts()[0]?.pages()[0];
  if(page) await page.screenshot({path:'validation-output/ui/failure.png'});
  console.error('Page errors:',errors);
  throw error;
} finally {backend.dispose();await browser.close();server.close();}
