export async function validPreparedToken(header,secret){
 if(typeof secret!=='string'||secret.length<32||typeof header!=='string'||header.length>1024||!header.startsWith('Bearer '))return false;
 const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const [actual,expected]=await Promise.all([digest(header.slice(7)),digest(secret)]);let difference=0;
 for(let i=0;i<expected.length;i++)difference|=actual[i]^expected[i];
 return difference===0;
}
