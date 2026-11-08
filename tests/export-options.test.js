import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCsv,buildJson,buildDxf,buildSvg,transformContours} from '../src/export.js';

const rect={width:100,height:60,loops:[
  [[0,0],[100,0],[100,60],[0,60]],
  [[40,20],[60,20],[60,40],[40,40]]
]};
test('defaults preserve dimensions, closed polylines and mm',()=>{
  const svg=buildSvg(rect),dxf=buildDxf(rect);
  assert.match(svg,/width="100mm" height="60mm"/);
  assert.match(dxf,/\$INSUNITS\n70\n4/);
  assert.equal(dxf.match(/LWPOLYLINE/g).length,2);
});
test('rotate, scale, mirror, shift without changing outer dimensions incorrectly',()=>{
  const result=transformContours(rect,{rotation:90,flipX:true,scale:2,offsetX:10,offsetY:-5});
  assert.equal(result.width,120);
  assert.equal(result.height,200);
  const all=result.loops.flat();
  assert.equal(Math.min(...all.map(p=>p[0])),10);
  assert.equal(Math.min(...all.map(p=>p[1])),-5);
});
test('exclude holes, margin and stroke affect SVG only',()=>{
  const x=buildSvg(rect,{includeHoles:false,margin:2,stroke:0.2});
  assert.match(x,/width="104mm" height="64mm"/);
  assert.equal((x.match(/<path/g)||[]).length,1);
  assert.match(x,/stroke-width="0.2"/);
});
test('DXF LINE entities are closed and retain assigned layer',()=>{
  const d=buildDxf(rect,{dxfMode:'lines',layer:'CUT_1',includeHoles:false});
  assert.equal((d.match(/\nLINE\n/g)||[]).length,4);
  assert.match(d,/\nCUT_1\n/);
});
test('JSON and CSV retain coordinate mm and loop closure',()=>{
  const data=JSON.parse(buildJson(rect));
  assert.equal(data.units,'mm');assert.equal(data.loops.length,2);
  assert.equal(buildCsv(rect).trim().split('\n').length,11);
});
test('invalid export options are rejected',()=>{
  assert.throws(()=>buildDxf(rect,{scale:0}),/Échelle/);
  assert.throws(()=>buildSvg(rect,{margin:-1}),/Marge/);
  assert.throws(()=>buildCsv(rect,{rotation:44}),/Rotation/);
});
