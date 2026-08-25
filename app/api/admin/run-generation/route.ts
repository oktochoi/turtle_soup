import { NextRequest, NextResponse } from 'next/server';
import { assertAdminAuth } from '@/lib/auth/route-secrets';
import { runPuzzleGenerationPipeline } from '@/lib/content/threads-puzzle/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Manual generation → pending review queue (no auto Threads).
 * Authorization: Bearer ADMIN_SECRET
 * Body JSON (optional): { "batchSize": 8 }
 */
export async function POST(request: NextRequest) {
  const denied = assertAdminAuth(request);
  if (denied) return denied;

  let batchSize = 8;
  try {
    const body = (await request.json()) as { batchSize?: number; skipThreads?: boolean };
    if (typeof body?.batchSize === 'number' && Number.isFinite(body.batchSize)) {
      batchSize = Math.max(1, Math.min(15, Math.floor(body.batchSize)));
    }
  } catch {
    /* empty body ok */
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
