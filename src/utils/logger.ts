import * as core from "@actions/core";

let loggerDebug = false;

export function setGlobalLoggerDebug(debug: boolean) {
    loggerDebug = debug;
}

export function logInfo(message: string) {
    core.info(message);
}

export function logWarning(message: string) {
    core.warning(message);
}

export function logError(message: any) {
    core.error(message.toString());
}

export function logDebugInfo(message: string) {
    if (loggerDebug) {
        logInfo(message);
    }
}

export function logDebugWarning(message: string) {
    if (loggerDebug) {
        logWarning(message);
    }
}

export function logDebugError(message: any) {
    if (loggerDebug) {
        logError(message.toString());
    }
}
