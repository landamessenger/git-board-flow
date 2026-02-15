export interface LogEntry {
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}
export declare function getAccumulatedLogEntries(): LogEntry[];
export declare function getAccumulatedLogsAsText(): string;
export declare function clearAccumulatedLogs(): void;
export declare function setGlobalLoggerDebug(debug: boolean, isRemote?: boolean): void;
export declare function setStructuredLogging(enabled: boolean): void;
export declare function logInfo(message: string, previousWasSingleLine?: boolean, metadata?: Record<string, unknown>, skipAccumulation?: boolean): void;
export declare function logWarn(message: string, metadata?: Record<string, unknown>): void;
export declare function logWarning(message: string): void;
export declare function logError(message: unknown, metadata?: Record<string, unknown>): void;
export declare function logDebugInfo(message: string, previousWasSingleLine?: boolean, metadata?: Record<string, unknown>): void;
export declare function logDebugWarning(message: string): void;
export declare function logDebugError(message: unknown): void;
