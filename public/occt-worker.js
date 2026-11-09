let pending = null;
self.onmessage = async ({data}) => {
  if (data.type !== 'load') return;
  const {id, buffer, base} = data;
  try {
    if (!pending) pending = (async () => {
      self.postMessage({type:'progress',id,message:'Loading the CAD geometry engine…'});
      importScripts(base + 'occt-import-js/occt-import-js.js');
      return self.occtimportjs({locateFile: name => base + 'occt-import-js/' + name});
    })();
    const engine = await pending;
    self.postMessage({type:'progress',id,message:'Parsing and triangulating the STEP model…'});
    const result = engine.ReadStepFile(new Uint8Array(buffer), {
      linearUnit: 'millimeter', linearDeflectionType: 'absolute_value',
      linearDeflection: 0.05, angularDeflection: 0.12
    });
    if (!result?.success || !result.meshes?.length) throw new Error('STEP illisible ou sans géométrie.');
    self.postMessage({type:'result', id, result});
  } catch (e) {
    pending = null;
    self.postMessage({type:'error', id, message: e.message || String(e)});
  }
};
