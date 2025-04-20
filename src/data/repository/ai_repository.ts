import { REPO_URL, TITLE } from '../../utils/constants';
import { logDebugInfo, logError } from '../../utils/logger';
import { Ai } from '../model/ai';

interface OpenRouterResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

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
            // logDebugInfo(`Sending prompt to ${model}: ${prompt}`);

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

            logDebugInfo(`Successfully received response from ${model}`);
            return data.choices[0].message.content;
        } catch (error) {
            logError(`Error querying ${model}: ${error}`);
            return undefined;
        }
    }

    askJson = async (ai: Ai, prompt: string): Promise<any | undefined> => {
        const result = await this.ask(ai, prompt);
        if (!result) {
            return undefined;
        }
        // Clean the response by removing ```json markers if present
        const cleanedResult = result
            .replace(/^```json\n?/, '')  // Remove ```json at the start
            .replace(/\n?```$/, '')      // Remove ``` at the end
            .trim();
        return JSON.parse(cleanedResult);
    }
}
