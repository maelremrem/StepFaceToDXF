export function parseViewBox(value) {
  const v=String(value||'').trim().split(/[\s,]+/).map(Number);
  if(v.length!==4||v.some(n=>!Number.isFinite(n))||v[2]<=0||v[3]<=0)
    throw new Error('Invalid SVG viewBox.');
  return {x:v[0],y:v[1],width:v[2],height:v[3]};
}
export function zoomViewBox(box,factor,point) {
  if(!Number.isFinite(factor)||factor<=0)throw new Error('Invalid zoom factor.');
  if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))
    throw new Error('Invalid zoom anchor.');
  return {
    x:point.x-(point.x-box.x)/factor,
    y:point.y-(point.y-box.y)/factor,
    width:box.width/factor,
    height:box.height/factor
  };
}
export function panViewBox(box,dx,dy) {
  if(!Number.isFinite(dx)||!Number.isFinite(dy))throw new Error('Invalid pan offset.');
  return {...box,x:box.x+dx,y:box.y+dy};
}
export function stringifyViewBox(box) {
  return [box.x,box.y,box.width,box.height].join(' ');
}
