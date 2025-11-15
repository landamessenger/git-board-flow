/**
 * JSON Schema for Agent responses
 * Used with OpenRouter JSON mode
 */

export const AGENT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    response: {
      type: "string",
      description: "Your text response to the user. Explain what you're doing or thinking."
    },
    tool_calls: {
      type: "array",
      description: "List of tools to call. Empty array [] if no tools are needed.",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Unique identifier for this tool call (e.g., 'call_1', 'call_2')"
          },
          name: {
            type: "string",
            description: "Name of the tool to call (must match one of the available tools)"
          },
          input: {
            type: "object",
            description: "Input parameters for the tool (must match the tool's input schema)",
            additionalProperties: false
          }
        },
        required: ["id", "name", "input"],
        additionalProperties: false
      }
    }
  },
  required: ["response", "tool_calls"],
  additionalProperties: false
};

