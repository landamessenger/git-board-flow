import { logDebugInfo, logError } from '../../utils/logger';
import { Ai } from '../model/ai';

export class AiRepository {
    ask = async (ai: Ai, prompt: string): Promise<string | undefined> => {
        const model = ai.getOpenRouterModel();
        const apiKey = ai.getOpenRouterApiKey();
        const providerRouting = ai.getProviderRouting();

        if (!model || !apiKey) {
            logError('Missing required AI configuration');
            return undefined;
        }

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
                    'HTTP-Referer': 'https://github.com/landamessenger/git-board-flow',
                    'X-Title': 'Git Board Flow',
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

            const data = await response.json();
            
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
}
