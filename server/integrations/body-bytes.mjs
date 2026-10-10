/**
 * Bodies of answers from sources, read with a limit: a source that sends more than the reader may hold (a broken
 * server, an endless body) ends the request at the limit instead of filling the memory of the process until the
 * timeout (E1 of the code analysis of 10.10.2026). Used by every reader that buffers an answer.
 */
export const TOO_LARGE='Quelldokument zu groß';
/**
 * The body as bytes, at most `limit` of them; beyond it the body is cancelled and an error with `message` thrown.
 * A declared Content-Length above the limit is refused before anything is read.
 */
export async function bodyBytes(r,limit,{message=TOO_LARGE}={}){
 if(Number(r.headers.get('content-length'))>limit){await r.body?.cancel();throw Error(message);}
 if(!r.body){const b=new Uint8Array(await r.arrayBuffer());if(b.byteLength>limit)throw Error(message);return b;}
 // Read in parts so that a server without Content-Length cannot make us hold more than the limit.
 const reader=r.body.getReader(),parts=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error(message);}parts.push(value);}
 const out=new Uint8Array(size);let at=0;for(const p of parts){out.set(p,at);at+=p.byteLength;}return out;
}
/** The body as UTF-8 text, at most `limit` bytes (see bodyBytes). */
export async function bodyText(r,limit,options){return new TextDecoder().decode(await bodyBytes(r,limit,options));}
/** The body as JSON, at most `limit` bytes (see bodyBytes). */
export async function bodyJson(r,limit,options){return JSON.parse(await bodyText(r,limit,options));}
