import { getOrBuildCaseKnowledge } from './cache';
import { V11_CONFIG } from './policy';
import { bestChunkSimilarity, similarity } from './retrieval';
import type { CaseKnowledge, EvaluationResult, FactMatch } from './types';

async function scoreAgainstFact(userText: string, factText: string): Promise<number> {
  // Root cause fix for 0%: compare fact against best chunk of user text, not only full blob
  const chunk = await bestChunkSimilarity(factText, userText);
  const direct = await similarity(userText, factText);
  return Math.max(chunk, direct);
}

function statusFromScore(score: number): FactMatch['status'] {
  if (score >= V11_CONFIG.EVAL_MATCH) return 'match';
  if (score >= V11_CONFIG.EVAL_PARTIAL) return 'partial';
  return 'miss';
}

/**
 * Evaluate hypothesis or final solution against Atomic Facts.
 * Does not leak answer text in user-facing summary.
 */
export async function evaluateAgainstFacts(args: {
  text: string;
  knowledge: CaseKnowledge;
  mode: 'hypothesis' | 'final';
}): Promise<EvaluationResult> {
  const facts = args.knowledge.facts.filter((f) => f.source === 'answer' || f.importance >= 0.5);
  const pool = facts.length ? facts : args.knowledge.facts;

  // Guarantee non-empty evaluation set from answer
  const evalFacts =
    pool.length > 0
      ? pool
      : [
          {
            id: 'fallback_answer',
            text: args.knowledge.answer,
            kind: 'fact' as const,
            importance: 1,
            source: 'answer' as const,
          },
        ];

  const totalWeight = evalFacts.reduce((s, f) => s + Math.max(0.2, f.importance), 0) || 1;
  const matches: FactMatch[] = [];

  for (const f of evalFacts) {
    const score = await scoreAgainstFact(args.text, f.text);
    const weight = Math.max(0.2, f.importance);
    matches.push({
      factId: f.id,
      text: f.text,
      status: statusFromScore(score),
      score,
      weight,
    });
  }

  const gained = matches.reduce((s, m) => {
    if (m.status === 'match') return s + m.weight;
    if (m.status === 'partial') return s + m.weight * 0.55;
    // Soft credit below partial — avoids hard 0% when somewhat related
    if (m.score >= 0.2) return s + m.weight * m.score * 0.35;
    return s;
  }, 0);

  const accuracy = Math.round(Math.min(100, Math.max(0, (gained / totalWeight) * 100)));
  const matchedCount = matches.filter((m) => m.status === 'match' || m.status === 'partial').length;

  let summary = '';
  if (args.mode === 'hypothesis') {
    if (accuracy >= 70) {
      summary =
        '중요한 방향을 잡았습니다. 핵심에 가까워지고 있어요. 빠진 연결고리를 조금 더 좁혀보세요.';
    } else if (accuracy >= 40) {
      summary =
        '일부 방향은 맞습니다. 다만 결정적인 이유나 인물 관계에 대해 조금 더 생각해보세요.';
    } else if (accuracy >= 20) {
      summary =
        '인물·관계·원인에 대한 가설 일부가 실제 사건과 맞지 않을 수 있습니다. 확인된 사실을 다시 살펴보세요.';
    } else {
      summary = '가설의 방향이 사건 핵심과 다소 떨어져 있습니다. 질문을 더 이어가 보세요.';
    }
  } else {
    summary =
      accuracy >= 85
        ? '핵심 사실을 거의 모두 짚었습니다.'
        : accuracy >= 60
          ? '대체로 맞는 추리입니다.'
          : accuracy >= 30
            ? '부분적으로 맞는 추리입니다.'
            : '사건 핵심과 거리가 있습니다.';
  }

  return {
    accuracy,
    matches,
    matchedCount,
    totalCount: evalFacts.length,
    summary,
  };
}

export async function evaluateHypothesisV11(args: {
  hypothesis: string;
  caseId: string;
  content: string;
  answer: string;
}): Promise<EvaluationResult> {
  const knowledge = getOrBuildCaseKnowledge(args);
  return evaluateAgainstFacts({ text: args.hypothesis, knowledge, mode: 'hypothesis' });
}

export async function evaluateFinalSolutionV11(args: {
  solution: string;
  caseId: string;
  content: string;
  answer: string;
}): Promise<EvaluationResult> {
  const knowledge = getOrBuildCaseKnowledge(args);
  return evaluateAgainstFacts({ text: args.solution, knowledge, mode: 'final' });
}
