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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isTokenLimitError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /rate_limit|tokens|Request too large|TPM|413|429/i.test(msg);
}

/**
 * Groq free tier ~8000 TPM: keep max_tokens modest and retry on limit errors.
 */
export async function groqJsonCompletion<T>(args: {
  model?: string;
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  retries?: number;
}): Promise<T> {
  const groq = getGroqClient();
  const model = args.model || getGroqModel();
  // Stay under ~8k TPM: input + reserved output must fit
  const maxTokens = Math.min(args.maxTokens ?? 2000, 2800);
  const retries = args.retries ?? 3;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        temperature: args.temperature ?? 0.7,
        max_tokens: maxTokens,
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
        const match = content.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('Groq response is not valid JSON');
        return JSON.parse(match[0]) as T;
      }
    } catch (e) {
      lastError = e;
      if (attempt < retries && isTokenLimitError(e)) {
        await sleep(12_000 + attempt * 4000);
        continue;
      }
      throw e;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
