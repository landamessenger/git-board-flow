/**
 * Shared instruction for every prompt we send to OpenCode about the project.
 * Tells the agent to read not only the code (respecting ignore patterns) but also
 * the repository documentation and defined rules, for a full picture and better decisions.
 */
export declare const OPENCODE_PROJECT_CONTEXT_INSTRUCTION = "**Important \u2013 use full project context:** In addition to reading the relevant code (respecting any file ignore patterns specified), read the repository documentation (e.g. README, docs/) and any defined rules or conventions (e.g. .cursor/rules, CONTRIBUTING, project guidelines). This gives you a complete picture of the project and leads to better decisions in both quality of reasoning and efficiency.";
