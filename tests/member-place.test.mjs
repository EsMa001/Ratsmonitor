// Mitgliedsgemeinde im Gemeindeverband (server/integrations/member-place.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import {where} from '../server/integrations/member-place.mjs';

test('values of a member municipality are shown for it, not for the union',()=>{
 assert.deepEqual(where('Samtgemeinde Nord-Elm','Haushaltsplan und Haushaltssatzung der Gemeinde Warberg 2027'),{key:'Warberg',label:'Gemeinde Warberg (Samtgemeinde Nord-Elm)'});
 assert.equal(where('Verbandsgemeinde Waldfischbach-Burgalben','Satzung der Ortsgemeinde Geiselberg über die Hebesätze').key,'Geiselberg');
 assert.deepEqual(where('Samtgemeinde Nord-Elm','Gebührenkalkulation Schmutzwasser'),{key:'',label:'Samtgemeinde Nord-Elm'});
 assert.deepEqual(where('Stadt Billerbeck','Hebesatzsatzung der Gemeinde Nachbarort'),{key:'',label:'Stadt Billerbeck'});
 // Der beratende Rat geht vor: Ortsgemeinderat Limbach in der Verbandsgemeinde Kirner Land
 assert.deepEqual(where('Verbandsgemeinde Kirner Land','Anhebung der Hebesätze der Realsteuern','Ortsgemeinderat Limbach'),{key:'Limbach',label:'Ortsgemeinde Limbach (Verbandsgemeinde Kirner Land)'});
 assert.deepEqual(where('Samtgemeinde Hattorf am Harz','1. Satzung zur Änderung der Hebesatzsatzung','Rat der Gemeinde Wulften am Harz'),{key:'Wulften am Harz',label:'Gemeinde Wulften am Harz (Samtgemeinde Hattorf am Harz)'});
 assert.equal(where('Samtgemeinde Sögel','Haushalt 2027','Samtgemeinderat Sögel').key,'');
});
