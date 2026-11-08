import test from 'node:test';
import assert from 'node:assert/strict';
import {parseViewBox,zoomViewBox,panViewBox,stringifyViewBox} from '../src/preview-viewbox.js';

test('SVG viewBox parsed and formatted',()=>{
  const box=parseViewBox('-4 -4 108 68');
  assert.deepEqual(box,{x:-4,y:-4,width:108,height:68});
  assert.equal(stringifyViewBox(box),'-4 -4 108 68');
});
test('zoom in and out remains centered on the cursor anchor',()=>{
  const initial=parseViewBox('0 0 100 60');
  const after=zoomViewBox(initial,2,{x:20,y:10});
  assert.deepEqual(after,{x:10,y:5,width:50,height:30});
  const restored=zoomViewBox(after,.5,{x:20,y:10});
  assert.deepEqual(restored,initial);
});
test('drag pan updates viewBox without changing scale',()=>{
  assert.deepEqual(panViewBox({x:2,y:3,width:40,height:20},-8,4),{x:-6,y:7,width:40,height:20});
});
test('reject malformed or unsafe viewBoxes and zoom',()=>{
  assert.throws(()=>parseViewBox('0 0 0 5'),/Invalid/);
  assert.throws(()=>parseViewBox('0 0 NaN 5'),/Invalid/);
  assert.throws(()=>zoomViewBox({x:0,y:0,width:100,height:60},0,{x:0,y:0}),/Invalid/);
});
