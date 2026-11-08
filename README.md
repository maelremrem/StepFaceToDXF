# STEP / FACE / DXF

A browser-only STEP face exporter for SVG and DXF, in millimeters.

Open the GitHub Pages site after deployment at https://maelremrem.github.io/StepFaceToDXF/.

The app reads files locally in your browser and extracts **triangulated** contours of planar STEP faces. Circular arcs are approximated by line segments, so validate dimensions before machining.

## GitHub Pages

Enable **Settings → Pages → Source: GitHub Actions** in this repository. The workflow then deploys on every push to `main`.

## Local development

```sh
npm install
npm run dev
npm test
npm run build
```

The `occt-import-js` library runs in a Web Worker, and its WASM files are copied from npm into the static `public/` directory at build time.
