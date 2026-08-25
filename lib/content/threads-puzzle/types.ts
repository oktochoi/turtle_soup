export type PuzzleDifficulty = 'easy' | 'medium' | 'hard';

export type PuzzleCandidate = {
  title: string;
  content: string;
  answer: string;
  explanation: string;
  difficulty: PuzzleDifficulty;
  coreTrick: string;
  place: string;
  characterRelation: string;
  whyInteresting: string;
};

export type JudgeResult = {
  pass: boolean;
  score: number;
  storyNatural: boolean;
  vividScene: boolean;
  curiosity: boolean;
  answerExplainsAll: boolean;
  noForcedSetup: boolean;
  notAbsurd: boolean;
  notDuplicate: boolean;
  commentWorthy: boolean;
  reasons: string[];
  improvementHints: string[];
};

export type PerformanceSummary = {
  strongPatterns: string[];
  weakPatterns: string[];
  highReplyStructures: string[];
  highShareStructures: string[];
  repeatedThemes: string[];
  avoidThemes: string[];
  recommendedDifficulty: PuzzleDifficulty;
  sampleNotes: string[];
};

export type RecentProblemBrief = {
  title: string;
  content: string;
  answer: string;
  coreTrick?: string | null;
};

export type SavedPendingPuzzle = {
  problemId: string;
  title: string;
  judgeScore: number;
};

/** Batch generation → pending review (no auto Threads publish) */
export type BatchPipelineResult = {
  ok: boolean;
  saved: SavedPendingPuzzle[];
  count?: number;
  attempts: number;
  error?: string;
};

/** Legacy single-result shape (approve flow / older callers) */
export type PipelineResult = {
  ok: boolean;
  problemId?: string;
  threadsMediaId?: string;
  permalink?: string | null;
  title?: string;
  attempts: number;
  error?: string;
  judgeScore?: number;
};
