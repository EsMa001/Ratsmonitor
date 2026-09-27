import test from 'node:test';
import assert from 'node:assert/strict';
import {availabilityLabel,regionAvailability} from '../shared/region-availability.mjs';
import {mapRubinMeeting} from '../server/integrations/more-rubin.mjs';
test('configured sources without articles remain distinct from populated and partial places',()=>{
 const a=regionAvailability([{regionId:'empty',method:'oparl',articleCount:0,complete:false},{regionId:'partial',articleCount:1234,complete:false},{regionId:'complete',articleCount:5,complete:true}]);
 assert.equal(availabilityLabel(a.empty),'Noch keine Artikel');assert.equal(availabilityLabel(a.partial),'1.234 Artikel · Teilstand');assert.equal(availabilityLabel(a.complete),'5 Artikel');assert.equal(availabilityLabel(undefined),'Datenstand unbekannt');
});
test('municipal portal API preserves city identity, only public agenda items, and distinguishes council decisions from recommendations',()=>{
 const source={id:'city',kind:'city',name:'Teststadt',base:'https://example.test/'};
 const meeting={datum:'2026-09-20',full_url:source.base+'meeting/1',committees:[{name:'Rat der Stadt Teststadt'}],agenda_items:[{ai_id:'1',status:1,title:'Neubau Schule',abstimmungstext:'einstimmig beschlossen',documents:[]},{ai_id:'2',status:2,title:'Nicht öffentlich',documents:[]}]};
 const [t]=mapRubinMeeting(meeting,source,new Date('2026-09-27'));assert.equal(t.source,'city');assert.equal(t.status,'approved');assert.equal(mapRubinMeeting(meeting,source).length,1);
 assert.equal(mapRubinMeeting({...meeting,committees:[{name:'Bauausschuss'}]},source)[0].status,'recommended');
});
