import type { JudgeResult } from '@/lib/ai-analyzer';
import { normalizeText } from './normalize';
import type {
  ParsedQuestion,
  RelationReasonResult,
  RetrievedItem,
  V11DecisionReason,
} from './types';

export const V11_CONFIG = {
  RETRIEVAL_STORY_MIN: 0.28,
  NLI_ENTAILMENT: 0.5,
  NLI_CONTRADICTION: 0.48,
  NLI_MARGIN: 0.05,
  CONFIRM_FACT_MIN_SIM: 0.42,
  CONFIRM_FACT_MIN_IMPORTANCE: 0.45,
  EVAL_MATCH: 0.4,
  EVAL_PARTIAL: 0.26,
  IRRELEVANT_MAX_RETRIEVAL: 0.22,
} as const;

/** Concrete details that are IRRELEVANT unless present in the case. */
const CONCRETE_DETAIL =
  /칼|총|독|권총|식칼|망치|줄|밧줄|돈|보험|유서|유언|카메라|cctv|혈흔|지문|알리바이|지문|독극물|수면제|폭탄/;

/** Alternative explanations → NO when case already has a different truth. */
const ALT_HYPOTHESIS =
  /사고였|우연이|우연히|단순\s*사고|강도|도둑|모르는\s*사람|남의|자살인가요|자살했어|타살인가요/;

export function isConcreteUngrounded(question: string, content: string, answer: string): boolean {
  const q = normalizeText(question);
  const caseText = normalizeText(`${content} ${answer}`);
  const hits = q.match(new RegExp(CONCRETE_DETAIL.source, 'g')) || [];
  if (!hits.length) return false;
  return hits.every((h) => !caseText.includes(h));
}

export function isAltHypothesisQuestion(question: string): boolean {
  return ALT_HYPOTHESIS.test(normalizeText(question));
}

export function decidePolicy(args: {
  parsed: ParsedQuestion;
  retrieved: RetrievedItem[];
  embeddingTopScore: number;
  nli: { entailment: number; contradiction: number; neutral: number } | null;
  relation: RelationReasonResult;
  storyRelevance: boolean;
  obviouslyUnrelated: boolean;
  concreteUngrounded?: boolean;
  altHypothesis?: boolean;
}): { label: JudgeResult; reason: V11DecisionReason } {
  const {
    parsed,
    nli,
    relation,
    storyRelevance,
    obviouslyUnrelated,
    embeddingTopScore,
    concreteUngrounded,
    altHypothesis,
  } = args;

  if (!parsed.raw.trim()) {
    return { label: 'irrelevant', reason: 'empty' };
  }

  if (obviouslyUnrelated) {
    return { label: 'irrelevant', reason: 'unrelated_irrelevant' };
  }

  // Relation mismatch (wrong parent/spouse/culprit) → NO — before IRRELEVANT
  if (
    !relation.matched &&
    (relation.detail?.includes('asked but only') ||
      relation.detail?.includes('asked as culprit') ||
      relation.detail?.includes('is culprit but') ||
      (relation.direction === 'general_to_specific' &&
        /엄마|아빠|어머니|아버지|남편|아내|부모/.test(parsed.normalized)))
  ) {
    return { label: 'no', reason: 'relation_not_entailed' };
  }

  if (
    relation.matched &&
    (relation.direction === 'synonym' || relation.direction === 'specific_to_general')
  ) {
    if (
      parsed.isFamilyQuery ||
      parsed.intent === 'relation' ||
      parsed.intent === 'entity' ||
      /결혼|부부|가족|관련|범인/.test(parsed.normalized)
    ) {
      return { label: 'yes', reason: 'relation_entailment' };
    }
  }

  if (relation.direction === 'general_to_specific' && !relation.matched) {
    return { label: 'no', reason: 'relation_not_entailed' };
  }

  if (concreteUngrounded) {
    return { label: 'irrelevant', reason: 'unrelated_irrelevant' };
  }

  if (altHypothesis) {
    return { label: 'no', reason: 'story_related_no' };
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

    if (
      neutral >= 0.45 &&
      neutral >= entailment &&
      neutral >= contradiction &&
      embeddingTopScore < V11_CONFIG.RETRIEVAL_STORY_MIN
    ) {
      return { label: 'irrelevant', reason: 'unrelated_irrelevant' };
    }
  }

  // Weak grounding → IRRELEVANT
  if (embeddingTopScore < V11_CONFIG.IRRELEVANT_MAX_RETRIEVAL && !storyRelevance) {
    return { label: 'irrelevant', reason: 'unrelated_irrelevant' };
  }

  // On-topic but not entailed/contradicted → IRRELEVANT (classic undetermined detail)
  if (storyRelevance || embeddingTopScore >= V11_CONFIG.RETRIEVAL_STORY_MIN) {
    return { label: 'irrelevant', reason: 'unrelated_irrelevant' };
  }

  return { label: 'irrelevant', reason: 'unrelated_irrelevant' };
}
