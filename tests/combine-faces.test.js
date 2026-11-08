import test from 'node:test';
import assert from 'node:assert/strict';
import {combineSelectedFaces} from '../src/combine-faces.js';
const p=[0,0,0,10,0,0,10,10,0,0,10,0,20,0,0,20,10,0];
test('adjacent coplanar faces merge without internal edges',()=>{
  const a={positions:p,triangles:[0,1,2,0,2,3]};
  const b={positions:p,triangles:[1,4,5,1,5,2]};
  const shape=combineSelectedFaces([a,b]);
  assert.equal(shape.width,20);
  assert.equal(shape.height,10);
  assert.equal(shape.loops.length,1);
});
test('noncoplanar selection is rejected clearly',()=>{
  const a={positions:p,triangles:[0,1,2]};
  const b={positions:[0,0,5,10,0,5,10,10,5],triangles:[0,1,2]};
  assert.throws(()=>combineSelectedFaces([a,b]),/not coplanar/);
});
