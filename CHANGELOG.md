# Changelog

## Unreleased
- Show measured file-read and 3D mesh preparation percentages, import stages, live elapsed time and model statistics in the loading dialog. No fictional STEP parsing percentage.
- Fix DXF entity subclass markers, handles and layer tables; validate all DXF modes with ezdxf
- Accessible local-import loading dialog, processing status and cancellation for CAD imports

## 1.0.0 Beta
- English-only user interface, error messages and documentation
- STL, OBJ and PLY local imports alongside STEP, IGES and BREP
- Connected planar mesh regions, configurable source unit conversion
- Multi-face selection and coplanar face merging, batch ZIP export
- PDF, EPS, HPGL, JSON and CSV outputs in addition to DXF and SVG
- DXF LINE / polyline and approximate CIRCLE / ARC fitting
- Export profiles (built-in and local browser storage)
- Automated regression tests

## 0.3.0
- IGES / BREP imports, import tessellation and planarity settings
- DXF / SVG settings, JSON / CSV exports

## 0.2.0
- Browser-only STEP importer with OpenCascade WebAssembly
- 3D face picking, 2D contour preview, DXF / SVG export
- GitHub Pages deployment
