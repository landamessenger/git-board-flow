/**
 * Integration-style tests for CheckProgressUseCase with the OpenCode-based flow.
 * Covers edge cases: missing AI config, no issue/branch/description, AI returns undefined/invalid
 * progress, progress 0% (single call; HTTP retries are in AiRepository), success path with label updates.
 */
export {};
