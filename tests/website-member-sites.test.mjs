import test from 'node:test';
import assert from 'node:assert/strict';
import {siteAllowed} from '../server/integrations/website.mjs';
// VG Burkhardtsdorf, 2026: Auerbach and Burkhardtsdorf publish on two websites of their own.
const vg={id:'de-145215103',base:'https://www.auerbach-erzgebirge.de/',memberSites:['https://www.burkhardtsdorf.de/']};
test('the website of a member municipality is read only where the entry names it',()=>{
 assert.equal(siteAllowed('https://www.burkhardtsdorf.de/de/sitzungsunterlagen.html#x',vg),'https://www.burkhardtsdorf.de/de/sitzungsunterlagen.html');
 assert.equal(siteAllowed('https://www.auerbach-erzgebirge.de/a.pdf',vg),'https://www.auerbach-erzgebirge.de/a.pdf');
 assert.throws(()=>siteAllowed('https://www.burkhardtsdorf.de/',{...vg,memberSites:undefined}),/Nicht freigegebene/);
 assert.throws(()=>siteAllowed('https://www.gornsdorf.de/',vg),/Nicht freigegebene/);
 assert.throws(()=>siteAllowed('http://www.burkhardtsdorf.de/',vg),/Nicht freigegebene/);
});
