# Accuracy roadmap

The application is usable without a backend, but its geometry comes from triangulated mesh data.

## Done
- Export polygon contours from planar faces
- Recognize planar connected regions in STL, OBJ and PLY meshes
- Merge selected coplanar CAD faces
- Optional least-squares fitted CIRCLE and ARC entities
- Export SVG, DXF, PDF, EPS, HPGL, JSON, CSV and ZIP

## Not solved: mathematically exact CAD curves

The bundled occt-import-js 0.0.23 returns triangulated meshes and their face ranges; it does not expose OpenCascade native edge curves to JavaScript. This means an exact B-Rep export cannot be built from its current public API.

To support true exact CIRCLE / ARC / spline entities, a separate WebAssembly build will be needed that exposes:
- STEP/IGES/BREP edges and wire topology
- Geometric curve types and analytic parameters
- Projected 2D plane-local curves
- Trimmed edges and orientation

Until this is available, DXF fitted arcs and circles are approximate. The operator must confirm geometry against the source CAD when precision is critical.
