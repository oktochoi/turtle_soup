import { groqJsonCompletion, getGroqJudgeModel } from '@/lib/groq/client';
import type { JudgeResult, PuzzleCandidate, RecentProblemBrief } from './types';

const judgeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pass: { type: 'boolean' },
    score: { type: 'number' },
    storyNatural: { type: 'boolean' },
    vividScene: { type: 'boolean' },
    curiosity: { type: 'boolean' },
    answerExplainsAll: { type: 'boolean' },
    noForcedSetup: { type: 'boolean' },
    notAbsurd: { type: 'boolean' },
    notDuplicate: { type: 'boolean' },
    commentWorthy: { type: 'boolean' },
    reasons: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    improvementHints: { type: 'array', items: { type: 'string' }, maxItems: 2 },
  },
  required: [
    'pass',
    'score',
    'storyNatural',
    'vividScene',
    'curiosity',
    'answerExplainsAll',
    'noForcedSetup',
    'notAbsurd',
    'notDuplicate',
    'commentWorthy',
    'reasons',
    'improvementHints',
  ],
} as const;

const SYSTEM = `바다거북스프 심사관. pass=true는 score>=7.5이고 불리언 전부 true.
꿈/촬영/사람이아니었다→notAbsurd=false. 정답만 새설정→noForcedSetup=false. 최근과 같은트릭→notDuplicate=false.
reasons/hints는 짧게.`;

export async function judgePuzzleCandidate(args: {
  candidate: PuzzleCandidate;
  recent: RecentProblemBrief[];
}): Promise<JudgeResult> {
  const recent = args.recent
    .slice(0, 6)
    .map((r) => `- ${r.title}`)
    .join('\n');

  const user = `제목:${args.candidate.title}
본문:${args.candidate.content.slice(0, 500)}
정답:${args.candidate.answer.slice(0, 280)}
트릭:${args.candidate.coreTrick.slice(0, 80)}

최근제목:
${recent || '(없음)'}

JSON 심사.`;

  const result = await groqJsonCompletion<JudgeResult>({
    model: getGroqJudgeModel(),
    system: SYSTEM,
    user,
    schemaName: 'turtle_soup_judge',
    schema: judgeSchema as unknown as Record<string, unknown>,
    temperature: 0.2,
    maxTokens: 700,
  });

  const flags = [
    result.storyNatural,
    result.vividScene,
    result.curiosity,
    result.answerExplainsAll,
    result.noForcedSetup,
    result.notAbsurd,
    result.notDuplicate,
    result.commentWorthy,
  ];
  const allTrue = flags.every(Boolean);
  const score = Number(result.score) || 0;
  const pass = Boolean(result.pass) && allTrue && score >= 7.5;

  return {
    ...result,
    score,
    pass,
    reasons: result.reasons || [],
    improvementHints: result.improvementHints || [],
  };
}
