import { HealthCheckResult } from './checks/health';
import { ToolsCheckResult } from './checks/tools';
import { ResourcesCheckResult } from './checks/resources';
import { PromptsCheckResult } from './checks/prompts';
export type CheckResult = HealthCheckResult | ToolsCheckResult | ResourcesCheckResult | PromptsCheckResult;
export interface TestSuiteReport {
    serverCommand?: string;
    serverUrl?: string;
    transport: string;
    checks: CheckResult[];
    passed: number;
    failed: number;
    warned: number;
    skipped: number;
    totalDurationMs: number;
    generatedAt: string;
    overallStatus: 'pass' | 'fail' | 'warn';
}
export declare function buildReport(checks: CheckResult[], transport: string, serverCommand?: string, serverUrl?: string): TestSuiteReport;
export declare function shouldFail(report: TestSuiteReport, failOn: string): boolean;
export declare function formatMarkdownReport(report: TestSuiteReport): string;
export declare function formatTextReport(report: TestSuiteReport): string;
