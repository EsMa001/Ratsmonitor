// Versand über SMTP (server/accounts/smtp.mjs): Ablauf gegen einen kleinen Testserver ohne TLS, Aufbau der Mail.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {sendSmtp,buildMessage,parseAddress} from '../server/accounts/smtp.mjs';
import {accountsConfig} from '../server/accounts/config.mjs';

/** Testserver: antwortet nach Drehbuch, merkt sich Befehle und den Inhalt nach DATA */
function fakeServer({authOk=true}={}){
 const seen={commands:[],data:''};
 const server=net.createServer(socket=>{
  socket.setEncoding('utf8');let buf='',inData=false;
  socket.write('220 test ESMTP\r\n');
  socket.on('data',chunk=>{
   buf+=chunk;
   for(;;){
    if(inData){const end=buf.indexOf('\r\n.\r\n');if(end<0)return;seen.data=buf.slice(0,end);buf=buf.slice(end+5);inData=false;socket.write('250 2.0.0 Ok: queued\r\n');continue;}
    const i=buf.indexOf('\r\n');if(i<0)return;
    const line=buf.slice(0,i);buf=buf.slice(i+2);seen.commands.push(line.split(' ')[0]);
    if(line.startsWith('EHLO'))socket.write('250-test\r\n250 AUTH PLAIN LOGIN\r\n');
    else if(line.startsWith('AUTH'))socket.write(authOk?'235 2.7.0 Authentication successful\r\n':'535 5.7.8 Authentication failed\r\n');
    else if(line.startsWith('MAIL')||line.startsWith('RCPT'))socket.write('250 2.1.0 Ok\r\n');
    else if(line==='DATA'){inData=true;socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');}
    else if(line==='QUIT'){socket.write('221 2.0.0 Bye\r\n');socket.end();}
   }
  });
 });
 return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve({server,seen,port:server.address().port})));
}
const mail={from:'Plenara <kontakt@plenara.de>',to:'max@example.org',replyTo:'kontakt@plenara.de',subject:'Ihr Anmeldelink für Plenara',text:'Hallo\n.\nPunkt am Zeilenanfang',html:'<p>Hallo</p>'};

test('SMTP: Anmeldung, Absender, Empfänger, Inhalt mit Punkt-Verdopplung, Ende mit QUIT',async()=>{
 const {server,seen,port}=await fakeServer();
 try{
  const id=await sendSmtp({host:'127.0.0.1',port,secure:false,user:'kontakt@plenara.de',pass:'geheim'},mail);
  assert.match(id,/@plenara\.de$/);
  assert.deepEqual(seen.commands,['EHLO','AUTH','MAIL','RCPT','DATA','QUIT']);
  assert.match(seen.data,/^From: Plenara <kontakt@plenara\.de>\r\n/);
  assert.match(seen.data,/Subject: =\?UTF-8\?B\?/,'Umlaut im Betreff kodiert');
  assert.match(seen.data,/Reply-To: kontakt@plenara\.de/);
  assert.match(seen.data,/multipart\/alternative/);
 }finally{server.close();}
});

test('SMTP: falsches Passwort und fehlende Angaben werfen, ohne das Passwort zu nennen',async()=>{
 const {server,port}=await fakeServer({authOk:false});
 try{
  await assert.rejects(sendSmtp({host:'127.0.0.1',port,secure:false,user:'kontakt@plenara.de',pass:'geheim'},mail),e=>/SMTP 535 auf AUTH/.test(e.message)&&!e.message.includes('geheim'));
  await assert.rejects(sendSmtp({host:'127.0.0.1',port,secure:false,user:'',pass:''},mail),/fehlt/);
 }finally{server.close();}
});

test('Mailaufbau und Einstellungen: Absender zerlegt, Passwort aus Base64, IONOS als Vorgabe',()=>{
 assert.deepEqual(parseAddress('Plenara <kontakt@plenara.de>'),{name:'Plenara',address:'kontakt@plenara.de'});
 const m=buildMessage({...mail,id:'abc@plenara.de',now:Date.parse('2026-10-19T10:00:00Z')});
 assert.match(m,/Message-ID: <abc@plenara\.de>/);
 const cfg=accountsConfig({MAIL_TRANSPORT:'smtp',SMTP_USER:'kontakt@plenara.de',SMTP_PASSWORD_B64:Buffer.from('ä$"\'x','utf8').toString('base64')},{dev:false});
 assert.equal(cfg.mail.transport,'smtp');
 assert.deepEqual({...cfg.mail.smtp},{host:'smtp.ionos.de',port:465,secure:true,user:'kontakt@plenara.de',pass:'ä$"\'x'});
});
