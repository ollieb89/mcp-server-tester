import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import { MCPClient, TransportType } from './client';
import { validateInitializeResult } from './validator';
import { runHealthCheck } from './checks/health';
import { runToolsCheck } from './checks/tools';
import { runResourcesCheck } from './checks/resources';
import { runPromptsCheck } from './checks/prompts';
import { buildReport, shouldFail, formatMarkdownReport, formatTextReport, CheckResult } from './reporter';

async function run(): Promise<void> {
  try {
    const transport = (core.getInput('transport') || 'stdio') as TransportType;
    const serverCommand = core.getInput('server-command') || undefined;
    const serverUrl = core.getInput('server-url') || undefined;
    const testTools = core.getBooleanInput('test-tools');
    const testResources = core.getBooleanInput('test-resources');
    const testPrompts = core.getBooleanInput('test-prompts');
    const failOn = core.getInput('fail-on') || 'errors';
    const timeoutMs = parseInt(core.getInput('timeout') || '30', 10) * 1000;
    const outputFile = core.getInput('output-file') || undefined;

    const checks: CheckResult[] = [];

    // Health check (always run)
    core.info('Running health check...');
    const healthResult = await runHealthCheck(transport, serverCommand, serverUrl, timeoutMs);
    checks.push(healthResult);
    core.info('[' + healthResult.status + '] health: ' + healthResult.message);

    if (healthResult.status === 'pass' && transport === 'stdio' && serverCommand) {
      // Connect once for remaining checks
      const client = new MCPClient({ transport: 'stdio', command: serverCommand, timeoutMs });
      try {
        await client.connect();
        const initResult = await client.initialize();

        // Protocol compliance validation
        const initValidation = validateInitializeResult(initResult);
        if (!initValidation.valid) {
          for (const issue of initValidation.issues.filter(i => i.level === 'error')) {
            core.warning('Protocol: ' + issue.field + ': ' + issue.message);
          }
        }

        if (testTools) {
          core.info('Running tools check...');
          const r = await runToolsCheck(client);
          checks.push(r);
          core.info('[' + r.status + '] tools: ' + r.message);
        }

        if (testResources) {
          core.info('Running resources check...');
          const r = await runResourcesCheck(client);
          checks.push(r);
          core.info('[' + r.status + '] resources: ' + r.message);
        }

        if (testPrompts) {
          core.info('Running prompts check...');
          const r = await runPromptsCheck(client);
          checks.push(r);
          core.info('[' + r.status + '] prompts: ' + r.message);
        }
      } finally {
        await client.disconnect().catch(() => {});
      }
    }

    const report = buildReport(checks, transport, serverCommand, serverUrl);
    const markdownReport = formatMarkdownReport(report);

    // Outputs
    core.setOutput('passed', String(report.passed));
    core.setOutput('failed', String(report.failed));
    core.setOutput('warnings', String(report.warned));
    core.setOutput('report-path', outputFile ?? '');

    // Job summary
    core.summary.addRaw(markdownReport).write();

    // Text log
    core.info('\n' + formatTextReport(report));

    // Artifact
    if (outputFile) {
      const outPath = path.resolve(outputFile);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
      core.info('Report written to ' + outPath);
    }

    if (shouldFail(report, failOn)) {
      core.setFailed(report.failed + ' check(s) failed (fail-on: ' + failOn + ')');
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
