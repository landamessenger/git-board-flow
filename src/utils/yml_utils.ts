import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface ActionInput {
  description: string;
  default: string;
}

interface ActionYaml {
  name: string;
  description: string;
  author: string;
  inputs: Record<string, ActionInput>;
}

export function loadActionYaml(): ActionYaml {
  const actionYamlPath = path.join(process.cwd(), 'action.yml');
  const yamlContent = fs.readFileSync(actionYamlPath, 'utf8');
  return yaml.load(yamlContent) as ActionYaml;
}

export function getActionInputs(): Record<string, ActionInput> {
  const actionYaml = loadActionYaml();
  return actionYaml.inputs;
}

export function getActionInputsWithDefaults(): Record<string, string> {
  const inputs = getActionInputs();
  const inputsWithDefaults: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(inputs)) {
    inputsWithDefaults[key] = value.default;
  }
  
  return inputsWithDefaults;
}
