// Baut den Importprozess (server/node/import-worker.mjs) und den plenara.X-Worker (server/node/x-worker.mjs) je als eine Datei für Node, mit denselben Ersetzungen wie der
// Server-Bau: 'cloudflare:workers' zeigt auf server/node/cloudflare-workers.mjs, 'server-only' ist leer, '@/' ist die
// Projektwurzel. Alle Pakete werden eingebündelt (wie vinext es für den Server tut); nur Node-Module bleiben außen.
import path from 'node:path';
import {build} from 'vite';

export async function buildWorker({root,outDir,entry='server/node/import-worker.mjs',fileName='import-worker.mjs',emptyOutDir=true}){
 await build({
  root,
  configFile:false,
  publicDir:false,
  logLevel:'warn',
  mode:'production',
  resolve:{alias:[
   {find:'cloudflare:workers',replacement:path.join(root,'server/node/cloudflare-workers.mjs')},
   {find:'@',replacement:root},
  ]},
  plugins:[{
   name:'rm-server-only',
   resolveId(id){if(id==='server-only')return '\0server-only';return null;},
   load(id){if(id==='\0server-only')return 'export {};';return null;},
  }],
  define:{'import.meta.env.DEV':'false'},
  ssr:{noExternal:true,target:'node'},
  build:{
   ssr:path.join(root,entry),
   outDir,
   emptyOutDir,
   minify:false,
   sourcemap:false,
   target:'node22',
   rollupOptions:{output:{entryFileNames:fileName,format:'es',codeSplitting:false}},
  },
 });
}
