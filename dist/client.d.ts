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
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
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
    arguments?: Array<{
        name: string;
        description?: string;
        required?: boolean;
    }>;
}
export interface MCPCapabilities {
    tools?: {
        listChanged?: boolean;
    };
    resources?: {
        subscribe?: boolean;
        listChanged?: boolean;
    };
    prompts?: {
        listChanged?: boolean;
    };
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
    command?: string;
    url?: string;
    timeoutMs?: number;
}
export declare class MCPClient {
    private proc;
    private messageId;
    private pendingRequests;
    private buffer;
    private connected;
    private options;
    constructor(options: ClientOptions);
    connect(): Promise<void>;
    private connectStdio;
    private processBuffer;
    private rejectAll;
    request(method: string, params?: Record<string, unknown>): Promise<MCPResponse>;
    initialize(): Promise<InitializeResult>;
    listTools(): Promise<MCPTool[]>;
    listResources(): Promise<MCPResource[]>;
    listPrompts(): Promise<MCPPrompt[]>;
    callTool(name: string, args?: Record<string, unknown>): Promise<MCPResponse>;
    isConnected(): boolean;
    disconnect(): Promise<void>;
}
export declare function httpGet(url: string, timeoutMs?: number): Promise<{
    status: number;
    body: string;
}>;
