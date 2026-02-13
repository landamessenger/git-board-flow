/**
 * Replaces {{paramName}} placeholders in a template with values from params.
 * Missing keys are left as {{paramName}}.
 */
export function fillTemplate(template: string, params: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => params[key] ?? `{{${key}}}`);
}
