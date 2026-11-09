let enginePromise=null;
const readers={step:'ReadStepFile',iges:'ReadIgesFile',brep:'ReadBrepFile'};
const report=(id,step,message)=>self.postMessage({type:'progress',id,step,message});

self.onmessage=async ({data})=>{
  if(data.type!=='load')return;
  const {id,buffer,base,format='step',params={}}=data;
  try{
    const readerName=readers[format];
    if(!readerName)throw Error('Unsupported CAD format: '+format);
    if(!enginePromise)enginePromise=(async ()=>{
      report(id,'engine','Loading OpenCascade WebAssembly…');
      importScripts(base+'occt-import-js/occt-import-js.js');
      const engine=await self.occtimportjs({
        locateFile:name=>base+'occt-import-js/'+name
      });
      return engine;
    })();
    const engine=await enginePromise;
    if(typeof engine[readerName]!=='function')throw Error('CAD reader unavailable: '+format);
    report(id,'geometry','Processing '+format.toUpperCase()+' topology and tessellation…');
    const options={
      linearUnit:'millimeter',
      linearDeflectionType:'absolute_value',
      linearDeflection:Number(params.linearDeflection)||.05,
      angularDeflection:Number(params.angularDeflection)||.12
    };
    const started=performance.now();
    const result=engine[readerName](new Uint8Array(buffer),options);
    if(!result?.success||!result.meshes?.length)throw Error('CAD file could not be processed.');
    const stats=result.meshes.reduce((acc,mesh)=>{
      acc.meshes++;
      acc.faces+=mesh.brep_faces?.length||1;
      acc.triangles+=Math.trunc((mesh.index?.array?.length||0)/3);
      return acc;
    },{meshes:0,faces:0,triangles:0});
    self.postMessage({type:'stats',id,stats,durationMs:performance.now()-started});
    self.postMessage({type:'result',id,result});
  }catch(e){
    enginePromise=null;
    self.postMessage({type:'error',id,message:e.message||String(e)});
  }
};
