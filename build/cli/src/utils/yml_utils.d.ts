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
export declare function loadActionYaml(): ActionYaml;
export declare function getActionInputs(): Record<string, ActionInput>;
export declare function getActionInputsWithDefaults(): Record<string, string>;
export {};
