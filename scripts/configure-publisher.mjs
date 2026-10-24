// SPDX-License-Identifier: GPL-3.0-or-later
import {readFile,writeFile} from 'node:fs/promises';
const publisher=process.argv[2];
if(!publisher||!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(publisher)||publisher.endsWith('-local'))throw new Error('Provide the real publisher ID created in Visual Studio Marketplace.');
const manifest=JSON.parse(await readFile('package.json','utf8'));
manifest.publisher=publisher;
await writeFile('package.json',JSON.stringify(manifest,null,2)+'\n');
console.log(`Publisher set to ${publisher}. Rebuild all platform VSIX packages before uploading.`);
