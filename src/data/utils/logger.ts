import * as core from "@actions/core";

let loggerDebug = false;

export function setGlobalLoggerDebug(debug: boolean) {
    loggerDebug = debug;
}

export function logInfo(message: string) {
    logDebugInfo(message);
}

export function logWarning(message: string) {
    core.warning(message);
}

export function logError(message: any) {
    logError(message.toString());
}

export function logDebugInfo(message: string) {
    if (loggerDebug) {
        logDebugInfo(message);
    }
}

export function logDebugWarning(message: string) {
    if (loggerDebug) {
        core.warning(message);
    }
}

export function logDebugError(message: any) {
    if (loggerDebug) {
        logError(message.toString());
    }
}
