import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function askOpenAI(prompt: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
      temperature: 0.7,
    });
    return response.choices[0]?.message?.content || '';
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'response' in error && 'message' in error) {
      // @ts-expect-error: dynamic error shape
      console.error('OpenAI API error:', error.response?.data || error.message);
    } else {
      console.error('OpenAI API error:', error);
    }
    throw new Error('Failed to get response from OpenAI');
  }
} 