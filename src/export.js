import {simplifyLoop} from './geometry.js';

const fmt = n => String(Number(n.toFixed(6)));
const num = (value, fallback, min, max, label) => {
  const n = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw Error(label + ' must be between ' + min + ' and ' + max + '.');
  return n;
};
const safeLayer = value => String(value || 'CUT').trim().replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'CUT';
const signedArea = loop => loop.reduce((sum,p,i) => {
  const next = loop[(i+1)%loop.length];
  return sum + p[0]*next[1]-next[0]*p[1];
},0)/2;
const inside = (point, poly) => {
  let result = false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[i],b=poly[j];
    if(((a[1]>point[1])!==(b[1]>point[1])) &&
       point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]) result=!result;
  }
  return result;
};
const bounds = loops => {
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const loop of loops) for(const [x,y] of loop) {
    minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
  }
  if(![minX,minY,maxX,maxY].every(Number.isFinite) || maxX<=minX || maxY<=minY)
    throw Error('Invalid or degenerate contour.');
  return {minX,minY,maxX,maxY,width:maxX-minX,height:maxY-minY};
};
export function normalizeOptions(options={}) {
  const rotation = num(options.rotation,0,0,270,'Rotation');
  if(![0,90,180,270].includes(rotation)) throw Error('Rotation must be 0, 90, 180 or 270 degrees.');
  return {
    rotation,
    flipX:!!options.flipX,flipY:!!options.flipY,
    scale:num(options.scale,1,0.00001,10000,'Scale'),
    offsetX:num(options.offsetX,0,-1e6,1e6,'X offset'),
    offsetY:num(options.offsetY,0,-1e6,1e6,'Y offset'),
    margin:num(options.margin,0,0,10000,'Margin'),
    stroke:num(options.stroke,0.1,0.001,10,'Stroke width'),
    simplify:num(options.simplify,0,0,10,'Simplification'),
    includeHoles:options.includeHoles!==false,
    dxfMode:['lines','polyline','circles'].includes(options.dxfMode)?options.dxfMode:'polyline',
    curveTolerance:num(options.curveTolerance,0.025,0.001,1,'Curve fit tolerance'),
    layer:safeLayer(options.layer)
  };
}
export function transformContours(contours,options={}) {
  const o=normalizeOptions(options);
  if(!contours?.loops?.length) throw Error('No contours to export.');
  const loops=o.includeHoles?contours.loops:contours.loops.filter((loop,i,all)=>{
    const pt=loop[0];
    return all.reduce((n,other,j)=>i!==j&&inside(pt,other)?n+1:n,0)%2===0;
  });
  const transformed=loops.map(loop=>{
    if(loop.length<3)throw Error('A contour has fewer than 3 vertices.');
    const points=loop.map(([px,py])=>{
      let x=(o.flipX?-px:px),y=(o.flipY?-py:py);
      if(o.rotation===90)[x,y]=[-y,x];
      if(o.rotation===180)[x,y]=[-x,-y];
      if(o.rotation===270)[x,y]=[y,-x];
      return [x*o.scale,y*o.scale];
    });
    return o.simplify?simplifyLoop(points,o.simplify):points;
  });
  const bb=bounds(transformed);
  return {
    width:bb.width,height:bb.height,options:o,
    loops:transformed.map(loop=>loop.map(([x,y])=>[x-bb.minX+o.offsetX,y-bb.minY+o.offsetY]))
  };
}
export function fitCircle(loop,tolerance=0.025) {
  if(loop.length<8)return null;
  let mx=0,my=0;
  for(const [x,y] of loop){mx+=x;my+=y;}
  mx/=loop.length;my/=loop.length;
  let xx=0,xy=0,yy=0,bx=0,by=0;
  for(const [x0,y0] of loop){
    const x=x0-mx,y=y0-my,z=(x*x+y*y)/2;
    xx+=x*x;xy+=x*y;yy+=y*y;bx+=x*z;by+=y*z;
  }
  const det=xx*yy-xy*xy;
  if(det<=1e-15)return null;
  const cx=mx+(bx*yy-by*xy)/det;
  const cy=my+(by*xx-bx*xy)/det;
  const radius=loop.reduce((sum,p)=>sum+Math.hypot(p[0]-cx,p[1]-cy),0)/loop.length;
  if(radius<=tolerance*2||!inside([cx,cy],loop))return null;
  const error=Math.max(...loop.map(p=>Math.abs(Math.hypot(p[0]-cx,p[1]-cy)-radius)));
  if(error>tolerance)return null;
  return {cx,cy,radius,error};
}
const paths = (data,forSvg=false) => data.loops.map(loop=>{
  const circle=data.options.dxfMode==='circles'?fitCircle(loop,data.options.curveTolerance):null;
  if(circle)return {circle,loop};
  return {loop};
});
export function buildSvg(contours,options={}) {
  const data=transformContours(contours,options),o=data.options;
  const bb=data;
  const elems=paths(data).map(({loop,circle})=>{
    if(circle)return '<circle cx="'+fmt(circle.cx)+'" cy="'+fmt(-circle.cy)+'" r="'+fmt(circle.radius)+'"/>';
    return '<path d="'+loop.map(([x,y],i)=>(i?'L ':'M ')+fmt(x)+' '+fmt(-y)).join(' ')+' Z"/>';
  }).join('\n');
  const w=bb.width+2*o.margin,h=bb.height+2*o.margin;
  const vx=o.offsetX-o.margin,vy=-o.offsetY-bb.height-o.margin;
  return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="'+fmt(w)+'mm" height="'+fmt(h)+'mm" viewBox="'+fmt(vx)+' '+fmt(vy)+' '+fmt(w)+' '+fmt(h)+'"><g fill="none" stroke="#000" stroke-width="'+fmt(o.stroke)+'">'+elems+'</g></svg>';
}
export function buildDxf(contours,options={}) {
  const data=transformContours(contours,options),o=data.options;
  const lines=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1015','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES'];
  for(const {loop,circle} of paths(data)){
    if(circle){
      lines.push('0','CIRCLE','8',o.layer,'10',fmt(circle.cx),'20',fmt(circle.cy),'30','0','40',fmt(circle.radius));
    }else if(o.dxfMode==='lines'){
      for(let i=0;i<loop.length;i++){
        const a=loop[i],b=loop[(i+1)%loop.length];
        lines.push('0','LINE','8',o.layer,'10',fmt(a[0]),'20',fmt(a[1]),'30','0','11',fmt(b[0]),'21',fmt(b[1]),'31','0');
      }
    }else{
      lines.push('0','LWPOLYLINE','8',o.layer,'90',String(loop.length),'70','1');
      for(const [x,y] of loop)lines.push('10',fmt(x),'20',fmt(y));
    }
  }
  lines.push('0','ENDSEC','0','EOF');
  return lines.join('\n')+'\n';
}
export function buildJson(contours,options={}) {
  const data=transformContours(contours,options);
  return JSON.stringify({format:'StepFaceToDXF-contours',version:2,units:'mm',
    width_mm:data.width,height_mm:data.height,closed:true,options:data.options,
    loops:data.loops.map(points=>({points}))},null,2)+'\n';
}
export function buildCsv(contours,options={}) {
  const data=transformContours(contours,options);
  const rows=['contour_id,point_id,x_mm,y_mm'];
  data.loops.forEach((loop,i)=>[...loop,loop[0]].forEach(([x,y],j)=>{
    rows.push([i+1,j+1,fmt(x),fmt(y)].join(','));
  }));
  return rows.join('\n')+'\n';
}
const pointsToPrint = data => {
  const o=data.options, x0=o.offsetX-o.margin,y0=o.offsetY-o.margin;
  const scale=72/25.4;
  return {
    width:(data.width+2*o.margin)*scale,
    height:(data.height+2*o.margin)*scale,
    loops:data.loops.map(loop=>loop.map(([x,y])=>[(x-x0)*scale,(y-y0)*scale])),
    stroke:o.stroke*scale
  };
};
const postscriptPaths = printable => printable.loops.map(loop=>{
  const first=loop[0];
  return 'newpath '+fmt(first[0])+' '+fmt(first[1])+' moveto\n'+
    loop.slice(1).map(([x,y])=>fmt(x)+' '+fmt(y)+' lineto').join('\n')+
    '\nclosepath stroke';
}).join('\n');
export function buildEps(contours,options={}) {
  const page=pointsToPrint(transformContours(contours,options));
  return '%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 '+Math.ceil(page.width)+' '+Math.ceil(page.height)+
    '\n%%HiResBoundingBox: 0 0 '+fmt(page.width)+' '+fmt(page.height)+
    '\n%%EndComments\n0 setgray '+fmt(page.stroke)+' setlinewidth\n'+postscriptPaths(page)+'\n%%EOF\n';
}
export function buildHpgl(contours,options={}) {
  const data=transformContours(contours,options);
  const {offsetX,offsetY,margin}=data.options;
  const move=([x,y])=>Math.round((x-offsetX+margin)*40)+','+Math.round((y-offsetY+margin)*40);
  const lines=['IN;','SP1;'];
  for(const loop of data.loops){
    lines.push('PU'+move(loop[0])+';','PD'+[...loop.slice(1),loop[0]].map(move).join(',')+';','PU;');
  }
  lines.push('SP0;');
  return lines.join('\n')+'\n';
}
export function buildPdf(contours,options={}) {
  const page=pointsToPrint(transformContours(contours,options));
  const cmds=['0 G',fmt(page.stroke)+' w'];
  for(const loop of page.loops){
    cmds.push(fmt(loop[0][0])+' '+fmt(loop[0][1])+' m');
    for(const [x,y] of loop.slice(1))cmds.push(fmt(x)+' '+fmt(y)+' l');
    cmds.push('h S');
  }
  const stream=cmds.join('\n')+'\n';
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+fmt(page.width)+' '+fmt(page.height)+'] /Resources << >> /Contents 4 0 R >>',
    '<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream'
  ];
  let pdf='%PDF-1.4\n', offsets=[0];
  for(let i=0;i<objects.length;i++){
    offsets.push(pdf.length);
    pdf+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';
  }
  const start=pdf.length;
  pdf+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
  for(const offset of offsets.slice(1))pdf+=String(offset).padStart(10,'0')+' 00000 n \n';
  pdf+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';
  return pdf;
}
export const EXPORTERS={
  svg:{build:buildSvg,mime:'image/svg+xml'},
  dxf:{build:buildDxf,mime:'application/dxf'},
  pdf:{build:buildPdf,mime:'application/pdf'},
  eps:{build:buildEps,mime:'application/postscript'},
  hpgl:{build:buildHpgl,mime:'application/vnd.hp-hpgl'},
  json:{build:buildJson,mime:'application/json'},
  csv:{build:buildCsv,mime:'text/csv;charset=utf-8'}
};
