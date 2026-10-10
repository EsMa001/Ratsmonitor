// E5 and E6 of the code analysis: patterns over foreign text stay linear; internal tokens are compared in constant time.
import test from 'node:test';
import assert from 'node:assert/strict';
import {extractPassages} from '../server/integrations/documents.mjs';
import {htmlToLines} from '../server/integrations/website-text.mjs';
import {parseRobots,robotsAllow,robotsPathMatches} from '../server/integrations/robots.mjs';
import {validBearer,validPreparedToken} from '../server/integrations/prepared-access.mjs';

const timed=fn=>{const t=performance.now();const r=fn();return [r,performance.now()-t];};

test('passages of a document without sentence ends are found in linear time, sentences as before',()=>{
 const [none,ms]=timed(()=>extractPassages('Sachverhalt: '+'wort '.repeat(12000)));
 assert.ok(ms<500,'60.000 Zeichen ohne Satzzeichen: '+Math.round(ms)+' ms');assert.deepEqual(none,[]);
 const text='Beschlussvorschlag: Der Rat beschließt den Neubau der Grundschule am Standort Nord mit einem Kostenrahmen von vier Millionen Euro. Die Verwaltung wird beauftragt, die Planung bis zum Frühjahr vorzulegen und den Förderantrag beim Land zu stellen! Abs. 3 gilt entsprechend für den Ausbau der Mensa im Jahr 2027 mit allen Nebenanlagen? Seite 2';
 const passages=extractPassages(text);
 assert.equal(passages.length,3);assert.match(passages[0],/^Beschlussvorschlag: Der Rat beschließt/);assert.match(passages[1],/^Die Verwaltung/);assert.match(passages[2],/^3 gilt entsprechend/,'"Abs." ends a sentence, as before');
});

test('a tag followed by a long run of spaces does not stall the page reader',()=>{
 const [lines,ms]=timed(()=>htmlToLines('<html><body><p>Vorher</p><a '+' '.repeat(60000)+'>Link</a><p>Nachher</p></body></html>'));
 assert.ok(ms<500,'60.000 Leerzeichen: '+Math.round(ms)+' ms');
 assert.deepEqual(lines,['Vorher','Link','Nachher']);
 // Empty elements are still read by their title.
 assert.match(htmlToLines('<p>Teil <abbr title="nichtöffentlich"></abbr> Ende</p>').join(' '),/nichtöffentlich/);
});

test('robots.txt rules with many wildcards are matched without a regular expression',()=>{
 assert.equal(robotsPathMatches('/bi/','/bi/si010.asp'),true);assert.equal(robotsPathMatches('/bi/','/ris/'),false);
 assert.equal(robotsPathMatches('/*.pdf$','/doc/a.pdf'),true);assert.equal(robotsPathMatches('/*.pdf$','/doc/a.pdf?x'),false);
 assert.equal(robotsPathMatches('/*.pdf','/doc/a.pdf?x'),true);assert.equal(robotsPathMatches('/a*b*c','/axxbyyc'),true);assert.equal(robotsPathMatches('/a*b*c','/axxcyyb'),false);
 assert.equal(robotsPathMatches('/','/anything'),true);assert.equal(robotsPathMatches('/$','/anything'),false);assert.equal(robotsPathMatches('/$','/'),true);
 assert.equal(robotsPathMatches('/a.b','/a.b'),true);assert.equal(robotsPathMatches('/a.b','/axb'),false,'a dot is a dot, not any character');
 const rule='/'+'*a'.repeat(30)+'*$',path='/'+'a'.repeat(400)+'b';
 const [verdict,ms]=timed(()=>robotsAllow(parseRobots('User-agent: *\nDisallow: '+rule+'\n'),path,['vorort-politicaltopics']));
 assert.ok(ms<200,'30 Sterne: '+Math.round(ms)+' ms');assert.equal(verdict,false);
 assert.equal(robotsAllow(parseRobots('User-agent: *\nDisallow: /bi/*$\nAllow: /bi/si010'),'/bi/si010.asp',['x']),true,'the longer rule wins as before');
});

test('internal tokens are checked whole, never with an early exit, and never when too short',async()=>{
 const secret='s'.repeat(16)+'-geheim';
 assert.equal(await validBearer('Bearer '+secret,secret,16),true);
 assert.equal(await validBearer('Bearer '+secret.slice(0,-1)+'x',secret,16),false);
 assert.equal(await validBearer('Bearer '+secret,'kurz',16),false,'a short secret counts as not set');
 assert.equal(await validBearer('Bearer '+secret,'',16),false);assert.equal(await validBearer(null,secret,16),false);assert.equal(await validBearer(secret,secret,16),false,'without the scheme');
 assert.equal(await validPreparedToken('Bearer '+secret,secret),false,'prepared tokens need 32 characters');
 const long='p'.repeat(40);assert.equal(await validPreparedToken('Bearer '+long,long),true);
});
