import { buildReport, shouldFail, formatMarkdownReport, formatTextReport } from '../src/reporter';
import { HealthCheckResult } from '../src/checks/health';
import { ToolsCheckResult } from '../src/checks/tools';

function healthPass(durationMs = 10): HealthCheckResult {
  return { name: 'health', status: 'pass', message: 'Server connected', durationMs, details: {} };
}
function healthFail(durationMs = 5): HealthCheckResult {
  return { name: 'health', status: 'fail', message: 'Connection refused', durationMs };
}
function toolsPass(): ToolsCheckResult {
  return { name: 'tools', status: 'pass', message: '3 tool(s) discovered', durationMs: 8, toolCount: 3, issues: [], toolNames: ['a', 'b', 'c'] };
}
function toolsWarn(): ToolsCheckResult {
  return { name: 'tools', status: 'warn', message: '2 warning(s)', durationMs: 8, toolCount: 2, issues: [{ level: 'warning', field: 'description', message: 'missing desc' }], toolNames: ['x', 'y'] };
}
function toolsFail(): ToolsCheckResult {
  return { name: 'tools', status: 'fail', message: 'schema error', durationMs: 5, toolCount: 0, issues: [{ level: 'error', field: 'name', message: 'empty' }], toolNames: [] };
}

describe('buildReport', () => {
  it('counts pass/fail/warn/skip correctly', () => {
    const report = buildReport([healthPass(), toolsPass()], 'stdio', 'node server.js');
    expect(report.passed).toBe(2);
    expect(report.failed).toBe(0);
    expect(report.overallStatus).toBe('pass');
  });

  it('marks overall fail when any check fails', () => {
    const report = buildReport([healthPass(), toolsFail()], 'stdio');
    expect(report.failed).toBe(1);
    expect(report.overallStatus).toBe('fail');
  });

  it('marks overall warn when only warnings', () => {
    const report = buildReport([healthPass(), toolsWarn()], 'stdio');
    expect(report.overallStatus).toBe('warn');
    expect(report.warned).toBe(1);
  });

  it('sums totalDurationMs', () => {
    const report = buildReport([healthPass(10), toolsPass()], 'stdio');
    expect(report.totalDurationMs).toBe(18);
  });

  it('stores transport and server info', () => {
    const report = buildReport([], 'http', undefined, 'http://localhost:3000');
    expect(report.transport).toBe('http');
    expect(report.serverUrl).toBe('http://localhost:3000');
  });
});

describe('shouldFail', () => {
  it('fails on errors when fail-on=errors and there are failures', () => {
    const report = buildReport([healthFail()], 'stdio');
    expect(shouldFail(report, 'errors')).toBe(true);
  });

  it('does not fail when no failures and fail-on=errors', () => {
    const report = buildReport([healthPass()], 'stdio');
    expect(shouldFail(report, 'errors')).toBe(false);
  });

  it('fails on warnings when fail-on=warnings and there are warnings', () => {
    const report = buildReport([healthPass(), toolsWarn()], 'stdio');
    expect(shouldFail(report, 'warnings')).toBe(true);
  });

  it('never fails when fail-on=none', () => {
    const report = buildReport([healthFail()], 'stdio');
    expect(shouldFail(report, 'none')).toBe(false);
  });
});

describe('formatMarkdownReport', () => {
  it('includes server and transport info', () => {
    const report = buildReport([healthPass()], 'stdio', 'node srv.js');
    const md = formatMarkdownReport(report);
    expect(md).toContain('node srv.js');
    expect(md).toContain('stdio');
  });

  it('shows passed/failed/warned counts', () => {
    const report = buildReport([healthPass(), toolsFail()], 'stdio');
    const md = formatMarkdownReport(report);
    expect(md).toContain('Failed');
    expect(md).toContain('Passed');
  });

  it('shows all checks passed message when clean', () => {
    const report = buildReport([healthPass()], 'stdio');
    const md = formatMarkdownReport(report);
    expect(md).toContain('All checks passed');
  });

  it('shows failed message when failures present', () => {
    const report = buildReport([healthFail()], 'stdio');
    const md = formatMarkdownReport(report);
    expect(md).toContain('check(s) failed');
  });

  it('includes powered-by footer', () => {
    const report = buildReport([healthPass()], 'stdio');
    const md = formatMarkdownReport(report);
    expect(md).toContain('mcp-server-tester');
    expect(md).toContain('github.com/ollieb89/mcp-server-tester');
  });

  it('includes check issues in output', () => {
    const report = buildReport([toolsFail()], 'stdio');
    const md = formatMarkdownReport(report);
    expect(md).toContain('tools issues');
  });
});

describe('formatTextReport', () => {
  it('includes summary metrics', () => {
    const report = buildReport([healthPass(), toolsPass()], 'stdio', 'node srv.js');
    const text = formatTextReport(report);
    expect(text).toContain('Passed:');
    expect(text).toContain('Failed:');
    expect(text).toContain('Overall:');
  });
});
