import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/auth/route-secrets';
import { runPuzzleGenerationPipeline } from '@/lib/content/threads-puzzle/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 300;

function batchFromEnv(): number {
  const n = Number(process.env.GENERATION_BATCH_SIZE || '5');
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(12, Math.floor(n)));
}

/**
 * Vercel Cron: generate multiple pending AI puzzles for admin review.
 * Does NOT publish to site or Threads — admin must Accept.
 * Schedule: weekdays 10:00 & 18:00 KST
 */
export async function GET(request: NextRequest) {
  const denied = assertCronAuth(request);
  if (denied) return denied;

  try {
    const result = await runPuzzleGenerationPipeline({ batchSize: batchFromEnv() });
    return NextResponse.json(
      {
        success: result.ok,
        ...result,
        timestamp: new Date().toISOString(),
      },
      { status: result.ok ? 200 : 500 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[cron/generate-puzzle]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
