const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const norm=a=>Math.sqrt(dot(a,a));

export const unitScale = unit => ({mm:1,cm:10,m:1000,inch:25.4,ft:304.8})[unit] ?? 1;

export function groupMeshRegions(positions,indices,opts={}) {
  if(positions.length%3 || indices.length%3 || indices.length<3)throw Error('Invalid triangle mesh.');
  const triangleCount=indices.length/3;
  if(triangleCount>300000)throw Error('Mesh has more than 300,000 triangles. Reduce the mesh complexity first.');
  const weld=opts.weldTolerance ?? 1e-5;
  const planeTolerance=opts.planeTolerance ?? .02;
  const normalDegrees=opts.normalDegrees ?? .6;
  if(!Number.isFinite(weld)||weld<=0||!Number.isFinite(planeTolerance)||planeTolerance<0)
    throw Error('Invalid region tolerance.');
  const cos=Math.cos(normalDegrees*Math.PI/180);
  const point=id=>[positions[3*id],positions[3*id+1],positions[3*id+2]];
  const weldMap=new Map(),vid=new Int32Array(positions.length/3);
  for(let i=0;i<vid.length;i++){
    const p=point(i);
    if(!p.every(Number.isFinite))throw Error('Nonfinite mesh coordinate.');
    const k=p.map(v=>Math.round(v/weld)).join(',');
    if(!weldMap.has(k))weldMap.set(k,weldMap.size);
    vid[i]=weldMap.get(k);
  }
  const edges=new Map(),normals=new Array(triangleCount),anchors=new Array(triangleCount);
  const neighbors=Array.from({length:triangleCount},()=>[]);
  for(let t=0;t<triangleCount;t++){
    const [a,b,c]=[indices[t*3],indices[t*3+1],indices[t*3+2]];
    if(![a,b,c].every(i=>Number.isInteger(i)&&i>=0&&i<vid.length)) throw Error('Mesh index out of range.');
    const pa=point(a),pb=point(b),pc=point(c),n=cross(sub(pb,pa),sub(pc,pa)),mag=norm(n);
    if(mag<1e-10)continue;
    normals[t]=n.map(v=>v/mag);anchors[t]=pa;
    const triplet=[vid[a],vid[b],vid[c]];
    for(let e=0;e<3;e++){
      const x=triplet[e],y=triplet[(e+1)%3];
      const key=x<y?x+':'+y:y+':'+x;
      if(!edges.has(key))edges.set(key,[]);
      edges.get(key).push(t);
    }
  }
  for(const entries of edges.values()){
    if(entries.length!==2)continue;
    const [a,b]=entries;
    neighbors[a].push(b);neighbors[b].push(a);
  }
  const triToRegion=new Int32Array(triangleCount).fill(-1), regions=[];
  for(let seed=0;seed<triangleCount;seed++){
    if(!normals[seed]||triToRegion[seed]!==-1)continue;
    const id=regions.length,queue=[seed],region={triangles:[],count:0},origin=anchors[seed],normal=normals[seed];
    triToRegion[seed]=id;
    for(let q=0;q<queue.length;q++){
      const t=queue[q];region.count++;
      region.triangles.push(indices[t*3],indices[t*3+1],indices[t*3+2]);
      for(const next of neighbors[t]){
        if(triToRegion[next]!==-1||!normals[next])continue;
        if(Math.abs(dot(normal,normals[next]))<cos)continue;
        let coplanar=true;
        for(let k=0;k<3;k++){
          const p=point(indices[next*3+k]);
          if(Math.abs(dot(normal,sub(p,origin)))>planeTolerance){coplanar=false;break;}
        }
        if(!coplanar)continue;
        triToRegion[next]=id;queue.push(next);
      }
    }
    regions.push(region);
  }
  return {regions,triToRegion};
}
