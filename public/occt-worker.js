let pending = null;
self.onmessage = async ({data}) => {
  if (data.type !== 'load') return;
  const {id, buffer, base} = data;
  try {
    if (!pending) pending = (async () => {
      importScripts(base + 'occt-import-js/occt-import-js.js');
      return self.occtimportjs({locateFile: name => base + 'occt-import-js/' + name});
    })();
    const engine = await pending;
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
