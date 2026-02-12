let loggerDebug = false;
let loggerRemote = false;
let structuredLogging = false;

export interface LogEntry {
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export function setGlobalLoggerDebug(debug: boolean, isRemote: boolean = false) {
    loggerDebug = debug;
    loggerRemote = isRemote;
}

export function setStructuredLogging(enabled: boolean) {
    structuredLogging = enabled;
}

function formatStructuredLog(entry: LogEntry): string {
    return JSON.stringify(entry);
}

export function logInfo(message: string, previousWasSingleLine: boolean = false, metadata?: Record<string, unknown>) {
    if (previousWasSingleLine && !loggerRemote) {
        console.log()
    }
    
    if (structuredLogging) {
        console.log(formatStructuredLog({
            level: 'info',
            message,
            timestamp: Date.now(),
            metadata
        }));
    } else {
        console.log(message);
    }
}

export function logWarn(message: string, metadata?: Record<string, unknown>) {
    if (structuredLogging) {
        console.warn(formatStructuredLog({
            level: 'warn',
            message,
            timestamp: Date.now(),
            metadata
        }));
    } else {
        console.warn(message);
    }
}

export function logWarning(message: string) {
    logWarn(message);
}

export function logError(message: unknown, metadata?: Record<string, unknown>) {
    const errorMessage = message instanceof Error ? message.message : String(message);
    
    if (structuredLogging) {
        console.error(formatStructuredLog({
            level: 'error',
            message: errorMessage,
            timestamp: Date.now(),
            metadata: {
                ...metadata,
                stack: message instanceof Error ? message.stack : undefined
            }
        }));
    } else {
        console.error(errorMessage);
    }
}

export function logDebugInfo(message: string, previousWasSingleLine: boolean = false, metadata?: Record<string, unknown>) {
    if (loggerDebug) {
        if (structuredLogging) {
            console.log(formatStructuredLog({
                level: 'debug',
                message,
                timestamp: Date.now(),
                metadata
            }));
        } else {
            logInfo(message, previousWasSingleLine);
        }
    }
}

export function logDebugWarning(message: string) {
    if (loggerDebug) {
        logWarning(message);
    }
}

export function logDebugError(message: unknown) {
    if (loggerDebug) {
        logError(message);
    }
}
