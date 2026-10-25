/** Deform only the cap of our millimetre-scale GLBs; leave the girdle/back intact. */
export async function domeModel(source: string, height: number, _profile: string, signal: AbortSignal): Promise<Blob> {
  const response = await fetch(source, { signal });
  if (!response.ok) throw new Error("Model unavailable");
  const buffer = await response.arrayBuffer();
  const view = new DataView(buffer);
  const jsonLength = view.getUint32(12, true);
  const doc = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
  const binStart = 28 + jsonLength;
  const accessor = (index: number) => {
    const a = doc.accessors[index], b = doc.bufferViews[a.bufferView];
    return { a, offset: binStart + (b.byteOffset || 0) + (a.byteOffset || 0), stride: b.byteStride || (a.type === "VEC3" ? 12 : a.componentType === 5125 ? 4 : 2) };
  };
  const done = new Set<number>();
  for (const mesh of doc.meshes) for (const p of mesh.primitives) {
    const pos = accessor(p.attributes.POSITION);
    if (done.has(p.attributes.POSITION)) continue;
    done.add(p.attributes.POSITION);
    const normal = accessor(p.attributes.NORMAL);
    const originalHeight = pos.a.max?.[1] ?? .004;
    const rim = originalHeight * .2;
    const points: number[][] = [], sums = Array.from({ length: pos.a.count }, () => [0,0,0]);
    for (let i=0;i<pos.a.count;i++) {
      const at=pos.offset+i*pos.stride;
      const x=view.getFloat32(at,true), y=view.getFloat32(at+4,true), z=view.getFloat32(at+8,true);
      const cap=Math.max(0, Math.min(1,(y-rim)/(originalHeight-rim)));
      // These GLBs retain a node rotation: local Y is thickness, X/Z are the outline.
      // Keep the existing cap curvature; all presets differ only in height.
      const next=y>rim ? rim+height/1000*cap : y;
      points.push([x,next,z]); view.setFloat32(at+4,next,true);
    }
    if (p.indices !== undefined) {
      const ind=accessor(p.indices);
      const get=(i:number) => ind.a.componentType===5125 ? view.getUint32(ind.offset+i*ind.stride,true) : ind.a.componentType===5121 ? view.getUint8(ind.offset+i*ind.stride) : view.getUint16(ind.offset+i*ind.stride,true);
      for(let i=0;i<ind.a.count;i+=3) {
        const ids=[get(i),get(i+1),get(i+2)], [a,b,c]=ids.map(n=>points[n]);
        const u=b.map((n,j)=>n-a[j]), v=c.map((n,j)=>n-a[j]);
        const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
        for(const id of ids) for(let j=0;j<3;j++) sums[id][j]+=n[j];
      }
      sums.forEach((n,i)=>{const length=Math.hypot(...n)||1; n.forEach((v,j)=>view.setFloat32(normal.offset+i*normal.stride+j*4,v/length,true));});
    }
    pos.a.min=[0,1,2].map(j=>Math.min(...points.map(p=>p[j])));
    pos.a.max=[0,1,2].map(j=>Math.max(...points.map(p=>p[j])));
  }
  const encoded=new TextEncoder().encode(JSON.stringify(doc));
  const padded=Math.ceil(encoded.length/4)*4;
  const binary=new Uint8Array(buffer,binStart);
  const output=new ArrayBuffer(28+padded+binary.length), result=new DataView(output);
  result.setUint32(0,0x46546c67,true); result.setUint32(4,2,true); result.setUint32(8,output.byteLength,true);
  result.setUint32(12,padded,true); result.setUint32(16,0x4e4f534a,true);
  new Uint8Array(output,20,padded).fill(32); new Uint8Array(output,20,encoded.length).set(encoded);
  result.setUint32(20+padded,binary.length,true); result.setUint32(24+padded,0x004e4942,true);
  new Uint8Array(output,28+padded).set(binary);
  return new Blob([output],{type:"model/gltf-binary"});
}
