import type { JudgeResult, ProblemKnowledge } from '@/lib/ai-analyzer';
import { analyzeQuestionV8 } from '@/lib/ai-analyzer';
import { judgeQuestionV10, runNLIScores } from '@/lib/ai-analyzer-v10';
import { getOrBuildCaseKnowledge } from './cache';
import { lexicalOverlap } from './normalize';
import { parseQuestion } from './parser';
import { decidePolicy, V11_CONFIG } from './policy';
import { isObviouslyUnrelated, reasonFamilyRelation } from './relation';
import { retrieveKnowledge, similarity } from './retrieval';
import type { AtomicFact, CaseKnowledge, V11JudgeDebug, V11JudgeResult } from './types';

function questionToHypothesis(question: string): string {
  let h = question.trim().replace(/[?？]+$/g, '');
  // "관련되어 있나요" → declarative-ish for NLI
  h = h.replace(/(인가요|일까요|나요|까)\s*$/g, '');
  if (!/[다요음]$/.test(h)) h = h + '이다';
  return h;
}

async function pickConfirmedFact(args: {
  knowledge: CaseKnowledge;
  retrieved: { id: string; text: string; score: number; kind: string }[];
  label: JudgeResult;
  confirmedIds: Set<string>;
}): Promise<AtomicFact | null> {
  if (args.label === 'irrelevant') return null;
  const candidates = args.knowledge.facts
    .filter((f) => f.source === 'answer' || f.kind === 'cause' || f.kind === 'belief' || f.kind === 'relation')
    .filter((f) => f.importance >= V11_CONFIG.CONFIRM_FACT_MIN_IMPORTANCE)
    .filter((f) => !args.confirmedIds.has(f.id));

  let best: AtomicFact | null = null;
  let bestScore = 0;
  for (const f of candidates) {
    const hit = args.retrieved.find((r) => r.text === f.text || r.id === f.id);
    const score = hit?.score ?? (await similarity(args.retrieved[0]?.text || '', f.text));
    // Prefer retrieved score for this fact
    const rScore = args.retrieved.find((r) => r.id === f.id)?.score ?? 0;
    const s = Math.max(score * 0.3, rScore);
    if (s > bestScore) {
      bestScore = s;
      best = f;
    }
  }
  if (!best || bestScore < V11_CONFIG.CONFIRM_FACT_MIN_SIM) return null;
  // Only confirm when answer was yes OR strong retrieval on a critical fact
  if (args.label === 'yes' || bestScore >= V11_CONFIG.CONFIRM_FACT_MIN_SIM + 0.08) {
    return best;
  }
  return null;
}

/** Lexical match when NLI/embeddings are weak (Node / short answers). */
function lexicalFactJudgment(args: {
  question: string;
  knowledge: CaseKnowledge;
  parsed: ReturnType<typeof parseQuestion>;
  relation: ReturnType<typeof reasonFamilyRelation>;
}): { label: JudgeResult; reason: 'entailment'; fact: AtomicFact } | null {
  const { question, knowledge, parsed, relation } = args;

  if (
    (relation.direction === 'general_to_specific' && !relation.matched) ||
    (relation.detail?.includes('asked but only') ?? false)
  ) {
    return null;
  }

  const qNorm = parsed.normalized;
  const topicHints = ['결혼', '사고', '자살', '살인', '범죄', '사망'];
  const qTopics = topicHints.filter((t) => qNorm.includes(t));

  const focusKinds = new Set(['cause', 'purpose', 'state', 'event', 'fact']);
  let best: { score: number; fact: AtomicFact } | null = null;

  for (const f of knowledge.facts) {
    if (f.source !== 'answer' && f.kind !== 'relation') continue;
    if (!focusKinds.has(f.kind) && f.kind !== 'relation') continue;

    const factNegated = /않|없|아니|못/.test(f.text);
    if (parsed.isNegated && !factNegated) continue;
    if (!parsed.isNegated && factNegated) continue;

    if (qTopics.length && !qTopics.some((t) => f.text.includes(t))) continue;

    const score = lexicalOverlap(question, f.text);
    const answerBoost = lexicalOverlap(question, knowledge.answer) * 0.12;
    const intentBoost = parsed.intent === f.kind ? 0.12 : 0;
    const purposeBoost =
      parsed.intent === 'purpose' &&
      f.kind === 'purpose' &&
      /목적|확인|위해|주문/.test(qNorm) &&
      /목적|확인|위해|주문/.test(f.text)
        ? 0.15
        : 0;
    const total = score + intentBoost + answerBoost + purposeBoost;
    if (!best || total > best.score) best = { score: total, fact: f };
  }

  if (best && best.score >= 0.4) {
    return { label: 'yes', reason: 'entailment', fact: best.fact };
  }
  return null;
}

