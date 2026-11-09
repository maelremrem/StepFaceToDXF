export async function readFileWithProgress(file,{onProgress=()=>{},signal}={}) {
  const total=file.size;
  const aborted=()=>{if(signal?.aborted)throw new DOMException('Import cancelled','AbortError');};
  aborted();
  if(!file.stream){
    const buffer=await file.arrayBuffer();
    aborted();
    onProgress(buffer.byteLength,total);
    return buffer;
  }
  const reader=file.stream().getReader();
  const bytes=new Uint8Array(total);
  let received=0;
  const cancel=()=>{void reader.cancel().catch(()=>{});};
  signal?.addEventListener('abort',cancel,{once:true});
  try{
    onProgress(0,total);
    while(true){
      aborted();
      const {done,value}=await reader.read();
      aborted();
      if(done)break;
      if(received+value.byteLength>total)throw Error('File stream exceeds reported size.');
      bytes.set(value,received);
      received+=value.byteLength;
      onProgress(received,total);
    }
    if(received!==total)throw Error('File read was incomplete.');
    return bytes.buffer;
  }finally{
    signal?.removeEventListener('abort',cancel);
    reader.releaseLock();
  }
}
