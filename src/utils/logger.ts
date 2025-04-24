import readline from 'readline';

let loggerDebug = false;
let loggerRemote = false;

export function setGlobalLoggerDebug(debug: boolean, isRemote: boolean = false) {
    loggerDebug = debug;
    loggerRemote = isRemote;
}

export function logInfo(message: string, previousWasSingleLine: boolean = false) {
    if (previousWasSingleLine && !loggerRemote) {
        console.log()
    }
    console.log(message);
}

export function logWarning(message: string) {
    console.warn(message);
}

export function logError(message: any) {
    console.error(message.toString());
}

export function logDebugInfo(message: string, previousWasSingleLine: boolean = false) {
    if (loggerDebug) {
        logInfo(message, previousWasSingleLine);
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

export function logSingleLine(message: string) {
    if (loggerRemote) {
        console.log(message);
        return;
    }
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(message);
}
