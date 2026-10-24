// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,access} from 'node:fs/promises';
const manifest=JSON.parse(await readFile('package.json','utf8'));
if(!manifest.publisher||manifest.publisher.endsWith('-local')) {
  console.error('Marketplace publisher registration is pending. See docs/publishing.md; then run npm run configure:publisher -- <publisher-id>.');
  process.exit(1);
}
if(manifest.name!=='npzsee'||manifest.displayName!=='NPZSee')throw new Error('Unexpected extension identity.');
if(!manifest.repository?.url?.includes('terenceyjh/NPZSee-vscode'))throw new Error('Repository metadata is missing.');
for(const file of ['LICENSE','NOTICE','README.md','assets/icon.png','package.nls.json','package.nls.zh-cn.json','package.nls.fr.json','package.nls.es.json','package.nls.ru.json','package.nls.ar.json'])await access(file);
console.log(`Listing metadata ready for ${manifest.publisher}.${manifest.name} ${manifest.version}. Upload only tested VSIX files built with this publisher.`);
