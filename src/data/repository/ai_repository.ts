import { REPO_URL, TITLE } from '../../utils/constants';
import { logDebugInfo, logError } from '../../utils/logger';
import { Ai } from '../model/ai';
import { AI_RESPONSE_JSON_SCHEMA } from '../model/ai_response_schema';
import { THINK_RESPONSE_JSON_SCHEMA } from '../model/think_response_schema';

export class AiRepository {
    ask = async (ai: Ai, prompt: string): Promise<string | undefined> => {
        const model = ai.getOpenRouterModel();
        const apiKey = ai.getOpenRouterApiKey();
        const providerRouting = ai.getProviderRouting();

        if (!model || !apiKey) {
            logError('Missing required AI configuration');
            return undefined;
        }

        logDebugInfo(`🔎 Model: ${model}`);
        logDebugInfo(`🔎 API Key: ***`);
        logDebugInfo(`🔎 Provider Routing: ${JSON.stringify(providerRouting, null, 2)}`);

        const url = `https://openrouter.ai/api/v1/chat/completions`;

        try {
            logDebugInfo(`Sending prompt to ${model}: ${prompt}`);

            const requestBody: any = {
                model: model,
                messages: [
                    { role: 'user', content: prompt },
                ],
            };

            // Add provider routing configuration if it exists and has properties
            if (Object.keys(providerRouting).length > 0) {
                requestBody.provider = providerRouting;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'HTTP-Referer': REPO_URL,
                    'X-Title': TITLE,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Response:', errorText);
                logError(`Error from API: ${response.status} ${response.statusText}`);
                return undefined;
            }

            const data: any = await response.json();
            
            if (!data.choices || data.choices.length === 0) {
                logError('No response content received from API');
                return undefined;
            }

            // logDebugInfo(`Successfully received response from ${model}`);
            return data.choices[0].message.content;
        } catch (error) {
            logError(`Error querying ${model}: ${error}`);
            return undefined;
        }
    }

    askJson = async (
        ai: Ai, 
        prompt: string, 
        schema?: any, 
        schemaName: string = "ai_response"
    ): Promise<any | undefined> => {
        const model = ai.getOpenRouterModel();
        const apiKey = ai.getOpenRouterApiKey();
        const providerRouting = ai.getProviderRouting();

        if (!model || !apiKey) {
            logError('Missing required AI configuration');
            return undefined;
        }

        // logDebugInfo(`🔎 Model: ${model}`);
        // logDebugInfo(`🔎 API Key: ***`);
        // logDebugInfo(`🔎 Provider Routing: ${JSON.stringify(providerRouting, null, 2)}`);

        const url = `https://openrouter.ai/api/v1/chat/completions`;

        // Use provided schema or default to AI_RESPONSE_JSON_SCHEMA
        const responseSchema = schema || AI_RESPONSE_JSON_SCHEMA;

        try {
            const requestBody: any = {
                model: model,
                messages: [
                    { role: 'user', content: prompt },
                ],
                response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: schemaName,
                        schema: responseSchema,
                        strict: true
                    }
                }
            };

            // Add provider routing configuration if it exists and has properties
            if (Object.keys(providerRouting).length > 0) {
                requestBody.provider = providerRouting;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'HTTP-Referer': REPO_URL,
                    'X-Title': TITLE,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Response:', errorText);
                logError(`Error from API: ${response.status} ${response.statusText}`);
                return undefined;
            }

            const data: any = await response.json();
            
            if (!data.choices || data.choices.length === 0) {
                logError('No response content received from API');
                return undefined;
            }

            // logDebugInfo(`Successfully received response from ${model}`);
            const content = data.choices[0].message.content;
            
            // logDebugInfo(`Response: ${content}`);
            return JSON.parse(content);
        } catch (error) {
            logError(`Error querying ${model}: ${error}`);
            return undefined;
        }
    }

    askThinkJson = async (ai: Ai, prompt: string): Promise<any | undefined> => {
        const model = ai.getOpenRouterModel();
        const apiKey = ai.getOpenRouterApiKey();
        const providerRouting = ai.getProviderRouting();

        if (!model || !apiKey) {
            logError('Missing required AI configuration');
            return undefined;
        }

        logDebugInfo(`🔎 Model: ${model}`);
        logDebugInfo(`🔎 API Key: ***`);
        logDebugInfo(`🔎 Provider Routing: ${JSON.stringify(providerRouting, null, 2)}`);

        const url = `https://openrouter.ai/api/v1/chat/completions`;

        try {
            const requestBody: any = {
                model: model,
                messages: [
                    { role: 'user', content: prompt },
                ],
                response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: "think_response",
                        schema: THINK_RESPONSE_JSON_SCHEMA,
                        strict: true
                    }
                }
            };

            // Add provider routing configuration if it exists and has properties
            if (Object.keys(providerRouting).length > 0) {
                requestBody.provider = providerRouting;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'HTTP-Referer': REPO_URL,
                    'X-Title': TITLE,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Response:', errorText);
                logError(`Error from API: ${response.status} ${response.statusText}`);
                return undefined;
            }

            const data: any = await response.json();
            
            if (!data.choices || data.choices.length === 0) {
                logError('No response content received from API');
                return undefined;
            }

            // logDebugInfo(`Successfully received response from ${model}`);
            const content = data.choices[0].message.content;
            
            // logDebugInfo(`Response: ${content}`);
            return JSON.parse(content);
        } catch (error) {
            logError(`Error querying ${model}: ${error}`);
            return undefined;
        }
    }
}
