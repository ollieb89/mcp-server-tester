import { MCPClient } from '../client';
import { validatePrompts, ValidationIssue } from '../validator';

export interface PromptsCheckResult {
  name: 'prompts';
  status: 'pass' | 'fail' | 'skip' | 'warn';
  message: string;
  durationMs: number;
  promptCount: number;
  issues: ValidationIssue[];
  promptNames: string[];
}

export async function runPromptsCheck(client: MCPClient): Promise<PromptsCheckResult> {
  const start = Date.now();
  try {
    const prompts = await client.listPrompts();
    const validation = validatePrompts(prompts);
    const durationMs = Date.now() - start;
    const errors = validation.issues.filter(i => i.level === 'error');
    const warnings = validation.issues.filter(i => i.level === 'warning');

    let status: PromptsCheckResult['status'] = 'pass';
    let message = prompts.length + ' prompt(s) discovered';
    if (errors.length > 0) {
      status = 'fail';
      message += ', ' + errors.length + ' schema error(s)';
    } else if (warnings.length > 0) {
      status = 'warn';
      message += ', ' + warnings.length + ' warning(s)';
    }

    return { name: 'prompts', status, message, durationMs, promptCount: prompts.length, issues: validation.issues, promptNames: prompts.map(p => p.name) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Method not found') || msg.includes('-32601')) {
      return { name: 'prompts', status: 'skip', message: 'Server does not support prompts (method not found)', durationMs: Date.now() - start, promptCount: 0, issues: [], promptNames: [] };
    }
    return { name: 'prompts', status: 'fail', message: 'prompts/list failed: ' + msg, durationMs: Date.now() - start, promptCount: 0, issues: [], promptNames: [] };
  }
}
