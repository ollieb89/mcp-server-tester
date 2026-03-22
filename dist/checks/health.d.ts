import { TransportType } from '../client';
export interface HealthCheckResult {
    name: 'health';
    status: 'pass' | 'fail' | 'skip';
    message: string;
    durationMs: number;
    details?: Record<string, unknown>;
}
export declare function runHealthCheck(transport: TransportType, command?: string, url?: string, timeoutMs?: number): Promise<HealthCheckResult>;
