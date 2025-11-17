/**
 * Copilot Agent Module
 * Exports all public types and classes
 */

export { Copilot } from './copilot';
export type {
  CopilotOptions,
  CopilotResult
} from './types';

// Internal exports for testing
export { SystemPromptBuilder } from './system_prompt_builder';
export { AgentInitializer } from './agent_initializer';
export { SubagentHandler } from './subagent_handler';
export { FilePartitioner } from './file_partitioner';

