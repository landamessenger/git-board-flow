/**
 * MCP Transport
 * Handles communication with MCP servers via different transports
 */

import { MCPMessage, MCPError } from './types';
import { logError, logDebugInfo } from '../../utils/logger';
import { spawn, ChildProcess } from 'child_process';

export interface MCPTransport {
  send(message: MCPMessage): Promise<void>;
  receive(): Promise<MCPMessage>;
  close(): Promise<void>;
  isConnected(): boolean;
}

/**
 * STDIO Transport - for local processes
 */
export class StdioTransport implements MCPTransport {
  private process?: ChildProcess;
  private messageQueue: MCPMessage[] = [];
  private messageHandlers: Map<string | number, (message: MCPMessage) => void> = new Map();
  private connected: boolean = false;

  constructor(
    private command: string,
    private args: string[] = [],
    private env: Record<string, string> = {}
  ) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.command, this.args, {
          env: { ...process.env, ...this.env },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let buffer = '';

        this.process.stdout?.on('data', (data: Buffer) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const message: MCPMessage = JSON.parse(line);
                this.handleMessage(message);
              } catch (error) {
                logError(`Failed to parse MCP message: ${error}`);
              }
            }
          }
        });

        this.process.stderr?.on('data', (data: Buffer) => {
          logDebugInfo(`MCP stderr: ${data.toString()}`);
        });

        this.process.on('exit', (code) => {
          this.connected = false;
          logDebugInfo(`MCP process exited with code ${code}`);
        });

        this.process.on('error', (error) => {
          this.connected = false;
          reject(error);
        });

        this.connected = true;
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async send(message: MCPMessage): Promise<void> {
    if (!this.process || !this.process.stdin) {
      throw new Error('MCP process not connected');
    }

    const json = JSON.stringify(message) + '\n';
    return new Promise((resolve, reject) => {
      this.process!.stdin!.write(json, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async receive(): Promise<MCPMessage> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MCP receive timeout'));
      }, 30000);

      const handler = (message: MCPMessage) => {
        clearTimeout(timeout);
        this.messageHandlers.delete(message.id!);
        resolve(message);
      };

      // Store handler temporarily (will be called by handleMessage)
      const tempId = Date.now();
      this.messageHandlers.set(tempId, handler);
    });
  }

  private handleMessage(message: MCPMessage): void {
    if (message.id !== undefined) {
      const handler = this.messageHandlers.get(message.id);
      if (handler) {
        handler(message);
        return;
      }
    }

    // Handle notifications (no id)
    if (message.method) {
      logDebugInfo(`MCP notification: ${message.method}`);
    }
  }

  async sendRequest(method: string, params?: any): Promise<MCPMessage> {
    const id = Date.now() + Math.random();
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      const handler = (response: MCPMessage) => {
        if (response.error) {
          reject(new Error(`MCP error: ${response.error.message}`));
        } else {
          resolve(response);
        }
      };

      this.messageHandlers.set(id, handler);
      this.send(message).catch(reject);
    });
  }

  async close(): Promise<void> {
    if (this.process) {
      const proc = this.process;
      this.process = undefined;
      this.connected = false;
      
      // Close stdin to signal the process to exit
      if (proc.stdin && !proc.stdin.destroyed) {
        try {
          proc.stdin.end();
        } catch (error) {
          // Ignore errors closing stdin
        }
      }
      
      // Give the process a moment to exit gracefully
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // If still running, kill it
      if (!proc.killed && proc.exitCode === null) {
        try {
          proc.kill('SIGTERM');
          
          // Wait a bit more for graceful shutdown
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Force kill if still running
          if (!proc.killed && proc.exitCode === null) {
            proc.kill('SIGKILL');
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          // Process might already be dead
        }
      }
    } else {
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected && this.process !== undefined;
  }
}

/**
 * HTTP Transport - for remote MCP servers
 */
export class HTTPTransport implements MCPTransport {
  private connected: boolean = false;

  constructor(
    private url: string,
    private headers: Record<string, string> = {}
  ) {}

  async connect(): Promise<void> {
    // HTTP doesn't need explicit connection
    this.connected = true;
  }

  async send(message: MCPMessage): Promise<void> {
    // HTTP transport sends and receives in one call
    // This is handled by sendRequest
  }

  async receive(): Promise<MCPMessage> {
    throw new Error('HTTP transport uses sendRequest instead');
  }

  async sendRequest(method: string, params?: any): Promise<MCPMessage> {
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id: Date.now() + Math.random(),
      method,
      params
    };

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const result = await response.json() as MCPMessage;
      return result;
    } catch (error) {
      throw new Error(`MCP HTTP request failed: ${error}`);
    }
  }

  async close(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * SSE Transport - for Server-Sent Events
 */
export class SSETransport implements MCPTransport {
  private eventSource?: EventSource;
  private messageHandlers: Map<string | number, (message: MCPMessage) => void> = new Map();
  private connected: boolean = false;

  constructor(
    private url: string,
    private headers: Record<string, string> = {}
  ) {}

  async connect(): Promise<void> {
    // SSE connection handled by browser EventSource or polyfill
    // For Node.js, we'd need a polyfill
    this.connected = true;
  }

  async send(message: MCPMessage): Promise<void> {
    // SSE typically uses HTTP POST for sending
    await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers
      },
      body: JSON.stringify(message)
    });
  }

  async receive(): Promise<MCPMessage> {
    // SSE receives via event stream
    throw new Error('SSE transport not fully implemented for Node.js');
  }

  async close(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

