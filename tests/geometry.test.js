import test from 'node:test';
import assert from 'node:assert/strict';
import {extractContours,simplifyLoop} from '../src/geometry.js';
import {buildDxf,buildSvg} from '../src/export.js';
function plate(){
  const p=[[0,0,0],[100,0,0],[100,60,0],[0,60,0],[40,20,0],[60,20,0],[60,40,0],[40,40,0]];
  const q=[[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
  return [p.flat(),q.flatMap(([a,b,c,d])=>[a,b,c,a,c,d])];
}
test('outer and inner contours, dimensions and units',()=>{
  const [p,t]=plate(),f=extractContours(p,t);
  assert.equal(f.width,100);assert.equal(f.height,60);
  assert.equal(f.loops.length,2);
  assert.deepEqual(f.loops.map(x=>x.length).sort(),[4,4]);
  assert.match(buildSvg(f),/width="100mm" height="60mm"/);
  assert.equal(buildDxf(f).match(/LWPOLYLINE/g).length,2);
  assert.match(buildDxf(f),/\$INSUNITS\n70\n4/);
});
test('rejects nonplanar surfaces',()=>{
  const [p,t]=plate();p[2]=2;
  assert.throws(()=>extractContours(p,t),/non plane/);
});
test('simplifies straight segments',()=>assert.equal(simplifyLoop([[0,0],[5,0],[10,0],[10,10],[0,10]]).length,4));
