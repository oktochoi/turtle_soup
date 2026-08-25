import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/auth/route-secrets';
import { collectDueInsights } from '@/lib/threads/insights';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Vercel Cron: collect Threads insights at 1h/6h/24h/72h windows
 */
export async function GET(request: NextRequest) {
  const denied = assertCronAuth(request);
  if (denied) return denied;

  try {
    const result = await collectDueInsights();
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[cron/collect-insights]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
