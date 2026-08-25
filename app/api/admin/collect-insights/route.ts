import { NextRequest, NextResponse } from 'next/server';
import { assertAdminAuth } from '@/lib/auth/route-secrets';
import { collectDueInsights } from '@/lib/threads/insights';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** Manual insights collection. Authorization: Bearer ADMIN_SECRET */
export async function POST(request: NextRequest) {
  const denied = assertAdminAuth(request);
  if (denied) return denied;

  try {
    const result = await collectDueInsights();
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
