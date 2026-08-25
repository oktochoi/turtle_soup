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

function isRetryableError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /rate_limit|tokens|Request too large|TPM|413|429|json_validate|Failed to validate JSON|empty content/i.test(
    msg
  );
}

function parseJsonContent<T>(content: string): T {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) {
      return JSON.parse(fence[1].trim()) as T;
    }
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Groq response is not valid JSON');
    return JSON.parse(match[0]) as T;
  }
}

type ResponseMode = 'json_object' | 'json_schema' | 'none';

/**
 * Prefer json_object — gpt-oss strict json_schema often returns empty failed_generation.
 * Optional schema kept for callers but not required by the API path.
 */
export async function groqJsonCompletion<T>(args: {
  model?: string;
  system: string;
  user: string;
  schemaName?: string;
  schema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  retries?: number;
}): Promise<T> {
  const groq = getGroqClient();
  const model = args.model || getGroqModel();
  const maxTokens = Math.min(args.maxTokens ?? 1600, 2500);
  const retries = args.retries ?? 2;

  const systemWithJson = args.system.includes('JSON')
    ? args.system
    : `${args.system}\n\nRespond with a single JSON object only.`;

  const modes: ResponseMode[] = ['json_object', 'none'];
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const mode = modes[Math.min(attempt, modes.length - 1)];
    try {
      const completion = await groq.chat.completions.create({
        model,
        temperature: args.temperature ?? 0.7,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemWithJson },
          {
            role: 'user',
            content:
              mode === 'none'
                ? `${args.user}\n\nReturn ONLY valid JSON (no markdown).`
                : args.user,
          },
        ],
        ...(mode === 'json_object'
          ? { response_format: { type: 'json_object' as const } }
          : {}),
      });

      const content = completion.choices[0]?.message?.content;
      if (!content?.trim()) {
        throw new Error('Groq returned empty content');
      }
      return parseJsonContent<T>(content);
    } catch (e) {
      lastError = e;
      if (attempt < retries && isRetryableError(e)) {
        await sleep(1500 + attempt * 1500);
        continue;
      }
      if (attempt < retries) {
        await sleep(800);
        continue;
      }
      throw e;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
