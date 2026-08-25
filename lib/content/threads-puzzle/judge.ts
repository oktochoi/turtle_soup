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
    reasons: { type: 'array', items: { type: 'string' } },
    improvementHints: { type: 'array', items: { type: 'string' } },
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

const SYSTEM = `당신은 바다거북스프 품질 심사관이다.
pass=true 조건: score>=7.5 이고 핵심 불리언(storyNatural, vividScene, curiosity, answerExplainsAll, noForcedSetup, notAbsurd, notDuplicate, commentWorthy)이 모두 true.
꿈/촬영/사람이 아니었다 류면 notAbsurd=false.
정답에서만 새 설정을 넣으면 noForcedSetup=false.
최근 문제와 같은 트릭이면 notDuplicate=false.
엄격하되 합리적 스토리형 문제는 통과시켜라.`;

export async function judgePuzzleCandidate(args: {
  candidate: PuzzleCandidate;
  recent: RecentProblemBrief[];
}): Promise<JudgeResult> {
  const recent = args.recent
    .slice(0, 10)
    .map((r) => `- ${r.title}: ${r.answer.slice(0, 80)}`)
    .join('\n');

  const user = `심사 대상:
제목: ${args.candidate.title}
본문: ${args.candidate.content}
정답: ${args.candidate.answer}
해설: ${args.candidate.explanation}
핵심트릭: ${args.candidate.coreTrick}

최근 문제:
${recent || '(없음)'}

위 체크리스트로 JSON 심사를 반환하라.`;

  const result = await groqJsonCompletion<JudgeResult>({
    model: getGroqJudgeModel(),
    system: SYSTEM,
    user,
    schemaName: 'turtle_soup_judge',
    schema: judgeSchema as unknown as Record<string, unknown>,
    temperature: 0.2,
    maxTokens: 1500,
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
