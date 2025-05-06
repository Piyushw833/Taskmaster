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
  } catch (error: any) {
    console.error('OpenAI API error:', error.response?.data || error.message);
    throw new Error('Failed to get response from OpenAI');
  }
} 