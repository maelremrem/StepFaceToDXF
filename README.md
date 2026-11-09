# StepFaceToDXF

**A fully client-side CAD face exporter for GitHub Pages, in English.**

**Live:** https://maelremrem.github.io/StepFaceToDXF/

Import a 3D model, click one or more coplanar faces, preview the flattened 2D contours, and download vector files at 1:1 scale in millimeters. All file processing runs locally in your browser.

CAD imports show a loading dialog with processing stages and an optional Cancel action. No artificial percentage is displayed: the STEP parser does not expose exact progress. Cancelling terminates the active import worker.

## Import formats

| Format | Extensions | Notes |
| --- | --- | --- |
| STEP | .step, .stp | OpenCascade importer; unit conversion to mm |
| IGES | .iges, .igs | OpenCascade importer; unit conversion to mm |
| OpenCascade BREP | .brep, .brp | No reliable unit metadata; choose source units |
| STL | .stl | Binary / ASCII meshes; choose source units |
| Wavefront OBJ | .obj | Triangulated mesh regions; choose source units |
| PLY | .ply | Polygonal meshes; choose source units |

CAD imports allow configurable linear tessellation deviation and angular deviation. The app finds **connected planar regions** in triangulated mesh files, with user-defined planarity and normal tolerances. Maximum upload size is 100 MB. Mesh region extraction currently caps each individual mesh at 300,000 triangles to bound browser resource use.

## Export formats

- **DXF:** closed LWPOLYLINE, LINE entities, or optional approximate fitted CIRCLE and ARC entities; configurable layer; `$INSUNITS=4` (millimeters).
- **SVG:** physical width/height in mm, editable stroke width and page margin.
- **PDF:** one-page, plain vector geometry, scaled in real millimeters.
- **EPS:** scalable PostScript vector paths.
- **HPGL (.plt):** plotter pen commands using 40 plotter units per millimeter.
- **JSON:** structured 2D contour coordinates and parameters.
- **CSV:** XY coordinates and contour/point IDs.

Settings: rotation (0/90/180/270 degrees), XY mirror, scale, offsets in mm, optional polygon simplification, remove holes, SVG/PDF margin and stroke, DXF layers, and curve-fit tolerance. There are built-in presets and editable custom profiles saved in the local browser.

Select multiple faces using **Shift+click** or enable Multi-select. The app can merge adjacent coplanar faces into a single file, or export multiple selected faces independently into a ZIP containing selected export formats.

## Accuracy and limitations

**The current importer exposes triangulated geometry, not exact OpenCascade B-Rep edges.** DXF circles and arcs can be *fitted* from polygon samples, but fitted curves and exported segments are **not exact CAD-native geometry**. Curve fitting is optional, limited by the selected tolerance, and falls back to line segments. The tessellation deviation is a meshing target, not a guaranteed manufacturing tolerance. Always check dimensions in a CAD/CAM tool before fabrication.

STL/OBJ/PLY models do not reliably specify physical units, so select the correct source units before import. Highly curved meshes create many small planar regions; open, non-manifold or imperfect meshes may not yield closed 2D contours.

The PDF and EPS implementations export plain vector paths, not a complete publishing/layout engine. HPGL is intended for conventional 40-unit/mm devices; verify your plotter's dialect.

## Development

```sh
npm install
npm test
npm run dev
npm run build
```

GitHub Pages is published by GitHub Actions on commits to `main`; pull requests run unit tests and the production build without deploying.

## Privacy

There is no backend, tracking endpoint, account system, or model upload. Imported files remain in your browser and custom presets are stored in the browser's own local storage.

For an explanation of the exact-geometry limitation, see [Accuracy roadmap](docs/ACCURACY.md).
## License

Copyright (C) 2026 maelremrem.

StepFaceToDXF's original source code is licensed under the **GNU General Public License version 3 only (GPL-3.0-only)**. See the full [LICENSE](LICENSE) text.

Third-party dependencies are distributed under their respective licenses.
