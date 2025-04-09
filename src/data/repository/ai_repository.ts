import { logDebugInfo, logError } from '../../utils/logger';
import { Ai } from '../model/ai';

export class AiRepository {
    ask = async (ai: Ai, prompt: string): Promise<string> => {
        const provider = ai.getOpenRouterProvider();
        const model = ai.getOpenRouterModel();
        const apiKey = ai.getOpenRouterApiKey();

        if (!provider || !model || !apiKey) {
            throw new Error('Missing required AI configuration');
        }

        // If the model already includes the provider, use it as is
        const proModel = model.includes('/') ? model : `${provider}/${model}`;

        const url = `https://openrouter.ai/api/v1/chat/completions`;

        try {
            logDebugInfo(`Sending prompt to ${proModel}: ${prompt}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Referer': 'https://github.com/landamessenger/git-board-flow',
                  'X-Title': 'Git Board Flow',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: proModel,
                  messages: [
                    { role: 'user', content: prompt },
                  ],
                }),
              });

            
            if (!response.ok) {
                throw new Error(`Error from API: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.choices || data.choices.length === 0) {
                throw new Error('No response content received from API');
            }

            logDebugInfo(`Successfully received response from ${proModel}`);
            return data.choices[0].message.content;
        } catch (error) {
            logError(`Error querying ${proModel}: ${error}`);
            throw error;
        }
    }
}
