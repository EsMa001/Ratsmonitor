// ETags of the reading admin routes (admin-http.ts), without imports of the worker, so tests can load it.
const bare=t=>t.trim().replace(/^W\//,'');
/** Whether an If-None-Match header names the ETag (weak comparison, list or "*"). */
export const etagMatches=(header,etag)=>!!header&&(header.trim()==='*'||header.split(',').some(t=>bare(t)===bare(etag)));
/** FNV-1a (32 bit, hex) over the parts joined by '|'. */
export function fnv(parts){let h=0x811c9dc5;for(const c of parts.join('|')){h^=c.charCodeAt(0);h=Math.imul(h,0x01000193)>>>0;}return h.toString(16);}
/**
 * Answer of a reading route: 304 without building the body if If-None-Match names the tag; otherwise the body (an object
 * or ready JSON text) with its ETag. tag() must be cheap (a few small queries); build() runs only when needed.
 * @param {Request} request
 * @param {()=>Promise<string>} tag
 * @param {()=>Promise<unknown>} build
 * @param {Record<string,string>} headers
 */
export async function readResponse(request,tag,build,headers){
 const etag=`W/"${await tag()}"`;
 if(etagMatches(request.headers.get('If-None-Match'),etag))return new Response(null,{status:304,headers:{...headers,ETag:etag}});
 const body=await build();
 return typeof body==='string'
  ?new Response(body,{headers:{...headers,ETag:etag,'Content-Type':'application/json; charset=utf-8'}})
  :Response.json(body,{headers:{...headers,ETag:etag}});
}