function negationFactSplit(args: {
  question: string;
  knowledge: CaseKnowledge;
  parsed: ReturnType<typeof parseQuestion>;
}): { label: JudgeResult; reason: 'contradiction' } | null {
  const { question, knowledge, parsed } = args;
  if (parsed.isNegated) return null;

  for (const f of knowledge.facts) {
    if (!/않|없|아니|못/.test(f.text)) continue;
    if (lexicalOverlap(question, f.text) >= 0.28) {
      return { label: 'no', reason: 'contradiction' };
    }
  }
  return null;
}

function purposeFactJudgment(args: {
  knowledge: CaseKnowledge;
  parsed: ReturnType<typeof parseQuestion>;
}): { label: JudgeResult; reason: 'entailment'; fact: AtomicFact } | null {
  const { knowledge, parsed } = args;
  if (parsed.intent !== 'purpose') return null;
  const q = parsed.normalized;
  if (!/목적|위해|확인/.test(q)) return null;

  for (const f of knowledge.facts) {
    if (f.kind !== 'purpose') continue;
    const hasOrder = /주문/.test(q) === /주문/.test(f.text);
    const hasConfirm = /확인|상태/.test(q) && /확인|상태/.test(f.text);
    if (hasOrder && hasConfirm) {
      return { label: 'yes', reason: 'entailment', fact: f };
    }
  }
  return null;
}

/**
 * V11 judge: Case Knowledge → retrieve → NLI → relation → policy.
 * Falls back to V10 then V9 on failure.
 */
