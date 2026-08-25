import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/require-admin-session';
import { runPuzzleGenerationPipeline } from '@/lib/content/threads-puzzle/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Session-admin: generate multiple pending AI puzzles for review.
 * Body: { "batchSize"?: number }  // default 8, max 15
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  let batchSize = 8;
  try {
    const body = (await request.json()) as { batchSize?: number };
    if (typeof body?.batchSize === 'number' && Number.isFinite(body.batchSize)) {
      batchSize = Math.max(1, Math.min(15, Math.floor(body.batchSize)));
    }
  } catch {
    /* empty body */
  }

  try {
    const result = await runPuzzleGenerationPipeline({ batchSize });
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
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
