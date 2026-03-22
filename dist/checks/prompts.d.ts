import { MCPClient } from '../client';
import { ValidationIssue } from '../validator';
export interface PromptsCheckResult {
    name: 'prompts';
    status: 'pass' | 'fail' | 'skip' | 'warn';
    message: string;
    durationMs: number;
    promptCount: number;
    issues: ValidationIssue[];
    promptNames: string[];
}
export declare function runPromptsCheck(client: MCPClient): Promise<PromptsCheckResult>;
