import { runHealthCheck } from '../src/checks/health';
import { runToolsCheck } from '../src/checks/tools';
import { runResourcesCheck } from '../src/checks/resources';
import { runPromptsCheck } from '../src/checks/prompts';
import { MCPClient, MCPTool, MCPResource, MCPPrompt } from '../src/client';

// Mock MCPClient
function makeMockClient(overrides: Partial<{
  listTools: () => Promise<MCPTool[]>;
  listResources: () => Promise<MCPResource[]>;
  listPrompts: () => Promise<MCPPrompt[]>;
}> = {}): MCPClient {
  const client = {} as unknown as MCPClient;
  (client as unknown as Record<string, unknown>).listTools = overrides.listTools ?? (async () => []);
  (client as unknown as Record<string, unknown>).listResources = overrides.listResources ?? (async () => []);
  (client as unknown as Record<string, unknown>).listPrompts = overrides.listPrompts ?? (async () => []);
  return client;
}

describe('runHealthCheck', () => {
  it('fails immediately with no command for stdio', async () => {
    const result = await runHealthCheck('stdio', undefined, undefined, 100);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('server-command is required');
  });

  it('fails immediately with no url for http', async () => {
    const result = await runHealthCheck('http', undefined, undefined, 100);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('server-url is required');
  });

  it('fails immediately with no url for sse', async () => {
    const result = await runHealthCheck('sse', undefined, undefined, 100);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('server-url is required');
  });

  it('fails with invalid command', async () => {
    const result = await runHealthCheck('stdio', 'this-cmd-does-not-exist-xyz --flag', undefined, 2000);
    expect(result.status).toBe('fail');
  }, 5000);
});

describe('runToolsCheck', () => {
  it('passes with valid tools', async () => {
    const client = makeMockClient({
      listTools: async () => [
        { name: 'get_data', description: 'Gets data', inputSchema: { type: 'object' } }
      ]
    });
    const result = await runToolsCheck(client);
    expect(result.status).toBe('pass');
    expect(result.toolCount).toBe(1);
    expect(result.toolNames).toEqual(['get_data']);
  });

  it('warns with tools missing descriptions', async () => {
    const client = makeMockClient({
      listTools: async () => [{ name: 'tool_a' }]
    });
    const result = await runToolsCheck(client);
    expect(result.status).toBe('warn');
    expect(result.issues.some(i => i.level === 'warning')).toBe(true);
  });

  it('fails with invalid tool name', async () => {
    const client = makeMockClient({
      listTools: async () => [{ name: '' }]
    });
    const result = await runToolsCheck(client);
    expect(result.status).toBe('fail');
  });

  it('skips when method not found', async () => {
    const client = makeMockClient({
      listTools: async () => { throw new Error('Method not found (-32601)'); }
    });
    const result = await runToolsCheck(client);
    expect(result.status).toBe('skip');
  });

  it('fails on other errors', async () => {
    const client = makeMockClient({
      listTools: async () => { throw new Error('Connection reset'); }
    });
    const result = await runToolsCheck(client);
    expect(result.status).toBe('fail');
  });

  it('passes empty tools list', async () => {
    const client = makeMockClient({ listTools: async () => [] });
    const result = await runToolsCheck(client);
    expect(result.status).toBe('pass');
    expect(result.toolCount).toBe(0);
  });
});

describe('runResourcesCheck', () => {
  it('passes with valid resources', async () => {
    const client = makeMockClient({
      listResources: async () => [{ uri: 'file:///data/file.txt', mimeType: 'text/plain' }]
    });
    const result = await runResourcesCheck(client);
    expect(result.status).toBe('pass');
    expect(result.resourceCount).toBe(1);
  });

  it('fails with invalid resource URI', async () => {
    const client = makeMockClient({
      listResources: async () => [{ uri: '' }]
    });
    const result = await runResourcesCheck(client);
    expect(result.status).toBe('fail');
  });

  it('skips when method not found', async () => {
    const client = makeMockClient({
      listResources: async () => { throw new Error('Method not found'); }
    });
    const result = await runResourcesCheck(client);
    expect(result.status).toBe('skip');
  });
});

describe('runPromptsCheck', () => {
  it('passes with valid prompts', async () => {
    const client = makeMockClient({
      listPrompts: async () => [{ name: 'code_review', description: 'Review code', arguments: [{ name: 'code', required: true }] }]
    });
    const result = await runPromptsCheck(client);
    expect(result.status).toBe('pass');
    expect(result.promptCount).toBe(1);
    expect(result.promptNames).toEqual(['code_review']);
  });

  it('fails with invalid prompt (no name)', async () => {
    const client = makeMockClient({
      listPrompts: async () => [{ name: '' }]
    });
    const result = await runPromptsCheck(client);
    expect(result.status).toBe('fail');
  });

  it('skips when method not found', async () => {
    const client = makeMockClient({
      listPrompts: async () => { throw new Error('Method not found (-32601)'); }
    });
    const result = await runPromptsCheck(client);
    expect(result.status).toBe('skip');
  });

  it('warns on prompts without descriptions', async () => {
    const client = makeMockClient({
      listPrompts: async () => [{ name: 'undocumented' }]
    });
    const result = await runPromptsCheck(client);
    expect(result.status).toBe('warn');
  });
});
