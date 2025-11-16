/**
 * MCP Transport
 * Handles communication with MCP servers via different transports
 */
import { MCPMessage } from './types';
export interface MCPTransport {
    send(message: MCPMessage): Promise<void>;
    receive(): Promise<MCPMessage>;
    close(): Promise<void>;
    isConnected(): boolean;
}
/**
 * STDIO Transport - for local processes
 */
export declare class StdioTransport implements MCPTransport {
    private command;
    private args;
    private env;
    private process?;
    private messageQueue;
    private messageHandlers;
    private connected;
    constructor(command: string, args?: string[], env?: Record<string, string>);
    connect(): Promise<void>;
    send(message: MCPMessage): Promise<void>;
    receive(): Promise<MCPMessage>;
    private handleMessage;
    sendRequest(method: string, params?: any): Promise<MCPMessage>;
    close(): Promise<void>;
    isConnected(): boolean;
}
/**
 * HTTP Transport - for remote MCP servers
 */
export declare class HTTPTransport implements MCPTransport {
    private url;
    private headers;
    private connected;
    constructor(url: string, headers?: Record<string, string>);
    connect(): Promise<void>;
    send(message: MCPMessage): Promise<void>;
    receive(): Promise<MCPMessage>;
    sendRequest(method: string, params?: any): Promise<MCPMessage>;
    close(): Promise<void>;
    isConnected(): boolean;
}
/**
 * SSE Transport - for Server-Sent Events
 */
export declare class SSETransport implements MCPTransport {
    private url;
    private headers;
    private eventSource?;
    private messageHandlers;
    private connected;
    constructor(url: string, headers?: Record<string, string>);
    connect(): Promise<void>;
    send(message: MCPMessage): Promise<void>;
    receive(): Promise<MCPMessage>;
    close(): Promise<void>;
    isConnected(): boolean;
}
