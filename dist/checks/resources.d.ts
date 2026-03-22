import { MCPClient } from '../client';
import { ValidationIssue } from '../validator';
export interface ResourcesCheckResult {
    name: 'resources';
    status: 'pass' | 'fail' | 'skip' | 'warn';
    message: string;
    durationMs: number;
    resourceCount: number;
    issues: ValidationIssue[];
    resourceUris: string[];
}
export declare function runResourcesCheck(client: MCPClient): Promise<ResourcesCheckResult>;
