// Kunden-MCP über HTTP (server/node/mcp-http-server.mjs). Auf dem Server als ratsmonitor-mcp.service; lokal zum Testen:
//   MCP_DATABASE_FILE=… MCP_CUSTOMERS_FILE=… MCP_TOKEN_SECRET=… MCP_ISSUER=http://127.0.0.1:3002 node scripts/mcp-http.mjs
import {startMcpHttp,McpHttpConfigError} from '../server/node/mcp-http-server.mjs';

try{
 const {close}=await startMcpHttp();
 const stop=()=>close().finally(()=>process.exit(0));
 process.once('SIGTERM',stop);
 process.once('SIGINT',stop);
}catch(error){
 // Keine Pfade, Geheimnisse oder SQL in der Ausgabe
 process.stderr.write(JSON.stringify({event:'mcp_http_startup_error',message:error instanceof McpHttpConfigError?error.message:'MCP-Dienst konnte nicht starten. Konfiguration prüfen.'})+'\n');
 process.exitCode=1;
}
