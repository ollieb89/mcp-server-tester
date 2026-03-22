import { MCPClient } from '../client';
import { validateResources, ValidationIssue } from '../validator';

export interface ResourcesCheckResult {
  name: 'resources';
  status: 'pass' | 'fail' | 'skip' | 'warn';
  message: string;
  durationMs: number;
  resourceCount: number;
  issues: ValidationIssue[];
  resourceUris: string[];
}

export async function runResourcesCheck(client: MCPClient): Promise<ResourcesCheckResult> {
  const start = Date.now();
  try {
    const resources = await client.listResources();
    const validation = validateResources(resources);
    const durationMs = Date.now() - start;
    const errors = validation.issues.filter(i => i.level === 'error');
    const warnings = validation.issues.filter(i => i.level === 'warning');

    let status: ResourcesCheckResult['status'] = 'pass';
    let message = resources.length + ' resource(s) discovered';
    if (errors.length > 0) {
      status = 'fail';
      message += ', ' + errors.length + ' schema error(s)';
    } else if (warnings.length > 0) {
      status = 'warn';
      message += ', ' + warnings.length + ' warning(s)';
    }

    return { name: 'resources', status, message, durationMs, resourceCount: resources.length, issues: validation.issues, resourceUris: resources.map(r => r.uri) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Method not found') || msg.includes('-32601')) {
      return { name: 'resources', status: 'skip', message: 'Server does not support resources (method not found)', durationMs: Date.now() - start, resourceCount: 0, issues: [], resourceUris: [] };
    }
    return { name: 'resources', status: 'fail', message: 'resources/list failed: ' + msg, durationMs: Date.now() - start, resourceCount: 0, issues: [], resourceUris: [] };
  }
}
