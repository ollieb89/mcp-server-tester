"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runToolsCheck = runToolsCheck;
const validator_1 = require("../validator");
async function runToolsCheck(client) {
    const start = Date.now();
    try {
        const tools = await client.listTools();
        const validation = (0, validator_1.validateTools)(tools);
        const durationMs = Date.now() - start;
        const errors = validation.issues.filter(i => i.level === 'error');
        const warnings = validation.issues.filter(i => i.level === 'warning');
        let status = 'pass';
        let message = tools.length + ' tool(s) discovered';
        if (errors.length > 0) {
            status = 'fail';
            message += ', ' + errors.length + ' schema error(s)';
        }
        else if (warnings.length > 0) {
            status = 'warn';
            message += ', ' + warnings.length + ' warning(s)';
        }
        return { name: 'tools', status, message, durationMs, toolCount: tools.length, issues: validation.issues, toolNames: tools.map(t => t.name) };
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // tools/list returning method-not-found is acceptable (server doesn't support tools)
        if (msg.includes('Method not found') || msg.includes('-32601')) {
            return { name: 'tools', status: 'skip', message: 'Server does not support tools (method not found)', durationMs: Date.now() - start, toolCount: 0, issues: [], toolNames: [] };
        }
        return { name: 'tools', status: 'fail', message: 'tools/list failed: ' + msg, durationMs: Date.now() - start, toolCount: 0, issues: [], toolNames: [] };
    }
}
