import {extractContours} from './geometry.js';

export function combineSelectedFaces(faces,tolerance=.02) {
  if(!faces?.length)throw Error('Select at least one face.');
  if(faces.length===1)return extractContours(faces[0].positions,faces[0].triangles,tolerance);
  if(faces.length>50)throw Error('Select no more than 50 faces at once.');
  const positions=[],triangles=[];
  for(const face of faces){
    const local=new Map();
    for(const index of face.triangles){
      let mapped=local.get(index);
      if(mapped===undefined) {
        mapped=positions.length/3;
        const i=index*3;
        positions.push(face.positions[i],face.positions[i+1],face.positions[i+2]);
        local.set(index,mapped);
      }
      triangles.push(mapped);
    }
  }
  try{return extractContours(positions,triangles,tolerance);}
  catch(err) {
    if(/non plane|non-planar|not planar|not coplanar/i.test(err.message))
      throw Error('Selected faces are not coplanar. Export them as a ZIP instead.');
    throw err;
  }
}
