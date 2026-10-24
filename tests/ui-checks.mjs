// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';

/** The same interactions run in Chromium and in the actual VS Code webview. */
export async function runUiChecks(frame, screenshot, hostMessages) {
  const waitReady = () => frame.locator('#status:not(.busy)').waitFor({ timeout:30000 });
  const select = async name => {
    await frame.locator('#filter').fill(name);
    const item=frame.locator('.array-item').filter({has:frame.locator('.array-name',{hasText:new RegExp(`^${name}$`)})});
    await item.click();await waitReady();
    await frame.locator('#filter').fill('');
  };
  await frame.locator('.array-item').first().waitFor({timeout:30000});
  assert.equal(await frame.locator('.array-item').count(),17);
  await select('unsigned');
  assert.match(await frame.locator('tbody').innerText(),/18446744073709551615/);
  await frame.locator('tr[data-row="2"] .cell').click();
  await frame.locator('#cell-details:not([hidden])').waitFor();
  assert.equal(await frame.locator('#cell-value').innerText(),'18446744073709551615');
  await screenshot('table-details');
  assert.equal(await frame.locator('dialog').count(),0,'Cell inspection stays inside Table');
  await frame.locator('#copy-cell').click(); await frame.locator('#close-details').click();
  await select('matrix');
  await frame.getByLabel('Column page',{exact:true}).fill('5');await frame.getByLabel('Column page',{exact:true}).press('Tab');await waitReady();
  assert.match(await frame.locator('thead').innerText(),/\[34\]/);
  assert.match(await frame.locator('tbody').innerText(),/419/);
  await select('cube');
  await frame.locator('tr[data-row="1"] th button').click();await waitReady();
  await frame.locator('tr[data-row="2"] th button').click();await waitReady();
  assert.match(await frame.locator('tbody').innerText(),/119/);
  await screenshot('cube');
  await select('metadata_json');
  await frame.locator('.json-tree').getByText('18446744073709551615',{exact:true}).waitFor();
  await frame.locator('summary').filter({hasText:'setup'}).click();
  await frame.getByText('测试🙂',{exact:true}).waitFor();
  assert.match(await frame.locator('.json-tree').innerText(),/测试🙂/);
  await frame.locator('summary').filter({hasText:/items/}).click();
  await frame.getByRole('button',{name:'Show next 100'}).click();
  assert.match(await frame.locator('.json-tree').innerText(),/\[199\]/);
  assert.equal(await frame.locator('.json-tree img,.json-tree script').count(),0);
  await screenshot('metadata');
  await select('unicode');await frame.locator('[data-tab="Plot"]').click();await waitReady();
  assert.match(await frame.locator('.error-state').innerText(),/text/);
  await frame.locator('[data-tab="Histogram"]').click();await waitReady();assert.match(await frame.locator('.error-state').innerText(),/numeric/);
  await select('object_unsupported');assert.match(await frame.locator('.error-state').innerText(),/pickle/);
  await select('empty');assert.match(await frame.locator('#content').innerText(),/Empty array/);
  await select('long_text');
  assert.ok((await frame.locator('#content').innerText()).includes('完整文本🙂'));
  await select('wave');
  await frame.getByRole('button',{name:'Last page',exact:true}).click();await waitReady();
  assert.equal(await frame.locator('tbody tr').count(),1);assert.match(await frame.locator('tbody').innerText(),/1000000/);
  await frame.locator('[data-tab="Plot"]').click();await waitReady();
  await frame.locator('canvas').waitFor();await screenshot('plot');
  const canvas=frame.locator('canvas');const bounds=await canvas.boundingBox();assert.ok(bounds&&bounds.width>200&&bounds.height>150);
  await canvas.hover({position:{x:bounds.width/2,y:bounds.height/2}});
  await frame.locator('.chart-tooltip:not([hidden])').waitFor({timeout:10000});
  const page=typeof frame.page==='function'?frame.page():frame;
  await page.mouse.wheel(0,-400);await page.waitForTimeout(250);
  await frame.getByRole('button',{name:'Reset view',exact:true}).click();
  if(hostMessages) {
    await frame.getByRole('button',{name:'Export SVG',exact:true}).click();
    for(let n=0;n<30&&!hostMessages.some(m=>m.type==='export');n++) await page.waitForTimeout(50);
    const svg=hostMessages.find(m=>m.type==='export')?.svg;
    assert.ok(svg?.startsWith('<svg'));assert.ok(!svg.includes('NaN'));assert.ok(svg.includes('clipPath'));
  }
  await frame.locator('[data-tab="Histogram"]').click();await waitReady();
  assert.match(await frame.locator('.analysis-note').innerText(),/Approximate preview/);
  await frame.getByLabel('Exact: scan all values',{exact:true}).check();await waitReady();
  assert.match(await frame.locator('.analysis-note').innerText(),/1,000,001/);
  await screenshot('histogram');
  await frame.getByLabel('Log count',{exact:true}).check();
  await frame.getByLabel('Bins',{exact:true}).fill('128');await frame.getByLabel('Bins',{exact:true}).press('Tab');await waitReady();
  assert.match(await frame.locator('#status').innerText(),/128 bins/);
  await select('xy_rows');await frame.locator('[data-tab="Plot"]').click();await waitReady();
  await frame.getByLabel('Series',{exact:true}).selectOption('xyRows');await waitReady();
  assert.match(await frame.locator('#status').innerText(),/3 samples/);
  await select('complex');await frame.locator('[data-tab="Plot"]').click();await waitReady();
  await frame.getByLabel('Component',{exact:true}).selectOption('magnitude');await waitReady();
  await frame.locator('[data-tab="Table"]').click();await waitReady();assert.match(await frame.locator('tbody').innerText(),/3 \+4j/);
  // Rapid changes exercise cancellation and suppression of stale responses.
  await select('wave');await frame.locator('[data-tab="Histogram"]').click();
  await frame.locator('.array-item').filter({has:frame.locator('.array-name',{hasText:/^unsigned$/})}).click();await waitReady();
  assert.equal(await frame.locator('#array-title').innerText(),'unsigned');assert.match(await frame.locator('tbody').innerText(),/18446744073709551615/);
  const labels={'zh-CN':'表格',en:'Table',fr:'Tableau',es:'Tabla',ru:'Таблица',ar:'جدول'};
  for(const [language,label] of Object.entries(labels)) {
    await frame.locator('#language').selectOption(language);await waitReady();
    await frame.locator('tbody').waitFor();
    assert.equal(await frame.locator('[data-tab="Table"]').innerText(),label);
    assert.equal(await frame.locator('html').getAttribute('lang'),language);
    assert.equal(await frame.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');
    assert.match(await frame.locator('tbody').innerText(),/18446744073709551615/);
    await frame.locator('tr[data-row="2"] .cell').click();await frame.locator('#cell-details:not([hidden])').waitFor();
    assert.equal(await frame.locator('#cell-value').innerText(),'18446744073709551615');
    await screenshot(`language-${language}`);
    await frame.locator('#close-details').click();
  }
  await frame.locator('#language').selectOption('en');await waitReady();await frame.locator('tbody').waitFor();
  return {passed:true,cases:['exact integers','matrix columns','4D navigation','JSON pagination','Unicode','unsupported dtype','empty array','last page','plot','zoom','hover','SVG','histogram','exact scan','log count','XY','complex','stale results','inline details','long content','six languages','Arabic RTL']};
}