export async function judgeQuestionV11(args: {
  question: string;
  caseId: string;
  content: string;
  answer: string;
  /** Already confirmed fact ids (session) */
  confirmedFactIds?: string[];
  /** Optional ProblemKnowledge for V9/V10 fallback */
  problemKnowledge?: ProblemKnowledge | null;
}): Promise<V11JudgeResult> {
  const confirmedIds = new Set(args.confirmedFactIds || []);

  try {
    const knowledge = getOrBuildCaseKnowledge({
      caseId: args.caseId,
      content: args.content,
      answer: args.answer,
    });

    const parsed = parseQuestion(args.question);
    const retrieved = await retrieveKnowledge(parsed.raw, knowledge, 5);
    const embeddingTopScore = retrieved[0]?.score ?? 0;
    const storyRelevance =
      embeddingTopScore >= V11_CONFIG.RETRIEVAL_STORY_MIN ||
      (await similarity(parsed.raw, knowledge.answer)) >= V11_CONFIG.RETRIEVAL_STORY_MIN ||
      (await similarity(parsed.raw, knowledge.content)) >= V11_CONFIG.RETRIEVAL_STORY_MIN * 0.9;

    const relation = reasonFamilyRelation(knowledge, parsed);
    const obviouslyUnrelated = isObviouslyUnrelated(parsed.raw);

    let nli: { entailment: number; contradiction: number; neutral: number } | null = null;
    let premise: string | undefined;

    // Belief split: prefer belief facts as premise for belief queries
    const premiseCandidates =
      parsed.isBeliefQuery && knowledge.beliefs.length
        ? knowledge.beliefs.map((b) => b.text)
        : retrieved.map((r) => r.text);

    if (!parsed.isBeliefQuery && parsed.intent === 'state') {
      // Prefer state/fact over belief for "죽었나요?" style
      const stateFacts = knowledge.facts.filter((f) => f.kind === 'state' || f.kind === 'fact');
      const real = stateFacts.find((f) => /살아|생존|죽지|사망하지/.test(f.text)) ||
        knowledge.facts.find((f) => !/생각|믿/.test(f.text) && /살아|죽|사망/.test(f.text));
      if (real) premiseCandidates.unshift(real.text);
      // Also put full answer early
      premiseCandidates.unshift(knowledge.answer);
    }

    const hypothesis = questionToHypothesis(parsed.raw);

    for (const p of premiseCandidates.slice(0, 3)) {
      try {
        const scores = await runNLIScores(p, hypothesis);
        if (
          !nli ||
          Math.max(scores.entailment, scores.contradiction) >
            Math.max(nli.entailment, nli.contradiction)
        ) {
          nli = scores;
          premise = p;
        }
      } catch {
        // NLI optional
      }
    }

    // Belief vs fact: if asking "아들은 죽었어?" and answer says alive + mother believed dead
    if (parsed.intent === 'state' && !parsed.isBeliefQuery) {
      const answerSaysAlive = /살아|생존/.test(knowledge.answer) && /생각|믿/.test(knowledge.answer);
      const asksDead = /죽|사망|숨지/.test(parsed.normalized);
      if (answerSaysAlive && asksDead) {
        const debug: V11JudgeDebug = {
          question: parsed.raw,
          parsedIntent: parsed.intent,
          retrieved,
          embeddingTopScore,
          nli: nli ? { ...nli, premise } : undefined,
          relation,
          storyRelevance: true,
          final: 'no',
          reason: 'belief_fact_split',
        };
        if (process.env.NODE_ENV === 'development') console.log('[V11]', debug);
        return { label: 'no', reason: 'belief_fact_split', confirmedFact: null, debug };
      }
    }
    if (parsed.isBeliefQuery) {
      const hasBeliefDead = knowledge.beliefs.some((b) => /죽|사망/.test(b.text)) ||
        (/생각|믿/.test(knowledge.answer) && /죽|사망/.test(knowledge.answer));
      const asksBelievedDead = /죽|사망/.test(parsed.normalized) && /생각|믿|알았/.test(parsed.normalized);
      if (hasBeliefDead && asksBelievedDead) {
        const debug: V11JudgeDebug = {
          question: parsed.raw,
          parsedIntent: parsed.intent,
          retrieved,
          embeddingTopScore,
          nli: nli ? { ...nli, premise } : undefined,
          relation,
          storyRelevance: true,
          final: 'yes',
          reason: 'belief_fact_split',
        };
        const fact =
          knowledge.facts.find((f) => f.kind === 'belief' && !confirmedIds.has(f.id)) || null;
        if (process.env.NODE_ENV === 'development') console.log('[V11]', debug);
        return { label: 'yes', reason: 'belief_fact_split', confirmedFact: fact, debug };
      }
    }

    const negSplit = negationFactSplit({ question: parsed.raw, knowledge, parsed });
    if (negSplit) {
      const debug: V11JudgeDebug = {
        question: parsed.raw,
        parsedIntent: parsed.intent,
        retrieved,
        embeddingTopScore,
        nli: nli ? { ...nli, premise } : undefined,
        relation,
        storyRelevance: true,
        final: negSplit.label,
        reason: negSplit.reason,
      };
      if (process.env.NODE_ENV === 'development') console.log('[V11]', debug);
      return { label: negSplit.label, reason: negSplit.reason, confirmedFact: null, debug };
    }

    if (!relation.matched && relation.detail?.includes('asked but only')) {
      const debug: V11JudgeDebug = {
        question: parsed.raw,
        parsedIntent: parsed.intent,
        retrieved,
        embeddingTopScore,
        nli: nli ? { ...nli, premise } : undefined,
        relation,
        storyRelevance: true,
        final: 'no',
        reason: 'relation_not_entailed',
      };
      if (process.env.NODE_ENV === 'development') console.log('[V11]', debug);
      return { label: 'no', reason: 'relation_not_entailed', confirmedFact: null, debug };
    }

    const purposeHit = purposeFactJudgment({ knowledge, parsed });
    if (purposeHit) {
      const debug: V11JudgeDebug = {
        question: parsed.raw,
        parsedIntent: parsed.intent,
        retrieved,
        embeddingTopScore,
        nli: nli ? { ...nli, premise } : undefined,
        relation,
        storyRelevance: true,
        final: 'yes',
        reason: purposeHit.reason,
      };
      const confirmedFact = !confirmedIds.has(purposeHit.fact.id) ? purposeHit.fact : null;
      if (process.env.NODE_ENV === 'development') console.log('[V11]', debug);
      return {
        label: purposeHit.label,
        reason: purposeHit.reason,
        confirmedFact,
        debug,
      };
    }

    const lexical = lexicalFactJudgment({ question: parsed.raw, knowledge, parsed, relation });
    if (lexical) {
      const debug: V11JudgeDebug = {
        question: parsed.raw,
        parsedIntent: parsed.intent,
        retrieved,
        embeddingTopScore,
        nli: nli ? { ...nli, premise } : undefined,
        relation,
        storyRelevance: true,
        final: 'yes',
        reason: lexical.reason,
      };
      const confirmedFact =
        !confirmedIds.has(lexical.fact.id) ? lexical.fact : null;
      if (process.env.NODE_ENV === 'development') console.log('[V11]', debug);
      return {
        label: lexical.label,
        reason: lexical.reason,
        confirmedFact,
        debug,
      };
    }

    const decision = decidePolicy({
      parsed,
      retrieved,
      embeddingTopScore,
      nli,
      relation,
      storyRelevance,
      obviouslyUnrelated,
    });

    const confirmedFact = await pickConfirmedFact({
      knowledge,
      retrieved,
      label: decision.label,
      confirmedIds,
    });

    const debug: V11JudgeDebug = {
      question: parsed.raw,
      parsedIntent: parsed.intent,
      retrieved,
      embeddingTopScore,
      nli: nli ? { ...nli, premise } : undefined,
      relation,
      storyRelevance,
      final: decision.label,
      reason: decision.reason,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('[V11]', debug);
    }

    return {
      label: decision.label,
      reason: decision.reason,
      confirmedFact,
      debug,
    };
  } catch (err) {
    console.warn('[V11] failed, trying V10/V9', err);
    return fallbackJudge(args);
  }
}

