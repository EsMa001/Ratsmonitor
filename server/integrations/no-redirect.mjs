// Every request to a source names this project. The Workers runtime sends no User-Agent on its own, and some
// providers answer requests without one with HTTP 403.
export const SOURCE_USER_AGENT='VorOrt-PoliticalTopics/0.5 (public council information)';
/**
 * fetch that refuses every redirect. Cloudflare Workers reject `redirect:'error'` ("Invalid redirect value"),
 * so the request uses 'manual' and the refusal happens here. Works the same in Node and in the Workers runtime.
 */
export async function fetchNoRedirect(url,init={},request=fetch){
 const r=await request(url,{...init,redirect:'manual'});
 if(r.type==='opaqueredirect'||(r.status>=300&&r.status<400)){await r.body?.cancel();throw Error('Unerwartete Weiterleitung der Quelle (HTTP '+r.status+')');}
 return r;
}
