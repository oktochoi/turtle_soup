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

const SYSTEM = `당신은 바다거북스프(상황 수수께끼/LTP) 심사관이다. 추리소설 심사관이 아니다.

pass=true 조건 (모두):
- score>=7.5
- storyNatural: 표면이 짧고 건조한 「사실」 나열인가 (소설체·수사체면 false)
- vividScene: 상황이 한 장면으로 잡히는가 (장황한 서사면 false)
- curiosity: 「왜?」가 남고 예/아니요로 파고들 여지가 있는가
- answerExplainsAll: 이면이 표면의 이상한 점을 모두 설명하는가
- noForcedSetup: 정답에서만 새 설정/인물/직업을 억지로 넣지 않았는가
- notAbsurd: 꿈/촬영/사람이아니었다 등 금지 반전이 아닌가 + 착각 반전이 논리적인가
- notDuplicate: 최근 문제·유명 고전 복제가 아닌가
- commentWorthy: Threads에서 「혹시 ~인가요?」식 추측 댓글이 나올 만한가

감동 사연·탐정 미스터리면 pass=false.
reasons/hints는 짧게.`;

export async function judgePuzzleCandidate(args: {
  candidate: PuzzleCandidate;
  recent: RecentProblemBrief[];
}): Promise<JudgeResult> {
  const recent = args.recent
    .slice(0, 6)
    .map((r) => `- ${r.title}`)
    .join('\n');

  const user = `심사 (LTP / 상황 수수께끼 기준):
제목:${args.candidate.title}
표면:${args.candidate.content.slice(0, 450)}
이면:${args.candidate.answer.slice(0, 350)}
착각유형:${args.candidate.coreTrick.slice(0, 80)}

최근제목:
${recent || '(없음)'}

JSON 심사.`;

  const result = await groqJsonCompletion<JudgeResult>({
    model: getGroqJudgeModel(),
    system: SYSTEM,
    user,
    schemaName: 'turtle_soup_judge',
    schema: judgeSchema as unknown as Record<string, unknown>,
    temperature: 0.15,
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
