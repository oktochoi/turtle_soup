import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth/require-admin-session';
import {
  approveAiPuzzle,
  rejectAiPuzzle,
  updateAiPuzzleDraft,
  type AiPuzzleEdits,
} from '@/lib/content/threads-puzzle/moderation';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  action: 'approve' | 'reject' | 'save';
  problemId: string;
  edits?: AiPuzzleEdits;
  /** default true on approve */
  publishThreads?: boolean;
};

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.response;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body?.problemId || !body?.action) {
    return NextResponse.json({ error: 'problemId and action required' }, { status: 400 });
  }

  try {
    if (body.action === 'save') {
      const data = await updateAiPuzzleDraft(body.problemId, body.edits || {});
      return NextResponse.json({ success: true, action: 'save', problem: data });
    }

    if (body.action === 'reject') {
      const data = await rejectAiPuzzle(body.problemId);
      return NextResponse.json({ success: true, action: 'reject', ...data });
    }

    if (body.action === 'approve') {
      const data = await approveAiPuzzle(body.problemId, {
        edits: body.edits,
        publishThreads: body.publishThreads,
      });
      return NextResponse.json({ success: true, action: 'approve', ...data });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
