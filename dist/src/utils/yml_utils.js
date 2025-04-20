"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadActionYaml = loadActionYaml;
exports.getActionInputs = getActionInputs;
exports.getActionInputsWithDefaults = getActionInputsWithDefaults;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const yaml = __importStar(require("js-yaml"));
function loadActionYaml() {
    const actionYamlPath = path.join(process.cwd(), 'action.yml');
    const yamlContent = fs.readFileSync(actionYamlPath, 'utf8');
    return yaml.load(yamlContent);
}
function getActionInputs() {
    const actionYaml = loadActionYaml();
    return actionYaml.inputs;
}
function getActionInputsWithDefaults() {
    const inputs = getActionInputs();
    const inputsWithDefaults = {};
    for (const [key, value] of Object.entries(inputs)) {
        inputsWithDefaults[key] = value.default;
    }
    return inputsWithDefaults;
}
