const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const len=v=>Math.sqrt(dot(v,v));
const norm=v=>v.map(x=>x/len(v));

export function simplifyLoop(points, threshold=0.003) {
  const result=[...points]; let changed=true;
  while(changed && result.length>3){
    changed=false;
    for(let i=result.length-1;i>=0;i--){
      const a=result[(i-1+result.length)%result.length], b=result[i], c=result[(i+1)%result.length];
      const dx=c[0]-a[0],dy=c[1]-a[1],span=Math.hypot(dx,dy);
      const dist=span ? Math.abs((b[0]-a[0])*dy-(b[1]-a[1])*dx)/span : 0;
      const within=(b[0]-a[0])*dx+(b[1]-a[1])*dy>=0 &&
        (b[0]-c[0])*(a[0]-c[0])+(b[1]-c[1])*(a[1]-c[1])>=0;
      if(span<1e-8 || (within && dist<threshold)){result.splice(i,1);changed=true;}
    }
  }
  return result;
}

export function extractContours(positions, triangles, tolerance=0.02) {
  if(!triangles?.length || triangles.length%3) throw Error('Maillage de face incomplet.');
  const vertices=[], ids=new Map(), counts=new Map();
  const vertex=index=>{
    const i=3*index,p=[positions[i],positions[i+1],positions[i+2]];
    if(!p.every(Number.isFinite)) throw Error('Coordonnées non valides.');
    const key=p.map(x=>Math.round(x/1e-5)).join(',');
    if(!ids.has(key)){ids.set(key,vertices.length);vertices.push(p);}
    return ids.get(key);
  };
  let origin=null,normal=null,span=0;
  for(let i=0;i<triangles.length;i+=3){
    const t=[vertex(triangles[i]),vertex(triangles[i+1]),vertex(triangles[i+2])];
    if(new Set(t).size!==3) continue;
    const p=t.map(j=>vertices[j]),n=cross(sub(p[1],p[0]),sub(p[2],p[0]));
    if(len(n)<1e-8) continue;
    if(!normal){normal=norm(n);origin=p[0];}
    span=Math.max(span,len(sub(p[0],p[1])),len(sub(p[1],p[2])),len(sub(p[2],p[0])));
    for(let j=0;j<3;j++){
      const a=t[j],b=t[(j+1)%3],key=a<b?a+':'+b:b+':'+a;
      const prev=counts.get(key);
      if(prev) prev.count++; else counts.set(key,{a,b,count:1});
    }
  }
  if(!normal) throw Error('Aucun triangle valide.');
  if(vertices.some(p=>Math.abs(dot(sub(p,origin),normal))>Math.max(tolerance,span*1e-5)))
    throw Error('Face non plane : sélectionnez une surface plate.');
  const adj=new Map();
  for(const {a,b,count} of counts.values()){
    if(count!==1) continue;
    if(!adj.has(a)) adj.set(a,[]);
    if(!adj.has(b)) adj.set(b,[]);
    adj.get(a).push(b);adj.get(b).push(a);
  }
  if(!adj.size || [...adj.values()].some(v=>v.length!==2)) throw Error('Contour non fermé ou ambigu.');
  const visited=new Set(),loops3D=[];
  for(const first of adj.keys()){
    if(visited.has(first)) continue;
    let current=first,prior=-1;const loop=[];
    for(let n=0;n<=adj.size;n++){
      if(current===first && loop.length) break;
      if(visited.has(current)) throw Error('Contour auto-intersecté.');
      visited.add(current);loop.push(vertices[current]);
      const near=adj.get(current),next=near[0]===prior?near[1]:near[0];
      prior=current;current=next;
      if(n===adj.size) throw Error('Contour ouvert.');
    }
    if(loop.length>=3)loops3D.push(loop);
  }
  if(!loops3D.length) throw Error('Aucun contour fermé.');
  const ref=Math.abs(dot(normal,[1,0,0]))<.9?[1,0,0]:[0,1,0];
  const x=norm(sub(ref,normal.map(v=>v*dot(ref,normal)))),y=norm(cross(normal,x));
  const raw=loops3D.map(loop=>loop.map(p=>[dot(sub(p,origin),x),dot(sub(p,origin),y)]));
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const loop of raw)for(const [a,b] of loop){minX=Math.min(minX,a);minY=Math.min(minY,b);maxX=Math.max(maxX,a);maxY=Math.max(maxY,b);}
  const width=maxX-minX,height=maxY-minY;
  if(width<1e-8 || height<1e-8) throw Error('Face dégénérée.');
  const loops=raw.map(loop=>simplifyLoop(loop.map(([a,b])=>[a-minX,b-minY])));
  return {width,height,loops,loops3D};
}
