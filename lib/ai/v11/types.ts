import type { JudgeResult } from '@/lib/ai-analyzer';

export type EntityType = 'person' | 'object' | 'place' | 'other';
export type FactKind = 'fact' | 'belief' | 'state' | 'event' | 'cause' | 'purpose' | 'relation';
export type QuestionIntent =
  | 'entity'
  | 'relation'
  | 'action'
  | 'state'
  | 'cause'
  | 'purpose'
  | 'belief'
  | 'time'
  | 'location'
  | 'other';

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  aliases?: string[];
  role?: string;
}

export type RelationType =
  | 'parent_of'
  | 'child_of'
  | 'spouse_of'
  | 'family'
  | 'identity'
  | 'owns'
  | 'participant'
  | 'located_in'
  | 'other';

export interface Relation {
  id: string;
  from: string;
  to: string;
  type: RelationType;
  /** directed: from --type--> to */
  text: string;
}

export interface CaseEvent {
  id: string;
  actor?: string;
  action: string;
  object?: string;
  text: string;
}

export interface StateFact {
  id: string;
  subject?: string;
  state: string;
  text: string;
}

export interface BeliefFact {
  id: string;
  holder: string;
  proposition: string;
  text: string;
}

export interface CausalFact {
  id: string;
  cause: string;
  effect: string;
  text: string;
  kind: 'cause' | 'purpose';
}

export interface AtomicFact {
  id: string;
  text: string;
  kind: FactKind;
  /** higher = more central to solution */
  importance: number;
  entityIds?: string[];
  source: 'answer' | 'content' | 'derived';
}

export interface CaseKnowledge {
  caseId: string;
  answerHash: string;
  content: string;
  answer: string;
  entities: Entity[];
  relations: Relation[];
  events: CaseEvent[];
  states: StateFact[];
  beliefs: BeliefFact[];
  causes: CausalFact[];
  facts: AtomicFact[];
  builtAt: number;
}

export interface ParsedQuestion {
  raw: string;
  normalized: string;
  intent: QuestionIntent;
  entitiesMentioned: string[];
  isNegated: boolean;
  isBeliefQuery: boolean;
  isCauseQuery: boolean;
  isFamilyQuery: boolean;
}

export interface RetrievedItem {
  kind: 'fact' | 'entity' | 'relation' | 'belief' | 'cause' | 'event' | 'state';
  id: string;
  text: string;
  score: number;
}

export interface RelationReasonResult {
  matched: boolean;
  direction: 'specific_to_general' | 'general_to_specific' | 'synonym' | 'none';
  detail: string;
}

export type V11DecisionReason =
  | 'entailment'
  | 'contradiction'
  | 'relation_entailment'
  | 'relation_not_entailed'
  | 'story_related_no'
  | 'unrelated_irrelevant'
  | 'belief_fact_split'
  | 'fallback_v10'
  | 'fallback_v9'
  | 'empty';

export interface V11JudgeDebug {
  question: string;
  parsedIntent: QuestionIntent;
  retrieved: RetrievedItem[];
  embeddingTopScore: number;
  nli?: {
    entailment: number;
    contradiction: number;
    neutral: number;
    premise?: string;
  };
  relation?: RelationReasonResult;
  storyRelevance: boolean;
  final: JudgeResult;
  reason: V11DecisionReason;
}

export interface V11JudgeResult {
  label: JudgeResult;
  reason: V11DecisionReason;
  confirmedFact?: AtomicFact | null;
  debug: V11JudgeDebug;
}

export type MatchStatus = 'match' | 'partial' | 'miss';

export interface FactMatch {
  factId: string;
  text: string;
  status: MatchStatus;
  score: number;
  weight: number;
}

export interface EvaluationResult {
  accuracy: number;
  matches: FactMatch[];
  matchedCount: number;
  totalCount: number;
  summary: string;
}
