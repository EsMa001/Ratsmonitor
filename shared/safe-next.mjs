// Ziel nach der Anmeldung: nur eigene, bekannte Pfade (requirements/konten-konzept.md, Abschnitt 11).
// Geprüft wird NACH der Normalisierung durch URL: '/.//x' wird sonst zu '//x' (andere Origin im Browser).
const PREFIXES=['/suche','/konto','/beschluss/','/thema/','/analytics','/admin','/lena','/preise','/datenabdeckung'];
export function safeNext(value){
 if(typeof value!=='string'||!value.startsWith('/')||value.length>500)return '/';
 if(/[\u0000-\u001f\u007f\\]/.test(value))return '/';
 let url;
 try{url=new URL(value,'https://app.local');}catch{return '/';}
 if(url.origin!=='https://app.local')return '/';
 const result=url.pathname+url.search+url.hash;
 if(!result.startsWith('/')||/^\/[/\\]/.test(result))return '/';
 if(result==='/'||result.startsWith('/?')||result.startsWith('/#'))return result;
 if(url.pathname.startsWith('/anmelden'))return '/';
 return PREFIXES.some(p=>url.pathname===p.replace(/\/$/,'')||url.pathname.startsWith(p.endsWith('/')?p:p+'/')||url.pathname===p)?result:'/';
}
