import { MCPClient } from '../client';
import { ValidationIssue } from '../validator';
export interface ToolsCheckResult {
    name: 'tools';
    status: 'pass' | 'fail' | 'skip' | 'warn';
    message: string;
    durationMs: number;
    toolCount: number;
    issues: ValidationIssue[];
    toolNames: string[];
}
export declare function runToolsCheck(client: MCPClient): Promise<ToolsCheckResult>;
