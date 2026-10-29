import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TOPIC_ID,safeIdPart,safeTopicId,withSafeTopicIds} from '../shared/topic-identity.mjs';
import {mergeImport} from '../server/integrations/merge-import.mjs';
import {parseKomfaAgenda} from '../server/integrations/komfa.mjs';

// Only a topic whose id matches TOPIC_ID can be opened (getTopic, saved articles). Ids a reader builds from raw values of
// the source must match it; ids that match it already must stay as they are, or the next import adds a second topic.
test('a valid id part and a valid id stay exactly as they are',()=>{
 for(const v of ['12345','63-26','22-1665.01','505_64282','A12','vo:7'])assert.equal(safeIdPart(v),v);
 for(const id of ['nrw-05113000-vo-505_64282','de-08315-top-200_8783','nrw-05158028-vo-A12','hh-22-1665.01','x'.repeat(200)])assert.equal(safeTopicId(id),id);
});
test('umlauts are written out, other characters become a dash, a value without any allowed character its checksum',()=>{
 assert.equal(safeIdPart('Vorlage Ö/12'),'Vorlage-Oe-12');
 assert.equal(safeIdPart('Straße 1'),'Strasse-1');
 assert.equal(safeIdPart('Résumé'),'Resume');
 assert.match(safeIdPart('中文'),/^[0-9a-f]{8}$/);
 assert.notEqual(safeIdPart('中文'),safeIdPart('日本'));
 assert.equal(safeTopicId('de-1-kf-vo-Ä 1'),'de-1-kf-vo-Ae-1');
});
test('an id over 200 characters is cut with a checksum: valid, stable and distinct',()=>{
 const a='de-1-rp-vo-'+'x'.repeat(250)+'a',b='de-1-rp-vo-'+'x'.repeat(250)+'b';
 assert.ok(TOPIC_ID.test(safeTopicId(a)));
 assert.equal(safeTopicId(a),safeTopicId(a));
 assert.notEqual(safeTopicId(a),safeTopicId(b));
 assert.ok(TOPIC_ID.test(safeTopicId('de-1-kf-vo-'+'Ä'.repeat(150))));
});
test('the import rewrites ids that cannot be opened, also the target of an alias, and warns once',()=>{
 const t=(id,extra={})=>({id,regionId:'de-1',title:'T',status:'unknown',events:[{date:'2026-10-01',committee:'Rat',status:'unknown',url:'https://example.org/s/'+encodeURIComponent(id)}],documents:[],...extra});
 const {topics,changed}=withSafeTopicIds([t('de-1-vo-Ü 1'),t('de-1-vo-2',{identity:{mergedInto:'de-1-vo-Ü 1'}}),t('de-1-vo-3')]);
 assert.deepEqual(topics.map(x=>x.id),['de-1-vo-Ue-1','de-1-vo-2','de-1-vo-3']);
 assert.equal(topics[1].identity.mergedInto,'de-1-vo-Ue-1');
 assert.deepEqual(changed,[['de-1-vo-Ü 1','de-1-vo-Ue-1']]);
 const merged=mergeImport({topics:[],coverage:{}},{topics:[t('de-1-vo-Ü 1'),t('de-1-vo-'+'9'.repeat(300))],coverage:{importedAt:'2026-10-29T00:00:00Z'}});
 assert.ok(merged.topics.every(x=>TOPIC_ID.test(x.id)));
 assert.equal(merged.coverage.warnings.length,1);
 assert.match(merged.coverage.warnings[0],/^2 Vorgangs-IDs/);
 // Valid ids pass without a warning.
 assert.equal(mergeImport({topics:[],coverage:{}},{topics:[t('de-1-vo-1')],coverage:{}}).coverage.warnings,undefined);
});
test('KOMFA: a reference with an umlaut gives an id that can be opened; references without one keep their id',()=>{
 const source={id:'de-14730070',name:'Stadt Delitzsch',kind:'city',method:'scraper',adapter:'komfa',base:'https://ris-delitzsch.komfa.de/'};
 const meeting={url:source.base+'index.php?module=komfaris&action=to&id=X',date:'2026-09-24',title:'Stadt Delitzsch, Stadtrat'};
 const html=readFileSync(new URL('./fixtures/komfa/delitzsch-stadtrat-2026-09-24.html',import.meta.url),'utf8'),now=new Date('2026-10-05T12:00:00Z');
 const ids=parseKomfaAgenda(html,meeting,source,now).items.map(i=>i.id);
 assert.ok(ids.includes('de-14730070-kf-vo-63-26'));
 const umlaut=parseKomfaAgenda(html.replaceAll('63-26','Ä 63-26'),meeting,source,now).items.map(i=>i.id);
 assert.ok(umlaut.includes('de-14730070-kf-vo-Ae-63-26'));
 assert.ok([...ids,...umlaut].every(id=>TOPIC_ID.test(id)));
});
