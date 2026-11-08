import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {PLYLoader} from 'three/addons/loaders/PLYLoader.js';
import {extractContours} from './geometry.js';
import {combineSelectedFaces} from './combine-faces.js';
import {groupMeshRegions,unitScale} from './mesh-regions.js';
import {EXPORTERS,transformContours} from './export.js';
import {createExportZip} from './zip.js';
import './style.css';

const el=id=>document.getElementById(id);
const viewport=el('viewport'),canvas=document.createElement('canvas');
viewport.prepend(canvas);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
const scene=new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff,2));
const lamp=new THREE.DirectionalLight(0xffffff,2.3);
lamp.position.set(1,1,2);scene.add(lamp);
const camera=new THREE.PerspectiveCamera(42,1,.01,1e6);
camera.position.set(120,90,120);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;
const model=new THREE.Group();scene.add(model);
const highlight=new THREE.MeshBasicMaterial({
  color:0x4fe5a2,side:THREE.DoubleSide,transparent:true,opacity:.58,
  polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1
});
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const controlsIds=['rotation','scale','offsetX','offsetY','margin','stroke','simplify','curveTolerance','flipX','flipY','includeHoles','dxfMode','layer'];
const exportIds=Object.keys(EXPORTERS);
const defaultOptions={
  rotation:'0',scale:'1',offsetX:'0',offsetY:'0',margin:'0',
  stroke:'0.1',simplify:'0',curveTolerance:'0.025',
  layer:'CUT',dxfMode:'polyline',flipX:false,flipY:false,includeHoles:true
};
const builtInPresets={
  default:{},
  laser:{stroke:'0.05',layer:'CUT',dxfMode:'polyline',includeHoles:true},
  drawing:{stroke:'0.18',margin:'5',layer:'DRAWING',dxfMode:'circles',includeHoles:true},
  plotter:{stroke:'0.1',margin:'0',layer:'PLOT',dxfMode:'lines',includeHoles:true}
};
let objects=[],records=[],selected=new Map(),activeId=null,combined=null,worker=null;
let seq=0,busy=false,basename='part',lastFile=null;
const overlays=new Map();
function status(message,error=false){
  el('status').textContent=message;el('status').classList.toggle('error',error);
}
function setBusy(value){
  busy=value;
  el('dropzone').classList.toggle('busy',value);
  el('fileInput').disabled=value;
  el('reloadButton').disabled=value||!lastFile;
}
function readImportOptions(){
  const val=id=>Number(el(id).value);
  const linearDeflection=val('linearDeflection'),angle=val('angularDeflection');
  const planarity=val('planarityTolerance'),regionAngle=val('regionAngle');
  if(!Number.isFinite(linearDeflection)||linearDeflection<.001||linearDeflection>5)
    throw Error('Mesh deviation must be between 0.001 and 5 mm.');
  if(!Number.isFinite(angle)||angle<1||angle>90)
    throw Error('Meshing angle must be between 1 and 90 degrees.');
  if(!Number.isFinite(planarity)||planarity<.001||planarity>5)
    throw Error('Planarity tolerance must be between 0.001 and 5 mm.');
  if(!Number.isFinite(regionAngle)||regionAngle<.1||regionAngle>10)
    throw Error('Region angle must be between 0.1 and 10 degrees.');
  return {linearDeflection,angularDeflection:angle*Math.PI/180,planarity,regionAngle,unit:el('inputUnit').value};
}
function readExportOptions(){
  const options={};
  for(const id of controlsIds){
    const target=el(id);
    if(target.type==='checkbox')options[id]=target.checked;
    else if(target.type==='number'||target.tagName==='SELECT'&&id==='rotation')options[id]=Number(target.value);
    else options[id]=target.value;
  }
  return options;
}
function applyExportOptions(values={}){
  for(const [id,def] of Object.entries(defaultOptions)){
    const target=el(id),value=values[id]===undefined?def:values[id];
    if(target.type==='checkbox')target.checked=Boolean(value);
    else target.value=String(value);
  }
  updatePreview();
}
function readSavedProfiles(){
  try{
    const stored=JSON.parse(localStorage.getItem('stepface_profiles_v1')||'{}');
    return stored&&typeof stored==='object'&&!Array.isArray(stored)?stored:{};
  }catch{return {};}
}
function refreshProfiles(){
  const current=el('presetSelect').value;
  el('presetSelect').querySelectorAll('option[data-custom]').forEach(n=>n.remove());
  for(const name of Object.keys(readSavedProfiles())){
    const option=new Option('Saved · '+name,'custom:'+name);
    option.dataset.custom='true';el('presetSelect').append(option);
  }
  if([...el('presetSelect').options].some(o=>o.value===current))el('presetSelect').value=current;
}
function saveProfile(){
  const name=window.prompt('Profile name (stored only in this browser):');
  if(!name)return;
  const clean=name.trim().slice(0,50);
  if(!clean)return;
  const profiles=readSavedProfiles();profiles[clean]=readExportOptions();
  localStorage.setItem('stepface_profiles_v1',JSON.stringify(profiles));
  refreshProfiles();el('presetSelect').value='custom:'+clean;
  status('Profile "'+clean+'" saved locally.');
}
function deleteProfile(){
  const id=el('presetSelect').value;
  if(!id.startsWith('custom:'))return status('Select a saved profile to delete.',true);
  const profiles=readSavedProfiles();delete profiles[id.slice(7)];
  localStorage.setItem('stepface_profiles_v1',JSON.stringify(profiles));
  el('presetSelect').value='default';refreshProfiles();
  applyExportOptions();status('Saved profile deleted.');
}
function clearSelected(){
  for(const overlay of overlays.values()){
    overlay.parent?.remove(overlay);overlay.geometry.dispose();
  }
  overlays.clear();selected.clear();activeId=null;combined=null;
  el('selectedCount').textContent='0';
  for(const id of ['widthValue','heightValue','loopCount'])el(id).textContent='—';
  el('preview').textContent='Select a planar face or region to preview its contours.';
  el('previewCaption').textContent='No face selected';
  for(const id of exportIds)el(id+'Button').disabled=true;
  el('zipButton').disabled=true;
}
function clearModel(){
  clearSelected();
  for(const object of objects){
    model.remove(object);
    object.geometry.dispose();
    object.material.dispose();
  }
  objects=[];records=[];
  el('emptyState').hidden=false;
}
function reset(){
  seq++;
  if(worker){worker.terminate();worker=null;}
  setBusy(false);clearModel();
  el('fileInput').value='';el('fileInfo').hidden=true;
  lastFile=null;el('reloadButton').disabled=true;
  status('Ready — all processing stays in your browser.');
}
function color(rgb){
  if(!Array.isArray(rgb)||rgb.length<3)return 0x90a9bb;
  const component=x=>Math.min(255,Math.max(0,Math.round(x*255)));
  return (component(rgb[0])<<16)|(component(rgb[1])<<8)|component(rgb[2]);
}
function addMesh(positions,indices,faceGroups,colorValue=0x90a9bb,kind='cad'){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const object=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({
    color:colorValue,roughness:.72,side:THREE.DoubleSide
  }));
  const lookup=new Int32Array(indices.length/3).fill(-1);
  const meshId=objects.length+1;
  for(const face of faceGroups){
    if(!face.triangles?.length)continue;
    const id=records.length;
    const label=(kind==='cad'?'Face ':'Region ')+(id+1);
    records.push({id,object,positions,triangles:face.triangles,meshIndex:meshId,label});
    if(face.first!==undefined){
      for(let t=face.first;t<=face.last;t++)lookup[t]=id;
    }else if(face.triangleIds){
      for(const t of face.triangleIds)lookup[t]=id;
    }
  }
  object.userData.lookup=lookup;
  objects.push(object);model.add(object);
}
function makeCadModel(imported,scale=1){
  clearModel();
  for(const mesh of imported.meshes||[]){
    const raw=mesh.attributes?.position?.array,indices=mesh.index?.array;
    if(!raw?.length||!indices?.length||indices.length%3)continue;
    const positions=Array.from(raw,n=>n*scale),nTriangles=indices.length/3;
    const groups=(mesh.brep_faces?.length?mesh.brep_faces:[{first:0,last:nTriangles-1}])
      .map(f=>({
        first:Math.trunc(f.first),last:Math.trunc(f.last),
        triangles:Array.from(indices.slice(Math.trunc(f.first)*3,(Math.trunc(f.last)+1)*3))
      }))
      .filter(f=>f.last>=f.first&&f.first>=0&&f.last<nTriangles);
    addMesh(positions,Array.from(indices),groups,color(mesh.color),'cad');
  }
  finishModel();
}
function makeMeshModel(geometries,options){
  clearModel();
  for(const rawGeometry of geometries){
    const raw=rawGeometry.getAttribute('position')?.array;
    if(!raw?.length)continue;
    const scale=unitScale(options.unit);
    const positions=Array.from(raw,n=>n*scale);
    const indices=rawGeometry.index?Array.from(rawGeometry.index.array):Array.from({length:positions.length/3},(_,i)=>i);
    if(indices.length%3)throw Error('Mesh contains incomplete triangles.');
    const result=groupMeshRegions(positions,indices,{
      planeTolerance:options.planarity,normalDegrees:options.regionAngle
    });
    const faceGroups=result.regions.map(region=>({triangles:region.triangles,triangleIds:[]}));
    for(let t=0;t<result.triToRegion.length;t++){
      const regionId=result.triToRegion[t];
      if(regionId>=0)faceGroups[regionId].triangleIds.push(t);
    }
    addMesh(positions,indices,faceGroups,0x95aebd,'mesh');
    rawGeometry.dispose();
  }
  finishModel();
}
function finishModel(){
  if(!objects.length)throw Error('The file contains no renderable geometry.');
  el('emptyState').hidden=true;
  fitModel();
  status(records.length+' selectable CAD faces / planar mesh regions loaded. Click to select.');
}
function fitModel(){
  if(!objects.length)return;
  const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3());
  const radius=Math.max(box.getSize(new THREE.Vector3()).length()*.5,1);
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(1,1,1.6).normalize().multiplyScalar(radius*3.3));
  camera.near=Math.max(radius/1000,.001);camera.far=Math.max(radius*1000,10000);
  camera.lookAt(center);camera.updateProjectionMatrix();controls.update();
}
function showPreview(contours){
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','-4 -4 '+(contours.width+8)+' '+(contours.height+8));
  let minX=Infinity,minY=Infinity;
  for(const loop of contours.loops)for(const point of loop){
    minX=Math.min(minX,point[0]);minY=Math.min(minY,point[1]);
  }
  for(const loop of contours.loops){
    const path=document.createElementNS(ns,'path');
    path.setAttribute('d',loop.map(([x,y],i)=>(i?'L':'M')+(x-minX)+','+(contours.height-(y-minY))).join(' ')+' Z');
    path.setAttribute('fill','none');path.setAttribute('stroke','#76e5ae');
    path.setAttribute('stroke-width','1.5');path.setAttribute('vector-effect','non-scaling-stroke');
    svg.append(path);
  }
  el('preview').replaceChildren(svg);
  el('previewCaption').textContent=contours.width.toFixed(2)+' × '+contours.height.toFixed(2)+' mm · '+contours.loops.length+' contours';
}
function updatePreview(){
  const all=[...selected.values()];
  el('selectedCount').textContent=String(all.length);
  el('zipButton').disabled=!all.length;
  combined=null;
  if(!all.length)return;
  try{
    const choice=el('mergeFaces').checked&&all.length>1?combineSelectedFaces(all.map(x=>x.face),readImportOptions().planarity):
      (selected.get(activeId)||all[all.length-1]).contours;
    combined=choice;
    const transformed=transformContours(choice,readExportOptions());
    showPreview(transformed);
    el('widthValue').textContent=transformed.width.toFixed(2)+' mm';
    el('heightValue').textContent=transformed.height.toFixed(2)+' mm';
    el('loopCount').textContent=String(transformed.loops.length);
  }catch(err){
    el('preview').textContent=err.message;
    el('previewCaption').textContent='Use ZIP to export individual faces.';
  }
  for(const id of exportIds)el(id+'Button').disabled=!combined;
}
function makeOverlay(face){
  const positions=new Float32Array(face.triangles.length*3);
  for(let j=0;j<face.triangles.length;j++){
    const index=face.triangles[j]*3;
    positions.set(face.positions.slice(index,index+3),j*3);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const overlay=new THREE.Mesh(geo,highlight);
  overlay.renderOrder=2;
  face.object.add(overlay);
  overlays.set(face.id,overlay);
}
function deselect(id){
  const overlay=overlays.get(id);
  if(overlay){overlay.parent?.remove(overlay);overlay.geometry.dispose();overlays.delete(id);}
  selected.delete(id);
  if(activeId===id)activeId=selected.size?[...selected.keys()].at(-1):null;
}
function pickFace(face,append){
  const isSelected=selected.has(face.id);
  if(!append)clearSelected();
  else if(isSelected){deselect(face.id);updatePreview();return;}
  if(isSelected&&!append)status('Selection refreshed.');
  if(selected.size>=50)return status('Maximum 50 selected faces.',true);
  try{
    const contours=extractContours(face.positions,face.triangles,readImportOptions().planarity);
    selected.set(face.id,{face,contours});activeId=face.id;
    makeOverlay(face);
    updatePreview();
    status(selected.size+' planar face(s) selected.');
  }catch(err){status(face.label+': '+err.message,true);}
}
function download(filename,content,mime){
  const blob=content instanceof Blob?content:new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function exportOne(kind){
  if(!combined)return;
  try{
    const descriptor=EXPORTERS[kind],content=descriptor.build(combined,readExportOptions());
    const ext=kind==='hpgl'?'plt':kind;
    download(basename+'_selection.'+ext,content,descriptor.mime);
    status(kind.toUpperCase()+' exported locally.');
  }catch(err){status(err.message,true);}
}
function exportZip(){
  try{
    const formats=[...document.querySelectorAll('input[name="zipFormat"]:checked')].map(input=>input.value);
    const entries=[...selected.values()];
    const zip=createExportZip(entries,formats,readExportOptions());
    download(basename+'_faces.zip',zip,'application/zip');
    status(entries.length+' face(s) exported as a ZIP.');
  }catch(err){status(err.message,true);}
}
const suffixes={stp:'step',step:'step',igs:'iges',iges:'iges',brep:'brep',brp:'brep',stl:'stl',obj:'obj',ply:'ply'};
async function openCad(file){
  if(!file||busy)return;
  const ext=file.name.split('.').at(-1).toLowerCase(),kind=suffixes[ext];
  if(!kind)return status('Choose a STEP, IGES, BREP, STL, OBJ or PLY file.',true);
  if(file.size>100*1024*1024)return status('Maximum file size is 100 MB.',true);
  let opts;
  try{opts=readImportOptions();}catch(err){status(err.message,true);return;}
  reset();setBusy(true);lastFile=file;el('reloadButton').disabled=true;
  basename=file.name.replace(/\.(step|stp|igs|iges|brep|brp|stl|obj|ply)$/i,'')
    .replace(/[^a-z0-9_-]/gi,'_').slice(0,80)||'part';
  el('fileName').textContent=file.name;
  el('fileMeta').textContent=(file.size/1048576).toFixed(2)+' MB · '+kind.toUpperCase();
  el('fileInfo').hidden=false;
  const id=++seq;
  try{
    status('Parsing '+kind.toUpperCase()+' locally…');
    if(['step','iges','brep'].includes(kind)){
      const buffer=await file.arrayBuffer();
      if(id!==seq)return;
      worker=new Worker(import.meta.env.BASE_URL+'occt-worker.js');
      worker.onmessage=({data})=>{
        if(data.id!==id)return;
        if(data.type==='error'){setBusy(false);status(data.message,true);return;}
        if(data.type==='result'){
          try{makeCadModel(data.result,kind==='brep'?unitScale(opts.unit):1);}
          catch(err){status(err.message,true);}
          setBusy(false);
        }
      };
      worker.onerror=event=>{if(id===seq){setBusy(false);status(event.message||'CAD worker failed.',true);}};
      const base=new URL(import.meta.env.BASE_URL,location.href).href;
      worker.postMessage({type:'load',id,buffer,base,format:kind,params:opts},[buffer]);
    }else{
      let geometries=[];
      if(kind==='stl'){
        geometries=[new STLLoader().parse(await file.arrayBuffer())];
      }else if(kind==='ply'){
        geometries=[new PLYLoader().parse(await file.arrayBuffer())];
      }else{
        const group=new OBJLoader().parse(await file.text());
        group.traverse(child=>{if(child.isMesh&&child.geometry)geometries.push(child.geometry.clone());});
      }
      if(id!==seq){geometries.forEach(g=>g.dispose());return;}
      makeMeshModel(geometries,opts);
      setBusy(false);
    }
  }catch(err){if(id===seq){setBusy(false);status(err.message,true);}}
}
el('dropzone').addEventListener('click',()=>{if(!busy)el('fileInput').click();});
el('dropzone').addEventListener('keydown',event=>{
  if(!busy&&(event.key==='Enter'||event.key===' ')){event.preventDefault();el('fileInput').click();}
});
el('fileInput').addEventListener('change',event=>openCad(event.target.files[0]));
for(const type of ['dragenter','dragover'])el('dropzone').addEventListener(type,event=>{
  event.preventDefault();el('dropzone').classList.add('dragover');
});
for(const type of ['dragleave','drop'])el('dropzone').addEventListener(type,event=>{
  event.preventDefault();el('dropzone').classList.remove('dragover');
});
el('dropzone').addEventListener('drop',event=>openCad(event.dataTransfer.files[0]));
el('resetButton').addEventListener('click',reset);
el('reloadButton').addEventListener('click',()=>{if(lastFile&&!busy)openCad(lastFile);});
el('fitButton').addEventListener('click',fitModel);
el('clearButton').addEventListener('click',()=>{clearSelected();status('Selection cleared.');});
el('mergeFaces').addEventListener('change',updatePreview);
for(const id of exportIds)el(id+'Button').addEventListener('click',()=>exportOne(id));
el('zipButton').addEventListener('click',exportZip);
for(const id of controlsIds)el(id).addEventListener('change',updatePreview);
el('planarityTolerance').addEventListener('change',()=>{
  if(!selected.size)return;
  const previous=[...selected.values()].map(item=>item.face);
  clearSelected();for(const face of previous)pickFace(face,true);
});
el('resetExportButton').addEventListener('click',()=>{applyExportOptions();el('presetSelect').value='default';});
el('presetSelect').addEventListener('change',event=>{
  const id=event.target.value;
  const settings=id.startsWith('custom:')?readSavedProfiles()[id.slice(7)]:builtInPresets[id];
  applyExportOptions(settings||{});status('Profile loaded.');
});
el('savePresetButton').addEventListener('click',saveProfile);
el('deletePresetButton').addEventListener('click',deleteProfile);
let clickStart=null;
canvas.addEventListener('pointerdown',event=>clickStart=[event.clientX,event.clientY]);
canvas.addEventListener('pointerup',event=>{
  if(!clickStart||Math.hypot(event.clientX-clickStart[0],event.clientY-clickStart[1])>4)return;
  clickStart=null;
  const rect=canvas.getBoundingClientRect();
  pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObjects(objects,false)[0];
  if(!hit)return;
  const index=hit.object.userData.lookup?.[hit.faceIndex];
  if(index===undefined||index<0)return;
  const face=records[index];
  if(face)pickFace(face,event.shiftKey||el('multiSelect').checked);
});
new ResizeObserver(()=>{
  const width=viewport.clientWidth,height=viewport.clientHeight;
  if(width&&height){
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
  }
}).observe(viewport);
refreshProfiles();
(function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);})();