async function fallbackJudge(args: {
  question: string;
  content: string;
  answer: string;
  problemKnowledge?: ProblemKnowledge | null;
}): Promise<V11JudgeResult> {
  const emptyDebug = {
    question: args.question,
    parsedIntent: 'other' as const,
    retrieved: [],
    embeddingTopScore: 0,
    storyRelevance: false,
    final: 'irrelevant' as JudgeResult,
    reason: 'fallback_v9' as const,
  };

  if (args.problemKnowledge) {
    try {
      const v10 = await judgeQuestionV10(args.question, args.problemKnowledge);
      return {
        label: v10.label,
        reason: 'fallback_v10',
        confirmedFact: null,
        debug: { ...emptyDebug, final: v10.label, reason: 'fallback_v10' },
      };
    } catch {
      try {
        const v9 = await analyzeQuestionV8(args.question, args.problemKnowledge);
        return {
          label: v9,
          reason: 'fallback_v9',
          confirmedFact: null,
          debug: { ...emptyDebug, final: v9, reason: 'fallback_v9' },
        };
      } catch {
        /* fallthrough */
      }
    }
  }

  return {
    label: 'irrelevant',
    reason: 'fallback_v9',
    confirmedFact: null,
    debug: emptyDebug,
  };
}

export { getOrBuildCaseKnowledge };
