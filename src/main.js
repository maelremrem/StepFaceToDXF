import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {extractContours} from './geometry.js';
import {buildSvg,buildDxf} from './export.js';
import './style.css';

const el=id=>document.getElementById(id);
const viewport=el('viewport'),canvas=document.createElement('canvas');
viewport.prepend(canvas);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff,2));
const lamp=new THREE.DirectionalLight(0xffffff,2.4);
lamp.position.set(1,1,2);scene.add(lamp);
const camera=new THREE.PerspectiveCamera(42,1,.01,100000);
camera.position.set(120,90,120);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;
const model=new THREE.Group();scene.add(model);
const highlight=new THREE.MeshStandardMaterial({color:0x75dba7,roughness:.7,side:THREE.DoubleSide,emissive:0x22563d});
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
let objects=[],faces=[],selected=null,contours=null,outline=null,worker=null,seq=0,busy=false,name='part';

function status(message,error=false){
  el('status').textContent=message;
  el('status').classList.toggle('error',error);
}
function setBusy(value){
  busy=value;
  el('dropzone').classList.toggle('busy',value);
  el('fileInput').disabled=value;
}
function clearSelection(){
  if(selected) selected.object.material[selected.index]=selected.material;
  selected=null;contours=null;
  for(const id of ['widthValue','heightValue','loopCount'])el(id).textContent='—';
  el('preview').textContent='Sélectionnez une face plane pour afficher son contour 2D.';
  el('previewCaption').textContent='Aucun contour sélectionné';
  el('dxfButton').disabled=true;el('svgButton').disabled=true;
  if(outline){
    model.remove(outline);outline.geometry.dispose();outline.material.dispose();outline=null;
  }
}
function clearModel(){
  clearSelection();
  const materials=new Set(faces.map(f=>f.material));
  for(const object of objects){model.remove(object);object.geometry.dispose();}
  materials.forEach(m=>m.dispose());
  objects=[];faces=[];
  el('emptyState').hidden=false;
}
function reset(){
  seq++;
  if(worker){worker.terminate();worker=null;}
  setBusy(false);clearModel();
  el('fileInput').value='';
  el('fileInfo').hidden=true;
  status('Prêt');
}
function color(rgb){
  if(!rgb?.length)return 0x90a9bb;
  return (Math.round(rgb[0]*255)<<16)|(Math.round(rgb[1]*255)<<8)|Math.round(rgb[2]*255);
}
function makeModel(imported){
  clearModel();
  const cache=new Map();
  const material=(rgb)=>{
    const key=color(rgb);
    if(!cache.has(key))cache.set(key,new THREE.MeshStandardMaterial({color:key,roughness:.7,side:THREE.DoubleSide}));
    return cache.get(key);
  };
  imported.meshes.forEach((mesh,meshIndex)=>{
    const positions=mesh.attributes?.position?.array,indices=mesh.index?.array;
    if(!positions?.length || !indices?.length || indices.length%3)return;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setIndex(indices);
    if(mesh.attributes?.normal?.array?.length===positions.length)
      geometry.setAttribute('normal',new THREE.Float32BufferAttribute(mesh.attributes.normal.array,3));
    else geometry.computeVertexNormals();
    const sourceFaces=mesh.brep_faces?.length?mesh.brep_faces:[{first:0,last:indices.length/3-1}];
    const mats=[],object=new THREE.Mesh(geometry,mats);
    sourceFaces.forEach((info,index)=>{
      const first=Math.max(0,Math.trunc(info.first)),last=Math.min(indices.length/3-1,Math.trunc(info.last));
      if(!Number.isFinite(first)||!Number.isFinite(last)||last<first)return;
      const currentMaterial=material(info.color||mesh.color);
      mats[index]=currentMaterial;
      geometry.addGroup(first*3,(last-first+1)*3,index);
      faces.push({object,index,meshIndex,first,last,material:currentMaterial,
        positions,triangles:indices.slice(first*3,(last+1)*3)});
    });
    model.add(object);objects.push(object);
  });
  if(!objects.length)throw Error('Aucune géométrie exploitable.');
  el('emptyState').hidden=true;
  fit();
  status(faces.length+' faces chargées · Cliquez sur une face plane.');
}
function fit(){
  if(!objects.length)return;
  const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3());
  const radius=Math.max(box.getSize(new THREE.Vector3()).length()*.5,1);
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(1,1,1.6).normalize().multiplyScalar(radius*3.3));
  camera.near=Math.max(radius/1000,.001);
  camera.far=Math.max(radius*1000,10000);
  camera.lookAt(center);camera.updateProjectionMatrix();controls.update();
}
function preview(face){
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','-4 -4 '+(face.width+8)+' '+(face.height+8));
  for(const loop of face.loops){
    const path=document.createElementNS(ns,'path');
    path.setAttribute('d',loop.map(([x,y],i)=>(i?'L':'M')+x+','+(face.height-y)).join(' ')+' Z');
    path.setAttribute('fill','none');path.setAttribute('stroke','#76e5ae');
    path.setAttribute('stroke-width','1.5');path.setAttribute('vector-effect','non-scaling-stroke');
    svg.append(path);
  }
  el('preview').replaceChildren(svg);
  el('previewCaption').textContent=face.width.toFixed(2)+' × '+face.height.toFixed(2)+' mm · '+face.loops.length+' contours';
}
function highlightEdges(loops){
  const coords=[];
  for(const loop of loops)for(let i=0;i<loop.length;i++)coords.push(...loop[i],...loop[(i+1)%loop.length]);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
  const material=new THREE.LineBasicMaterial({color:0x2df7a2,depthTest:false});
  outline=new THREE.LineSegments(geometry,material);outline.renderOrder=10;model.add(outline);
}
function select(face){
  clearSelection();selected=face;
  face.object.material[face.index]=highlight;
  try{
    contours=extractContours(face.positions,face.triangles);
    el('widthValue').textContent=contours.width.toFixed(2)+' mm';
    el('heightValue').textContent=contours.height.toFixed(2)+' mm';
    el('loopCount').textContent=contours.loops.length;
    el('dxfButton').disabled=false;el('svgButton').disabled=false;
    preview(contours);highlightEdges(contours.loops3D);
    status('Face plane prête pour export');
  }catch(err){
    el('preview').textContent=err.message;el('previewCaption').textContent='Export indisponible';
    status(err.message,true);
  }
}
function download(ext,text,mime){
  if(!contours||!selected)return;
  const blob=new Blob([text],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name+'_face_'+(selected.meshIndex+1)+'-'+(selected.index+1)+'.'+ext;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function openStep(file){
  if(!file||busy)return;
  if(!/\.(step|stp)$/i.test(file.name)){status('Choisissez un .step ou .stp.',true);return;}
  if(file.size>100*1024*1024){status('Fichier supérieur à 100 Mo.',true);return;}
  reset();setBusy(true);
  name=file.name.replace(/\.(step|stp)$/i,'').replace(/[^a-z0-9_-]/gi,'_').slice(0,80)||'part';
  el('fileName').textContent=file.name;
  el('fileMeta').textContent=(file.size/1048576).toFixed(2)+' Mo · STEP';
  el('fileInfo').hidden=false;
  const id=++seq;
  worker=new Worker(import.meta.env.BASE_URL+'occt-worker.js');
  worker.onmessage=({data})=>{
    if(data.id!==id)return;
    if(data.type==='error'){setBusy(false);status(data.message,true);return;}
    if(data.type==='result'){
      setBusy(false);
      try{makeModel(data.result);}catch(err){status(err.message,true);}
    }
  };
  worker.onerror=e=>{if(id===seq){setBusy(false);status(e.message||'Erreur dans le worker',true);}};
  status('Analyse du STEP par OpenCascade…');
  file.arrayBuffer().then(buffer=>{
    if(id!==seq)return;
    const base=new URL(import.meta.env.BASE_URL,location.href).href;
    worker.postMessage({type:'load',id,buffer,base},[buffer]);
  }).catch(err=>{setBusy(false);status(err.message,true);});
}
el('dropzone').addEventListener('click',()=>{if(!busy)el('fileInput').click();});
el('dropzone').addEventListener('keydown',e=>{
  if(!busy && (e.key==='Enter'||e.key===' ')){e.preventDefault();el('fileInput').click();}
});
el('fileInput').addEventListener('change',e=>openStep(e.target.files[0]));
['dragenter','dragover'].forEach(type=>el('dropzone').addEventListener(type,e=>{
  e.preventDefault();el('dropzone').classList.add('dragover');
}));
['dragleave','drop'].forEach(type=>el('dropzone').addEventListener(type,e=>{
  e.preventDefault();el('dropzone').classList.remove('dragover');
}));
el('dropzone').addEventListener('drop',e=>openStep(e.dataTransfer.files[0]));
el('resetButton').addEventListener('click',reset);
el('fitButton').addEventListener('click',fit);
el('clearButton').addEventListener('click',()=>{clearSelection();status('Sélection effacée.');});
el('dxfButton').addEventListener('click',()=>contours&&download('dxf',buildDxf(contours),'application/dxf'));
el('svgButton').addEventListener('click',()=>contours&&download('svg',buildSvg(contours),'image/svg+xml'));
let clickStart=null;
canvas.addEventListener('pointerdown',e=>clickStart=[e.clientX,e.clientY]);
canvas.addEventListener('pointerup',e=>{
  if(!clickStart || Math.hypot(e.clientX-clickStart[0],e.clientY-clickStart[1])>4)return;
  clickStart=null;
  const bounds=canvas.getBoundingClientRect();
  pointer.set((e.clientX-bounds.left)/bounds.width*2-1,-(e.clientY-bounds.top)/bounds.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObjects(objects,false)[0];
  if(!hit)return;
  const face=faces.find(f=>f.object===hit.object && hit.faceIndex>=f.first && hit.faceIndex<=f.last);
  if(face)select(face);
});
new ResizeObserver(()=>{
  const width=viewport.clientWidth,height=viewport.clientHeight;
  if(width&&height){renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
}).observe(viewport);
(function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);})();
