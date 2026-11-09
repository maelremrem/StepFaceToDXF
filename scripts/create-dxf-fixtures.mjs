import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {buildDxf} from '../src/export.js';

const directory=resolve(process.argv[2]||'/tmp/stepface-dxf-fixtures');
mkdirSync(directory,{recursive:true});
const rectangle={loops:[[[0,0],[100,0],[100,60],[0,60]],[[40,20],[60,20],[60,40],[40,40]]]};
const circle={loops:[Array.from({length:96},(_,i)=>[8*Math.cos(i*2*Math.PI/96),8*Math.sin(i*2*Math.PI/96)])]};
const quarter=Array.from({length:16},(_,i)=>[10+5*Math.cos(-Math.PI/2+i*Math.PI/30),5+5*Math.sin(-Math.PI/2+i*Math.PI/30)]);
const rounded={loops:[[[0,0],...quarter,[15,12],[0,12]]]};

for(const [filename,shape,options] of [
  ['polylines.dxf',rectangle,{layer:'CUT'}],
  ['lines.dxf',rectangle,{dxfMode:'lines',includeHoles:false}],
  ['circle.dxf',circle,{dxfMode:'circles',layer:'CIRCLES'}],
  ['arcs.dxf',rounded,{dxfMode:'circles',curveTolerance:.02}],
  ['layer0.dxf',rectangle,{layer:'0'}]
]) {
  writeFileSync(join(directory,filename),buildDxf(shape,options),'utf8');
}
