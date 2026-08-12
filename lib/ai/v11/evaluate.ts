import { getOrBuildCaseKnowledge } from './cache';
import { V11_CONFIG } from './policy';
import { bestChunkSimilarity, similarity } from './retrieval';
import type { CaseKnowledge, EvaluationResult, FactMatch } from './types';

async function scoreAgainstFact(userText: string, factText: string): Promise<number> {
  // Compare fact against best chunk of user text, not only full blob
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
 * Pick the facts that matter for scoring.
 * Too many atomic sentences made short (but correct) paraphrases score near 0%.
 */
function selectEvalFacts(knowledge: CaseKnowledge) {
  const answerFacts = knowledge.facts
    .filter((f) => f.source === 'answer')
    .sort((a, b) => b.importance - a.importance);

  // Prefer concise set: top facts + always keep highest-importance ones
  const capped = answerFacts.slice(0, Math.min(4, Math.max(2, answerFacts.length)));

  if (capped.length > 0) return capped;

  const derived = knowledge.facts
    .filter((f) => f.importance >= 0.55)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 3);
  if (derived.length > 0) return derived;

  return [
    {
      id: 'fallback_answer',
      text: knowledge.answer,
      kind: 'fact' as const,
      importance: 1,
      source: 'answer' as const,
    },
  ];
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
  const evalFacts = selectEvalFacts(args.knowledge);
  const totalWeight = evalFacts.reduce((s, f) => s + Math.max(0.25, f.importance), 0) || 1;
  const matches: FactMatch[] = [];

  for (const f of evalFacts) {
    const score = await scoreAgainstFact(args.text, f.text);
    const weight = Math.max(0.25, f.importance);
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
    if (m.status === 'partial') return s + m.weight * 0.65;
    // Soft credit below partial — avoids hard 0% when somewhat related
    if (m.score >= 0.18) return s + m.weight * m.score * 0.55;
    return s;
  }, 0);

  let accuracy = Math.round(Math.min(100, Math.max(0, (gained / totalWeight) * 100)));

  // Whole-answer floor: a good paraphrase of the full answer should not collapse to ~0%.
  // Short guesses (e.g. "아내가 죽였다") get a discounted floor so they don't auto-100%.
  const wholeScore = await scoreAgainstFact(args.text, args.knowledge.answer);
  const brevity =
    args.text.trim().length < 18 ? 0.72 : args.text.trim().length < 36 ? 0.85 : 1;
  const wholeAccuracy = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        (wholeScore >= V11_CONFIG.EVAL_MATCH
          ? 68 + (wholeScore - V11_CONFIG.EVAL_MATCH) * 70
          : wholeScore >= V11_CONFIG.EVAL_PARTIAL
            ? 42 +
              ((wholeScore - V11_CONFIG.EVAL_PARTIAL) /
                Math.max(0.01, V11_CONFIG.EVAL_MATCH - V11_CONFIG.EVAL_PARTIAL)) *
                26
            : wholeScore * 100 * 0.8) * brevity
      )
    )
  );

  // Blend: fact coverage + holistic paraphrase (holistic helps short correct answers)
  accuracy = Math.round(
    Math.max(accuracy, accuracy * 0.6 + wholeAccuracy * 0.4, wholeAccuracy * 0.88)
  );
  accuracy = Math.min(100, Math.max(0, accuracy));

  // Short solutions that only share a keyword (e.g. "아내가 죽였다") should not auto-clear.
  const userLen = args.text.replace(/\s/g, '').length;
  const answerLen = args.knowledge.answer.replace(/\s/g, '').length;
  if (userLen > 0 && answerLen > 0 && userLen < Math.max(12, answerLen * 0.4)) {
    const shortCap = Math.round(38 + wholeScore * 50);
    accuracy = Math.min(accuracy, shortCap);
  }

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
