import type { JudgeResult, ProblemKnowledge } from '@/lib/ai-analyzer';
import { analyzeQuestionV8 } from '@/lib/ai-analyzer';
import { INVESTIGATION_CONFIG } from './config';
import {
  detectClueUnlock,
  energyCostFor,
  evaluateFinalSolution,
  evaluateHypothesis,
  evaluateQuestionImportance,
  xpFor,
} from './evaluate';
import { calculateCaseScore } from './scoring';
import type {
  CaseResult,
  InvestigationCase,
  InvestigationQuestion,
  InvestigationSession,
  KeyClue,
} from './types';

export type JudgeFn = (
  question: string,
  knowledge: ProblemKnowledge
) => Promise<JudgeResult>;

/** Production judge: V9. V10 comparison stays outside game layer. */
export const defaultJudge: JudgeFn = async (question, knowledge) => {
  return analyzeQuestionV8(question, knowledge);
};

export function createSession(caseId: string): InvestigationSession {
  return {
    caseId,
    status: 'briefing',
    startedAt: Date.now(),
    investigationEnergy: INVESTIGATION_CONFIG.INITIAL_ENERGY,
    xp: 0,
    questionCount: 0,
    irrelevantQuestionCount: 0,
    hintCount: 0,
    discoveredClueIds: [],
    hypothesisCount: 0,
    truthScore: 0,
    questions: [],
  };
}

export interface AskQuestionResult {
  session: InvestigationSession;
  answer: JudgeResult;
  importance: InvestigationQuestion['importance'];
  xp: number;
  energyCost: number;
  unlockedClue: KeyClue | null;
  energyDepleted: boolean;
}

export async function processQuestion(args: {
  question: string;
  session: InvestigationSession;
  caseData: InvestigationCase;
  knowledge: ProblemKnowledge;
  judge?: JudgeFn;
}): Promise<AskQuestionResult> {
  const { question, caseData, knowledge } = args;
  let session = { ...args.session, questions: [...args.session.questions] };
  const judge = args.judge || defaultJudge;

  if (session.investigationEnergy <= 0 && session.status !== 'solving') {
    session = { ...session, status: 'solving' };
  }

  const answer = await judge(question, knowledge);

  const { importance } = await evaluateQuestionImportance({
    question,
    answer,
    caseData,
    discoveredClueIds: session.discoveredClueIds,
  });

  const unlockedClue = await detectClueUnlock({
    question,
    answer,
    caseData,
    discoveredClueIds: session.discoveredClueIds,
  });

  const finalImportance =
    unlockedClue && unlockedClue.importance === 'critical'
      ? 'critical'
      : unlockedClue
        ? importance === 'irrelevant'
          ? 'useful'
          : importance
        : importance;

  const energyCost = energyCostFor(finalImportance);
  const xp = xpFor(finalImportance, unlockedClue || undefined);

  const discoveredClueIds = unlockedClue
    ? [...session.discoveredClueIds, unlockedClue.id]
    : session.discoveredClueIds;

  const nextEnergy = Math.max(0, session.investigationEnergy - energyCost);
  const log: InvestigationQuestion = {
    question,
    answer,
    importance: finalImportance,
    xp,
    energyCost,
    unlockedClueId: unlockedClue?.id,
    createdAt: Date.now(),
  };

  // Clue progress can raise Truth without oscillating on every normal question
  let truthScore = session.truthScore;
  if (unlockedClue && caseData.keyClues.length > 0) {
    const ratio = discoveredClueIds.length / caseData.keyClues.length;
    const clueTruth = Math.round(ratio * 55);
    truthScore = Math.max(truthScore, clueTruth);
  }

  session = {
    ...session,
    status: nextEnergy <= 0 ? 'solving' : session.status === 'briefing' ? 'investigating' : session.status,
    investigationEnergy: nextEnergy,
    xp: session.xp + xp,
    questionCount: session.questionCount + 1,
    irrelevantQuestionCount:
      session.irrelevantQuestionCount + (finalImportance === 'irrelevant' ? 1 : 0),
    discoveredClueIds,
    truthScore,
    questions: [...session.questions, log],
  };

  if (process.env.NODE_ENV === 'development') {
    console.log('[Investigation]', {
      question,
      answer,
      importance: finalImportance,
      energyCost,
      xp,
      unlockedClue: unlockedClue?.text,
      energy: session.investigationEnergy,
      truthScore: session.truthScore,
    });
  }

  return {
    session,
    answer,
    importance: finalImportance,
    xp,
    energyCost,
    unlockedClue,
    energyDepleted: nextEnergy <= 0,
  };
}

export async function processHypothesis(args: {
  hypothesis: string;
  session: InvestigationSession;
  caseData: InvestigationCase;
}): Promise<InvestigationSession> {
  const feedback = await evaluateHypothesis(args.hypothesis, args.caseData);
  return {
    ...args.session,
    hypothesisCount: args.session.hypothesisCount + 1,
    truthScore: feedback.truthScore,
    lastHypothesis: args.hypothesis,
    hypothesisFeedback: feedback,
  };
}

export async function processHint(args: {
  session: InvestigationSession;
  caseData: InvestigationCase;
}): Promise<{ session: InvestigationSession; hint: string | null }> {
  const { session, caseData } = args;
  if (session.investigationEnergy < INVESTIGATION_CONFIG.COST_HINT) {
    return { session, hint: null };
  }
  const hints = caseData.hints;
  if (!hints.length) {
    return {
      session: {
        ...session,
        investigationEnergy: Math.max(0, session.investigationEnergy - INVESTIGATION_CONFIG.COST_HINT),
        hintCount: session.hintCount + 1,
      },
      hint: '누가 무엇을 했는지보다, 무엇이 사건의 출발점이었는지에 집중해 보세요.',
    };
  }
  const idx = Math.min(session.hintCount, hints.length - 1);
  return {
    session: {
      ...session,
      investigationEnergy: Math.max(0, session.investigationEnergy - INVESTIGATION_CONFIG.COST_HINT),
      hintCount: session.hintCount + 1,
    },
    hint: hints[idx],
  };
}

export async function processFinalSolution(args: {
  solution: string;
  session: InvestigationSession;
  caseData: InvestigationCase;
}): Promise<{ session: InvestigationSession; result: CaseResult }> {
  const { score, matches } = await evaluateFinalSolution(args.solution, args.caseData);
  const closedAt = Date.now();
  let session: InvestigationSession = {
    ...args.session,
    status: 'closed',
    closedAt,
    finalSolutionScore: score,
    truthScore: Math.max(args.session.truthScore, score),
  };

  const result = calculateCaseScore({
    session,
    finalSolutionScore: score,
    cluesTotal: args.caseData.keyClues.length,
    elementMatches: matches,
  });

  session = {
    ...session,
    score: result.score,
    grade: result.grade,
    detectiveStyle: result.detectiveStyle,
  };

  return { session, result };
}

export function canCloseCase(solutionScore: number): boolean {
  return solutionScore >= INVESTIGATION_CONFIG.SOLVE_MIN;
}
