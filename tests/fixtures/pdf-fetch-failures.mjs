// Run the real fetch.mjs against a temporary database and PDF store, with only the downloader replaced.
// argv[2]: {dir, args, plan: {url: 'ok'|'nopdf'|<http status>}}; the main database must already exist in dir.
import {mock} from 'node:test';
const {dir,args=[],plan={}}=JSON.parse(process.argv[2]);
const lib=new URL('../../scripts/pdf-store/store-lib.mjs',import.meta.url);
const actual=await import(lib.href);
const calls=[];
mock.module(lib.href,{namedExports:{...actual,downloader:()=>async url=>{
 calls.push(url);const p=plan[url]??'ok';
 if(p==='ok')return new TextEncoder().encode('%PDF-1.4 fixture '+url);
 if(p==='nopdf')return new TextEncoder().encode('<html>');
 throw Object.assign(Error('HTTP '+p),{http:Number(p)});
}}});
process.env.DATABASE_FILE=dir+'/main.sqlite';process.env.RM_PDF_STORE=dir+'/store';
process.argv=[process.argv[0],'fetch.mjs',...args];
const log=console.log;console.log=()=>{};
await import(new URL('../../scripts/pdf-store/fetch.mjs',import.meta.url).href);
console.log=log;
console.log(JSON.stringify({calls}));
