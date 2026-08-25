import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/require-admin-session';
import { runPuzzleGenerationPipeline } from '@/lib/content/threads-puzzle/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Session-admin: generate exactly one pending AI puzzle. */
export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

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
