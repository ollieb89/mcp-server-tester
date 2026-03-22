"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPClient = void 0;
exports.httpGet = httpGet;
const child_process_1 = require("child_process");
class MCPClient {
    constructor(options) {
        this.proc = null;
        this.messageId = 1;
        this.pendingRequests = new Map();
        this.buffer = '';
        this.connected = false;
        this.options = { timeoutMs: 10000, ...options };
    }
    async connect() {
        if (this.options.transport === 'stdio') {
            await this.connectStdio();
        }
        else {
            throw new Error('Transport ' + this.options.transport + ' requires network; use validateHttpEndpoint for HTTP/SSE');
        }
        this.connected = true;
    }
    async connectStdio() {
        if (!this.options.command)
            throw new Error('server-command is required for stdio transport');
        const parts = this.options.command.trim().split(/\s+/);
        this.proc = (0, child_process_1.spawn)(parts[0], parts.slice(1), {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env }
        });
        this.proc.stdout?.on('data', (data) => {
            this.buffer += data.toString();
            this.processBuffer();
        });
        this.proc.stderr?.on('data', (_) => {
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
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    processBuffer() {
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() ?? '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            try {
                const msg = JSON.parse(trimmed);
                if ('id' in msg && msg.id !== undefined) {
                    const pending = this.pendingRequests.get(msg.id);
                    if (pending) {
                        clearTimeout(pending.timer);
                        this.pendingRequests.delete(msg.id);
                        pending.resolve(msg);
                    }
                }
            }
            catch {
                // non-JSON line from server
            }
        }
    }
    rejectAll(err) {
        for (const [id, pending] of this.pendingRequests) {
            clearTimeout(pending.timer);
            pending.reject(err);
            this.pendingRequests.delete(id);
        }
    }
    async request(method, params) {
        const id = this.messageId++;
        const req = { jsonrpc: '2.0', id, method, params };
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error('Request timeout: ' + method + ' (id=' + id + ')'));
            }, this.options.timeoutMs);
            this.pendingRequests.set(id, { resolve, reject, timer });
            const line = JSON.stringify(req) + '\n';
            if (this.proc?.stdin) {
                this.proc.stdin.write(line);
            }
            else {
                clearTimeout(timer);
                this.pendingRequests.delete(id);
                reject(new Error('Not connected'));
            }
        });
    }
    async initialize() {
        const resp = await this.request('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'mcp-server-tester', version: '1.0.0' }
        });
        if (resp.error)
            throw new Error('initialize failed: ' + resp.error.message);
        // Send initialized notification (no response expected)
        const notification = { jsonrpc: '2.0', method: 'notifications/initialized' };
        if (this.proc?.stdin) {
            this.proc.stdin.write(JSON.stringify(notification) + '\n');
        }
        return resp.result;
    }
    async listTools() {
        const resp = await this.request('tools/list');
        if (resp.error)
            throw new Error('tools/list failed: ' + resp.error.message);
        return (resp.result?.tools ?? []);
    }
    async listResources() {
        const resp = await this.request('resources/list');
        if (resp.error)
            throw new Error('resources/list failed: ' + resp.error.message);
        return (resp.result?.resources ?? []);
    }
    async listPrompts() {
        const resp = await this.request('prompts/list');
        if (resp.error)
            throw new Error('prompts/list failed: ' + resp.error.message);
        return (resp.result?.prompts ?? []);
    }
    async callTool(name, args = {}) {
        return this.request('tools/call', { name, arguments: args });
    }
    isConnected() { return this.connected; }
    async disconnect() {
        this.rejectAll(new Error('disconnected'));
        if (this.proc) {
            this.proc.stdin?.end();
            await new Promise(resolve => {
                const t = setTimeout(resolve, 1000);
                this.proc?.on('close', () => { clearTimeout(t); resolve(); });
                this.proc?.kill();
            });
            this.proc = null;
        }
        this.connected = false;
    }
}
exports.MCPClient = MCPClient;
// Lightweight HTTP health check (no full MCP handshake)
async function httpGet(url, timeoutMs = 5000) {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? await Promise.resolve().then(() => __importStar(require('https'))) : await Promise.resolve().then(() => __importStar(require('http')));
    return new Promise((resolve, reject) => {
        const req = mod.get(url, { timeout: timeoutMs }, (res) => {
            let body = '';
            res.on('data', (d) => { body += d.toString(); });
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('HTTP request timeout')); });
    });
}
