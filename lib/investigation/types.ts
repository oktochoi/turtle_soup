import type { JudgeResult } from '@/lib/ai-analyzer';

export type CaseCategory =
  | 'crime'
  | 'mystery'
  | 'horror'
  | 'twist'
  | 'emotional'
  | 'extreme'
  | 'unknown';

export type ClueImportance = 'normal' | 'important' | 'critical';

export type QuestionImportance = 'irrelevant' | 'normal' | 'useful' | 'critical';

export type InvestigationStatus =
  | 'briefing'
  | 'investigating'
  | 'solving'
  | 'closed';

export interface KeyClue {
  id: string;
  text: string;
  keywords?: string[];
  concepts?: string[];
  importance: ClueImportance;
  xp: number;
}

export interface SolutionElement {
  id: string;
  text: string;
  weight: number;
}

export interface InvestigationCase {
  id: string;
  caseNumber: string;
  title: string;
  briefing: string;
  content: string;
  answer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: CaseCategory;
  categoryLabel: string;
  estimatedMinutes: number;
  playCount: number;
  keyClues: KeyClue[];
  solutionElements: SolutionElement[];
  hints: string[];
}

export interface InvestigationQuestion {
  question: string;
  answer: JudgeResult;
  importance: QuestionImportance;
  xp: number;
  energyCost: number;
  unlockedClueId?: string;
  createdAt: number;
}

export interface InvestigationSession {
  caseId: string;
  status: InvestigationStatus;
  startedAt: number;
  investigationEnergy: number;
  xp: number;
  questionCount: number;
  irrelevantQuestionCount: number;
  hintCount: number;
  discoveredClueIds: string[];
  hypothesisCount: number;
  truthScore: number;
  lastHypothesis?: string;
  hypothesisFeedback?: HypothesisFeedback;
  questions: InvestigationQuestion[];
  finalSolutionScore?: number;
  score?: number;
  grade?: string;
  detectiveStyle?: string;
  closedAt?: number;
}

export interface HypothesisFeedback {
  matchedParts: string[];
  uncertainParts: string[];
  wrongDirection: boolean;
  truthScore: number;
  summary: string;
}

export interface ElementMatch {
  id: string;
  text: string;
  status: 'match' | 'partial' | 'miss';
  similarity: number;
  weight: number;
}

export interface CaseResult {
  score: number;
  grade: string;
  finalSolutionScore: number;
  truthScore: number;
  cluesFound: number;
  cluesTotal: number;
  questionCount: number;
  irrelevantQuestionCount: number;
  hintCount: number;
  durationSec: number;
  energyRemaining: number;
  detectiveStyle: string;
  styleDescription: string;
  elementMatches: ElementMatch[];
  highlightQuestion?: string;
}

export const CATEGORY_LABELS: Record<CaseCategory, string> = {
  crime: '사건',
  mystery: '미스터리',
  horror: '공포',
  twist: '반전',
  emotional: '감동',
  extreme: '극악',
  unknown: '미분류',
};
