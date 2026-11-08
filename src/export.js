import {simplifyLoop} from './geometry.js';

const fmt = n => String(Number(n.toFixed(6)));
const number = (value, fallback, min, max, label) => {
  const n = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw Error(label + ' doit être compris entre ' + min + ' et ' + max + '.');
  return n;
};
const safeLayer = name => String(name || 'CUT').trim().replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'CUT';
const area = loop => Math.abs(loop.reduce((sum, p, i) => {
  const q = loop[(i + 1) % loop.length];
  return sum + p[0] * q[1] - q[0] * p[1];
}, 0)) / 2;

export function normalizeOptions(options = {}) {
  const rotation = number(options.rotation, 0, 0, 270, 'Rotation');
  if (![0, 90, 180, 270].includes(rotation)) throw Error('Rotation non prise en charge.');
  return {
    rotation,
    flipX: !!options.flipX,
    flipY: !!options.flipY,
    scale: number(options.scale, 1, 0.00001, 10000, 'Échelle'),
    offsetX: number(options.offsetX, 0, -1000000, 1000000, 'Décalage X'),
    offsetY: number(options.offsetY, 0, -1000000, 1000000, 'Décalage Y'),
    margin: number(options.margin, 0, 0, 10000, 'Marge SVG'),
    stroke: number(options.stroke, 0.1, 0.001, 10, 'Épaisseur du trait'),
    simplify: number(options.simplify, 0, 0, 10, 'Simplification'),
    includeHoles: options.includeHoles !== false,
    dxfMode: options.dxfMode === 'lines' ? 'lines' : 'polyline',
    layer: safeLayer(options.layer)
  };
}
export function transformContours(contours, options = {}) {
  const o = normalizeOptions(options);
  if (!contours?.loops?.length) throw Error('Contour vide.');
  let loops = contours.loops;
  if (!o.includeHoles && loops.length > 1) loops = [loops.reduce((a,b) => area(a)>=area(b)?a:b)];
  const raw = loops.map(loop => {
    if (loop.length < 3) throw Error('Contour non fermé.');
    const points = loop.map(([x0,y0]) => {
      let x = o.flipX ? -x0 : x0;
      let y = o.flipY ? -y0 : y0;
      if (o.rotation === 90) [x,y] = [-y,x];
      else if (o.rotation === 180) [x,y] = [-x,-y];
      else if (o.rotation === 270) [x,y] = [y,-x];
      return [x * o.scale, y * o.scale];
    });
    return o.simplify ? simplifyLoop(points, o.simplify) : points;
  });
  const all = raw.flat();
  const minX = Math.min(...all.map(p=>p[0])), minY = Math.min(...all.map(p=>p[1]));
  const maxX = Math.max(...all.map(p=>p[0])), maxY = Math.max(...all.map(p=>p[1]));
  if (![minX,minY,maxX,maxY].every(Number.isFinite)) throw Error('Coordonnées invalides.');
  return {
    width: maxX - minX, height: maxY - minY, options: o,
    loops: raw.map(loop => loop.map(([x,y]) => [x-minX+o.offsetX, y-minY+o.offsetY]))
  };
}
export function buildSvg(contours, options = {}) {
  const {width,height,loops,options:o} = transformContours(contours,options);
  const path = loops.map(loop => '<path d="' + loop.map(([x,y],i) => (i?'L ':'M ')+fmt(x)+' '+fmt(-y)).join(' ') + ' Z"/>').join('\n');
  const vx = o.offsetX - o.margin;
  const vy = -o.offsetY - height - o.margin;
  const w = width + o.margin * 2;
  const h = height + o.margin * 2;
  return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="'+fmt(w)+'mm" height="'+fmt(h)+'mm" viewBox="'+fmt(vx)+' '+fmt(vy)+' '+fmt(w)+' '+fmt(h)+'"><g fill="none" stroke="#000" stroke-width="'+fmt(o.stroke)+'">'+path+'</g></svg>';
}
export function buildDxf(contours, options = {}) {
  const {loops,options:o} = transformContours(contours, options);
  const lines=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1015','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES'];
  for (const loop of loops) {
    if (o.dxfMode === 'lines') {
      for (let i=0;i<loop.length;i++) {
        const a=loop[i],b=loop[(i+1)%loop.length];
        lines.push('0','LINE','8',o.layer,'10',fmt(a[0]),'20',fmt(a[1]),'30','0','11',fmt(b[0]),'21',fmt(b[1]),'31','0');
      }
    } else {
      lines.push('0','LWPOLYLINE','8',o.layer,'90',String(loop.length),'70','1');
      for(const [x,y] of loop) lines.push('10',fmt(x),'20',fmt(y));
    }
  }
  lines.push('0','ENDSEC','0','EOF');
  return lines.join('\n')+'\n';
}
export function buildJson(contours, options = {}) {
  const {width,height,loops,options:o} = transformContours(contours,options);
  return JSON.stringify({format:'StepFaceToDXF-contours',version:1,units:'mm',width_mm:width,height_mm:height,closed:true,options:o,loops:loops.map(points=>({points}))},null,2)+'\n';
}
export function buildCsv(contours, options = {}) {
  const {loops} = transformContours(contours,options);
  const rows=['contour_id,point_id,x_mm,y_mm'];
  loops.forEach((loop,i)=>[...loop,loop[0]].forEach(([x,y],j)=>rows.push([i+1,j+1,fmt(x),fmt(y)].join(','))));
  return rows.join('\n')+'\n';
}
