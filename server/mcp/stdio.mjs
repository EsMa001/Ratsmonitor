import {parseArgs} from 'node:util';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {openMcpRuntime,McpConfigurationError} from '../node/mcp-runtime.mjs';
import {createRatsmonitorMcpServer} from './server.mjs';

export async function runMcpStdio(mode,args=process.argv.slice(2)) {
  const {values}=parseArgs({args,options:{config:{type:'string'},help:{type:'boolean'}},allowPositionals:false});
  if (values.help) {
    process.stdout.write(`node scripts/mcp-${mode}.mjs --config PFAD.json\nLokaler MCP-STDIO-Zugang (${mode}). Kein HTTP-Port, kein Export, keine automatische Migration.\nAlternativ RM_MCP_CONFIG setzen. Datenbankpfade sind relativ zur Konfigurationsdatei.\n`);
    return;
  }
  const runtime=await openMcpRuntime(mode,values.config||process.env.RM_MCP_CONFIG);
  const server=createRatsmonitorMcpServer({mode,work:runtime.work,customer:runtime.customer,
    identity:runtime.config.identity,requestsPerMinute:runtime.config.requestsPerMinute,
    audit:event=>process.stderr.write(JSON.stringify({event:'mcp_tool',...event})+'\n')});
  const transport=new StdioServerTransport(process.stdin,process.stdout,{maxBufferSize:3_000_000});
  let closing=false;
  const close=async()=>{
    if (closing) return;
    closing=true;
    process.stdin.off('end',close);
    process.off('SIGINT',close);
    process.off('SIGTERM',close);
    try { await server.close(); } finally { runtime.close(); }
  };
  server.server.onclose=close;
  process.stdin.once('end',close);
  process.once('SIGINT',close);
  process.once('SIGTERM',close);
  try { await server.connect(transport); } catch (error) { await close();throw error; }
  return {close};
}

export function reportMcpStartupError(error) {
  // No database paths, raw SQL or secrets on either protocol output or diagnostic output.
  const message=error instanceof McpConfigurationError ? error.message : 'MCP konnte nicht gestartet werden. Konfiguration und lokale Abhaengigkeiten pruefen.';
  process.stderr.write(JSON.stringify({event:'mcp_startup_error',message})+'\n');
  process.exitCode=1;
}
