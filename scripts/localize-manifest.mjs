// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
const messages=JSON.parse(await readFile('locales/messages.json','utf8'));
const translate=(locale,key)=>locale==='en'?key:messages[key][{'zh-cn':0,fr:1,es:2,ru:3,ar:4}[locale]];
for(const locale of ['en','zh-cn','fr','es','ru','ar']) {
  const data={
    'extension.description':translate(locale,'Fast multidimensional NumPy array viewer, powered by Rust.'),
    'command.open':`NPZSee: ${translate(locale,'Open NumPy File')}`,
    'command.reload':`NPZSee: ${translate(locale,'Reload File')}`,
    'language.description':translate(locale,'Interface language. Auto follows the VS Code display language.'),
    'filesystem.description':translate(locale,'A real filesystem is required by the data engine.'),
  };
  await writeFile(locale==='en'?'package.nls.json':`package.nls.${locale}.json`,JSON.stringify(data,null,2)+'\n');
}
