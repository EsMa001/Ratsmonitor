import {runMcpStdio,reportMcpStartupError} from '../server/mcp/stdio.mjs';

runMcpStdio('internal').catch(reportMcpStartupError);
