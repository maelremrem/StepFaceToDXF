import test from 'node:test';
import assert from 'node:assert/strict';
import {createImportDialog,formatBytes} from '../src/import-dialog.js';

function fakeUI() {
  let now=0,tick=null,closed=0,cancelled=0;
  const attributes=new Map();
  const rows=['read','engine','geometry','render'].map(importStep=>{
    const attrs=new Map(),label={textContent:''};
    return {dataset:{importStep},querySelector(){return label;},
      setAttribute(k,v){attrs.set(k,v);},removeAttribute(k){attrs.delete(k);},attrs,label};
  });
  const events=new Map(),dialog={
    open:false,querySelectorAll(){return rows;},
    showModal(){this.open=true;},close(){this.open=false;closed++;},
    addEventListener(k,fn){events.set(k,fn);}
  };
  const cancelButton={addEventListener(k,fn){events.set('button_'+k,fn);}};
  const text=()=>({textContent:''});
  const filename=text(),phase=text(),detail=text(),percent=text(),elapsed=text(),stepTime=text(),stats={...text(),hidden:false};
  const bar={dataset:{},setAttribute(k,v){attributes.set(k,v);},removeAttribute(k){attributes.delete(k);}};
  const fill={style:{width:''}};
  const api=createImportDialog({dialog,filename,phase,detail,percent,bar,fill,
    elapsed,stepTime,stats,cancelButton,onCancel:()=>{cancelled++;api.close();},
    clock:()=>now,startTimer:cb=>{tick=cb;return 1;},stopTimer:()=>{tick=null;}
  });
  return {api,dialog,filename,phase,detail,percent,elapsed,stepTime,stats,bar,fill,rows,attributes,events,
    elapse(ms){now+=ms;tick?.();},get cancelled(){return cancelled;},get closed(){return closed;}};
}
test('real file percentage from measured bytes, no fabricated geometry percentage',()=>{
  const u=fakeUI();
  u.api.begin('design.step','step');
  u.api.fileProgress(524288,1048576);
  assert.equal(u.percent.textContent,'50%');
  assert.equal(u.attributes.get('aria-valuenow'),'50');
  assert.match(u.detail.textContent,/512.0 KB \/ 1.0 MB/);
  u.elapse(2340);
  assert.equal(u.elapsed.textContent,'Elapsed 2.3s');
  u.api.stage('engine','Loading OpenCascade');
  assert.equal(u.percent.textContent,'Working');
  assert.equal(u.attributes.has('aria-valuenow'),false);
  u.api.stage('geometry','Processing CAD');
  u.elapse(11500);
  assert.equal(u.stepTime.textContent,'This step 11.5s');
  assert.match(u.bar.dataset.mode,/indeterminate/);
  assert.equal(u.rows[1].dataset.state,'done');
  u.api.metrics({meshes:2,faces:11,triangles:1200});
  assert.match(u.stats.textContent,/1,200 triangles/);
  u.api.stage('render','Building view');
  u.api.modelProgress(1,2);
  assert.equal(u.percent.textContent,'50%');
  assert.equal(u.attributes.get('aria-valuenow'),'50');
  u.api.close();
  assert.equal(u.dialog.open,false);
});
test('mesh import skips engine instead of claiming it ran',()=>{
  const u=fakeUI();u.api.begin('mesh.stl','stl');
  u.api.stage('geometry','Decode STL',{skip:['engine']});
  assert.equal(u.rows[1].dataset.state,'skipped');
});
test('Escape and cancel button call cancellation and clear timer',()=>{
  const u=fakeUI();u.api.begin('part.step','step');
  u.events.get('button_click')();
  assert.equal(u.cancelled,1);
  u.api.begin('part.step','step');
  let prevented=false;u.events.get('cancel')({preventDefault(){prevented=true;}});
  assert.equal(u.cancelled,2);
  assert.ok(prevented);
  assert.equal(u.dialog.open,false);
});
test('binary size formatting',()=>{
  assert.equal(formatBytes(2048),'2.0 KB');
  assert.equal(formatBytes(0),'0 B');
  assert.equal(formatBytes(1048576),'1.0 MB');
});
