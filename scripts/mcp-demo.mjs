import {existsSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {applyMigrations} from './node-migrate.mjs';

/** Creates only an isolated synthetic demo, never opens or migrates the normal application database. */
export function prepareMcpDemo() {
  const root=fileURLToPath(new URL('..',import.meta.url));
  const directory=resolve(root,'tmp/mcp-demo'),file=resolve(directory,'reports.sqlite');
  if (existsSync(file)) return {created:false,file};
  mkdirSync(directory,{recursive:true});
  const sql=new DatabaseSync(file);
  try {
    applyMigrations(sql,resolve(root,'drizzle'),{log:()=>{}});
    const date=new Date().toISOString().slice(0,10);
    const text='Dies ist ein erfundener Testbericht fuer die lokale MCP-Erprobung. Die Verwaltung plant einen barrierefreien Zugang zum Gemeindehaus. Die bestehende Rampe wird ersetzt und der Eingang verbreitert. Der Vorschlag soll zuerst im Ausschuss beraten werden. Eine Entscheidung liegt noch nicht vor.';
    const insert=sql.prepare('INSERT INTO topics(id,region_id,source,event_date,updated_at,status,payload) VALUES(?,?,?,?,?,?,?)');
    for (const regionId of ['billerbeck','muenster']) {
      const id='mcp-demo-'+regionId,title='MCP-Testdaten: barrierefreier Zugang';
      insert.run(id,regionId,'city',date,date,'consulting',JSON.stringify({id,regionId,title,officialTitle:title,status:'consulting',eventDate:date,
        documentText:text,events:[],documents:[],shortSummary:'Erfundener Testbericht zur lokalen MCP-Erprobung.',
        ruleSummary:{version:3,short:{sentences:['Erfundener Testbericht zur lokalen MCP-Erprobung.']},long:{sentences:['Der Testvorschlag betrifft einen barrierefreien Zugang; eine Entscheidung liegt noch nicht vor.']}}}));
    }
  } finally { sql.close(); }
  return {created:true,file};
}

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const result=prepareMcpDemo();
  console.log(result.created ? 'Getrennte MCP-Testdatenbank mit zwei erfundenen Berichten angelegt.' : 'MCP-Testdatenbank besteht bereits und wurde nicht veraendert.');
  console.log('Startkonfigurationen: config/mcp/internal.example.json und config/mcp/customer.example.json');
}
