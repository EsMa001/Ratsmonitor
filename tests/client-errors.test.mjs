// Fehler aus dem Browser: nur bekannte Felder, gekürzt, Seite ohne Suchparameter; Mengenbegrenzung; nur gleiche Herkunft.
import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanReport,makeLimiter,sameOrigin} from '../server/integrations/client-errors.mjs';

test('a report keeps only known fields, cuts them and drops search parameters from the page',()=>{
 const r=cleanReport({kind:'rejection',message:'x'.repeat(500),stack:'a\nb',page:'/suche?q=Privates&ort=05#treffer',browser:'Safari',email:'a@b.de'});
 assert.equal(r.kind,'rejection');assert.equal(r.message.length,300);assert.equal(r.stack,'a b');assert.equal(r.page,'/suche');
 assert.equal('email' in r,false);
 assert.equal(cleanReport({message:''}),null);assert.equal(cleanReport(null),null);
 assert.equal(cleanReport({kind:'boom',message:'m'}).kind,'error');
});

test('the limiter lets PER_MINUTE reports through per minute and starts again in the next one',()=>{
 let t=0;const allow=makeLimiter(2,()=>t);
 assert.deepEqual([allow(),allow(),allow()],[true,true,false]);
 t=60000;assert.equal(allow(),true);
});

test('only the same origin may report',()=>{
 const req=(origin,site='same-origin')=>({url:'https://plenara.de/api/client-error',headers:new Headers({...(origin?{origin}:{}),'sec-fetch-site':site})});
 assert.equal(sameOrigin(req('https://plenara.de')),true);
 assert.equal(sameOrigin(req('https://boese.example')),false);
 assert.equal(sameOrigin(req(null)),false);
 assert.equal(sameOrigin(req('https://plenara.de','cross-site')),false);
});
