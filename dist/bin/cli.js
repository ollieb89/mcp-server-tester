#!/usr/bin/env node
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
const health_1 = require("../checks/health");
const tools_1 = require("../checks/tools");
const resources_1 = require("../checks/resources");
const prompts_1 = require("../checks/prompts");
const reporter_1 = require("../reporter");
const client_1 = require("../client");
const validator_1 = require("../validator");
const fs = __importStar(require("fs"));
function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = argv[i + 1];
            if (!next || next.startsWith('--')) {
                args[key] = true;
            }
            else {
                args[key] = next;
                i++;
            }
        }
    }
    return args;
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || args.h) {
        console.log(`mcp-server-tester - Test MCP servers in CI\n\nUsage:\n  mcp-server-tester --transport stdio --command "node server.js"\n  mcp-server-tester --transport http --url http://localhost:3000/mcp\n\nOptions:\n  --transport <stdio|http|sse>     Transport type (default: stdio)\n  --command <cmd>                  Server command for stdio transport\n  --url <url>                      Server URL for http/sse transport\n  --test-tools                     Run tool discovery check\n  --test-resources                 Run resource discovery check\n  --test-prompts                   Run prompt discovery check\n  --all                            Run all checks\n  --fail-on <errors|warnings|none> Fail exit code policy (default: errors)\n  --timeout <seconds>              Timeout in seconds (default: 30)\n  --output <file>                  Write JSON report to file\n  --format <text|json|markdown>    Output format (default: text)\n  --help                           Show help`);
        process.exit(0);
    }
    const transport = (typeof args.transport === 'string' ? args.transport : 'stdio');
    const command = typeof args.command === 'string' ? args.command : undefined;
    const url = typeof args.url === 'string' ? args.url : undefined;
    const failOn = typeof args['fail-on'] === 'string' ? args['fail-on'] : 'errors';
    const timeoutMs = parseInt(typeof args.timeout === 'string' ? args.timeout : '30', 10) * 1000;
    const outputFile = typeof args.output === 'string' ? args.output : undefined;
    const format = typeof args.format === 'string' ? args.format : 'text';
    const checks = [];
    console.log('mcp-server-tester v1.0.0 | transport: ' + transport);
    const healthResult = await (0, health_1.runHealthCheck)(transport, command, url, timeoutMs);
    checks.push(healthResult);
    console.log('[' + (healthResult.status === 'pass' ? 'ok' : 'fail') + '] health: ' + healthResult.message);
    if (healthResult.status === 'pass' && transport === 'stdio' && command) {
        const client = new client_1.MCPClient({ transport: 'stdio', command, timeoutMs });
        try {
            await client.connect();
            const initResult = await client.initialize();
            const validation = (0, validator_1.validateInitializeResult)(initResult);
            if (!validation.valid) {
                for (const issue of validation.issues.filter((i) => i.level === 'error')) {
                    console.warn('[warn] protocol ' + issue.field + ': ' + issue.message);
                }
            }
            if (args['test-tools'] || args.all) {
                const r = await (0, tools_1.runToolsCheck)(client);
                checks.push(r);
                console.log('[' + r.status + '] tools: ' + r.message);
            }
            if (args['test-resources'] || args.all) {
                const r = await (0, resources_1.runResourcesCheck)(client);
                checks.push(r);
                console.log('[' + r.status + '] resources: ' + r.message);
            }
            if (args['test-prompts'] || args.all) {
                const r = await (0, prompts_1.runPromptsCheck)(client);
                checks.push(r);
                console.log('[' + r.status + '] prompts: ' + r.message);
            }
        }
        finally {
            await client.disconnect().catch(() => { });
        }
    }
    const report = (0, reporter_1.buildReport)(checks, transport, command, url);
    console.log('\nOverall: ' + report.overallStatus.toUpperCase());
    if (outputFile) {
        fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
        console.log('Report written to ' + outputFile);
    }
    if (format === 'markdown')
        console.log('\n' + (0, reporter_1.formatMarkdownReport)(report));
    else if (format === 'json')
        console.log(JSON.stringify(report, null, 2));
    else
        console.log('\n' + (0, reporter_1.formatTextReport)(report));
    if ((0, reporter_1.shouldFail)(report, failOn))
        process.exit(1);
}
main().catch(err => { console.error('Fatal:', err.message); process.exit(2); });
