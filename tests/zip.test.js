import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {createExportZip} from '../src/zip.js';

const face={label:'Planar face',positions:[],triangles:[]};
const contours={loops:[[[0,0],[10,0],[10,5],[0,5]]]};
test('ZIP contains every selected face and requested export format',()=>{
  const result=createExportZip([{face,contours},{face:{...face,label:'Second face'},contours}],['dxf','svg']);
  const files=unzipSync(result);
  assert.equal(Object.keys(files).length,4);
  assert.match(strFromU8(files['Planar_face_1.dxf']),/\$INSUNITS/);
  assert.match(strFromU8(files['Second_face_2.svg']),/width="10mm"/);
});
test('ZIP rejects unsupported format',()=>{
  assert.throws(()=>createExportZip([{face,contours}],['invalid']),/Unsupported/);
});
