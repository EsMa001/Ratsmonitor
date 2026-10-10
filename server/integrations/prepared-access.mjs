/** Bearer token of a prepared-analysis or export request: a secret of at least 32 characters, compared in constant time. */
export const validPreparedToken=(header,secret)=>validBearer(header,secret,32);
/**
 * Whether the Authorization header carries the secret: the digests of both are compared whole, so the time taken
 * tells nothing about how many leading characters were right. A secret shorter than minLength never validates.
 */
export async function validBearer(header,secret,minLength){
 if(typeof secret!=='string'||secret.length<minLength||typeof header!=='string'||header.length>1024||!header.startsWith('Bearer '))return false;
 const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const [actual,expected]=await Promise.all([digest(header.slice(7)),digest(secret)]);let difference=0;
 for(let i=0;i<expected.length;i++)difference|=actual[i]^expected[i];
 return difference===0;
}
