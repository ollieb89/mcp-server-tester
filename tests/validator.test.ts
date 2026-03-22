import {
  validateInitializeResult,
  validateTool, validateTools,
  validateResource, validateResources,
  validatePrompt, validatePrompts
} from '../src/validator';
import { InitializeResult, MCPTool, MCPResource, MCPPrompt } from '../src/client';

const goodInit: InitializeResult = {
  protocolVersion: '2024-11-05',
  capabilities: { tools: {}, resources: {} },
  serverInfo: { name: 'test-server', version: '1.0.0' }
};

describe('validateInitializeResult', () => {
  it('passes a valid initialize result', () => {
    expect(validateInitializeResult(goodInit).valid).toBe(true);
    expect(validateInitializeResult(goodInit).issues.filter(i => i.level === 'error')).toHaveLength(0);
  });

  it('errors on missing protocolVersion', () => {
    const r = validateInitializeResult({ ...goodInit, protocolVersion: '' });
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.field === 'protocolVersion' && i.level === 'error')).toBe(true);
  });

  it('warns on unknown protocolVersion', () => {
    const r = validateInitializeResult({ ...goodInit, protocolVersion: '2099-01-01' });
    expect(r.issues.some(i => i.field === 'protocolVersion' && i.level === 'warning')).toBe(true);
  });

  it('errors on missing serverInfo', () => {
    const r = validateInitializeResult({ ...goodInit, serverInfo: null as unknown as InitializeResult['serverInfo'] });
    expect(r.valid).toBe(false);
  });

  it('warns on empty serverInfo.name', () => {
    const r = validateInitializeResult({ ...goodInit, serverInfo: { name: '', version: '1.0.0' } });
    expect(r.issues.some(i => i.field === 'serverInfo.name')).toBe(true);
  });

  it('errors on missing capabilities', () => {
    const r = validateInitializeResult({ ...goodInit, capabilities: null as unknown as InitializeResult['capabilities'] });
    expect(r.valid).toBe(false);
  });
});

describe('validateTool', () => {
  const good: MCPTool = { name: 'get_weather', description: 'Gets weather', inputSchema: { type: 'object' } };

  it('passes a valid tool', () => {
    expect(validateTool(good).valid).toBe(true);
  });

  it('errors on missing name', () => {
    expect(validateTool({ ...good, name: '' }).valid).toBe(false);
  });

  it('warns on unusual name characters', () => {
    const r = validateTool({ ...good, name: 'tool with spaces' });
    expect(r.issues.some(i => i.field === 'name' && i.level === 'warning')).toBe(true);
  });

  it('warns on missing description', () => {
    const r = validateTool({ ...good, description: undefined });
    expect(r.issues.some(i => i.field === 'description')).toBe(true);
  });

  it('warns on non-object inputSchema type', () => {
    const r = validateTool({ ...good, inputSchema: { type: 'string' } });
    expect(r.issues.some(i => i.field === 'inputSchema.type')).toBe(true);
  });

  it('emits info on missing inputSchema', () => {
    const r = validateTool({ ...good, inputSchema: undefined });
    expect(r.issues.some(i => i.field === 'inputSchema' && i.level === 'info')).toBe(true);
  });
});

describe('validateTools', () => {
  it('detects duplicate tool names', () => {
    const tools: MCPTool[] = [
      { name: 'my_tool', description: 'a' },
      { name: 'my_tool', description: 'b' }
    ];
    const r = validateTools(tools);
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.message.includes('Duplicate'))).toBe(true);
  });

  it('passes list of valid tools', () => {
    const tools: MCPTool[] = [
      { name: 'tool_a', description: 'desc a', inputSchema: { type: 'object' } },
      { name: 'tool_b', description: 'desc b', inputSchema: { type: 'object' } }
    ];
    expect(validateTools(tools).issues.filter(i => i.level === 'error')).toHaveLength(0);
  });
});

describe('validateResource', () => {
  it('passes a valid resource', () => {
    expect(validateResource({ uri: 'file:///data/example.txt', mimeType: 'text/plain' }).valid).toBe(true);
  });

  it('errors on missing URI', () => {
    expect(validateResource({ uri: '' }).valid).toBe(false);
  });

  it('warns on invalid mimeType', () => {
    const r = validateResource({ uri: 'file:///x', mimeType: 'notamimetype' });
    expect(r.issues.some(i => i.field === 'mimeType')).toBe(true);
  });
});

describe('validateResources', () => {
  it('detects duplicate URIs', () => {
    const resources: MCPResource[] = [{ uri: 'file:///same' }, { uri: 'file:///same' }];
    expect(validateResources(resources).valid).toBe(false);
  });
});

describe('validatePrompt', () => {
  const good: MCPPrompt = { name: 'my_prompt', description: 'A prompt', arguments: [{ name: 'arg1' }] };

  it('passes a valid prompt', () => {
    expect(validatePrompt(good).valid).toBe(true);
  });

  it('errors on missing name', () => {
    expect(validatePrompt({ ...good, name: '' }).valid).toBe(false);
  });

  it('errors on missing argument name', () => {
    const r = validatePrompt({ ...good, arguments: [{ name: '' }] });
    expect(r.valid).toBe(false);
  });

  it('errors on duplicate argument names', () => {
    const r = validatePrompt({ ...good, arguments: [{ name: 'arg1' }, { name: 'arg1' }] });
    expect(r.valid).toBe(false);
  });

  it('warns on missing description', () => {
    const r = validatePrompt({ ...good, description: undefined });
    expect(r.issues.some(i => i.field === 'description')).toBe(true);
  });
});

describe('validatePrompts', () => {
  it('detects duplicate prompt names', () => {
    const prompts: MCPPrompt[] = [{ name: 'p1' }, { name: 'p1' }];
    expect(validatePrompts(prompts).valid).toBe(false);
  });
});
