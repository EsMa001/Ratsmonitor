// Versand über SMTP (MAIL_TRANSPORT=smtp, etwa das Postfach kontakt@plenara.de bei IONOS: smtp.ionos.de, Port 465, TLS).
// Bewusst klein und ohne Abhängigkeit: eine Mail je Verbindung, AUTH PLAIN, Text- und HTML-Teil. Die Netzmodule werden erst
// beim Versand geladen (wie in document-proxy.mjs), damit andere Builds (Cloudflare) sie nicht bündeln.

/** Kopfzeile nach RFC 2047 (UTF-8, Base64), nur wenn nötig */
const header=value=>/^[\x20-\x7e]*$/.test(value)?value:`=?UTF-8?B?${Buffer.from(value,'utf8').toString('base64')}?=`;
/** Base64 in Zeilen zu 76 Zeichen */
const b64=text=>Buffer.from(text,'utf8').toString('base64').replace(/.{76}/g,'$&\r\n');
/** Absender „Name <adresse>“ in Name und Adresse */
export function parseAddress(value){
 const m=String(value||'').match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
 return m?{name:m[1].replace(/^"|"$/g,''),address:m[2].trim()}:{name:'',address:String(value||'').trim()};
}
const formatAddress=({name,address})=>name?`${header(name)} <${address}>`:address;

/** Die Mail als Text (Kopf und Körper, CRLF, ohne Punkt-Verdopplung) */
/** headers: weitere Kopfzeilen (List-Unsubscribe …), nur ASCII, ohne Zeilenumbruch */
export function buildMessage({from,to,replyTo,subject,text,html,headers={},now=Date.now(),id}){
 const f=parseAddress(from),boundary='plenara-'+id.split('@')[0];
 const lines=[
  `From: ${formatAddress(f)}`,`To: ${to}`,...(replyTo?[`Reply-To: ${replyTo}`]:[]),`Subject: ${header(subject)}`,
  `Date: ${new Date(now).toUTCString().replace('GMT','+0000')}`,`Message-ID: <${id}>`,'MIME-Version: 1.0',
  ...Object.entries(headers||{}).filter(([k,v])=>/^[A-Za-z][A-Za-z0-9-]*$/.test(k)&&/^[\x20-\x7e]*$/.test(String(v))).map(([k,v])=>`${k}: ${v}`),
 ];
 if(html){
  lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`,'',
   `--${boundary}`,'Content-Type: text/plain; charset=utf-8','Content-Transfer-Encoding: base64','',b64(text||''),
   `--${boundary}`,'Content-Type: text/html; charset=utf-8','Content-Transfer-Encoding: base64','',b64(html),
   `--${boundary}--`);
 }else lines.push('Content-Type: text/plain; charset=utf-8','Content-Transfer-Encoding: base64','',b64(text||''));
 return lines.join('\r\n');
}

/**
 * Eine Mail verschicken. options: {host, port, secure (TLS ab Verbindungsbeginn, Port 465), user, pass, timeoutMs}.
 * connect(options) liefert für Tests einen eigenen Socket. Rückgabe: Message-ID. Wirft bei jeder Antwort außer 2xx/3xx.
 */
export async function sendSmtp({host,port=465,secure=true,user,pass,timeoutMs=20000,connect},{from,to,replyTo,subject,text,html,headers,now=Date.now()}){
 if(!host||!user||!pass)throw new Error('SMTP_HOST, SMTP_USER oder Passwort fehlt');
 const sender=parseAddress(from).address;
 const id=`${now.toString(36)}.${Math.random().toString(36).slice(2,10)}@${sender.split('@')[1]||'plenara.de'}`;
 let socket;
 if(connect)socket=await connect({host,port,secure});
 else{
  const name=secure?'node:tls':'node:net',mod=await import(/* @vite-ignore */ name);
  socket=await new Promise((resolve,reject)=>{
   const s=secure?mod.connect({host,port,servername:host}):mod.connect({host,port});
   s.once(secure?'secureConnect':'connect',()=>resolve(s));s.once('error',reject);
  });
 }
 socket.setEncoding?.('utf8');
 let buffer='',waiting=null;
 const timer=setTimeout(()=>{socket.destroy?.(new Error('SMTP: Zeitüberschreitung'));},timeoutMs);
 const fail=error=>{if(waiting){const w=waiting;waiting=null;w.reject(error);}};
 socket.on('error',fail);socket.on('close',()=>fail(new Error('SMTP: Verbindung geschlossen')));
 // Antwort lesen: Zeilen bis zur letzten (Code gefolgt von Leerzeichen)
 const tryRead=()=>{
  if(!waiting)return;
  const lines=buffer.split('\r\n');
  for(let i=0;i<lines.length-1;i++){
   if(/^\d{3} /.test(lines[i])||/^\d{3}$/.test(lines[i])){
    const reply=lines.slice(0,i+1).join('\n');buffer=lines.slice(i+1).join('\r\n');
    const w=waiting;waiting=null;w.resolve({code:Number(lines[i].slice(0,3)),text:reply});return;
   }
  }
 };
 socket.on('data',chunk=>{buffer+=chunk;tryRead();});
 const read=()=>new Promise((resolve,reject)=>{waiting={resolve,reject};tryRead();});
 const step=async(command,ok)=>{
  if(command!==null)socket.write(command+'\r\n');
  const r=await read();
  if(!ok.includes(Math.floor(r.code/100))&&!ok.includes(r.code))throw new Error(`SMTP ${r.code} auf ${command===null?'Begrüßung':command.split(' ')[0]}: ${r.text.slice(0,120)}`);
  return r;
 };
 try{
  await step(null,[2]);
  await step('EHLO plenara.de',[2]);
  await step('AUTH PLAIN '+Buffer.from(`\0${user}\0${pass}`,'utf8').toString('base64'),[2]);
  await step(`MAIL FROM:<${sender}>`,[2]);
  await step(`RCPT TO:<${to}>`,[2]);
  await step('DATA',[3]);
  // Punkt-Verdopplung am Zeilenanfang, Ende mit <CRLF>.<CRLF>
  const body=buildMessage({from,to,replyTo,subject,text,html,headers,now,id}).replace(/(^|\r\n)\./g,'$1..');
  await step(body+'\r\n.',[2]);
  await step('QUIT',[2]).catch(()=>{});
  return id;
 }finally{clearTimeout(timer);socket.end?.();}
}
