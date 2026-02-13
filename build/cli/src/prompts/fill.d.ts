/**
 * Replaces {{paramName}} placeholders in a template with values from params.
 * Missing keys are left as {{paramName}}.
 */
export declare function fillTemplate(template: string, params: Record<string, string>): string;
