// Compatibility entry point for existing commands; the implementation is agent-neutral.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {main} from './ai-job.mjs';
export {sqliteAdapter} from './ai-job.mjs';
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
