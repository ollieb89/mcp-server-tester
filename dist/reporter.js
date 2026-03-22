"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReport = buildReport;
exports.shouldFail = shouldFail;
exports.formatMarkdownReport = formatMarkdownReport;
exports.formatTextReport = formatTextReport;
function buildReport(checks, transport, serverCommand, serverUrl) {
    let passed = 0, failed = 0, warned = 0, skipped = 0;
    let totalDurationMs = 0;
    for (const check of checks) {
        totalDurationMs += check.durationMs;
        if (check.status === 'pass')
            passed++;
        else if (check.status === 'fail')
            failed++;
        else if (check.status === 'warn')
            warned++;
        else if (check.status === 'skip')
            skipped++;
    }
    const overallStatus = failed > 0 ? 'fail' : warned > 0 ? 'warn' : 'pass';
    return {
        serverCommand,
        serverUrl,
        transport,
        checks,
        passed,
        failed,
        warned,
        skipped,
        totalDurationMs,
        generatedAt: new Date().toISOString(),
        overallStatus
    };
}
function shouldFail(report, failOn) {
    if (failOn === 'none')
        return false;
    if (failOn === 'errors' || failOn === 'error')
        return report.failed > 0;
    if (failOn === 'warnings' || failOn === 'warning')
        return report.failed > 0 || report.warned > 0;
    return report.failed > 0; // default
}
const STATUS_ICON = {
    pass: '✅',
    fail: '❌',
    warn: '⚠️',
    skip: '⏭️'
};
function formatMarkdownReport(report) {
    const lines = [];
    lines.push('## 🔌 MCP Server Test Report');
    lines.push('');
    const target = report.serverCommand ?? report.serverUrl ?? '(unknown)';
    lines.push('**Server:** `' + target + '`  ');
    lines.push('**Transport:** ' + report.transport + '  ');
    lines.push('**Generated:** ' + new Date(report.generatedAt).toUTCString());
    lines.push('');
    lines.push('### Summary');
    lines.push('');
    lines.push('| Status | Count |');
    lines.push('|--------|-------|');
    lines.push('| ✅ Passed | ' + report.passed + ' |');
    lines.push('| ❌ Failed | ' + report.failed + ' |');
    lines.push('| ⚠️ Warnings | ' + report.warned + ' |');
    lines.push('| ⏭️ Skipped | ' + report.skipped + ' |');
    lines.push('| ⏱️ Duration | ' + report.totalDurationMs + 'ms |');
    lines.push('');
    lines.push('### Check Results');
    lines.push('');
    lines.push('| Check | Status | Duration | Message |');
    lines.push('|-------|--------|----------|---------|');
    for (const check of report.checks) {
        const icon = STATUS_ICON[check.status] ?? '❓';
        lines.push('| ' + check.name + ' | ' + icon + ' ' + check.status + ' | ' + check.durationMs + 'ms | ' + check.message + ' |');
    }
    lines.push('');
    // Issues per check
    for (const check of report.checks) {
        const c = check;
        const issues = c.issues;
        if (issues && issues.length > 0) {
            lines.push('#### ' + check.name + ' issues');
            lines.push('');
            for (const issue of issues) {
                const icon = issue.level === 'error' ? '❌' : issue.level === 'warning' ? '⚠️' : 'ℹ️';
                lines.push('- ' + icon + ' **' + issue.field + '**: ' + issue.message);
            }
            lines.push('');
        }
    }
    if (report.overallStatus === 'pass') {
        lines.push('### ✅ All checks passed');
        lines.push('');
    }
    else if (report.overallStatus === 'fail') {
        lines.push('### ❌ ' + report.failed + ' check(s) failed');
        lines.push('');
    }
    else {
        lines.push('### ⚠️ Checks passed with warnings');
        lines.push('');
    }
    lines.push('---');
    lines.push('*Powered by [mcp-server-tester](https://github.com/ollieb89/mcp-server-tester)*');
    return lines.join('\n');
}
function formatTextReport(report) {
    const lines = [
        'mcp-server-tester Results',
        '=========================',
        'Transport: ' + report.transport,
        'Server: ' + (report.serverCommand ?? report.serverUrl ?? '(unknown)'),
        '',
        'Passed:  ' + report.passed,
        'Failed:  ' + report.failed,
        'Warned:  ' + report.warned,
        'Skipped: ' + report.skipped,
        '',
        'Checks:'
    ];
    for (const check of report.checks) {
        const icon = check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : check.status === 'warn' ? '!' : '-';
        lines.push('  [' + icon + '] ' + check.name + ': ' + check.message + ' (' + check.durationMs + 'ms)');
    }
    lines.push('');
    lines.push('Overall: ' + report.overallStatus.toUpperCase());
    return lines.join('\n');
}
