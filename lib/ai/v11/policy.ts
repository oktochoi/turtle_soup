import type { JudgeResult } from '@/lib/ai-analyzer';
import type {
  ParsedQuestion,
  RelationReasonResult,
  RetrievedItem,
  V11DecisionReason,
} from './types';

export const V11_CONFIG = {
  RETRIEVAL_STORY_MIN: 0.28,
  NLI_ENTAILMENT: 0.55,
  NLI_CONTRADICTION: 0.52,
  NLI_MARGIN: 0.06,
  CONFIRM_FACT_MIN_SIM: 0.48,
  CONFIRM_FACT_MIN_IMPORTANCE: 0.45,
  EVAL_MATCH: 0.48,
  EVAL_PARTIAL: 0.32,
} as const;

export function decidePolicy(args: {
  parsed: ParsedQuestion;
  retrieved: RetrievedItem[];
  embeddingTopScore: number;
  nli: { entailment: number; contradiction: number; neutral: number } | null;
  relation: RelationReasonResult;
  storyRelevance: boolean;
  obviouslyUnrelated: boolean;
}): { label: JudgeResult; reason: V11DecisionReason } {
  const { parsed, nli, relation, storyRelevance, obviouslyUnrelated, embeddingTopScore } = args;

  if (!parsed.raw.trim()) {
    return { label: 'irrelevant', reason: 'empty' };
  }

  if (obviouslyUnrelated) {
    return { label: 'irrelevant', reason: 'unrelated_irrelevant' };
  }

  // Explicit parent mismatch → NO before lexical/NLI shortcuts
  if (
    !relation.matched &&
    (relation.detail?.includes('asked but only') ||
      (relation.direction === 'general_to_specific' && /엄마|아빠|어머니|아버지|남편|아내/.test(parsed.normalized)))
  ) {
    return { label: 'no', reason: 'relation_not_entailed' };
  }
  if (relation.matched && (relation.direction === 'synonym' || relation.direction === 'specific_to_general')) {
    if (parsed.isFamilyQuery || parsed.intent === 'relation' || parsed.intent === 'entity') {
      return { label: 'yes', reason: 'relation_entailment' };
    }
  }

  // Explicit: general→specific does not entail
  if (relation.direction === 'general_to_specific' && !relation.matched) {
    if (
      storyRelevance ||
      embeddingTopScore >= V11_CONFIG.RETRIEVAL_STORY_MIN ||
      /범인|가해|관련/.test(parsed.normalized)
    ) {
      return { label: 'no', reason: 'relation_not_entailed' };
    }
  }

  if (nli) {
    const { entailment, contradiction, neutral } = nli;
    const entailOk =
      entailment >= V11_CONFIG.NLI_ENTAILMENT &&
      entailment > contradiction &&
      entailment - Math.max(contradiction, neutral) >= V11_CONFIG.NLI_MARGIN;

    if (entailOk) {
      return { label: 'yes', reason: 'entailment' };
    }

    if (contradiction >= V11_CONFIG.NLI_CONTRADICTION && contradiction >= entailment) {
      return { label: 'no', reason: 'contradiction' };
    }
  }

  // High retrieval to answer facts → related hypothesis → NO if not entailed
  if (storyRelevance || embeddingTopScore >= V11_CONFIG.RETRIEVAL_STORY_MIN) {
    return { label: 'no', reason: 'story_related_no' };
  }

  // Conservative IRRELEVANT — but Y/N case questions stay NO, not IRRELEVANT
  const isYnQuestion = /\?|인가|일까|나요|니|니요|죠\?/.test(parsed.raw);
  if (embeddingTopScore < 0.2 && !isYnQuestion) {
    return { label: 'irrelevant', reason: 'unrelated_irrelevant' };
  }

  // Default: story-ish questions → NO rather than IRRELEVANT
  return { label: 'no', reason: 'story_related_no' };
}
