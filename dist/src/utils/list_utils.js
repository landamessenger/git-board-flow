"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRandomElement = void 0;
const chance_1 = __importDefault(require("chance"));
const chance = new chance_1.default();
const getRandomElement = (list) => {
    // Return undefined for empty lists
    if (!list?.length) {
        return undefined;
    }
    // Return first element for single item lists
    if (list.length === 1) {
        return list[0];
    }
    // Use chance to get a random index
    const randomIndex = chance.integer({ min: 0, max: list.length - 1 });
    return list[randomIndex];
};
exports.getRandomElement = getRandomElement;
