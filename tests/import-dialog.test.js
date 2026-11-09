import test from 'node:test';
import assert from 'node:assert/strict';
import {createImportDialog} from '../src/import-dialog.js';

function mockDialog() {
  const events=new Map();
  const dialog={
    open:false,
    addEventListener(name,fn){events.set(name,fn);},
    showModal(){this.open=true;},
    close(){this.open=false;}
  };
  const button={addEventListener(name,fn){events.set('button_'+name,fn);}};
  const filename={textContent:''},phase={textContent:''};
  let cancellations=0;
  const ui=createImportDialog({dialog,filename,phase,cancelButton:button,onCancel:()=>{cancellations++;ui.close();}});
  return {dialog,button,filename,phase,ui,events,get cancellations(){return cancellations;}};
}
test('opens for a STEP file and updates the current phase',()=>{
  const x=mockDialog();
  x.ui.begin('part.step','step');
  assert.equal(x.dialog.open,true);
  assert.equal(x.filename.textContent,'part.step');
  assert.match(x.phase.textContent,/Reading STEP file/);
  x.ui.update('Triangulating the STEP model…');
  assert.match(x.phase.textContent,/Triangulating/);
  x.ui.close();
  assert.equal(x.dialog.open,false);
  x.ui.update('Too late');
  assert.match(x.phase.textContent,/Triangulating/);
});
test('cancel button and Escape both call cancellation',()=>{
  const x=mockDialog();
  x.ui.begin('part.step','step');
  x.events.get('button_click')();
  assert.equal(x.cancellations,1);
  assert.equal(x.dialog.open,false);
  x.ui.begin('another.step','step');
  let prevented=false;
  x.events.get('cancel')({preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(x.cancellations,2);
  assert.equal(x.dialog.open,false);
});
