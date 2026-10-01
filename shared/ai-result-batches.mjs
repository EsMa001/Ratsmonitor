// Split large result files without changing job ID or article contents.
export function splitAiResultBatches(output){
 if(output?.format!=='ratsmonitor-ai-results-v1'||typeof output.jobId!=='string'||!Array.isArray(output.articles)||!output.articles.length||output.articles.some(a=>!a||typeof a.id!=='string')||new Set(output.articles.map(a=>a.id)).size!==output.articles.length)throw Error('Ungültige Ergebnisdatei oder doppelte Artikel.');
 const encode=new TextEncoder(),batches=[];let articles=[];
 const make=items=>({format:output.format,jobId:output.jobId,articles:items});
 const overhead=encode.encode(JSON.stringify({action:'apply',result:make([])})).byteLength;
 let size=overhead;
 for(const article of output.articles){
  const bytes=encode.encode(JSON.stringify(article)).byteLength;
  if(overhead+bytes>2900000)throw Error('Ein einzelnes Artikelergebnis überschreitet 2,9 MB. Quellenauszüge kürzen.');
  if(articles.length>=100||size+bytes+(articles.length?1:0)>2900000){batches.push(make(articles));articles=[];size=overhead;}
  size+=bytes+(articles.length?1:0);articles.push(article);
 }
 if(articles.length)batches.push(make(articles));return batches;
}
