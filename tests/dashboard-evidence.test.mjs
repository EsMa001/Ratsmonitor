import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {loadAtlasInputs,applyConsentEvidence} from '../scripts/source-discovery/atlas-inputs.mjs';
import {consentsOf} from '../server/integrations/consents.mjs';

test('standalone atlas preserves selected open findings and OUT leaves the saved atlas untouched',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-evidence-preview-'));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const out=path.join(directory,'preview.html'),target='server/integrations/source-atlas.json';
 const original=fs.readFileSync(target),inputs=loadAtlasInputs();
 const result=spawnSync(process.execPath,['scripts/dashboard/build.mjs'],{encoding:'utf8',env:{...process.env,OUT:out}});
 assert.equal(result.status,0,result.stderr||result.stdout);
 const line=fs.readFileSync(out,'utf8').match(/^const D=(.+);\r?$/m);
 assert.ok(line,'standalone page contains its data');
 const data=JSON.parse(line[1]),areas=new Map(data.areas.map(a=>[a.id,a]));
 for(const [id,resolution] of inputs.resolutions){
  const finding=applyConsentEvidence(resolution,consentsOf(id)[0],{})?.selected;
  if(!finding)continue;
  const area=areas.get(id);
  assert.equal(area.c,finding.category,id+' category');
  assert.equal(area.r,finding.reason,id+' original reason');
  assert.equal(area.z,finding.access,id+' access');
  assert.equal(area.u,/^https?:/.test(finding.url)?finding.url:'',id+' address');
 }
 for(const [id,source] of inputs.sources)if(areas.has(id))assert.equal(areas.get(id).c,source.checkPending?'ready':'ok',id+' configured source');
 assert.deepEqual(fs.readFileSync(target),original,'preview must not write production atlas data');
});
