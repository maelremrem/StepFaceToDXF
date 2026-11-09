import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDxf} from '../src/export.js';

function entities(text) {
  const pairs=text.trim().split('\n');
  assert.equal(pairs.length%2,0);
  const tags=[];
  for(let i=0;i<pairs.length;i+=2)tags.push([pairs[i],pairs[i+1]]);
  const sectionStart=tags.findIndex(([code,value])=>code==='2'&&value==='ENTITIES');
  assert.ok(sectionStart>=0);
  const result=[];
  let current=null;
  for(const [code,value] of tags.slice(sectionStart+1)){
    if(code==='0'&&value==='ENDSEC')break;
    if(code==='0'){
      current={type:value,tags:[]};
      result.push(current);
    }else if(current)current.tags.push([code,value]);
  }
  return result;
}
const rectangle={loops:[[[0,0],[100,0],[100,60],[0,60]],[[40,20],[60,20],[60,40],[40,40]]]};
const circle={loops:[Array.from({length:96},(_,i)=>[8*Math.cos(i*2*Math.PI/96),8*Math.sin(i*2*Math.PI/96)])]};
const quarter=Array.from({length:16},(_,i)=>[10+5*Math.cos(-Math.PI/2+i*Math.PI/30),5+5*Math.sin(-Math.PI/2+i*Math.PI/30)]);
const rounded={loops:[[[0,0],...quarter,[15,12],[0,12]]]};

test('DXF R2000 declares unit and referenced layer tables',()=>{
  const dxf=buildDxf(rectangle,{layer:'PROFILE'});
  assert.match(dxf,/\$ACADVER\n1\nAC1015/);
  assert.match(dxf,/\$INSUNITS\n70\n4/);
  assert.match(dxf,/\nLAYER\n5\n22\n330\n20\n100\nAcDbSymbolTableRecord\n100\nAcDbLayerTableRecord\n2\nPROFILE\n/);
  assert.match(dxf,/\nLTYPE\n5\n11\n330\n10\n100\nAcDbSymbolTableRecord/);
});
test('closed LWPolylines declare the AcDbPolyline subclass',()=>{
  const result=entities(buildDxf(rectangle));
  assert.equal(result.length,2);
  for(const entity of result){
    assert.equal(entity.type,'LWPOLYLINE');
    assert.deepEqual(entity.tags.filter(([code])=>code==='100').map(([,name])=>name),['AcDbEntity','AcDbPolyline']);
    assert.ok(entity.tags.some(([code,value])=>code==='70'&&value==='1'));
    assert.ok(entity.tags.some(([code,value])=>code==='90'&&value==='4'));
  }
});
test('LINE, CIRCLE and ARC carry their required subclass markers',()=>{
  const line=entities(buildDxf(rectangle,{dxfMode:'lines',includeHoles:false}));
  assert.equal(line.length,4);
  assert.ok(line.every(entity=>entity.type==='LINE'&&entity.tags.some(([code,value])=>code==='100'&&value==='AcDbLine')));
  const circles=entities(buildDxf(circle,{dxfMode:'circles'}));
  assert.equal(circles.length,1);
  assert.equal(circles[0].type,'CIRCLE');
  assert.ok(circles[0].tags.some(([code,value])=>code==='100'&&value==='AcDbCircle'));
  const arcs=entities(buildDxf(rounded,{dxfMode:'circles',curveTolerance:.02}));
  assert.ok(arcs.some(entity=>entity.type==='ARC'));
  for(const arc of arcs.filter(entity=>entity.type==='ARC')){
    assert.deepEqual(arc.tags.filter(([code])=>code==='100').map(([,name])=>name),['AcDbEntity','AcDbCircle','AcDbArc']);
  }
});
test('every graphic entity has a unique valid hex handle',()=>{
  const result=entities(buildDxf(rounded,{dxfMode:'circles',curveTolerance:.02}));
  const handles=result.map(entity=>entity.tags.find(([code])=>code==='5')?.[1]);
  assert.ok(handles.every(handle=>/^[0-9A-F]+$/.test(handle)));
  assert.equal(new Set(handles).size,handles.length);
});
test('default drawing layer 0 is not defined twice',()=>{
  const dxf=buildDxf(rectangle,{layer:'0'});
  const layerTable=dxf.split('0\nTABLE\n2\nLAYER\n')[1].split('0\nENDTAB')[0];
  assert.equal((layerTable.match(/\nAcDbLayerTableRecord\n/g)||[]).length,1);
});
