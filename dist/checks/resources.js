"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runResourcesCheck = runResourcesCheck;
const validator_1 = require("../validator");
async function runResourcesCheck(client) {
    const start = Date.now();
    try {
        const resources = await client.listResources();
        const validation = (0, validator_1.validateResources)(resources);
        const durationMs = Date.now() - start;
        const errors = validation.issues.filter(i => i.level === 'error');
        const warnings = validation.issues.filter(i => i.level === 'warning');
        let status = 'pass';
        let message = resources.length + ' resource(s) discovered';
        if (errors.length > 0) {
            status = 'fail';
            message += ', ' + errors.length + ' schema error(s)';
        }
        else if (warnings.length > 0) {
            status = 'warn';
            message += ', ' + warnings.length + ' warning(s)';
        }
        return { name: 'resources', status, message, durationMs, resourceCount: resources.length, issues: validation.issues, resourceUris: resources.map(r => r.uri) };
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('Method not found') || msg.includes('-32601')) {
            return { name: 'resources', status: 'skip', message: 'Server does not support resources (method not found)', durationMs: Date.now() - start, resourceCount: 0, issues: [], resourceUris: [] };
        }
        return { name: 'resources', status: 'fail', message: 'resources/list failed: ' + msg, durationMs: Date.now() - start, resourceCount: 0, issues: [], resourceUris: [] };
    }
}
