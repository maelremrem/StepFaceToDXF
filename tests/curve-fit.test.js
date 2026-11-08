import test from 'node:test';
import assert from 'node:assert/strict';
import {fitArcPoints,segmentPolyline} from '../src/curve-fit.js';
import {buildDxf,buildSvg} from '../src/export.js';

const quarter=Array.from({length:16},(_,i)=>[10+5*Math.cos(-Math.PI/2+i*Math.PI/30),5+5*Math.sin(-Math.PI/2+i*Math.PI/30)]);
test('partial circular arc fit has correct radius and sweep',()=>{
  const arc=fitArcPoints(quarter,.01);
  assert.ok(arc);
  assert.ok(Math.abs(arc.radius-5)<1e-5);
  assert.ok(Math.abs(arc.sweep-Math.PI/2)<1e-5);
});
test('rounded outline yields ARC entities when fitting is enabled',()=>{
  const loop=[[0,0],...quarter,[15,12],[0,12]];
  const shape={loops:[loop]};
  const segs=segmentPolyline(loop,.02);
  assert.ok(segs.some(s=>s.type==='arc'));
  assert.match(buildDxf(shape,{dxfMode:'circles',curveTolerance:.02}),/\nARC\n/);
  assert.match(buildSvg(shape,{dxfMode:'circles',curveTolerance:.02}),/ A /);
});
test('straight rectangle remains lines',()=>{
  const shape={loops:[[[0,0],[10,0],[10,20],[0,20]]]};
  assert.doesNotMatch(buildDxf(shape,{dxfMode:'circles'}),/\nARC\n/);
});
