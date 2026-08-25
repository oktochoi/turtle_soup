import Groq from 'groq-sdk';

let client: Groq | null = null;

export function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }
  if (!client) {
    client = new Groq({ apiKey });
  }
  return client;
}

export function getGroqModel(): string {
  return process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
}

export function getGroqJudgeModel(): string {
  return process.env.GROQ_JUDGE_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
}

export async function groqJsonCompletion<T>(args: {
  model?: string;
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const groq = getGroqClient();
  const model = args.model || getGroqModel();

  const completion = await groq.chat.completions.create({
    model,
    temperature: args.temperature ?? 0.7,
    max_tokens: args.maxTokens ?? 4096,
    messages: [
      { role: 'system', content: args.system },
      { role: 'user', content: args.user },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: args.schemaName,
        strict: true,
        schema: args.schema,
      },
    },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Groq returned empty content');
  }

  try {
    return JSON.parse(content) as T;
  } catch {
    // Fallback: extract JSON object if model wrapped text
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Groq response is not valid JSON');
    return JSON.parse(match[0]) as T;
  }
}
