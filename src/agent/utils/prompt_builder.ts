/**
 * Prompt builder for Agent SDK
 * Builds prompts that include tool definitions and conversation history
 */

import { Message, ContentBlock } from '../types';
import { ToolDefinition } from '../types';

export class PromptBuilder {
  /**
   * Build a complete prompt from messages and tools
   * This converts the message history into a format suitable for OpenRouter
   */
  static buildPrompt(
    messages: Message[],
    tools?: ToolDefinition[]
  ): string {
    const parts: string[] = [];

    // Add system message if present
    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage && typeof systemMessage.content === 'string') {
      parts.push(`## System Instructions\n\n${systemMessage.content}\n\n`);
    }

    // Add tools information if available (simplified)
    if (tools && tools.length > 0) {
      parts.push(this.buildToolsSection(tools));
    }

    // Add conversation history (only last 3 messages to avoid token limit)
    const recentMessages = messages.filter(m => m.role !== 'system').slice(-3);
    if (recentMessages.length > 0) {
      for (const message of recentMessages) {
        // Simplified format - just show role and truncated content
        if (typeof message.content === 'string') {
          const truncated = message.content.length > 200 
            ? message.content.substring(0, 200) + '...' 
            : message.content;
          parts.push(`${message.role}: ${truncated}\n`);
        } else {
          // For content blocks, just show summary
          parts.push(`${message.role}: [${message.content.length} content blocks]\n`);
        }
      }
    }

    // Add current instruction (simplified)
    parts.push('\n## Your Response\n\n');
    parts.push('Respond with JSON: {"response": "your text", "tool_calls": []}');
    parts.push('\n\nProvide your response now:');

    return parts.join('\n');
  }

  /**
   * Build tools section for prompt (simplified to save tokens)
   */
  private static buildToolsSection(tools: ToolDefinition[]): string {
    const parts: string[] = ['## Available Tools\n\n'];
    
    for (const tool of tools) {
      parts.push(`**${tool.name}**: ${tool.description}\n`);
      // Simplified schema - just show required fields
      const required = tool.inputSchema.required || [];
      if (required.length > 0) {
        parts.push(`  Required: ${required.join(', ')}\n`);
      }
    }

    parts.push('\n**Instructions**: Use tools via `tool_calls` array. Format: `{"id": "call_1", "name": "tool_name", "input": {...}}`\n\n');

    return parts.join('\n');
  }

  /**
   * Format a message for the prompt
   */
  private static formatMessage(message: Message): string {
    const role = message.role.toUpperCase();
    
    if (typeof message.content === 'string') {
      return `**${role}**: ${message.content}\n\n`;
    }

    // Handle content blocks
    const blocks: string[] = [];
    for (const block of message.content) {
      if (block.type === 'text') {
        blocks.push(block.text);
      } else if (block.type === 'tool_use') {
        blocks.push(`[Tool Call: ${block.name} with id ${block.id}]`);
      } else if (block.type === 'tool_result') {
        const result = typeof block.content === 'string' 
          ? block.content 
          : JSON.stringify(block.content);
        blocks.push(`[Tool Result for ${block.tool_use_id}]: ${result}`);
      }
    }

    return `**${role}**: ${blocks.join('\n')}\n\n`;
  }

  /**
   * Get response schema for JSON mode
   */
  private static getResponseSchema(): any {
    return {
      type: 'object',
      properties: {
        reasoning: {
          type: 'string',
          description: 'Your reasoning process for this step (optional)'
        },
        response: {
          type: 'string',
          description: 'Your text response to the user'
        },
        tool_calls: {
          type: 'array',
          description: 'List of tools to call (empty array if no tools needed)',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Unique identifier for this tool call'
              },
              name: {
                type: 'string',
                description: 'Name of the tool to call'
              },
              input: {
                type: 'object',
                description: 'Input parameters for the tool'
              }
            },
            required: ['id', 'name', 'input'],
            additionalProperties: false
          }
        }
      },
      required: ['response', 'tool_calls'],
      additionalProperties: false
    };
  }
}

