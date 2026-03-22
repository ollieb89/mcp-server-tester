import { MCPTool, MCPResource, MCPPrompt, InitializeResult } from './client';
export interface ValidationIssue {
    level: 'error' | 'warning' | 'info';
    field: string;
    message: string;
}
export interface ValidationResult {
    valid: boolean;
    issues: ValidationIssue[];
}
export declare function validateInitializeResult(result: InitializeResult): ValidationResult;
export declare function validateTool(tool: MCPTool): ValidationResult;
export declare function validateTools(tools: MCPTool[]): ValidationResult;
export declare function validateResource(resource: MCPResource): ValidationResult;
export declare function validateResources(resources: MCPResource[]): ValidationResult;
export declare function validatePrompt(prompt: MCPPrompt): ValidationResult;
export declare function validatePrompts(prompts: MCPPrompt[]): ValidationResult;
