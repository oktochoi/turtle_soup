/**
 * Local E2E: generate one pending AI puzzle via the real pipeline.
 * Usage: npx --yes tsx scripts/test-ai-generate.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

async function main() {
  console.log('=== AI puzzle generation E2E ===');
  console.log('GROQ_MODEL=', process.env.GROQ_MODEL);
  console.log('SUPABASE_URL set=', Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL));
  console.log('SERVICE_ROLE set=', Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));
  console.log('GROQ_API_KEY set=', Boolean(process.env.GROQ_API_KEY));

  const { runPuzzleGenerationPipeline } = await import(
    '../lib/content/threads-puzzle/pipeline'
  );

  const started = Date.now();
  const result = await runPuzzleGenerationPipeline({ batchSize: 1, exploreChance: 0.3 });
  const ms = Date.now() - started;

  console.log('--- result ---');
  console.log(JSON.stringify(result, null, 2));
  console.log('elapsed_ms=', ms);

  if (!result.ok) {
    console.error('GENERATION_FAILED');
    process.exit(1);
  }

  console.log('GENERATION_OK');
  console.log('title=', result.saved[0]?.title);
  console.log('problemId=', result.saved[0]?.problemId);
  process.exit(0);
}

main().catch((e) => {
  console.error('CRASH', e instanceof Error ? e.message : e);
  process.exit(1);
});
