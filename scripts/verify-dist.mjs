import { existsSync, statSync } from 'node:fs';
for (const file of ['dist/index.html', 'dist/occt-worker.js', 'dist/occt-import-js/occt-import-js.js', 'dist/occt-import-js/occt-import-js.wasm']) {
  if (!existsSync(file) || !statSync(file).size) throw new Error('Missing asset: ' + file);
}
