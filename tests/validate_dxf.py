from pathlib import Path
import sys
import ezdxf

directory=Path(sys.argv[1])
expected={
    "polylines.dxf": {"LWPOLYLINE": 2},
    "lines.dxf": {"LINE": 4},
    "circle.dxf": {"CIRCLE": 1},
    "arcs.dxf": {"ARC": 1},
    "layer0.dxf": {"LWPOLYLINE": 2},
}

for filename,counts in expected.items():
    doc=ezdxf.readfile(directory/filename)
    auditor=doc.audit()
    assert not auditor.errors, f"{filename}: {auditor.errors}"
    assert not auditor.fixes, f"{filename}: {auditor.fixes}"
    assert doc.dxfversion=="AC1015", filename
    assert doc.header.get("$INSUNITS")==4, filename
    entities=list(doc.modelspace())
    for entity_type,minimum in counts.items():
        found=sum(entity.dxftype()==entity_type for entity in entities)
        assert found>=minimum, f"{filename}: expected >= {minimum} {entity_type}, found {found}"
    for entity in entities:
        assert entity.dxf.layer in doc.layers, f"{filename}: undefined layer {entity.dxf.layer}"
        assert entity.dxf.hasattr("handle"), f"{filename}: missing entity handle"
    if filename=="polylines.dxf":
        assert all(e.closed for e in entities), filename
        assert len(entities[0])==4 and len(entities[1])==4, filename
    print(f"PASS {filename}: {len(entities)} entities, mm, no DXF audit repairs")
