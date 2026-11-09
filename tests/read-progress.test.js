import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileWithProgress} from '../src/read-progress.js';

const fileFromChunks=(chunks)=>{
  const size=chunks.reduce((n,chunk)=>n+chunk.length,0);
  return {size,stream:()=>new ReadableStream({
    start(controller){
      for(const chunk of chunks)controller.enqueue(Uint8Array.from(chunk));
      controller.close();
    }
  })};
};
test('stream reader reports actual loaded bytes and produces intact ArrayBuffer',async()=>{
  const progress=[],file=fileFromChunks([[1,2],[3,4],[5]]);
  const buf=await readFileWithProgress(file,{onProgress:(done,total)=>progress.push([done,total])});
  assert.deepEqual([...new Uint8Array(buf)],[1,2,3,4,5]);
  assert.deepEqual(progress,[[0,5],[2,5],[4,5],[5,5]]);
});
test('abort interrupts reading',async()=>{
  const controller=new AbortController(),file=fileFromChunks([[1,2],[3,4]]);
  await assert.rejects(readFileWithProgress(file,{signal:controller.signal,
    onProgress:(done)=>{if(done===2)controller.abort();}
  }),error=>error.name==='AbortError');
});
test('fallback read reports completion, without inventing increments',async()=>{
  const logs=[];
  const b=await readFileWithProgress({size:3,arrayBuffer:async()=>Uint8Array.from([1,2,3]).buffer},
    {onProgress:(n,total)=>logs.push([n,total])});
  assert.equal(b.byteLength,3);
  assert.deepEqual(logs,[[3,3]]);
});
