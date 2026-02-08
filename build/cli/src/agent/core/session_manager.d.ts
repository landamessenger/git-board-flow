/**
 * Session Manager
 * Manages agent sessions with persistence
 */
import { Message } from '../types/message_types';
import { AgentResult, Metrics } from '../types/agent_types';
export interface SessionMetadata {
    sessionId: string;
    createdAt: number;
    lastUpdated: number;
    messageCount: number;
    turnCount: number;
    toolCallCount: number;
    metrics?: Metrics;
}
export interface SessionData {
    metadata: SessionMetadata;
    messages: Message[];
}
export declare class SessionManager {
    private sessionsDir;
    constructor(sessionsDir?: string);
    /**
     * Ensure sessions directory exists
     */
    private ensureSessionsDir;
    /**
     * Get session file path
     */
    private getSessionPath;
    /**
     * Save session
     */
    saveSession(sessionId: string, messages: Message[], result?: AgentResult): Promise<void>;
    /**
     * Load session
     */
    loadSession(sessionId: string): Promise<SessionData | null>;
    /**
     * Delete session
     */
    deleteSession(sessionId: string): Promise<void>;
    /**
     * List all sessions
     */
    listSessions(): Promise<SessionMetadata[]>;
    /**
     * Get session creation time
     */
    private getSessionCreatedAt;
    /**
     * Generate new session ID
     */
    generateSessionId(): string;
}
