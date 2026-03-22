"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runHealthCheck = runHealthCheck;
const client_1 = require("../client");
async function runHealthCheck(transport, command, url, timeoutMs = 10000) {
    const start = Date.now();
    if (transport === 'http' || transport === 'sse') {
        if (!url) {
            return { name: 'health', status: 'fail', message: 'server-url is required for ' + transport + ' transport', durationMs: 0 };
        }
        try {
            const resp = await (0, client_1.httpGet)(url, timeoutMs);
            const durationMs = Date.now() - start;
            if (resp.status >= 200 && resp.status < 500) {
                return { name: 'health', status: 'pass', message: 'HTTP endpoint reachable (status ' + resp.status + ')', durationMs, details: { status: resp.status } };
            }
            return { name: 'health', status: 'fail', message: 'HTTP endpoint returned status ' + resp.status, durationMs, details: { status: resp.status } };
        }
        catch (e) {
            return { name: 'health', status: 'fail', message: 'HTTP connection failed: ' + (e instanceof Error ? e.message : String(e)), durationMs: Date.now() - start };
        }
    }
    // stdio
    if (!command) {
        return { name: 'health', status: 'fail', message: 'server-command is required for stdio transport', durationMs: 0 };
    }
    const client = new client_1.MCPClient({ transport: 'stdio', command, timeoutMs });
    try {
        await client.connect();
        const initResult = await client.initialize();
        const durationMs = Date.now() - start;
        await client.disconnect();
        return {
            name: 'health',
            status: 'pass',
            message: 'Server connected and initialized successfully',
            durationMs,
            details: {
                serverName: initResult.serverInfo?.name,
                serverVersion: initResult.serverInfo?.version,
                protocolVersion: initResult.protocolVersion
            }
        };
    }
    catch (e) {
        await client.disconnect().catch(() => { });
        return {
            name: 'health',
            status: 'fail',
            message: 'Server health check failed: ' + (e instanceof Error ? e.message : String(e)),
            durationMs: Date.now() - start
        };
    }
}
