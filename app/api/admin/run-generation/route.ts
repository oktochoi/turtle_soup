import { NextRequest, NextResponse } from 'next/server';
import { assertAdminAuth } from '@/lib/auth/route-secrets';
import { runPuzzleGenerationPipeline } from '@/lib/content/threads-puzzle/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Manual generation → one pending puzzle.
 * Authorization: Bearer ADMIN_SECRET
 */
export async function POST(request: NextRequest) {
  const denied = assertAdminAuth(request);
  if (denied) return denied;

  try {
    const result = await runPuzzleGenerationPipeline({ batchSize: 1 });
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
