import test from 'node:test';
import assert from 'node:assert/strict';
import {X509Certificate} from 'node:crypto';
import tls from 'node:tls';
import {INTERMEDIATES,addIntermediates} from '../server/integrations/intermediate-cas.mjs';

test('intermediate certificates: public CA certificates, valid, never a root, added once to the default list',()=>{
 for(const pem of INTERMEDIATES){
  const c=new X509Certificate(pem);
  assert.equal(c.ca,true,c.subject);
  assert.notEqual(c.subject,c.issuer,'keine Wurzel: '+c.subject);
  assert.ok(new Date(c.validTo)>new Date(),'gültig: '+c.subject);
 }
 if(typeof tls.setDefaultCACertificates!=='function')return;
 const fp=pem=>new X509Certificate(pem).fingerprint256;
 assert.equal(addIntermediates(),true);
 assert.equal(addIntermediates(),false);
 const now=new Set(tls.getCACertificates('default').map(fp));
 for(const pem of INTERMEDIATES)assert.ok(now.has(fp(pem)),new X509Certificate(pem).subject);
});
