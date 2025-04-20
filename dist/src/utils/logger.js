"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setGlobalLoggerDebug = setGlobalLoggerDebug;
exports.logInfo = logInfo;
exports.logWarning = logWarning;
exports.logError = logError;
exports.logDebugInfo = logDebugInfo;
exports.logDebugWarning = logDebugWarning;
exports.logDebugError = logDebugError;
exports.logSingleLine = logSingleLine;
const readline_1 = __importDefault(require("readline"));
let loggerDebug = false;
function setGlobalLoggerDebug(debug) {
    loggerDebug = debug;
}
function logInfo(message, previousWasSingleLine = false) {
    if (previousWasSingleLine) {
        console.log();
    }
    console.log(message);
}
function logWarning(message) {
    console.warn(message);
}
function logError(message) {
    console.error(message.toString());
}
function logDebugInfo(message, previousWasSingleLine = false) {
    if (loggerDebug) {
        logInfo(message, previousWasSingleLine);
    }
}
function logDebugWarning(message) {
    if (loggerDebug) {
        logWarning(message);
    }
}
function logDebugError(message) {
    if (loggerDebug) {
        logError(message.toString());
    }
}
function logSingleLine(message) {
    readline_1.default.clearLine(process.stdout, 0);
    readline_1.default.cursorTo(process.stdout, 0);
    process.stdout.write(message);
}
