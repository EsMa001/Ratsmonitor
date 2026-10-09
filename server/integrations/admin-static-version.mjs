// Version of what the admin views take from the deployed code rather than the database (catalog, connected sources,
// coverage history, source atlas, robots verdicts, names of the quality checks). It is part of their ETags, so a deploy
// that changes any of it never answers 304 with an older view. Computed once when the module loads.
import {CATALOG} from '../../shared/catalog.mjs';
import {QUALITY_CHECKS} from '../../shared/quality-checks.mjs';
import {connectedIds} from './admin-coverage.mjs';
import {fnv} from '../services/admin-etag.mjs';
import history from './coverage-history.json' with {type:'json'};
import atlas from './source-atlas.json' with {type:'json'};
import robots from './source-robots.json' with {type:'json'};
export const STATIC_VER=fnv([
 CATALOG.length,CATALOG.at(-1)?.id,[...connectedIds()].sort().join(','),
 history.builtAt,history.points?.length,atlas.builtAt,atlas.reportDate,Object.keys(atlas.areas||{}).length,
 robots.builtAt??robots.checkedAt??Object.keys(robots.sources||{}).length,
 JSON.stringify(QUALITY_CHECKS),
].map(String));
