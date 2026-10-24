// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
await mkdir('out/test', { recursive: true });
await build({ entryPoints:['src/backend.ts'], bundle:true,platform:'node',format:'cjs',outfile:'out/test/backend.cjs' });
const { Backend } = await import('../out/test/backend.cjs');
const generated = spawnSync('python', ['tests/make-fixtures.py'], { encoding:'utf8' });
assert.equal(generated.status,0,generated.stderr);
const executable = path.resolve(`bin/${process.platform}-${process.arch}/npzsee-backend${process.platform==='win32'?'.exe':''}`);
const fixture = path.resolve('validation-output/extension-fixtures.npz');

async function session(file, run) {
  const backend=new Backend(executable,file);
  try { const catalog=await backend.request('open'); const indexes=Object.fromEntries(catalog.entries.map(e=>[e.name,e.index])); await run(backend,indexes,catalog); }
  finally { backend.dispose(); }
}

test('Rust protocol: paged exact values, all columns, slices, Unicode and JSON', async () => {
  await session(fixture,async (b,i,c) => {
    assert.equal(c.entries.length,17);
    const meta=await b.request('select',{array:i.unsigned}); assert.equal(meta.dtype,'<u8');
    const t=await b.request('table',{array:i.unsigned}); assert.deepEqual(t.rows.map(r=>r.values[0]),['0','9223372036854775809','18446744073709551615']);
    const m=await b.request('table',{array:i.matrix,start:11,count:200,columnStart:32,columnCount:16});
    assert.deepEqual(m.rows,[{index:11,values:['417','418','419']}]);
    const nested=await b.request('table',{array:i.cube});assert.equal(nested.kind,'nested');
    const slice=await b.request('table',{array:i.cube,prefix:[1,2],start:3}); assert.deepEqual(slice.rows[0].values,['115','116','117','118','119']);
    const fortran=await b.request('table',{array:i.fortran,prefix:[1],start:2});assert.deepEqual(fortran.rows[0].values,['20','21','22','23']);
    const unicode=await b.request('table',{array:i.unicode}); assert.equal(unicode.rows[0].values[0],'中文'); assert.equal(unicode.rows[4].values[0],'embedded\0nul');
    const scalar=await b.request('table',{array:i.metadata_json}); assert.equal(JSON.parse(scalar.value).setup['仪器'],'测试🙂');
    const long=await b.request('cell',{array:i.long_text,indices:[]});assert.ok(long.value.endsWith('完整文本🙂'));
    assert.equal((await b.request('table',{array:i.empty})).kind,'empty');
    await assert.rejects(b.request('select',{array:i.object_unsupported}),/pickle/);
  });
});
test('Rust analysis: spikes, zoom, original hover, complex components, XY and exact histograms',async () => {
  await session(fixture,async(b,i)=>{
    const full=await b.request('plot',{array:i.wave,columns:700});assert.ok(full.points.length<=1404); assert.ok(full.points.some(p=>p[1]===1000));assert.ok(full.points.some(p=>p[1]===-2000));
    const zoom=await b.request('plot',{array:i.wave,columns:700,range:[543200,543220]});assert.ok(zoom.points.some(p=>p[0]===543210&&p[1]===1000));
    assert.equal((await b.request('sample',{array:i.wave,index:543210})).value,'1000');
    const complex=await b.request('plot',{array:i.complex,component:'magnitude'});assert.equal(complex.points[0][1],5);
    for(const [key,layout] of [['xy_rows','xyRows'],['xy_columns','xyColumns']]) assert.deepEqual((await b.request('plot',{array:i[key],layout})).points,[[10,4],[20,5],[30,6]]);
    const h=await b.request('histogram',{array:i.nonfinite,exact:true,bins:8});assert.equal(h.count,1);assert.equal(h.nonfinite,3);assert.equal(h.mean,1);assert.equal(h.counts.reduce((a,b)=>a+b),1);
    const constant=await b.request('histogram',{array:i.constant,exact:true});assert.deepEqual(constant.dataRange,[5,5]);assert.equal(constant.std,0);
    const sampled=await b.request('histogram',{array:i.wave});assert.ok(sampled.sampled<=250000);assert.equal(sampled.total,1000001);
  });
});
test('Malformed requests, boundaries and incompatible layouts are rejected without killing the session',async () => {
  await session(fixture,async(b,i)=>{
    for(const [method,params] of [
      ['table',{array:i.cube,prefix:[2]}],['table',{array:i.cube,prefix:[0,0,0,0,0]}],['table',{array:i.wave,start:1000002}],
      ['table',{array:i.matrix,columnStart:35}],['cell',{array:i.matrix,indices:[0,35]}],['plot',{array:i.wave,layout:'xyRows'}],
      ['plot',{array:i.cube}],['plot',{array:i.unicode}],['sample',{array:i.wave,index:1000001}],['select',{array:999}],
      ['plot',{array:i.wave,component:'unknown'}],['unexpected',{}],['table',{array:i.scalar,unknownField:123}],
    ]) await assert.rejects(b.request(method,params));
    assert.equal((await b.request('select',{array:i.scalar})).count,1);
  });
});
test('Cancellation discards expensive work; the next file operation succeeds',async () => {
  await session(fixture,async(b,i)=>{
    const work=b.request('histogram',{array:i.wave,exact:true}).catch(e=>e.message);
    await b.request('cancel'); await work;
    assert.equal((await b.request('table',{array:i.scalar})).value,'42');
  });
});
test('Bare NPY files, corrupt files, and process shutdown',async () => {
  await session(path.resolve('validation-output/bare-fortran.npy'),async(b)=>assert.equal((await b.request('select')).fortran,true));
  const b=new Backend(executable,path.resolve('validation-output/corrupt.npz'));await assert.rejects(b.request('open'));b.dispose();assert.equal(b.alive,false);await assert.rejects(b.request('open'));
});
test('Real recording: full length, bounded transport and exact full histogram',async context => {
  const name=(await readdir('data').catch(()=>[])).find(n=>n.endsWith('.npz'));
  if(!name) { context.skip('Private recording is not included in source control'); return; }
  await session(path.resolve('data',name),async(b,i,c)=>{
    assert.equal(c.entries.length,22);
    const meta=await b.request('select',{array:i.voltage});assert.equal(meta.count,12500000);
    const last=await b.request('table',{array:i.voltage,start:12499999});assert.equal(last.rows[0].index,12499999);
    const plot=await b.request('plot',{array:i.voltage,columns:1400});assert.ok(plot.points.length<=2804);assert.ok(JSON.stringify(plot).length<200000);
    const hist=await b.request('histogram',{array:i.voltage,exact:true});assert.equal(hist.count+hist.nonfinite,12500000);
    await writeFile('validation-output/extension-performance.json',JSON.stringify({arrayCount:c.entries.length,samples:meta.count,loadMs:meta.elapsedMs,plotMs:plot.elapsedMs,plotPoints:plot.points.length,plotTransportBytes:Buffer.byteLength(JSON.stringify(plot)),exactHistogramMs:hist.elapsedMs},null,2));
  });
});
