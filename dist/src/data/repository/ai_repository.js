"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiRepository = void 0;
const constants_1 = require("../../utils/constants");
const logger_1 = require("../../utils/logger");
class AiRepository {
    constructor() {
        this.ask = async (ai, prompt) => {
            const model = ai.getOpenRouterModel();
            const apiKey = ai.getOpenRouterApiKey();
            const providerRouting = ai.getProviderRouting();
            if (!model || !apiKey) {
                (0, logger_1.logError)('Missing required AI configuration');
                return undefined;
            }
            (0, logger_1.logDebugInfo)(`🔎 Model: ${model}`);
            (0, logger_1.logDebugInfo)(`🔎 API Key: ***`);
            (0, logger_1.logDebugInfo)(`🔎 Provider Routing: ${JSON.stringify(providerRouting, null, 2)}`);
            const url = `https://openrouter.ai/api/v1/chat/completions`;
            try {
                // logDebugInfo(`Sending prompt to ${model}: ${prompt}`);
                const requestBody = {
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
                        'HTTP-Referer': constants_1.REPO_URL,
                        'X-Title': constants_1.TITLE,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('API Response:', errorText);
                    (0, logger_1.logError)(`Error from API: ${response.status} ${response.statusText}`);
                    return undefined;
                }
                const data = await response.json();
                if (!data.choices || data.choices.length === 0) {
                    (0, logger_1.logError)('No response content received from API');
                    return undefined;
                }
                (0, logger_1.logDebugInfo)(`Successfully received response from ${model}`);
                return data.choices[0].message.content;
            }
            catch (error) {
                (0, logger_1.logError)(`Error querying ${model}: ${error}`);
                return undefined;
            }
        };
        this.askJson = async (ai, prompt) => {
            const result = await this.ask(ai, prompt);
            if (!result) {
                return undefined;
            }
            // Clean the response by removing ```json markers if present
            const cleanedResult = result
                .replace(/^```json\n?/, '') // Remove ```json at the start
                .replace(/\n?```$/, '') // Remove ``` at the end
                .trim();
            return JSON.parse(cleanedResult);
        };
    }
}
exports.AiRepository = AiRepository;
