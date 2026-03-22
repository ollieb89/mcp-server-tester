#!/usr/bin/env node
import { runHealthCheck } from '../checks/health';
import { runToolsCheck } from '../checks/tools';
import { runResourcesCheck } from '../checks/resources';
import { runPromptsCheck } from '../checks/prompts';
import { buildReport, shouldFail, formatMarkdownReport, formatTextReport, CheckResult } from '../reporter';
import { MCPClient, TransportType } from '../client';
import { validateInitializeResult } from '../validator';
import * as fs from 'fs';

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    console.log(`mcp-server-tester - Test MCP servers in CI\n\nUsage:\n  mcp-server-tester --transport stdio --command "node server.js"\n  mcp-server-tester --transport http --url http://localhost:3000/mcp\n\nOptions:\n  --transport <stdio|http|sse>     Transport type (default: stdio)\n  --command <cmd>                  Server command for stdio transport\n  --url <url>                      Server URL for http/sse transport\n  --test-tools                     Run tool discovery check\n  --test-resources                 Run resource discovery check\n  --test-prompts                   Run prompt discovery check\n  --all                            Run all checks\n  --fail-on <errors|warnings|none> Fail exit code policy (default: errors)\n  --timeout <seconds>              Timeout in seconds (default: 30)\n  --output <file>                  Write JSON report to file\n  --format <text|json|markdown>    Output format (default: text)\n  --help                           Show help`);
    process.exit(0);
  }

  const transport = (typeof args.transport === 'string' ? args.transport : 'stdio') as TransportType;
  const command = typeof args.command === 'string' ? args.command : undefined;
  const url = typeof args.url === 'string' ? args.url : undefined;
  const failOn = typeof args['fail-on'] === 'string' ? args['fail-on'] : 'errors';
  const timeoutMs = parseInt(typeof args.timeout === 'string' ? args.timeout : '30', 10) * 1000;
  const outputFile = typeof args.output === 'string' ? args.output : undefined;
  const format = typeof args.format === 'string' ? args.format : 'text';

  const checks: CheckResult[] = [];

  console.log('mcp-server-tester v1.0.0 | transport: ' + transport);

  const healthResult = await runHealthCheck(transport, command, url, timeoutMs);
  checks.push(healthResult);
  console.log('[' + (healthResult.status === 'pass' ? 'ok' : 'fail') + '] health: ' + healthResult.message);

  if (healthResult.status === 'pass' && transport === 'stdio' && command) {
    const client = new MCPClient({ transport: 'stdio', command, timeoutMs });
    try {
      await client.connect();
      const initResult = await client.initialize();
      const validation = validateInitializeResult(initResult);
      if (!validation.valid) {
        for (const issue of validation.issues.filter((i: { level: string }) => i.level === 'error')) {
          console.warn('[warn] protocol ' + issue.field + ': ' + issue.message);
        }
      }

      if (args['test-tools'] || args.all) {
        const r = await runToolsCheck(client);
        checks.push(r);
        console.log('[' + r.status + '] tools: ' + r.message);
      }
      if (args['test-resources'] || args.all) {
        const r = await runResourcesCheck(client);
        checks.push(r);
        console.log('[' + r.status + '] resources: ' + r.message);
      }
      if (args['test-prompts'] || args.all) {
        const r = await runPromptsCheck(client);
        checks.push(r);
        console.log('[' + r.status + '] prompts: ' + r.message);
      }
    } finally {
      await client.disconnect().catch(() => {});
    }
  }

  const report = buildReport(checks, transport, command, url);
  console.log('\nOverall: ' + report.overallStatus.toUpperCase());
  if (outputFile) {
    fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
    console.log('Report written to ' + outputFile);
  }
  if (format === 'markdown') console.log('\n' + formatMarkdownReport(report));
  else if (format === 'json') console.log(JSON.stringify(report, null, 2));
  else console.log('\n' + formatTextReport(report));
  if (shouldFail(report, failOn)) process.exit(1);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(2); });
