export interface LogEntry {
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    timestamp: number;
    metadata?: Record<string, any>;
}
export declare function setGlobalLoggerDebug(debug: boolean, isRemote?: boolean): void;
export declare function setStructuredLogging(enabled: boolean): void;
export declare function logInfo(message: string, previousWasSingleLine?: boolean, metadata?: Record<string, any>): void;
export declare function logWarn(message: string, metadata?: Record<string, any>): void;
export declare function logWarning(message: string): void;
export declare function logError(message: any, metadata?: Record<string, any>): void;
export declare function logDebugInfo(message: string, previousWasSingleLine?: boolean, metadata?: Record<string, any>): void;
export declare function logDebugWarning(message: string): void;
export declare function logDebugError(message: any): void;
export declare function logSingleLine(message: string): void;
