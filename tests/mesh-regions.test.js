import test from 'node:test';
import assert from 'node:assert/strict';
import {groupMeshRegions,unitScale} from '../src/mesh-regions.js';
import {extractContours} from '../src/geometry.js';
test('two coplanar triangles form one region',()=>{
  const p=[0,0,0,10,0,0,10,5,0,0,5,0],i=[0,1,2,0,2,3];
  const result=groupMeshRegions(p,i);
  assert.equal(result.regions.length,1);
  assert.equal(extractContours(p,result.regions[0].triangles).width,10);
});
test('connected perpendicular faces are distinct',()=>{
  const p=[0,0,0,10,0,0,0,10,0,0,0,10];
  const result=groupMeshRegions(p,[0,1,2,0,3,1]);
  assert.equal(result.regions.length,2);
});
test('disconnected coplanar regions remain separate',()=>{
  const p=[0,0,0,1,0,0,0,1,0,5,0,0,6,0,0,5,1,0];
  assert.equal(groupMeshRegions(p,[0,1,2,3,4,5]).regions.length,2);
});
test('nonindexed STL duplicate vertices are welded on shared edges',()=>{
  const p=[0,0,0,10,0,0,10,10,0, 0,0,0,10,10,0,0,10,0];
  assert.equal(groupMeshRegions(p,[0,1,2,3,4,5]).regions.length,1);
});
test('mesh units are converted to millimeters',()=>{
  assert.equal(unitScale('inch'),25.4);
  assert.equal(unitScale('m'),1000);
});
