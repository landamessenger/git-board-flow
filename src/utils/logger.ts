let loggerDebug = false;
let loggerRemote = false;
let structuredLogging = false;

export interface LogEntry {
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

const accumulatedLogEntries: LogEntry[] = [];

/** Removes markdown code fences from message so log output does not break when visualized (e.g. GitHub Actions). */
function sanitizeLogMessage(message: string): string {
    return message.replace(/```/g, '');
}

function pushLogEntry(entry: LogEntry): void {
    accumulatedLogEntries.push(entry);
}

export function getAccumulatedLogEntries(): LogEntry[] {
    return [...accumulatedLogEntries];
}

export function getAccumulatedLogsAsText(): string {
    return accumulatedLogEntries
        .map((e) => {
            const prefix = `[${e.level.toUpperCase()}]`;
            const meta = e.metadata?.stack ? `\n${String(e.metadata.stack)}` : '';
            return `${prefix} ${e.message}${meta}`;
        })
        .join('\n');
}

export function clearAccumulatedLogs(): void {
    accumulatedLogEntries.length = 0;
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

export function logInfo(message: string, previousWasSingleLine: boolean = false, metadata?: Record<string, unknown>, skipAccumulation?: boolean) {
    const sanitized = sanitizeLogMessage(message);
    if (!skipAccumulation) {
        pushLogEntry({ level: 'info', message: sanitized, timestamp: Date.now(), metadata });
    }
    if (previousWasSingleLine && !loggerRemote) {
        console.log()
    }
    
    if (structuredLogging) {
        console.log(formatStructuredLog({
            level: 'info',
            message: sanitized,
            timestamp: Date.now(),
            metadata
        }));
    } else {
        console.log(sanitized);
    }
}

export function logWarn(message: string, metadata?: Record<string, unknown>) {
    const sanitized = sanitizeLogMessage(message);
    pushLogEntry({ level: 'warn', message: sanitized, timestamp: Date.now(), metadata });
    if (structuredLogging) {
        console.warn(formatStructuredLog({
            level: 'warn',
            message: sanitized,
            timestamp: Date.now(),
            metadata
        }));
    } else {
        console.warn(sanitized);
    }
}

export function logWarning(message: string) {
    logWarn(message);
}

export function logError(message: unknown, metadata?: Record<string, unknown>) {
    const errorMessage = message instanceof Error ? message.message : String(message);
    const sanitized = sanitizeLogMessage(errorMessage);
    const metaWithStack = {
        ...metadata,
        stack: message instanceof Error ? message.stack : undefined
    };
    pushLogEntry({ level: 'error', message: sanitized, timestamp: Date.now(), metadata: metaWithStack });
    if (structuredLogging) {
        console.error(formatStructuredLog({
            level: 'error',
            message: sanitized,
            timestamp: Date.now(),
            metadata: metaWithStack
        }));
    } else {
        console.error(sanitized);
    }
}

export function logDebugInfo(message: string, previousWasSingleLine: boolean = false, metadata?: Record<string, unknown>) {
    if (loggerDebug) {
        const sanitized = sanitizeLogMessage(message);
        pushLogEntry({ level: 'debug', message: sanitized, timestamp: Date.now(), metadata });
        if (structuredLogging) {
            console.log(formatStructuredLog({
                level: 'debug',
                message: sanitized,
                timestamp: Date.now(),
                metadata
            }));
        } else {
            logInfo(sanitized, previousWasSingleLine, undefined, true);
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
