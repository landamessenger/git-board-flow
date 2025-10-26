/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 846:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


/**
 * This script serves as a runner for GitHub Actions, determining the appropriate
 * executable path based on the platform and architecture, and executing it with
 * the necessary environment variables.
 *
 * It handles different combinations of:
 * - Platforms: macOS (darwin) and Linux
 * - Architectures: arm64 and x64
 *
 * The script also sets up environment variables for the GitHub Action,
 * including passing through all INPUT_* variables from the parent process.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
const os_1 = __importDefault(__nccwpck_require__(37));
const child_process_1 = __nccwpck_require__(81);
const path_1 = __importDefault(__nccwpck_require__(17));
// Get current platform and architecture
const platform = os_1.default.platform();
const arch = os_1.default.arch();
/**
 * Path to the executable that will be run based on platform and architecture
 */
let execTarget = null;
// Get the directory where this script is located
const scriptDir = __dirname;
// Determine the correct executable path based on platform and architecture
if (platform === 'darwin') {
    execTarget = arch === 'arm64'
        ? path_1.default.join(scriptDir, 'macos', 'arm64', 'index.js')
        : path_1.default.join(scriptDir, 'macos', 'x64', 'index.js');
}
else if (platform === 'linux') {
    execTarget = arch === 'arm64'
        ? path_1.default.join(scriptDir, 'linux', 'arm64', 'index.js')
        : path_1.default.join(scriptDir, 'linux', 'x64', 'index.js');
}
// Validate that we have a valid executable path
if (!execTarget) {
    throw new Error(`Unsupported platform (${platform}) or architecture (${arch})`);
}
/**
 * Execute the target script with:
 * - Inherited stdio for proper output handling
 * - All environment variables from the parent process
 * - A dummy variable for testing purposes
 * - All INPUT_* variables passed as a JSON string in INPUT_VARS_JSON
 */
(0, child_process_1.execSync)(`node ${execTarget}`, {
    stdio: 'inherit',
    env: {
        ...process.env,
        INPUT_VARS_JSON: JSON.stringify(Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('INPUT_'))))
    }
});


/***/ }),

/***/ 81:
/***/ ((module) => {

module.exports = require("child_process");

/***/ }),

/***/ 37:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 17:
/***/ ((module) => {

module.exports = require("path");

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
/******/ 	var __webpack_exports__ = __nccwpck_require__(846);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;