/**
 * Tests for SessionManager
 */

import { SessionManager } from '../core/session_manager';
import { Message } from '../types/message_types';
import * as fs from 'fs';
import * as path from 'path';

describe('SessionManager', () => {
  let manager: SessionManager;
  const testSessionsDir = '.test-sessions';

  beforeEach(() => {
    manager = new SessionManager(testSessionsDir);
    // Clean up test directory
    if (fs.existsSync(testSessionsDir)) {
      fs.readdirSync(testSessionsDir).forEach(file => {
        fs.unlinkSync(path.join(testSessionsDir, file));
      });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testSessionsDir)) {
      fs.readdirSync(testSessionsDir).forEach(file => {
        fs.unlinkSync(path.join(testSessionsDir, file));
      });
      fs.rmdirSync(testSessionsDir);
    }
  });

  describe('saveSession and loadSession', () => {
    it('should save and load session', async () => {
      const sessionId = 'test_session_1';
      const messages: Message[] = [
        { role: 'system', content: 'System message' },
        { role: 'user', content: 'User message' }
      ];

      await manager.saveSession(sessionId, messages);

      const loaded = await manager.loadSession(sessionId);
      
      expect(loaded).not.toBeNull();
      expect(loaded?.messages.length).toBe(2);
      expect(loaded?.metadata.sessionId).toBe(sessionId);
    });

    it('should return null for non-existent session', async () => {
      const loaded = await manager.loadSession('non_existent');
      expect(loaded).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should delete session', async () => {
      const sessionId = 'test_session_2';
      const messages: Message[] = [
        { role: 'user', content: 'Test' }
      ];

      await manager.saveSession(sessionId, messages);
      expect(await manager.loadSession(sessionId)).not.toBeNull();

      await manager.deleteSession(sessionId);
      expect(await manager.loadSession(sessionId)).toBeNull();
    });
  });

  describe('listSessions', () => {
    it('should list all sessions', async () => {
      await manager.saveSession('session1', [{ role: 'user', content: 'Test1' }]);
      await manager.saveSession('session2', [{ role: 'user', content: 'Test2' }]);

      const sessions = await manager.listSessions();
      
      expect(sessions.length).toBeGreaterThanOrEqual(2);
      expect(sessions.some(s => s.sessionId === 'session1')).toBe(true);
      expect(sessions.some(s => s.sessionId === 'session2')).toBe(true);
    });
  });

  describe('generateSessionId', () => {
    it('should generate unique session IDs', () => {
      const id1 = manager.generateSessionId();
      const id2 = manager.generateSessionId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^session_/);
    });
  });
});

