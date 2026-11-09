import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const code=readFileSync(new URL('../public/occt-worker.js',import.meta.url),'utf8');
function simulate(result) {
  const messages=[],calls=[],engine={
    ReadStepFile(data,params){calls.push(['step',data.byteLength,params]);return result;},
    ReadIgesFile(data,params){calls.push(['iges',data.byteLength,params]);return result;},
    ReadBrepFile(data,params){calls.push(['brep',data.byteLength,params]);return result;}
  };
  const self={
    postMessage(value){messages.push(value);},
    async occtimportjs(){return engine;}
  };
  const context={self,importScripts(){},performance:{now:()=>performance.now()}};
  runInNewContext(code,context);
  return {self,messages,calls};
}
const valid={
  success:true,
  meshes:[{brep_faces:[{first:0,last:0},{first:1,last:1}],index:{array:Uint32Array.from([0,1,2,3,4,5])}}]
};
test('real engine and geometry stages, measured face/triangle stats',async()=>{
  const w=simulate(valid);
  await w.self.onmessage({data:{
    type:'load',id:9,base:'/StepFaceToDXF/',format:'step',buffer:new Uint8Array(8).buffer,
    params:{linearDeflection:.025,angularDeflection:.11}
  }});
  const phases=w.messages.filter(x=>x.type==='progress').map(x=>x.step);
  assert.deepEqual(phases,['engine','geometry']);
  const stats=w.messages.find(x=>x.type==='stats');
  assert.equal(stats.id,9);
  assert.deepEqual(JSON.parse(JSON.stringify(stats.stats)),{meshes:1,faces:2,triangles:2});
  assert.ok(Number.isFinite(stats.durationMs)&&stats.durationMs>=0);
  assert.equal(w.messages.at(-1).type,'result');
  assert.equal(w.calls[0][0],'step');
  assert.equal(w.calls[0][2].linearDeflection,.025);
});
test('correct CAD reader is selected from actual source format',async()=>{
  const w=simulate(valid);
  await w.self.onmessage({data:{type:'load',id:4,base:'/',format:'iges',buffer:new ArrayBuffer(6)}});
  assert.equal(w.calls[0][0],'iges');
});
test('unreadable CAD file raises an error, not a fake successful progress',async()=>{
  const w=simulate({success:false,meshes:[]});
  await w.self.onmessage({data:{type:'load',id:1,base:'/',format:'step',buffer:new ArrayBuffer(1)}});
  assert.equal(w.messages.at(-1).type,'error');
  assert.ok(!w.messages.some(x=>x.type==='result'));
});
