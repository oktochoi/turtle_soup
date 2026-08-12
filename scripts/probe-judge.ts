/**
 * Probe yes/no/irrelevant judgment quality on realistic turtle-soup questions.
 */
import { buildCaseKnowledge } from '../lib/ai/v11/knowledge';
import { judgeQuestionV11 } from '../lib/ai/v11/judge';

type Case = {
  id: string;
  content: string;
  answer: string;
  questions: { q: string; expect: 'yes' | 'no' | 'irrelevant' }[];
};

const cases: Case[] = [
  {
    id: 'wife_killer',
    content: '한 남자가 집에서 살해된 채로 발견되었다. 문은 안에서 잠겨 있었다.',
    answer: '범인은 피해자의 아내였다. 아내는 남편이 외도했다고 오해해서 살해했다.',
    questions: [
      { q: '아내가 범인인가요?', expect: 'yes' },
      { q: '범인이 가족인가요?', expect: 'yes' },
      { q: '남편이 범인인가요?', expect: 'no' },
      { q: '문이 잠겨 있었나요?', expect: 'yes' },
      { q: '외도 오해가 동기가 됐나요?', expect: 'yes' },
      { q: '사고였나요?', expect: 'no' },
      { q: '오늘 날씨가 관련 있나요?', expect: 'irrelevant' },
      { q: '피해자는 남자인가요?', expect: 'yes' },
      { q: '칼이 사용됐나요?', expect: 'irrelevant' },
      { q: '돈이 관련됐나요?', expect: 'irrelevant' },
    ],
  },
  {
    id: 'mother_order',
    content: '한 여자가 배달 음식을 받고 나서 충격을 받았다.',
    answer: '어머니는 아들이 죽었다고 생각했지만 실제로 아들은 살아 있었다. 상태를 확인하기 위해 음식을 주문했다.',
    questions: [
      { q: '엄마가 음식을 주문했나요?', expect: 'yes' },
      { q: '아들이 실제로 죽었나요?', expect: 'no' },
      { q: '엄마는 아들이 죽었다고 생각했나요?', expect: 'yes' },
      { q: '주문 목적이 상태 확인인가요?', expect: 'yes' },
      { q: '아빠가 주문했나요?', expect: 'no' },
      { q: '날씨가 관련 있나요?', expect: 'irrelevant' },
    ],
  },
];

async function main() {
  let pass = 0;
  let total = 0;
  const fails: string[] = [];

  for (const c of cases) {
    buildCaseKnowledge({ caseId: c.id, content: c.content, answer: c.answer });
    console.log(`\n=== ${c.id} ===`);
    for (const item of c.questions) {
      total++;
      const r = await judgeQuestionV11({
        question: item.q,
        caseId: c.id,
        content: c.content,
        answer: c.answer,
      });
      const ok = r.label === item.expect;
      if (ok) pass++;
      else fails.push(`${c.id} | ${item.q} expect=${item.expect} got=${r.label} (${r.reason})`);
      console.log(`${ok ? 'OK' : 'FAIL'} ${item.q} → ${r.label} (expect ${item.expect}) [${r.reason}] nli=${r.debug.nli ? `${r.debug.nli.entailment.toFixed(2)}/${r.debug.nli.contradiction.toFixed(2)}` : 'null'} emb=${r.debug.embeddingTopScore.toFixed(2)}`);
    }
  }

  console.log(`\n--- ${pass}/${total} (${Math.round((pass / total) * 100)}%) ---`);
  if (fails.length) {
    console.log('Failures:');
    fails.forEach((f) => console.log(' ', f));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
