const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const normAngle=n=>((n%360)+360)%360;
export const degrees=rad=>normAngle(rad*180/Math.PI);

export function fitArcPoints(points,tolerance=.025) {
  if(points.length<5)return null;
  let mx=0,my=0;
  for(const [x,y] of points){mx+=x;my+=y;}
  mx/=points.length;my/=points.length;
  let xx=0,xy=0,yy=0,bx=0,by=0;
  for(const [x0,y0] of points){
    const x=x0-mx,y=y0-my,z=(x*x+y*y)/2;
    xx+=x*x;xy+=x*y;yy+=y*y;bx+=x*z;by+=y*z;
  }
  const det=xx*yy-xy*xy;
  if(det<1e-12)return null;
  const cx=mx+(bx*yy-by*xy)/det,cy=my+(by*xx-bx*xy)/det;
  const radius=points.reduce((s,p)=>s+dist(p,[cx,cy]),0)/points.length;
  if(!Number.isFinite(radius)||radius<=tolerance*2)return null;
  const error=Math.max(...points.map(p=>Math.abs(dist(p,[cx,cy])-radius)));
  if(error>tolerance)return null;
  const angles=points.map(p=>Math.atan2(p[1]-cy,p[0]-cx));
  let sweep=0,sign=0;
  for(let i=1;i<angles.length;i++){
    let delta=angles[i]-angles[i-1];
    if(delta>Math.PI)delta-=2*Math.PI;
    if(delta<-Math.PI)delta+=2*Math.PI;
    if(Math.abs(delta)<1e-5||Math.abs(delta)>Math.PI*.85)return null;
    if(sign&&Math.sign(delta)!==sign)return null;
    sign=Math.sign(delta);sweep+=delta;
  }
  if(Math.abs(sweep)<Math.PI/9||Math.abs(sweep)>=Math.PI*1.98)return null;
  return {cx,cy,radius,sweep,error};
}
function cornerScore(a,b,c){
  const u=[a[0]-b[0],a[1]-b[1]],v=[c[0]-b[0],c[1]-b[1]];
  const mu=Math.hypot(...u),mv=Math.hypot(...v);
  if(!mu||!mv)return 0;
  return Math.PI-Math.acos(Math.max(-1,Math.min(1,dot(u,v)/(mu*mv))));
}
export function segmentPolyline(loop,tolerance=.025){
  if(loop.length<5)return loop.map((start,i)=>({type:'line',start,end:loop[(i+1)%loop.length]}));
  let corner=0,maximum=-Infinity;
  for(let i=0;i<loop.length;i++){
    const score=cornerScore(loop[(i+loop.length-1)%loop.length],loop[i],loop[(i+1)%loop.length]);
    if(score>maximum){maximum=score;corner=i;}
  }
  const rotated=[...loop.slice(corner),...loop.slice(0,corner)];
  const extended=[...rotated,rotated[0]],segments=[];
  let i=0;
  while(i<rotated.length){
    let best=null;
    for(let end=i+4;end<=Math.min(i+64,rotated.length);end++){
      const arc=fitArcPoints(extended.slice(i,end+1),tolerance);
      if(arc)best={end,arc};
      else if(best)break;
    }
    if(best){
      segments.push({type:'arc',start:extended[i],end:extended[best.end],...best.arc});
      i=best.end;
    }else{
      segments.push({type:'line',start:extended[i],end:extended[i+1]});
      i++;
    }
  }
  return segments;
}
