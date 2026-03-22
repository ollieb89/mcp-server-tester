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

// MCP spec: protocol version must be 2024-11-05 or later
const KNOWN_VERSIONS = new Set(['2024-11-05']);

export function validateInitializeResult(result: InitializeResult): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!result.protocolVersion) {
    issues.push({ level: 'error', field: 'protocolVersion', message: 'Missing protocolVersion in initialize result' });
  } else if (!KNOWN_VERSIONS.has(result.protocolVersion)) {
    issues.push({ level: 'warning', field: 'protocolVersion', message: 'Unknown protocol version: ' + result.protocolVersion + ' (expected 2024-11-05)' });
  }

  if (!result.serverInfo) {
    issues.push({ level: 'error', field: 'serverInfo', message: 'Missing serverInfo in initialize result' });
  } else {
    if (!result.serverInfo.name) {
      issues.push({ level: 'warning', field: 'serverInfo.name', message: 'serverInfo.name is empty or missing' });
    }
    if (!result.serverInfo.version) {
      issues.push({ level: 'warning', field: 'serverInfo.version', message: 'serverInfo.version is empty or missing' });
    }
  }

  if (!result.capabilities || typeof result.capabilities !== 'object') {
    issues.push({ level: 'error', field: 'capabilities', message: 'Missing or invalid capabilities in initialize result' });
  }

  return { valid: issues.filter(i => i.level === 'error').length === 0, issues };
}

export function validateTool(tool: MCPTool): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!tool.name || typeof tool.name !== 'string') {
    issues.push({ level: 'error', field: 'name', message: 'Tool name is required and must be a string' });
  } else if (!/^[a-zA-Z0-9_-]+$/.test(tool.name)) {
    issues.push({ level: 'warning', field: 'name', message: 'Tool name "' + tool.name + '" contains unusual characters (expected a-z, A-Z, 0-9, _ -)' });
  }

  if (!tool.description) {
    issues.push({ level: 'warning', field: 'description', message: 'Tool "' + (tool.name || '?') + '" has no description' });
  }

  if (tool.inputSchema) {
    if (tool.inputSchema.type !== 'object') {
      issues.push({ level: 'warning', field: 'inputSchema.type', message: 'Tool "' + tool.name + '" inputSchema.type should be "object" (got "' + tool.inputSchema.type + '")' });
    }
  } else {
    issues.push({ level: 'info', field: 'inputSchema', message: 'Tool "' + (tool.name || '?') + '" has no inputSchema' });
  }

  return { valid: issues.filter(i => i.level === 'error').length === 0, issues };
}

export function validateTools(tools: MCPTool[]): ValidationResult {
  const allIssues: ValidationIssue[] = [];
  const names = new Set<string>();

  for (const tool of tools) {
    const r = validateTool(tool);
    allIssues.push(...r.issues);
    if (tool.name) {
      if (names.has(tool.name)) {
        allIssues.push({ level: 'error', field: 'name', message: 'Duplicate tool name: "' + tool.name + '"' });
      }
      names.add(tool.name);
    }
  }

  return { valid: allIssues.filter(i => i.level === 'error').length === 0, issues: allIssues };
}

export function validateResource(resource: MCPResource): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!resource.uri || typeof resource.uri !== 'string') {
    issues.push({ level: 'error', field: 'uri', message: 'Resource URI is required and must be a string' });
  } else {
    try {
      new URL(resource.uri);
    } catch {
      // Check if it's a valid relative URI scheme
      if (!/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(resource.uri) && !resource.uri.startsWith('/')) {
        issues.push({ level: 'warning', field: 'uri', message: 'Resource URI "' + resource.uri + '" may not be a valid URI' });
      }
    }
  }

  if (resource.mimeType && typeof resource.mimeType === 'string') {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]*$/.test(resource.mimeType)) {
      issues.push({ level: 'warning', field: 'mimeType', message: 'Resource "' + resource.uri + '" has unusual mimeType: "' + resource.mimeType + '"' });
    }
  }

  return { valid: issues.filter(i => i.level === 'error').length === 0, issues };
}

export function validateResources(resources: MCPResource[]): ValidationResult {
  const allIssues: ValidationIssue[] = [];
  const uris = new Set<string>();

  for (const resource of resources) {
    const r = validateResource(resource);
    allIssues.push(...r.issues);
    if (resource.uri) {
      if (uris.has(resource.uri)) {
        allIssues.push({ level: 'error', field: 'uri', message: 'Duplicate resource URI: "' + resource.uri + '"' });
      }
      uris.add(resource.uri);
    }
  }

  return { valid: allIssues.filter(i => i.level === 'error').length === 0, issues: allIssues };
}

export function validatePrompt(prompt: MCPPrompt): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!prompt.name || typeof prompt.name !== 'string') {
    issues.push({ level: 'error', field: 'name', message: 'Prompt name is required and must be a string' });
  }

  if (!prompt.description) {
    issues.push({ level: 'warning', field: 'description', message: 'Prompt "' + (prompt.name || '?') + '" has no description' });
  }

  if (prompt.arguments) {
    const argNames = new Set<string>();
    for (const arg of prompt.arguments) {
      if (!arg.name) {
        issues.push({ level: 'error', field: 'arguments[].name', message: 'Prompt argument has no name in "' + (prompt.name || '?') + '"' });
      } else if (argNames.has(arg.name)) {
        issues.push({ level: 'error', field: 'arguments[].name', message: 'Duplicate argument name "' + arg.name + '" in prompt "' + prompt.name + '"' });
      } else {
        argNames.add(arg.name);
      }
    }
  }

  return { valid: issues.filter(i => i.level === 'error').length === 0, issues };
}

export function validatePrompts(prompts: MCPPrompt[]): ValidationResult {
  const allIssues: ValidationIssue[] = [];
  const names = new Set<string>();

  for (const prompt of prompts) {
    const r = validatePrompt(prompt);
    allIssues.push(...r.issues);
    if (prompt.name) {
      if (names.has(prompt.name)) {
        allIssues.push({ level: 'error', field: 'name', message: 'Duplicate prompt name: "' + prompt.name + '"' });
      }
      names.add(prompt.name);
    }
  }

  return { valid: allIssues.filter(i => i.level === 'error').length === 0, issues: allIssues };
}
