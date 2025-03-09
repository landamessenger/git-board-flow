import * as core from '@actions/core';
import OpenAI from 'openai';

export class AiRepository {
    askChatGPT = async (prompt: string, apiKey: string, model: string = 'gpt-3.5-turbo'): Promise<string> => {
        try {
            core.info(`Sending prompt to ChatGPT: ${prompt}`);
            
            const openai = new OpenAI({
                apiKey: apiKey
            });
            
            const completion = await openai.chat.completions.create({
                model: model,
                messages: [{ role: 'user', content: prompt }],
            });

            const response = completion.choices[0]?.message?.content;
            
            if (!response) {
                throw new Error('No response received from ChatGPT');
            }

            core.info('Successfully received response from ChatGPT');
            return response;
        } catch (error) {
            core.error(`Error querying ChatGPT: ${error}`);
            throw error;
        }
    }
}