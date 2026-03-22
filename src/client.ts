import { spawn, ChildProcess } from 'child_process';

// MCP Protocol types (spec 2024-11-05)
export interface MCPRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: Record<string, unknown>;
  error?: { code: number; message: string; data?: unknown };
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

export interface MCPCapabilities {
  tools?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  prompts?: { listChanged?: boolean };
  logging?: Record<string, unknown>;
}

export interface MCPServerInfo {
  name: string;
  version: string;
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: MCPCapabilities;
  serverInfo: MCPServerInfo;
}

export type TransportType = 'stdio' | 'http' | 'sse';

export interface ClientOptions {
  transport: TransportType;
  command?: string;       // for stdio
  url?: string;           // for http/sse
  timeoutMs?: number;
}

export class MCPClient {
  private proc: ChildProcess | null = null;
  private messageId = 1;
  private pendingRequests = new Map<number | string, {
    resolve: (r: MCPResponse) => void;
    reject: (e: Error) => void;
    timer: NodeJS.Timeout;
  }>();
  private buffer = '';
  private connected = false;
  private options: ClientOptions;

  constructor(options: ClientOptions) {
    this.options = { timeoutMs: 10000, ...options };
  }

  async connect(): Promise<void> {
    if (this.options.transport === 'stdio') {
      await this.connectStdio();
    } else {
      throw new Error('Transport ' + this.options.transport + ' requires network; use validateHttpEndpoint for HTTP/SSE');
    }
    this.connected = true;
  }

  private async connectStdio(): Promise<void> {
    if (!this.options.command) throw new Error('server-command is required for stdio transport');
    const parts = this.options.command.trim().split(/\s+/);
    this.proc = spawn(parts[0], parts.slice(1), {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    this.proc.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.proc.stderr?.on('data', (_: Buffer) => {
      // stderr from server — ignore in tests unless debugging
    });

    this.proc.on('error', (err) => {
      this.rejectAll(err);
    });

    this.proc.on('close', (code) => {
      if (code !== 0 && code !== null) {
        this.rejectAll(new Error('MCP server process exited with code ' + code));
      }
    });

    // Give server a moment to start
    await new Promise<void>(resolve => setTimeout(resolve, 200));
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as MCPResponse;
        if ('id' in msg && msg.id !== undefined) {
          const pending = this.pendingRequests.get(msg.id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pendingRequests.delete(msg.id);
            pending.resolve(msg);
          }
        }
      } catch {
        // non-JSON line from server
      }
    }
  }

  private rejectAll(err: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(err);
      this.pendingRequests.delete(id);
    }
  }

  async request(method: string, params?: Record<string, unknown>): Promise<MCPResponse> {
    const id = this.messageId++;
    const req: MCPRequest = { jsonrpc: '2.0', id, method, params };

    return new Promise<MCPResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout: ' + method + ' (id=' + id + ')'));
      }, this.options.timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });

      const line = JSON.stringify(req) + '\n';
      if (this.proc?.stdin) {
        this.proc.stdin.write(line);
      } else {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(new Error('Not connected'));
      }
    });
  }

  async initialize(): Promise<InitializeResult> {
    const resp = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'mcp-server-tester', version: '1.0.0' }
    });
    if (resp.error) throw new Error('initialize failed: ' + resp.error.message);

    // Send initialized notification (no response expected)
    const notification: MCPNotification = { jsonrpc: '2.0', method: 'notifications/initialized' };
    if (this.proc?.stdin) {
      this.proc.stdin.write(JSON.stringify(notification) + '\n');
    }

    return resp.result as unknown as InitializeResult;
  }

  async listTools(): Promise<MCPTool[]> {
    const resp = await this.request('tools/list');
    if (resp.error) throw new Error('tools/list failed: ' + resp.error.message);
    return ((resp.result?.tools ?? []) as MCPTool[]);
  }

  async listResources(): Promise<MCPResource[]> {
    const resp = await this.request('resources/list');
    if (resp.error) throw new Error('resources/list failed: ' + resp.error.message);
    return ((resp.result?.resources ?? []) as MCPResource[]);
  }

  async listPrompts(): Promise<MCPPrompt[]> {
    const resp = await this.request('prompts/list');
    if (resp.error) throw new Error('prompts/list failed: ' + resp.error.message);
    return ((resp.result?.prompts ?? []) as MCPPrompt[]);
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<MCPResponse> {
    return this.request('tools/call', { name, arguments: args });
  }

  isConnected(): boolean { return this.connected; }

  async disconnect(): Promise<void> {
    this.rejectAll(new Error('disconnected'));
    if (this.proc) {
      this.proc.stdin?.end();
      await new Promise<void>(resolve => {
        const t = setTimeout(resolve, 1000);
        this.proc?.on('close', () => { clearTimeout(t); resolve(); });
        this.proc?.kill();
      });
      this.proc = null;
    }
    this.connected = false;
  }
}

// Lightweight HTTP health check (no full MCP handshake)
export async function httpGet(url: string, timeoutMs = 5000): Promise<{ status: number; body: string }> {
  const parsed = new URL(url);
  const isHttps = parsed.protocol === 'https:';
  const mod = isHttps ? await import('https') : await import('http');
  return new Promise((resolve, reject) => {
    const req = mod.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (d: Buffer) => { body += d.toString(); });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('HTTP request timeout')); });
  });
}
