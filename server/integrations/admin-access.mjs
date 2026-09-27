const OWNER_KEY='admin-owner-v1';
export class AdminError extends Error{constructor(status,message){super(message);this.status=status;}}
export async function adminAccess(db,user){
 if(!user?.userId)return {kind:'anonymous'};
 if(!db)throw new AdminError(503,'Die Datenbank ist momentan nicht erreichbar.');
 const row=await db.prepare('SELECT value FROM system_state WHERE key=?').bind(OWNER_KEY).first();
 if(!row)return {kind:'setup'};
 return {kind:JSON.parse(row.value).userId===user.userId?'owner':'denied'};
}
export async function requireAdminAccess(db,user){
 const access=await adminAccess(db,user);
 if(access.kind!=='owner')throw new AdminError(access.kind==='anonymous'?401:403,access.kind==='setup'?'Der Admin-Zugang muss zuerst freigeschaltet werden.':'Kein Zugriff auf die Administration.');
 return user;
}
export function requireSameOrigin(request){
 if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')throw new AdminError(403,'Diese Aktion muss direkt in der Administration gestartet werden.');
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new AdminError(415,'JSON-Anfrage erforderlich.');
}
export async function claimAdmin(db,user,code,expectedHash){
 const access=await adminAccess(db,user);
 if(access.kind==='anonymous')throw new AdminError(401,'Bitte zuerst mit ChatGPT anmelden.');
 if(access.kind!=='setup')throw new AdminError(409,'Der Admin-Zugang wurde bereits vergeben.');
 if(!/^[a-f0-9]{64}$/.test(expectedHash||''))throw new AdminError(503,'Die einmalige Freischaltung ist noch nicht eingerichtet.');
 if(typeof code!=='string'||code.length>128)throw new AdminError(400,'Ungültiger Freischaltcode.');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code.trim()));
 const actual=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
 let different=0;for(let i=0;i<64;i++)different|=actual.charCodeAt(i)^expectedHash.charCodeAt(i);
 if(different)throw new AdminError(403,'Der Freischaltcode stimmt nicht.');
 // The first successful claim binds a verified, Site-specific identity exactly once.
 const saved=await db.prepare('INSERT OR IGNORE INTO system_state(key,value) VALUES(?,?) RETURNING value').bind(OWNER_KEY,JSON.stringify({userId:user.userId,createdAt:new Date().toISOString()})).first();
 if(!saved)throw new AdminError(409,'Der Admin-Zugang wurde bereits vergeben.');
 return {claimed:true};
}
