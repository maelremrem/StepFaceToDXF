import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const from = 'node_modules/occt-import-js/dist';
const to = 'public/occt-import-js';
if (!existsSync(join(from, 'occt-import-js.wasm'))) throw new Error('Run npm install first.');
mkdirSync(to, { recursive: true });
for (const file of ['occt-import-js.js', 'occt-import-js.wasm']) {
  copyFileSync(join(from, file), join(to, file));
}
