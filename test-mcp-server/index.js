#!/usr/bin/env node

/**
 * Simple MCP Server for Testing
 * Implements Model Context Protocol over stdio
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Tools available in this MCP server
const tools = [
  {
    name: 'echo',
    description: 'Echo back the input text',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to echo back'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'add',
    description: 'Add two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: {
          type: 'number',
          description: 'First number'
        },
        b: {
          type: 'number',
          description: 'Second number'
        }
      },
      required: ['a', 'b']
    }
  },
  {
    name: 'get_time',
    description: 'Get current time',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'reverse',
    description: 'Reverse a string',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to reverse'
        }
      },
      required: ['text']
    }
  }
];

// Handle incoming messages
rl.on('line', (line) => {
  try {
    const message = JSON.parse(line);
    handleMessage(message);
  } catch (error) {
    sendError(null, -32700, 'Parse error', error.message);
  }
});

function handleMessage(message) {
  const { jsonrpc, id, method, params } = message;

  if (jsonrpc !== '2.0') {
    sendError(id, -32600, 'Invalid Request', 'jsonrpc must be "2.0"');
    return;
  }

  // Handle initialize
  if (method === 'initialize') {
    sendResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: 'test-mcp-server',
        version: '1.0.0'
      }
    });
    return;
  }

  // Handle tools/list
  if (method === 'tools/list') {
    sendResponse(id, {
      tools: tools
    });
    return;
  }

  // Handle tools/call
  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    const tool = tools.find(t => t.name === name);

    if (!tool) {
      sendError(id, -32601, 'Method not found', `Tool "${name}" not found`);
      return;
    }

    // Execute tool
    let result;
    try {
      switch (name) {
        case 'echo':
          result = { content: [{ type: 'text', text: args.text }] };
          break;
        
        case 'add':
          result = { 
            content: [{ 
              type: 'text', 
              text: `Result: ${args.a + args.b}` 
            }] 
          };
          break;
        
        case 'get_time':
          result = { 
            content: [{ 
              type: 'text', 
              text: new Date().toISOString() 
            }] 
          };
          break;
        
        case 'reverse':
          result = { 
            content: [{ 
              type: 'text', 
              text: args.text.split('').reverse().join('') 
            }] 
          };
          break;
        
        default:
          throw new Error(`Tool "${name}" not implemented`);
      }

      sendResponse(id, result);
    } catch (error) {
      sendError(id, -32603, 'Internal error', error.message);
    }
    return;
  }

  // Handle resources/list
  if (method === 'resources/list') {
    sendResponse(id, {
      resources: []
    });
    return;
  }

  // Handle prompts/list
  if (method === 'prompts/list') {
    sendResponse(id, {
      prompts: []
    });
    return;
  }

  // Unknown method
  sendError(id, -32601, 'Method not found', `Method "${method}" not found`);
}

function sendResponse(id, result) {
  const response = {
    jsonrpc: '2.0',
    id,
    result
  };
  console.log(JSON.stringify(response));
}

function sendError(id, code, message, data) {
  const response = {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data
    }
  };
  console.log(JSON.stringify(response));
}

// Handle stdin close (client disconnected)
process.stdin.on('end', () => {
  rl.close();
  process.exit(0);
});

// Handle process termination
process.on('SIGTERM', () => {
  rl.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  rl.close();
  process.exit(0);
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error(JSON.stringify({
    jsonrpc: '2.0',
    error: {
      code: -32603,
      message: 'Internal error',
      data: error.message
    }
  }));
  rl.close();
  process.exit(1);
});

