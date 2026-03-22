"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const client_1 = require("./client");
const validator_1 = require("./validator");
const health_1 = require("./checks/health");
const tools_1 = require("./checks/tools");
const resources_1 = require("./checks/resources");
const prompts_1 = require("./checks/prompts");
const reporter_1 = require("./reporter");
async function run() {
    try {
        const transport = (core.getInput('transport') || 'stdio');
        const serverCommand = core.getInput('server-command') || undefined;
        const serverUrl = core.getInput('server-url') || undefined;
        const testTools = core.getBooleanInput('test-tools');
        const testResources = core.getBooleanInput('test-resources');
        const testPrompts = core.getBooleanInput('test-prompts');
        const failOn = core.getInput('fail-on') || 'errors';
        const timeoutMs = parseInt(core.getInput('timeout') || '30', 10) * 1000;
        const outputFile = core.getInput('output-file') || undefined;
        const checks = [];
        // Health check (always run)
        core.info('Running health check...');
        const healthResult = await (0, health_1.runHealthCheck)(transport, serverCommand, serverUrl, timeoutMs);
        checks.push(healthResult);
        core.info('[' + healthResult.status + '] health: ' + healthResult.message);
        if (healthResult.status === 'pass' && transport === 'stdio' && serverCommand) {
            // Connect once for remaining checks
            const client = new client_1.MCPClient({ transport: 'stdio', command: serverCommand, timeoutMs });
            try {
                await client.connect();
                const initResult = await client.initialize();
                // Protocol compliance validation
                const initValidation = (0, validator_1.validateInitializeResult)(initResult);
                if (!initValidation.valid) {
                    for (const issue of initValidation.issues.filter(i => i.level === 'error')) {
                        core.warning('Protocol: ' + issue.field + ': ' + issue.message);
                    }
                }
                if (testTools) {
                    core.info('Running tools check...');
                    const r = await (0, tools_1.runToolsCheck)(client);
                    checks.push(r);
                    core.info('[' + r.status + '] tools: ' + r.message);
                }
                if (testResources) {
                    core.info('Running resources check...');
                    const r = await (0, resources_1.runResourcesCheck)(client);
                    checks.push(r);
                    core.info('[' + r.status + '] resources: ' + r.message);
                }
                if (testPrompts) {
                    core.info('Running prompts check...');
                    const r = await (0, prompts_1.runPromptsCheck)(client);
                    checks.push(r);
                    core.info('[' + r.status + '] prompts: ' + r.message);
                }
            }
            finally {
                await client.disconnect().catch(() => { });
            }
        }
        const report = (0, reporter_1.buildReport)(checks, transport, serverCommand, serverUrl);
        const markdownReport = (0, reporter_1.formatMarkdownReport)(report);
        // Outputs
        core.setOutput('passed', String(report.passed));
        core.setOutput('failed', String(report.failed));
        core.setOutput('warnings', String(report.warned));
        core.setOutput('report-path', outputFile ?? '');
        // Job summary
        core.summary.addRaw(markdownReport).write();
        // Text log
        core.info('\n' + (0, reporter_1.formatTextReport)(report));
        // Artifact
        if (outputFile) {
            const outPath = path.resolve(outputFile);
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
            core.info('Report written to ' + outPath);
        }
        if ((0, reporter_1.shouldFail)(report, failOn)) {
            core.setFailed(report.failed + ' check(s) failed (fail-on: ' + failOn + ')');
        }
    }
    catch (error) {
        core.setFailed(error instanceof Error ? error.message : String(error));
    }
}
run();
