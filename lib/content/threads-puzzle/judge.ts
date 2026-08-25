import { groqJsonCompletion, getGroqJudgeModel } from '@/lib/groq/client';
import type { JudgeResult, PuzzleCandidate, RecentProblemBrief } from './types';

const SYSTEM = `바다거북스프(LTP) 심사관. 추리소설 심사 금지.
pass=true는 score>=7.5이고 아래 불리언이 모두 true.
storyNatural=짧은 사실형 표면, vividScene=한 장면, curiosity=왜? 남음,
answerExplainsAll=이면이 표면 설명, noForcedSetup=정답만 새설정 없음,
notAbsurd=금지반전 아님, notDuplicate=최근과 다름, commentWorthy=댓글 추측 가능.
감동사연·탐정물이면 pass=false.
JSON만 출력. 키: pass,score,storyNatural,vividScene,curiosity,answerExplainsAll,noForcedSetup,notAbsurd,notDuplicate,commentWorthy,reasons,improvementHints`;

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

export async function judgePuzzleCandidate(args: {
  candidate: PuzzleCandidate;
  recent: RecentProblemBrief[];
}): Promise<JudgeResult> {
  const recent = args.recent
    .slice(0, 6)
    .map((r) => `- ${r.title}`)
    .join('\n');

  const user = `제목:${args.candidate.title}
표면:${args.candidate.content.slice(0, 450)}
이면:${args.candidate.answer.slice(0, 350)}
착각:${args.candidate.coreTrick.slice(0, 80)}
최근:
${recent || '(없음)'}
JSON 심사.`;

  const raw = await groqJsonCompletion<Record<string, unknown>>({
    model: getGroqJudgeModel(),
    system: SYSTEM,
    user,
    temperature: 0.15,
    maxTokens: 600,
    retries: 1,
  });

  const result: JudgeResult = {
    pass: asBool(raw.pass),
    score: Number(raw.score) || 0,
    storyNatural: asBool(raw.storyNatural),
    vividScene: asBool(raw.vividScene),
    curiosity: asBool(raw.curiosity),
    answerExplainsAll: asBool(raw.answerExplainsAll),
    noForcedSetup: asBool(raw.noForcedSetup),
    notAbsurd: asBool(raw.notAbsurd),
    notDuplicate: asBool(raw.notDuplicate),
    commentWorthy: asBool(raw.commentWorthy),
    reasons: Array.isArray(raw.reasons) ? raw.reasons.map(String).slice(0, 3) : [],
    improvementHints: Array.isArray(raw.improvementHints)
      ? raw.improvementHints.map(String).slice(0, 2)
      : [],
  };

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
  const score = result.score;
  const pass = Boolean(result.pass) && allTrue && score >= 7.5;

  return { ...result, score, pass };
}
