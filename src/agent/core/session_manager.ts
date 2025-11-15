/**
 * Session Manager
 * Manages agent sessions with persistence
 */

import { Message } from '../types/message_types';
import { AgentResult, Metrics } from '../types/agent_types';
import * as fs from 'fs';
import * as path from 'path';
import { logInfo, logError } from '../../utils/logger';

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

export class SessionManager {
  private sessionsDir: string;

  constructor(sessionsDir: string = '.agent-sessions') {
    this.sessionsDir = sessionsDir;
    this.ensureSessionsDir();
  }

  /**
   * Ensure sessions directory exists
   */
  private ensureSessionsDir(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Get session file path
   */
  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  /**
   * Save session
   */
  async saveSession(sessionId: string, messages: Message[], result?: AgentResult): Promise<void> {
    try {
      const metadata: SessionMetadata = {
        sessionId,
        createdAt: this.getSessionCreatedAt(sessionId) || Date.now(),
        lastUpdated: Date.now(),
        messageCount: messages.length,
        turnCount: result?.turns.length || 0,
        toolCallCount: result?.toolCalls.length || 0,
        metrics: result?.metrics
      };

      const sessionData: SessionData = {
        metadata,
        messages
      };

      const filePath = this.getSessionPath(sessionId);
      fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
      
      logInfo(`💾 Session saved: ${sessionId}`);
    } catch (error) {
      logError(`Failed to save session ${sessionId}: ${error}`);
      throw error;
    }
  }

  /**
   * Load session
   */
  async loadSession(sessionId: string): Promise<SessionData | null> {
    try {
      const filePath = this.getSessionPath(sessionId);
      
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const sessionData: SessionData = JSON.parse(content);
      
      logInfo(`📂 Session loaded: ${sessionId}`);
      return sessionData;
    } catch (error) {
      logError(`Failed to load session ${sessionId}: ${error}`);
      return null;
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const filePath = this.getSessionPath(sessionId);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logInfo(`🗑️ Session deleted: ${sessionId}`);
      }
    } catch (error) {
      logError(`Failed to delete session ${sessionId}: ${error}`);
      throw error;
    }
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<SessionMetadata[]> {
    try {
      const files = fs.readdirSync(this.sessionsDir);
      const sessions: SessionMetadata[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const sessionId = file.replace('.json', '');
          const session = await this.loadSession(sessionId);
          if (session) {
            sessions.push(session.metadata);
          }
        }
      }

      return sessions.sort((a, b) => b.lastUpdated - a.lastUpdated);
    } catch (error) {
      logError(`Failed to list sessions: ${error}`);
      return [];
    }
  }

  /**
   * Get session creation time
   */
  private getSessionCreatedAt(sessionId: string): number | null {
    try {
      const session = this.loadSession(sessionId);
      return session ? (session as any).metadata?.createdAt || null : null;
    } catch {
      return null;
    }
  }

  /**
   * Generate new session ID
   */
  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

