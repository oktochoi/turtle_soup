/**
 * Game Logic V2 — thin session state (no XP / energy / live Truth %).
 * AI lives in lib/ai/v11. UI must not implement judgment here.
 * V11 is dynamically imported so Vercel serverless traces stay under size limits.
 */

import type { JudgeResult, ProblemKnowledge } from '@/lib/ai-analyzer';
import type { AtomicFact, EvaluationResult, V11JudgeDebug } from '@/lib/ai/v11/types';
import type { Problem } from '@/lib/types';
import { caseNumberFromId, difficultyStars } from '@/lib/investigation/case-adapter';
import { CATEGORY_LABELS, type CaseCategory } from '@/lib/investigation/types';

export type GameStatus = 'ready' | 'briefing' | 'investigating' | 'closed';

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  text: string;
  answer?: JudgeResult;
  confirmedFact?: string;
  createdAt: number;
}

export interface GameSessionV2 {
  caseId: string;
  status: GameStatus;
  startedAt: number;
  closedAt?: number;
  messages: ChatMessage[];
  confirmedFacts: AtomicFact[];
  hintCount: number;
  questionCount: number;
  lastHypothesisFeedback?: string;
  result?: {
    accuracy: number;
    matchedCount: number;
    totalCount: number;
    solution: string;
    answer: string;
  };
}

export interface CaseView {
  id: string;
  caseNumber: string;
  title: string;
  content: string;
  answer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  categoryLabel: string;
  stars: string;
  hints: string[];
}

export function createGameSession(caseId: string): GameSessionV2 {
  return {
    caseId,
    status: 'ready',
    startedAt: Date.now(),
    messages: [],
    confirmedFacts: [],
    hintCount: 0,
    questionCount: 0,
  };
}

export function problemToCaseView(problem: Problem): CaseView {
  const difficulty = (problem.difficulty || 'medium') as 'easy' | 'medium' | 'hard';
  const raw = problem as Problem & { category?: string };
  const category = (raw.category as CaseCategory) || 'mystery';
  return {
    id: problem.id,
    caseNumber: caseNumberFromId(problem.id),
    title: problem.title,
    content: problem.content || '',
    answer: problem.answer || '',
    difficulty,
    categoryLabel: CATEGORY_LABELS[category] || CATEGORY_LABELS.mystery,
    stars: difficultyStars(difficulty),
    hints: Array.isArray(problem.hints)
      ? problem.hints.filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
      : [],
  };
}

export async function askQuestionV2(args: {
  question: string;
  session: GameSessionV2;
  caseView: CaseView;
  problemKnowledge?: ProblemKnowledge | null;
}): Promise<{ session: GameSessionV2; debug?: V11JudgeDebug }> {
  const q = args.question.trim();
  if (!q) return { session: args.session };

  const confirmedFactIds = args.session.confirmedFacts.map((f) => f.id);
  const { judgeQuestionV11 } = await import('@/lib/ai/v11/judge');
  const judged = await judgeQuestionV11({
    question: q,
    caseId: args.caseView.id,
    content: args.caseView.content,
    answer: args.caseView.answer,
    confirmedFactIds,
    problemKnowledge: args.problemKnowledge,
  });

  const messages = [...args.session.messages];
  messages.push({
    id: `u_${Date.now()}`,
    role: 'user',
    text: q,
    createdAt: Date.now(),
  });

  const answerLabel =
    judged.label === 'yes' ? '예.' : judged.label === 'no' ? '아니요.' : '상관없습니다.';

  messages.push({
    id: `a_${Date.now()}`,
    role: 'ai',
    text: answerLabel,
    answer: judged.label,
    confirmedFact: judged.confirmedFact?.text,
    createdAt: Date.now() + 1,
  });

  let confirmedFacts = args.session.confirmedFacts;
  if (judged.confirmedFact && !confirmedFacts.some((f) => f.id === judged.confirmedFact!.id)) {
    confirmedFacts = [...confirmedFacts, judged.confirmedFact];
  }

  return {
    session: {
      ...args.session,
      status: 'investigating',
      messages,
      confirmedFacts,
      questionCount: args.session.questionCount + 1,
    },
    debug: judged.debug,
  };
}

export async function submitHypothesisV2(args: {
  hypothesis: string;
  session: GameSessionV2;
  caseView: CaseView;
}): Promise<GameSessionV2> {
  const { evaluateHypothesisV11 } = await import('@/lib/ai/v11/evaluate');
  const result = await evaluateHypothesisV11({
    hypothesis: args.hypothesis,
    caseId: args.caseView.id,
    content: args.caseView.content,
    answer: args.caseView.answer,
  });

  const messages = [
    ...args.session.messages,
    {
      id: `h_${Date.now()}`,
      role: 'system' as const,
      text: result.summary,
      createdAt: Date.now(),
    },
  ];

  return {
    ...args.session,
    messages,
    lastHypothesisFeedback: result.summary,
  };
}

export async function applyHintV2(args: {
  session: GameSessionV2;
  caseView: CaseView;
}): Promise<GameSessionV2> {
  const hints = args.caseView.hints;
  const text =
    hints[Math.min(args.session.hintCount, Math.max(0, hints.length - 1))] ||
    '누가 무엇을 했는지보다, 무엇이 사건의 출발점이었는지에 집중해 보세요.';

  return {
    ...args.session,
    hintCount: args.session.hintCount + 1,
    messages: [
      ...args.session.messages,
      {
        id: `hint_${Date.now()}`,
        role: 'system',
        text: `💡 ${text}`,
        createdAt: Date.now(),
      },
    ],
  };
}

export async function solveCaseV2(args: {
  solution: string;
  session: GameSessionV2;
  caseView: CaseView;
}): Promise<{ session: GameSessionV2; evaluation: EvaluationResult }> {
  const { evaluateFinalSolutionV11 } = await import('@/lib/ai/v11/evaluate');
  const { getOrBuildCaseKnowledge } = await import('@/lib/ai/v11/cache');
  const evaluation = await evaluateFinalSolutionV11({
    solution: args.solution,
    caseId: args.caseView.id,
    content: args.caseView.content,
    answer: args.caseView.answer,
  });

  // Warm knowledge so answer reveal is consistent
  getOrBuildCaseKnowledge({
    caseId: args.caseView.id,
    content: args.caseView.content,
    answer: args.caseView.answer,
  });

  const session: GameSessionV2 = {
    ...args.session,
    status: 'closed',
    closedAt: Date.now(),
    result: {
      accuracy: evaluation.accuracy,
      matchedCount: evaluation.matchedCount,
      totalCount: evaluation.totalCount,
      solution: args.solution,
      answer: args.caseView.answer,
    },
  };

  return { session, evaluation };
}
