import test from 'node:test';
import assert from 'node:assert/strict';
import {ROBOTS_POLICIES,robotsPolicy,obeyRobots} from '../server/integrations/robots-policy.mjs';

test('robots policy: recorded, not obeyed, unless ROBOTS_POLICY=obey',()=>{
 assert.deepEqual(ROBOTS_POLICIES,['record','obey']);
 assert.equal(robotsPolicy({}),'record');assert.equal(robotsPolicy(undefined),'record');assert.equal(robotsPolicy(null),'record');
 assert.equal(robotsPolicy({ROBOTS_POLICY:'obey'}),'obey');assert.equal(robotsPolicy({ROBOTS_POLICY:' OBEY '}),'obey');
 // Anything else is the standard rule: a typo never switches a run back to the old rule unnoticed.
 for(const value of ['record','','ignore','obey!','0'])assert.equal(robotsPolicy({ROBOTS_POLICY:value}),'record',value);
 assert.equal(obeyRobots({ROBOTS_POLICY:'obey'}),true);assert.equal(obeyRobots({}),false);
 // The process environment decides when no environment is handed in.
 const was=process.env.ROBOTS_POLICY;
 try{delete process.env.ROBOTS_POLICY;assert.equal(obeyRobots(),false);process.env.ROBOTS_POLICY='obey';assert.equal(obeyRobots(),true);}
 finally{if(was===undefined)delete process.env.ROBOTS_POLICY;else process.env.ROBOTS_POLICY=was;}
});
