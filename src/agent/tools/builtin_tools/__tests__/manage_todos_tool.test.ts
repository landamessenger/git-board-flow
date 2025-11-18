/**
 * Tests for Manage TODOs Tool
 */

import { ManageTodosTool } from '../manage_todos_tool';
import { TodoStatus, TodoAction } from '../../../../data/model/think_response';

describe('ManageTodosTool', () => {
  let tool: ManageTodosTool;
  let createTodo: jest.Mock;
  let updateTodo: jest.Mock;
  let getAllTodos: jest.Mock;
  let getActiveTodos: jest.Mock;

  beforeEach(() => {
    createTodo = jest.fn();
    updateTodo = jest.fn();
    getAllTodos = jest.fn();
    getActiveTodos = jest.fn();

    tool = new ManageTodosTool({
      createTodo,
      updateTodo,
      getAllTodos,
      getActiveTodos
    });
  });

  describe('getName', () => {
    it('should return correct tool name', () => {
      expect(tool.getName()).toBe('manage_todos');
    });
  });

  describe('getDescription', () => {
    it('should return description', () => {
      const description = tool.getDescription();
      expect(description).toBeDefined();
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
      expect(description).toContain('TODO');
    });
  });

  describe('getInputSchema', () => {
    it('should return valid input schema', () => {
      const schema = tool.getInputSchema();
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.required).toContain('action');
    });

    it('should have action enum with TodoAction values', () => {
      const schema = tool.getInputSchema();
      expect(schema.properties.action.type).toBe('string');
      expect(schema.properties.action.enum).toEqual(Object.values(TodoAction));
    });

    it('should have status enum with TodoStatus values', () => {
      const schema = tool.getInputSchema();
      expect(schema.properties.status.type).toBe('string');
      expect(schema.properties.status.enum).toEqual(Object.values(TodoStatus));
    });

    it('should have content field', () => {
      const schema = tool.getInputSchema();
      expect(schema.properties.content.type).toBe('string');
    });

    it('should have todo_id field', () => {
      const schema = tool.getInputSchema();
      expect(schema.properties.todo_id.type).toBe('string');
    });

    it('should have notes field', () => {
      const schema = tool.getInputSchema();
      expect(schema.properties.notes.type).toBe('string');
    });
  });

  describe('execute - CREATE action', () => {
    it('should create TODO with valid input', async () => {
      createTodo.mockReturnValue({
        id: 'todo_1',
        content: 'Test task',
        status: TodoStatus.PENDING
      });

      const result = await tool.execute({
        action: TodoAction.CREATE,
        content: 'Test task',
        status: TodoStatus.PENDING
      });

      expect(createTodo).toHaveBeenCalledWith('Test task', TodoStatus.PENDING);
      expect(result).toContain('TODO created');
      expect(result).toContain('todo_1');
      expect(result).toContain('Test task');
    });

    it('should create TODO with default status when not provided', async () => {
      createTodo.mockReturnValue({
        id: 'todo_1',
        content: 'Test task',
        status: TodoStatus.PENDING
      });

      const result = await tool.execute({
        action: TodoAction.CREATE,
        content: 'Test task'
      });

      expect(createTodo).toHaveBeenCalledWith('Test task', TodoStatus.PENDING);
      expect(result).toContain('TODO created');
    });

    it('should accept IN_PROGRESS status for new TODO', async () => {
      createTodo.mockReturnValue({
        id: 'todo_1',
        content: 'Test task',
        status: TodoStatus.IN_PROGRESS
      });

      const result = await tool.execute({
        action: TodoAction.CREATE,
        content: 'Test task',
        status: TodoStatus.IN_PROGRESS
      });

      expect(createTodo).toHaveBeenCalledWith('Test task', TodoStatus.IN_PROGRESS);
      expect(result).toContain('TODO created');
    });

    it('should accept alternative field names for content', async () => {
      createTodo.mockReturnValue({
        id: 'todo_1',
        content: 'Test task',
        status: TodoStatus.PENDING
      });

      // Test with 'description' field
      await tool.execute({
        action: TodoAction.CREATE,
        description: 'Test task'
      });
      expect(createTodo).toHaveBeenCalledWith('Test task', TodoStatus.PENDING);

      // Test with 'text' field
      await tool.execute({
        action: TodoAction.CREATE,
        text: 'Test task'
      });
      expect(createTodo).toHaveBeenCalledWith('Test task', TodoStatus.PENDING);

      // Test with 'task' field
      await tool.execute({
        action: TodoAction.CREATE,
        task: 'Test task'
      });
      expect(createTodo).toHaveBeenCalledWith('Test task', TodoStatus.PENDING);
    });

    it('should throw error if content is missing', async () => {
      await expect(tool.execute({
        action: TodoAction.CREATE
      })).rejects.toThrow('content is required');
    });

    it('should throw error if content is not a string', async () => {
      await expect(tool.execute({
        action: TodoAction.CREATE,
        content: 123
      })).rejects.toThrow('content is required');
    });

    it('should throw error if status is COMPLETED for new TODO', async () => {
      await expect(tool.execute({
        action: TodoAction.CREATE,
        content: 'Test task',
        status: TodoStatus.COMPLETED
      })).rejects.toThrow('status for create must be');
    });

    it('should throw error if status is CANCELLED for new TODO', async () => {
      await expect(tool.execute({
        action: TodoAction.CREATE,
        content: 'Test task',
        status: TodoStatus.CANCELLED
      })).rejects.toThrow('status for create must be');
    });
  });

  describe('execute - UPDATE action', () => {
    it('should update TODO status successfully', async () => {
      updateTodo.mockReturnValue(true);

      const result = await tool.execute({
        action: TodoAction.UPDATE,
        todo_id: 'todo_1',
        status: TodoStatus.IN_PROGRESS
      });

      expect(updateTodo).toHaveBeenCalledWith('todo_1', {
        status: TodoStatus.IN_PROGRESS,
        notes: undefined
      });
      expect(result).toContain('TODO updated');
      expect(result).toContain('todo_1');
    });

    it('should update TODO notes successfully', async () => {
      updateTodo.mockReturnValue(true);

      const result = await tool.execute({
        action: TodoAction.UPDATE,
        todo_id: 'todo_1',
        notes: 'Working on it'
      });

      expect(updateTodo).toHaveBeenCalledWith('todo_1', {
        status: undefined,
        notes: 'Working on it'
      });
      expect(result).toContain('TODO updated');
    });

    it('should update both status and notes', async () => {
      updateTodo.mockReturnValue(true);

      const result = await tool.execute({
        action: TodoAction.UPDATE,
        todo_id: 'todo_1',
        status: TodoStatus.COMPLETED,
        notes: 'Done!'
      });

      expect(updateTodo).toHaveBeenCalledWith('todo_1', {
        status: TodoStatus.COMPLETED,
        notes: 'Done!'
      });
      expect(result).toContain('TODO updated');
    });

    it('should allow updating to COMPLETED status', async () => {
      updateTodo.mockReturnValue(true);

      const result = await tool.execute({
        action: TodoAction.UPDATE,
        todo_id: 'todo_1',
        status: TodoStatus.COMPLETED
      });

      expect(updateTodo).toHaveBeenCalledWith('todo_1', {
        status: TodoStatus.COMPLETED,
        notes: undefined
      });
      expect(result).toContain('TODO updated');
    });

    it('should allow updating to CANCELLED status', async () => {
      updateTodo.mockReturnValue(true);

      const result = await tool.execute({
        action: TodoAction.UPDATE,
        todo_id: 'todo_1',
        status: TodoStatus.CANCELLED
      });

      expect(updateTodo).toHaveBeenCalledWith('todo_1', {
        status: TodoStatus.CANCELLED,
        notes: undefined
      });
      expect(result).toContain('TODO updated');
    });

    it('should return error message if TODO not found', async () => {
      updateTodo.mockReturnValue(false);

      const result = await tool.execute({
        action: TodoAction.UPDATE,
        todo_id: 'todo_nonexistent',
        status: TodoStatus.IN_PROGRESS
      });

      expect(result).toContain('Error: TODO [todo_nonexistent] not found');
    });

    it('should throw error if todo_id is missing', async () => {
      await expect(tool.execute({
        action: TodoAction.UPDATE,
        status: TodoStatus.IN_PROGRESS
      })).rejects.toThrow('todo_id is required');
    });

    it('should throw error if status is invalid', async () => {
      await expect(tool.execute({
        action: TodoAction.UPDATE,
        todo_id: 'todo_1',
        status: 'invalid_status'
      })).rejects.toThrow('status must be one of');
    });
  });

  describe('execute - LIST action', () => {
    it('should return formatted list of all TODOs', async () => {
      getAllTodos.mockReturnValue([
        {
          id: 'todo_1',
          content: 'Task 1',
          status: TodoStatus.PENDING
        },
        {
          id: 'todo_2',
          content: 'Task 2',
          status: TodoStatus.IN_PROGRESS,
          notes: 'Working on it'
        },
        {
          id: 'todo_3',
          content: 'Task 3',
          status: TodoStatus.COMPLETED
        }
      ]);

      getActiveTodos.mockReturnValue([
        {
          id: 'todo_1',
          content: 'Task 1',
          status: TodoStatus.PENDING
        },
        {
          id: 'todo_2',
          content: 'Task 2',
          status: TodoStatus.IN_PROGRESS
        }
      ]);

      const result = await tool.execute({
        action: TodoAction.LIST
      });

      expect(getAllTodos).toHaveBeenCalled();
      expect(getActiveTodos).toHaveBeenCalled();
      expect(result).toContain('TODO List');
      expect(result).toContain('3 total');
      expect(result).toContain('2 active');
      expect(result).toContain('todo_1');
      expect(result).toContain('todo_2');
      expect(result).toContain('todo_3');
      expect(result).toContain('Task 1');
      expect(result).toContain('Task 2');
      expect(result).toContain('Task 3');
      expect(result).toContain('Working on it');
    });

    it('should return empty message when no TODOs exist', async () => {
      getAllTodos.mockReturnValue([]);
      getActiveTodos.mockReturnValue([]);

      const result = await tool.execute({
        action: TodoAction.LIST
      });

      expect(result).toBe('No TODOs found.');
    });

    it('should include emojis for different statuses', async () => {
      getAllTodos.mockReturnValue([
        {
          id: 'todo_1',
          content: 'Pending task',
          status: TodoStatus.PENDING
        },
        {
          id: 'todo_2',
          content: 'In progress task',
          status: TodoStatus.IN_PROGRESS
        },
        {
          id: 'todo_3',
          content: 'Completed task',
          status: TodoStatus.COMPLETED
        },
        {
          id: 'todo_4',
          content: 'Cancelled task',
          status: TodoStatus.CANCELLED
        }
      ]);

      getActiveTodos.mockReturnValue([
        {
          id: 'todo_1',
          content: 'Pending task',
          status: TodoStatus.PENDING
        },
        {
          id: 'todo_2',
          content: 'In progress task',
          status: TodoStatus.IN_PROGRESS
        }
      ]);

      const result = await tool.execute({
        action: TodoAction.LIST
      });

      expect(result).toContain('⏳'); // Pending emoji
      expect(result).toContain('🔄'); // In progress emoji
      expect(result).toContain('✅'); // Completed emoji
      expect(result).toContain('❌'); // Cancelled emoji
    });
  });

  describe('execute - validation', () => {
    it('should throw error if action is invalid', async () => {
      await expect(tool.execute({
        action: 'invalid_action'
      })).rejects.toThrow('action must be one of');
    });

    it('should throw error if action is missing', async () => {
      await expect(tool.execute({})).rejects.toThrow('action must be one of');
    });
  });
});

