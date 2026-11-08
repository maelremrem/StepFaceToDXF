# StepFaceToDXF — browser CAD face exporter

[Try the web app](https://maelremrem.github.io/StepFaceToDXF/)

A static, private, local-first CAD tool using OpenCascade WebAssembly, Three.js and Vite. No files are uploaded to a server.

## Import

- STEP: `.step`, `.stp`
- IGES: `.iges`, `.igs`
- OpenCascade BREP: `.brep`, `.brp`

Import options: triangulation linear deviation (mm), angular deviation (degrees), and planar face tolerance (mm). Changing tessellation options requires reloading the file. STEP/IGES output is normalized to millimeters. **BREP source coordinates are assumed to be in mm** because that format does not carry reliable unit metadata.

STL/OBJ/PLY support is planned for v0.4: those formats are meshes, with different surface-selection behavior.

## Export

Select a planar face in 3D and export:

- **DXF** — closed LWPOLYLINE or independent LINE entities, with custom layer; `$INSUNITS = 4` (mm).
- **SVG** — mm size, configurable stroke width and margin.
- **JSON** — closed loops with XY point coordinates in mm.
- **CSV** — loop/point IDs and XY coordinates in mm (first point repeated to close each loop).

Transform options: 0/90/180/270 rotation, mirror X/Y, scale factor, XY offsets in mm, hole inclusion, optional extra polyline simplification. Default is **1:1 in mm**. The preview reflects the options. The original STEP geometry is not modified.

**Precision:** contours are obtained from the **triangulated** faces. Curved CAD edges become segments rather than native CIRCLE/ARC geometry. Input tessellation deviation is a target, **not a metrology tolerance**. Inspect the file in a CAD/CAM tool before machining.

## Development

```sh
npm install
npm run dev
npm test
npm run build
```

Enable Settings → Pages → Source: GitHub Actions. Pushing to `main` builds and deploys automatically.

MIT? License has not been chosen yet; please check repository licensing before reusing source.
