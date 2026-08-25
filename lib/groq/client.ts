import Groq from 'groq-sdk';

let client: Groq | null = null;

/** This Groq org: gpt-oss / qwen / compound (no llama). */
const DEFAULT_MODEL = 'openai/gpt-oss-20b';
const FALLBACK_MODEL = 'qwen/qwen3.6-27b';

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

/** Remap llama → gpt-oss (llama is model_not_found on this org). */
export function resolveSafeGroqModel(preferred?: string): string {
  const raw = (preferred || process.env.GROQ_MODEL || DEFAULT_MODEL).trim();
  if (/llama/i.test(raw)) return DEFAULT_MODEL;
  return raw || DEFAULT_MODEL;
}

export function getGroqModel(): string {
  return resolveSafeGroqModel();
}

export function getGroqJudgeModel(): string {
  return resolveSafeGroqModel(
    process.env.GROQ_JUDGE_MODEL || process.env.GROQ_MODEL || DEFAULT_MODEL
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function extractJsonObject(text: string): Record<string, unknown> | null {
  let trimmed = (text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .trim();
  if (!trimmed) return null;

  const tryParse = (s: string) => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === 'object' && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };

  let parsed = tryParse(trimmed);
  if (parsed) return parsed;

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    parsed = tryParse(fence[1].trim());
    if (parsed) return parsed;
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    parsed = tryParse(trimmed.slice(start, end + 1));
    if (parsed) return parsed;
  }

  return null;
}

type ChatMessage = {
  content?: string | null;
  reasoning?: string | null;
};

function messageText(message: ChatMessage | undefined | null): string {
  if (!message) return '';
  const content = (message.content || '').trim();
  if (content) return content;
  return (message.reasoning || '').trim();
}

function friendlyGroqError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/model_not_found|does not exist|do not have access/i.test(msg)) {
    return 'Groq 모델 접근 불가. GROQ_MODEL=openai/gpt-oss-20b 로 설정하세요.';
  }
  if (/rate_limit|TPM|429|413/i.test(msg)) {
    return 'Groq 사용량 한도입니다. 1분 후 다시 눌러 주세요.';
  }
  if (/json_validate|Failed to validate JSON/i.test(msg)) {
    return 'JSON 모드를 쓰지 않는 최신 코드로 재배포가 필요합니다.';
  }
  return msg.slice(0, 240);
}

/**
 * Plain chat only — NEVER response_format json_object/json_schema
 * (both return json_validate_failed on this org's models).
 *
 * gpt-oss often puts draft text in `reasoning` and final in `content`.
 * If content is empty (token budget eaten by reasoning), parse reasoning.
 */
export async function groqPuzzleCompletion(args: {
  model?: string;
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<Record<string, unknown>> {
  const groq = getGroqClient();
  const primary = resolveSafeGroqModel(args.model);
  const models = [...new Set([primary, FALLBACK_MODEL, DEFAULT_MODEL])];
  // gpt-oss spends tokens on reasoning — need headroom for final JSON
  const maxTokens = Math.min(Math.max(args.maxTokens ?? 2500, 2000), 4000);

  const system = `${args.system}

출력 규칙:
- 최종 결과는 JSON 객체 하나만 (키: title, content, answer, explanation, difficulty, coreTrick, place, characterRelation, whyInteresting)
- difficulty는 easy|medium|hard
- 추론은 짧게. 마지막에 JSON을 반드시 완성할 것.`;

  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const isGptOss = /gpt-oss/i.test(model);
        const completion = await groq.chat.completions.create({
          model,
          temperature: (args.temperature ?? 0.7) + attempt * 0.05,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            {
              role: 'user',
              content: `${args.user}\n\n지금 { 로 시작하는 JSON을 완성해서 출력.`,
            },
          ],
          // gpt-oss: keep reasoning short so content gets the JSON
          ...(isGptOss ? { reasoning_effort: 'low' as const } : {}),
        });

        const choice = completion.choices[0];
        const message = choice?.message as ChatMessage | undefined;
        const text = messageText(message);
        const obj = extractJsonObject(text);
        if (obj && (obj.title || obj.content || obj.answer)) {
          return obj;
        }

        lastError = new Error(
          `빈/불완전 응답 (${model}, finish=${choice?.finish_reason}): ${text.slice(0, 80)}`
        );
      } catch (e) {
        lastError = e;
        await sleep(500);
      }
    }
  }

  throw new Error(friendlyGroqError(lastError));
}

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
  const obj = await groqPuzzleCompletion({
    model: args.model,
    system: args.system,
    user: args.user,
    temperature: args.temperature,
    maxTokens: args.maxTokens,
  });
  return obj as T;
}
