import {zipSync,strToU8} from 'fflate';
import {EXPORTERS} from './export.js';

export function createExportZip(selections,formats,options={}) {
  if(!selections?.length)throw Error('Select one or more faces.');
  if(!formats?.length)throw Error('Select at least one export format.');
  const data={};
  const safeName=value=>String(value||'part').replace(/[^A-Za-z0-9._-]/g,'_').slice(0,80);
  selections.forEach(({face,contours},i)=>{
    if(!contours)throw Error('One selected face has no valid planar contour.');
    for(const ext of formats) {
      if(!EXPORTERS[ext])throw Error('Unsupported export format: '+ext);
      const filename=safeName(face.label||'face_'+(i+1))+'_'+(i+1)+'.'+(ext==='hpgl'?'plt':ext);
      data[filename]=strToU8(EXPORTERS[ext].build(contours,options));
    }
  });
  return zipSync(data,{level:6});
}
