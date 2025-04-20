#!/usr/bin/env node
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 481:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


/**
 * CLI Entry Point
 *
 * This script serves as the main entry point for the CLI application.
 * It determines the appropriate binary to execute based on the current
 * platform (macOS/Linux) and architecture (x64/arm64).
 *
 * The script:
 * 1. Detects the current platform and architecture
 * 2. Maps them to the corresponding pre-built binary path
 * 3. Executes the binary with the provided command line arguments
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const os_1 = __importDefault(__nccwpck_require__(37));
const child_process_1 = __nccwpck_require__(81);
// Get current platform and architecture
const platform = os_1.default.platform();
const arch = os_1.default.arch();
let execTarget = null;
// Map platform and architecture to the correct binary path
if (platform === 'darwin') {
    execTarget = arch === 'arm64'
        ? './build/cli/macos/arm64/index.js'
        : './build/cli/macos/x64/index.js';
}
else if (platform === 'linux') {
    execTarget = arch === 'arm64'
        ? './build/cli/linux/arm64/index.js'
        : './build/cli/linux/x64/index.js';
}
// Validate that we have a supported platform/architecture combination
if (!execTarget) {
    throw new Error(`Unsupported platform (${platform}) or architecture (${arch})`);
}
// Pass through all command line arguments to the target binary
const args = process.argv.slice(2).join(' ');
// Execute the target binary with the provided arguments
(0, child_process_1.execSync)(`node ${execTarget} ${args}`, { stdio: 'inherit' });


/***/ }),

/***/ 81:
/***/ ((module) => {

module.exports = require("child_process");

/***/ }),

/***/ 37:
/***/ ((module) => {

module.exports = require("os");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId].call(module.exports, module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __nccwpck_require__(481);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;