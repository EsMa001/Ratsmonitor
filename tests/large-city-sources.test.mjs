import test from 'node:test';
import assert from 'node:assert/strict';
import {NRW_SOURCES} from '../server/integrations/source-catalog.mjs';

const source=id=>NRW_SOURCES.find(s=>s.id===id);

// Bremen (24.10.2026): the SD.NET gateway answers modified_since after 60 s with 502 (406 with Accept JSON);
// the plain list read from its end works.
test('Bremen liest die Sitzungsliste vom Ende, nicht über modified_since',()=>{
 assert.equal(source('de-04011000').meetingScan,'end');
});

// Solingen (24.10.2026): SD.NET RIM marks no item as public; public view counts as public (decision of the owner).
test('Solingen übernimmt Punkte ohne Kennzeichnung als öffentlich',()=>{
 assert.ok(source('nrw-05122000').assumePublicAgenda?.decided);
});
