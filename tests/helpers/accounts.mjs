// Gemeinsame Hilfen für die Kontotests: Umgebung, Anfragen wie aus dem Browser, Mails aus dem Dev-Postfach.
import {accountsMemoryDb,memoryDb} from './d1.mjs';
import {accountsConfig} from '../../server/accounts/config.mjs';
import {context} from '../../server/accounts/login.mjs';
import {resetLimits} from '../../server/accounts/rate-limit.mjs';

export const SITE='https://plenara.test';
export function setup({access='invite',openSignup=false,extraEnv={}}={}){
 resetLimits();
 const accounts=accountsMemoryDb(),content=memoryDb();
 const env={ACCOUNTS:accounts.db,DB:content.db,ACCOUNTS_SECRET:'test-secret-0123456789abcdef0123456789abcdef',SITE_URL:SITE,RM_ACCESS:access,MAIL_TRANSPORT:'outbox',ACCOUNTS_TEST_OUTBOX:'1',
  ...(openSignup?{ACCOUNTS_OPEN_SIGNUP:'1'}:{}),...extraEnv};
 const cfg=accountsConfig(env,{dev:false});
 const jar=new Map();
 let clock=Date.parse('2026-10-14T10:00:00Z');
 const h={accounts,content,env,cfg,jar,
  now:()=>clock,tick:ms=>{clock+=ms;},
  /** Anfrage wie aus dem Browser; Cookies aus dem Glas, Set-Cookie zurück ins Glas */
  async call(handler,{path='/api/x',method='POST',body,origin,host='plenara.test',proto='https',headers={},cookies,ip='203.0.113.7'}={}){
   const url=`${proto}://${host}${path}`;
   const cookieHeader=[...(cookies??jar)].map(([k,v])=>`${k}=${v}`).join('; ');
   const request=new Request(url,{method,headers:{'content-type':'application/json',origin:origin??`${proto}://${host}`,'x-forwarded-for':ip,cookie:cookieHeader,'user-agent':'Mozilla/5.0 (Windows NT 10.0) Firefox/130.0',...headers},
    body:method==='GET'||method==='HEAD'?undefined:JSON.stringify(body??{})});
   let result;
   try{result=await handler(context(request,env,{cfg,now:clock}));}
   catch(error){if(error?.status)return {status:error.status,body:{error:error.message,...(error.extra||{})},later:[]};throw error;}
   for(const line of result.response.headers.getSetCookie()){
    const [pair,...attrs]=line.split(';');const i=pair.indexOf('=');const name=pair.slice(0,i),value=pair.slice(i+1);
    if(!cookies){if(/max-age=0/i.test(attrs.join(';')))jar.delete(name);else jar.set(name,value);}
   }
   for(const task of result.later||[])await task();
   const text=await result.response.text();
   return {status:result.response.status,body:text?JSON.parse(text):null,headers:result.response.headers,setCookies:result.response.headers.getSetCookie()};
  },
  /** Letzte Mail an eine Adresse aus dem Dev-Postfach, mit Token und Code */
  lastMail(to){
   const row=accounts.sql.prepare('SELECT * FROM dev_mail WHERE "to"=? ORDER BY id DESC LIMIT 1').get(to);
   if(!row)return null;
   return {...row,token:row.text.match(/#t=([A-Za-z0-9_-]{43})/)?.[1],code:row.text.match(/(\d{4}) (\d{4})/)?.slice(1).join('')};
  },
  mails:to=>accounts.sql.prepare('SELECT * FROM dev_mail WHERE "to"=? ORDER BY id').all(to),
  addUser(email,{tier=null,admin=false,status='active'}={}){
   const id='u_'+email.replace(/\W/g,'');const at=new Date(clock).toISOString();
   accounts.sql.prepare('INSERT INTO users(id,email,email_verified_at,status,created_at) VALUES(?,?,?,?,?)').run(id,email,at,status,at);
   if(tier)accounts.sql.prepare("INSERT INTO plan_grants(user_id,tier,source,starts_at) VALUES(?,?,'manual',?)").run(id,tier,at);
   if(admin)accounts.sql.prepare("INSERT INTO user_roles(user_id,role,granted_at) VALUES(?,'admin',?)").run(id,at);
   return id;
  },
  invite(email,{tier='pro',until='2027-01-31T00:00:00.000Z'}={}){
   accounts.sql.prepare('INSERT INTO invites(email,tier,tier_until,note,created_at,expires_at) VALUES(?,?,?,?,?,?)').run(email,tier,until,'Test',new Date(clock).toISOString(),new Date(clock+30*86400000).toISOString());
  },
 };
 return h;
}
