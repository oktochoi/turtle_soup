/**
 * V11 regression checks that do NOT require browser ML models.
 * Run: npx tsx scripts/v11-regression.ts
 * (If tsx unavailable, validated via tsc import graph + manual play.)
 */

import { buildCaseKnowledge } from '../lib/ai/v11/knowledge';
import { parseQuestion } from '../lib/ai/v11/parser';
import { reasonFamilyRelation, isObviouslyUnrelated } from '../lib/ai/v11/relation';
import { decidePolicy } from '../lib/ai/v11/policy';

type Expect = 'yes' | 'no' | 'irrelevant';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function runFamilyCase() {
  const answer = '피해자의 어머니가 사건에 관련되어 있었다.';
  const knowledge = buildCaseKnowledge({
    caseId: 'test_family',
    content: '한 남자가 숨진 채 발견됐다.',
    answer,
  });

  const cases: { q: string; expect: Expect; via: 'relation' | 'unrelated' }[] = [
    { q: '엄마가 관련되어 있어?', expect: 'yes', via: 'relation' },
    { q: '부모님 중 한 명이 관련되어 있어?', expect: 'yes', via: 'relation' },
    { q: '아빠가 관련되어 있어?', expect: 'no', via: 'relation' },
    { q: '오늘 날씨가 사건에 관련 있어?', expect: 'irrelevant', via: 'unrelated' },
  ];

  for (const c of cases) {
    const parsed = parseQuestion(c.q);
    if (c.via === 'unrelated') {
      assert(isObviouslyUnrelated(c.q), `expected unrelated: ${c.q}`);
      const d = decidePolicy({
        parsed,
        retrieved: [],
        embeddingTopScore: 0.05,
        nli: null,
        relation: { matched: false, direction: 'none', detail: '' },
        storyRelevance: false,
        obviouslyUnrelated: true,
      });
      assert(d.label === 'irrelevant', `weather → IRRELEVANT, got ${d.label}`);
      console.log('OK irrelevant:', c.q);
      continue;
    }

    const rel = reasonFamilyRelation(knowledge, parsed);
    if (c.expect === 'yes') {
      assert(rel.matched, `expected relation match for: ${c.q} (${rel.detail})`);
      const d = decidePolicy({
        parsed,
        retrieved: [{ kind: 'fact', id: '1', text: answer, score: 0.5 }],
        embeddingTopScore: 0.5,
        nli: null,
        relation: rel,
        storyRelevance: true,
        obviouslyUnrelated: false,
      });
      assert(d.label === 'yes', `${c.q} → YES, got ${d.label} (${d.reason})`);
      console.log('OK yes:', c.q, rel.direction);
    } else {
      // 아빠: should not synonym-match 어머니
      assert(!rel.matched || rel.direction === 'none', `아빠 should not match mother: ${JSON.stringify(rel)}`);
      const d = decidePolicy({
        parsed,
        retrieved: [{ kind: 'fact', id: '1', text: answer, score: 0.45 }],
        embeddingTopScore: 0.45,
        nli: null,
        relation: rel,
        storyRelevance: true,
        obviouslyUnrelated: false,
      });
      assert(d.label === 'no', `${c.q} → NO, got ${d.label}`);
      console.log('OK no:', c.q);
    }
  }
}

function runBeliefKnowledge() {
  const answer =
    '어머니는 아들이 죽었다고 생각했지만 실제로 아들은 살아 있었다.';
  const knowledge = buildCaseKnowledge({
    caseId: 'test_belief',
    content: '전화가 왔다.',
    answer,
  });
  assert(knowledge.beliefs.length >= 1 || knowledge.facts.some((f) => f.kind === 'belief'), 'belief extracted');
  assert(knowledge.facts.length >= 1, 'facts non-empty');
  console.log('OK belief knowledge:', {
    beliefs: knowledge.beliefs.length,
    facts: knowledge.facts.length,
    entities: knowledge.entities.map((e) => e.name),
  });
}

function runCauseKnowledge() {
  const answer = '남자는 진실을 알게 된 충격으로 자살했다.';
  const knowledge = buildCaseKnowledge({
    caseId: 'test_cause',
    content: '남자가 숨졌다.',
    answer,
  });
  assert(
    knowledge.causes.length >= 1 || knowledge.facts.some((f) => f.kind === 'cause'),
    'cause extracted'
  );
  console.log('OK cause knowledge:', {
    causes: knowledge.causes.length,
    facts: knowledge.facts.map((f) => f.kind),
  });
}

function runGeneralToSpecific() {
  const answer = '부모 중 한 명이 관련되어 있다.';
  const knowledge = buildCaseKnowledge({
    caseId: 'test_g2s',
    content: '사건 현장',
    answer,
  });
  const parsed = parseQuestion('엄마가 관련되어 있나요?');
  const rel = reasonFamilyRelation(knowledge, parsed);
  assert(
    rel.direction === 'general_to_specific' || !rel.matched,
    `general parent must not auto-entail mother: ${JSON.stringify(rel)}`
  );
  console.log('OK general→specific:', rel);
}

function main() {
  runFamilyCase();
  runBeliefKnowledge();
  runCauseKnowledge();
  runGeneralToSpecific();
  console.log('\nAll V11 regression checks passed.');
}

main();
