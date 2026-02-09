import * as fs from 'fs';

jest.mock('fs');

const mockReadFileSync = fs.readFileSync as jest.Mock;

describe('yml_utils', () => {
  beforeEach(() => {
    mockReadFileSync.mockReset();
  });

  describe('loadActionYaml', () => {
    it('loads and parses action.yml with name and inputs', () => {
      const yamlContent = `
name: "Test Action"
description: "Test"
author: "Author"
inputs:
  debug:
    description: "Debug"
    default: "false"
  foo:
    description: "Foo input"
    default: "bar"
`;
      mockReadFileSync.mockReturnValue(yamlContent);

      const { loadActionYaml } = require('../yml_utils');
      const result = loadActionYaml();

      expect(result.name).toBe('Test Action');
      expect(result.description).toBe('Test');
      expect(result.author).toBe('Author');
      expect(result.inputs).toBeDefined();
      expect(result.inputs.debug).toEqual({ description: 'Debug', default: 'false' });
      expect(result.inputs.foo).toEqual({ description: 'Foo input', default: 'bar' });
      expect(mockReadFileSync).toHaveBeenCalledWith(expect.stringContaining('action.yml'), 'utf8');
    });
  });

  describe('getActionInputs', () => {
    it('returns inputs from loaded yaml', () => {
      const yamlContent = `
name: "A"
description: "B"
author: "C"
inputs:
  x:
    description: "X"
    default: "1"
`;
      mockReadFileSync.mockReturnValue(yamlContent);

      const { getActionInputs } = require('../yml_utils');
      const result = getActionInputs();

      expect(result.x).toEqual({ description: 'X', default: '1' });
    });
  });

  describe('getActionInputsWithDefaults', () => {
    it('returns record of input keys to default values', () => {
      const yamlContent = `
name: "A"
description: "B"
author: "C"
inputs:
  debug:
    description: "Debug"
    default: "false"
  name:
    description: "Name"
    default: "world"
`;
      mockReadFileSync.mockReturnValue(yamlContent);

      const { getActionInputsWithDefaults } = require('../yml_utils');
      const result = getActionInputsWithDefaults();

      expect(result.debug).toBe('false');
      expect(result.name).toBe('world');
    });
  });
});
