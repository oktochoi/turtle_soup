/**
 * V11 full judge E2E against scripts/v11-testset.json
 * Run: npm run test:v11:e2e
 *
 * Note: NLI/embedding require browser (Transformers). In Node, judge falls back to V9
 * for some cases — failures are reported separately.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { judgeQuestionV11 } from '../lib/ai/v11/judge';

type Expect = 'yes' | 'no' | 'irrelevant';

interface TestCase {
  id: string;
  category: string;
  answer: string;
  question: string;
  expect: Expect;
}

const testset: TestCase[] = JSON.parse(
  readFileSync(join(__dirname, 'v11-testset.json'), 'utf-8')
);

async function runOne(tc: TestCase) {
  const result = await judgeQuestionV11({
    question: tc.question,
    caseId: `test_${tc.id}`,
    content: '테스트용 사건 상황입니다.',
    answer: tc.answer,
  });
  const pass = result.label === tc.expect;
  return { ...tc, got: result.label, pass, reason: result.reason };
}

async function main() {
  console.log(`\nV11 E2E — ${testset.length} cases\n`);

  const results = [];
  for (const tc of testset) {
    const r = await runOne(tc);
    results.push(r);
    const mark = r.pass ? 'OK' : 'FAIL';
    console.log(
      `[${mark}] ${r.id} (${r.category}) expect=${r.expect} got=${r.got} reason=${r.reason}`
    );
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);

  console.log(`\n--- Summary ---`);
  console.log(`Pass: ${passed}/${testset.length} (${Math.round((passed / testset.length) * 100)}%)`);

  if (failed.length) {
    console.log(`\nFailed (${failed.length}):`);
    for (const f of failed) {
      console.log(`  - ${f.id}: Q="${f.question}" expect=${f.expect} got=${f.got}`);
    }
    process.exit(1);
  }

  console.log('\nAll E2E cases passed.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
