import type { JudgeResult } from '@/lib/ai-analyzer';
import { INVESTIGATION_CONFIG } from './config';
import { bestSimilarity, textSimilarity } from './similarity';
import type {
  HypothesisFeedback,
  InvestigationCase,
  KeyClue,
  QuestionImportance,
  ElementMatch,
  SolutionElement,
} from './types';

export function energyCostFor(importance: QuestionImportance): number {
  switch (importance) {
    case 'critical':
      return INVESTIGATION_CONFIG.COST_CRITICAL;
    case 'useful':
      return INVESTIGATION_CONFIG.COST_USEFUL;
    case 'irrelevant':
      return INVESTIGATION_CONFIG.COST_IRRELEVANT;
    default:
      return INVESTIGATION_CONFIG.COST_NORMAL;
  }
}

export function xpFor(importance: QuestionImportance, unlockedClue?: KeyClue): number {
  if (unlockedClue) return unlockedClue.xp || INVESTIGATION_CONFIG.XP_CRITICAL;
  switch (importance) {
    case 'critical':
      return INVESTIGATION_CONFIG.XP_CRITICAL;
    case 'useful':
      return INVESTIGATION_CONFIG.XP_USEFUL;
    case 'irrelevant':
      return INVESTIGATION_CONFIG.XP_IRRELEVANT;
    default:
      return INVESTIGATION_CONFIG.XP_NORMAL;
  }
}

export async function evaluateQuestionImportance(args: {
  question: string;
  answer: JudgeResult;
  caseData: InvestigationCase;
  discoveredClueIds: string[];
}): Promise<{ importance: QuestionImportance; bestClueSim: number }> {
  const { question, answer, caseData, discoveredClueIds } = args;

  if (answer === 'irrelevant') {
    return { importance: 'irrelevant', bestClueSim: 0 };
  }

  const remaining = caseData.keyClues.filter((c) => !discoveredClueIds.includes(c.id));
  const clueTexts = remaining.map((c) => c.text);
  const { score: clueSim } = await bestSimilarity(question, clueTexts);

  const answerSim = await textSimilarity(question, caseData.answer);
  const contentSim = await textSimilarity(question, caseData.content);
  const storySim = Math.max(answerSim, contentSim);

  if (clueSim >= INVESTIGATION_CONFIG.CRITICAL_SIM) {
    return { importance: 'critical', bestClueSim: clueSim };
  }
  if (
    clueSim >= INVESTIGATION_CONFIG.USEFUL_SIM ||
    answerSim >= INVESTIGATION_CONFIG.USEFUL_SIM
  ) {
    return { importance: 'useful', bestClueSim: clueSim };
  }
  if (storySim < 0.28) {
    return { importance: 'irrelevant', bestClueSim: clueSim };
  }
  return { importance: 'normal', bestClueSim: clueSim };
}

export async function detectClueUnlock(args: {
  question: string;
  answer: JudgeResult;
  caseData: InvestigationCase;
  discoveredClueIds: string[];
}): Promise<KeyClue | null> {
  const { question, answer, caseData, discoveredClueIds } = args;
  if (answer === 'irrelevant') return null;

  const remaining = caseData.keyClues.filter((c) => !discoveredClueIds.includes(c.id));
  if (!remaining.length) return null;

  // Compare question (+ polarity) against each clue
  const polarity =
    answer === 'yes' ? '그렇다' : answer === 'no' ? '그렇지 않다' : '';
  const probe = polarity ? `${question} ${polarity}` : question;

  const scores: { clue: KeyClue; score: number }[] = [];
  for (const clue of remaining) {
    const s1 = await textSimilarity(probe, clue.text);
    const s2 = await textSimilarity(question, clue.text);
    scores.push({ clue, score: Math.max(s1, s2) });
  }
  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  const second = scores[1]?.score ?? 0;
  if (!top) return null;
  if (top.score < INVESTIGATION_CONFIG.CLUE_UNLOCK_SIM) return null;
  if (top.score - second < INVESTIGATION_CONFIG.CLUE_MIN_MARGIN && scores.length > 1) {
    // still allow unlock if clearly above threshold
    if (top.score < INVESTIGATION_CONFIG.CLUE_UNLOCK_SIM + 0.08) return null;
  }
  return top.clue;
}

async function matchElements(
  text: string,
  elements: SolutionElement[]
): Promise<ElementMatch[]> {
  const matches: ElementMatch[] = [];
  for (const el of elements) {
    const sim = await textSimilarity(text, el.text);
    let status: ElementMatch['status'] = 'miss';
    if (sim >= INVESTIGATION_CONFIG.ELEMENT_MATCH_SIM) status = 'match';
    else if (sim >= INVESTIGATION_CONFIG.ELEMENT_PARTIAL_SIM) status = 'partial';
    matches.push({
      id: el.id,
      text: el.text,
      status,
      similarity: sim,
      weight: el.weight,
    });
  }
  return matches;
}

export function scoreFromElementMatches(matches: ElementMatch[]): number {
  const total = matches.reduce((s, m) => s + m.weight, 0) || 1;
  const gained = matches.reduce((s, m) => {
    if (m.status === 'match') return s + m.weight;
    if (m.status === 'partial') return s + m.weight * 0.5;
    return s;
  }, 0);
  return Math.round((gained / total) * 100);
}

export async function evaluateHypothesis(
  hypothesis: string,
  caseData: InvestigationCase
): Promise<HypothesisFeedback> {
  const matches = await matchElements(hypothesis, caseData.solutionElements);
  const truthScore = scoreFromElementMatches(matches);

  // Never return solution element text — that would spoil the answer.
  const matchCount = matches.filter((m) => m.status === 'match').length;
  const partialCount = matches.filter((m) => m.status === 'partial').length;
  const wrongDirection = matches.filter((m) => m.status === 'miss').length > matches.length / 2;

  let summary = '지금까지 확인된 사실과 일치하는 부분이 있습니다.';
  if (truthScore < 30) {
    summary = '가설의 방향이 사건 핵심과 다소 떨어져 있습니다. 단서를 더 모아보세요.';
  } else if (truthScore < 55) {
    summary = '일부는 맞지만, 아직 확인되지 않은 가정이 포함되어 있습니다.';
  } else if (truthScore < 80) {
    summary = '핵심에 가까워지고 있습니다. 빠진 연결고리를 더 좁혀보세요.';
  } else {
    summary = '가설이 사건의 핵심 구조와 대체로 일치합니다.';
  }
  if (wrongDirection && truthScore < 50) {
    summary = '인물·관계·원인에 대한 가설 일부가 실제 사건과 맞지 않을 수 있습니다.';
  }

  return {
    matchedParts: matchCount > 0 ? ['일치하는 요소가 있습니다'] : [],
    uncertainParts: partialCount > 0 ? ['아직 확인되지 않은 가정이 있습니다'] : [],
    wrongDirection,
    truthScore,
    summary,
  };
}

export async function evaluateFinalSolution(
  solution: string,
  caseData: InvestigationCase
): Promise<{ score: number; matches: ElementMatch[] }> {
  const matches = await matchElements(solution, caseData.solutionElements);
  return { score: scoreFromElementMatches(matches), matches };
}
