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

/** Prefer a model that reliably returns JSON/tool args on Groq free tier. */
export function getGroqModel(): string {
  // 70B is still fast on Groq and follows few-shot style better than 8B
  return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
}

export function getGroqJudgeModel(): string {
  return process.env.GROQ_JUDGE_MODEL || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const tryParse = (s: string) => {
    try {
      return JSON.parse(s) as Record<string, unknown>;
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

  // Find outermost { ... } even if model added prose before/after
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    parsed = tryParse(trimmed.slice(start, end + 1));
    if (parsed) return parsed;
  }

  return null;
}

function messageToObject(message: {
  content?: string | null;
  tool_calls?: Array<{
    function?: { name?: string; arguments?: string };
  }> | null;
}): Record<string, unknown> {
  const toolArgs = message.tool_calls?.[0]?.function?.arguments;
  if (toolArgs) {
    const fromTool = extractJsonObject(toolArgs);
    if (fromTool) return fromTool;
  }

  const content = message.content || '';
  const fromContent = extractJsonObject(content);
  if (fromContent) return fromContent;

  const preview = (toolArgs || content || '(empty)').slice(0, 160).replace(/\s+/g, ' ');
  throw new Error(`Groq response is not valid JSON: ${preview}`);
}

const PUZZLE_TOOL = {
  type: 'function' as const,
  function: {
    name: 'submit_turtle_soup',
    description: 'Submit one Korean turtle-soup (situation puzzle) candidate',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        answer: { type: 'string' },
        explanation: { type: 'string' },
        difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        coreTrick: { type: 'string' },
        place: { type: 'string' },
        characterRelation: { type: 'string' },
        whyInteresting: { type: 'string' },
      },
      required: [
        'title',
        'content',
        'answer',
        'explanation',
        'difficulty',
        'coreTrick',
        'place',
        'characterRelation',
        'whyInteresting',
      ],
    },
  },
};

/**
 * Structured puzzle generation via tool_call (most reliable on Groq).
 * Falls back to json_object if the model ignores tools.
 */
export async function groqPuzzleCompletion(args: {
  model?: string;
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<Record<string, unknown>> {
  const groq = getGroqClient();
  const model = args.model || getGroqModel();
  const maxTokens = Math.min(args.maxTokens ?? 1400, 2000);

  // Attempt 1: tool calling
  try {
    const completion = await groq.chat.completions.create({
      model,
      temperature: args.temperature ?? 0.7,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: args.system },
        { role: 'user', content: args.user },
      ],
      tools: [PUZZLE_TOOL],
      tool_choice: {
        type: 'function',
        function: { name: 'submit_turtle_soup' },
      },
    });

    const message = completion.choices[0]?.message;
    if (message) {
      return messageToObject(message);
    }
  } catch {
    /* fall through */
  }

  // Attempt 2: json_object
  await sleep(400);
  const completion = await groq.chat.completions.create({
    model,
    temperature: args.temperature ?? 0.7,
    max_tokens: maxTokens,
    messages: [
      {
        role: 'system',
        content: `${args.system}\n\nOutput a single JSON object only.`,
      },
      {
        role: 'user',
        content: `${args.user}\n\nJSON keys: title,content,answer,explanation,difficulty,coreTrick,place,characterRelation,whyInteresting`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const message = completion.choices[0]?.message;
  if (!message) throw new Error('Groq returned empty message');
  return messageToObject(message);
}

/** Generic JSON helper (judge / misc) — json_object + parse. */
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
  const maxTokens = Math.min(args.maxTokens ?? 1200, 2000);
  const retries = args.retries ?? 1;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model,
        temperature: args.temperature ?? 0.5,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'system',
            content: args.system.includes('JSON')
              ? args.system
              : `${args.system}\nRespond with JSON only.`,
          },
          { role: 'user', content: args.user },
        ],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content || '';
      const obj = extractJsonObject(content);
      if (!obj) {
        throw new Error(`Groq response is not valid JSON: ${content.slice(0, 160)}`);
      }
      return obj as T;
    } catch (e) {
      lastError = e;
      if (attempt < retries) await sleep(1000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
