let pending = null;
const formats = {step: 'ReadStepFile', stp:'ReadStepFile', igs:'ReadIgesFile', iges:'ReadIgesFile', brp:'ReadBrepFile', brep:'ReadBrepFile'};
self.onmessage = async ({data}) => {
  if (data.type !== 'load') return;
  const {id, buffer, base, format, params={}} = data;
  try {
    const method = formats[format];
    if (!method) throw new Error('Format non supporté.');
    const linearDeflection=Number(params.linearDeflection);
    const angularDeflection=Number(params.angularDeflection);
    if (!Number.isFinite(linearDeflection) || linearDeflection < 0.001 || linearDeflection > 5) throw new Error('Déviation hors limites.');
    if (!Number.isFinite(angularDeflection) || angularDeflection < 0.01 || angularDeflection > 1.6) throw new Error('Angle hors limites.');
    if (!pending) pending = (async () => {
      importScripts(base + 'occt-import-js/occt-import-js.js');
      return self.occtimportjs({locateFile: name => base + 'occt-import-js/' + name});
    })();
    const engine=await pending;
    if (typeof engine[method] !== 'function') throw new Error('Lecteur CAO indisponible : '+format);
    const result=engine[method](new Uint8Array(buffer),{
      linearUnit:'millimeter',
      linearDeflectionType:'absolute_value',
      linearDeflection,angularDeflection
    });
    if (!result?.success || !result.meshes?.length) throw new Error('Fichier CAO illisible ou sans géométrie.');
    self.postMessage({type:'result',id,result});
  } catch(e) {
    self.postMessage({type:'error',id,message:e.message||String(e)});
  }
};
