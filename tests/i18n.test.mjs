// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
await build({entryPoints:['src/i18n.ts'],bundle:true,platform:'node',format:'cjs',outfile:'out/test/i18n.cjs'});
const {translate,resolveLanguage,languages}=await import('../out/test/i18n.cjs');
const messages=JSON.parse(await readFile('locales/messages.json','utf8'));
const placeholders=value=>[...value.matchAll(/\{(\w+)\}/g)].map(match=>match[1]).sort();
test('All six languages have complete messages and matching placeholders',()=>{
  assert.equal(languages.length,6);
  for(const [key,row] of Object.entries(messages)) {
    assert.equal(row.length,5,key);
    for(const value of row) {assert.ok(value.trim(),key);assert.deepEqual(placeholders(value),placeholders(key),key);}
    for(const language of languages) assert.equal(typeof translate(language.value,key),'string');
  }
});
test('Locale fallback, exact values and dynamic labels',()=>{
  assert.equal(resolveLanguage('zh-Hans'),'zh-CN');assert.equal(resolveLanguage('fr-CA'),'fr');assert.equal(resolveLanguage('de'),'en');assert.equal(resolveLanguage('ar-SA'),'ar');
  assert.equal(translate('zh-CN','Cell details'),'单元格详情');
  assert.equal(translate('fr','{count} arrays, ready to explore',{count:22}),'22 tableaux prêts à explorer');
  assert.equal(translate('ar','18446744073709551615'),'18446744073709551615');
});
test('All statically requested UI message keys exist',async()=>{
  for(const file of ['media/main.ts','src/extension.ts']) {
    const source=await readFile(file,'utf8');
    for(const match of source.matchAll(/\bt\(\s*['"]([^'"\n]+)['"]/g))assert.ok(Object.hasOwn(messages,match[1]),`${file}: ${match[1]}`);
  }
});
