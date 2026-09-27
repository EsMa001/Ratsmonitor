/** Decode one territory at a time, after the database lease is held. */
export function loadBackfill(packed){
 async function* results(){
  for(const part of packed.parts){
   const bytes=Uint8Array.from(atob(part.data),c=>c.charCodeAt(0));
   const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
   const result=await new Response(stream).json();
   if(result.coverage?.regionId!==part.regionId||!Array.isArray(result.topics))throw Error('Ungültiges historisches Gebietspaket');
   yield result;
  }
 }
 return {revision:packed.revision,results:results()};
}
