import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSvg,buildDxf,buildPdf,buildEps,buildHpgl,fitCircle,transformContours} from '../src/export.js';
const rect={width:80,height:40,loops:[[[0,0],[80,0],[80,40],[0,40]],[[20,10],[30,10],[30,20],[20,20]]]};
test('vector PDF has valid header and page dimensions',()=>{
  const pdf=buildPdf(rect);
  assert.match(pdf,/^%PDF-1\.4/);
  assert.match(pdf,/\/MediaBox \[0 0 226\.771654 113\.385827\]/);
  const pos=Number(pdf.match(/startxref\n(\d+)/)[1]);
  assert.equal(pdf.slice(pos,pos+4),'xref');
});
test('EPS contains scalable path and correct bounding box',()=>{
  const eps=buildEps(rect);
  assert.match(eps,/%%BoundingBox: 0 0 227 114/);
  assert.match(eps,/closepath stroke/);
});
test('HPGL uses 40 plotter units per mm and closed path',()=>{
  const hpgl=buildHpgl(rect,{includeHoles:false});
  assert.match(hpgl,/PU0,0;/);
  assert.match(hpgl,/PD3200,0,3200,1600,0,1600,0,0;/);
});
test('fitted circular loops export DXF CIRCLE and SVG circle',()=>{
  const loop=Array.from({length:96},(_,i)=>[10+8*Math.cos(i*2*Math.PI/96),10+8*Math.sin(i*2*Math.PI/96)]);
  const shape={width:16,height:16,loops:[loop]};
  const fit=fitCircle(loop,.01);
  assert.ok(fit); assert.ok(Math.abs(fit.radius-8)<1e-5);
  assert.match(buildDxf(shape,{dxfMode:'circles'}),/\nCIRCLE\n/);
  assert.match(buildSvg(shape,{dxfMode:'circles'}),/<circle/);
});
test('holes removal keeps disjoint outlines',()=>{
  const two={loops:[[[0,0],[10,0],[10,10],[0,10]],[[2,2],[4,2],[4,4],[2,4]],[[20,0],[30,0],[30,10],[20,10]]]};
  assert.equal(transformContours(two,{includeHoles:false}).loops.length,2);
});
test('invalid settings throw',()=>assert.throws(()=>buildPdf(rect,{scale:-1}),/Scale/));
