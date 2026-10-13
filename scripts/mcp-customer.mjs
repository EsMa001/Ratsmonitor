import {runMcpStdio,reportMcpStartupError} from '../server/mcp/stdio.mjs';

runMcpStdio('customer').catch(reportMcpStartupError);
