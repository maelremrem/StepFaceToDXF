const fmt=n=>String(Number(n.toFixed(5)));
export function buildSvg({width,height,loops}) {
  if(!loops?.length)throw Error('Contour vide.');
  const paths=loops.map(loop=>'<path d="'+loop.map(([x,y],i)=>(i?'L ':'M ')+fmt(x)+' '+fmt(height-y)).join(' ')+' Z"/>').join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="'+fmt(width)+'mm" height="'+fmt(height)+'mm" viewBox="0 0 '+fmt(width)+' '+fmt(height)+'"><g fill="none" stroke="#000" stroke-width="0.1">'+paths+'</g></svg>';
}
export function buildDxf({loops}) {
  if(!loops?.length)throw Error('Contour vide.');
  const lines=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1015','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES'];
  for(const loop of loops){
    lines.push('0','LWPOLYLINE','8','CUT','90',String(loop.length),'70','1');
    for(const [x,y] of loop)lines.push('10',fmt(x),'20',fmt(y));
  }
  lines.push('0','ENDSEC','0','EOF');
  return lines.join('\n')+'\n';
}
