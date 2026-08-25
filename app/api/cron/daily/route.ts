import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/auth/route-secrets';
import { collectDueInsights } from '@/lib/threads/insights';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Vercel Hobby: only ONE cron is allowed (and typically once per day).
 * This route bundles daily maintenance. AI puzzle generation is manual
 * from Admin → AI 문제 검수 ("한번에 후보 만들기").
 */
export async function GET(request: NextRequest) {
  const denied = assertCronAuth(request);
  if (denied) return denied;

  const results: Record<string, unknown> = {};

  // 1) Inactive rooms
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('cleanup_inactive_rooms');
    results.roomsCleanup = error
      ? { ok: false, error: error.message }
      : { ok: true, deletedCount: data || 0 };
  } catch (e) {
    results.roomsCleanup = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // 2) Threads insights (for already-published posts)
  try {
    results.insights = { ok: true, ...(await collectDueInsights()) };
  } catch (e) {
    results.insights = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // 3) AI learning cycle
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const batchSize = Math.min(
      Math.max(1, parseInt(process.env.AI_LEARNING_BATCH_SIZE ?? '50', 10) || 50),
      100
    );
    const { data, error } = await supabase.rpc('run_ai_learning_cycle', {
      p_batch_size: batchSize,
    });
    results.aiLearning = error
      ? { ok: false, error: error.message }
      : { ok: true, data };
  } catch (e) {
    results.aiLearning = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const allOk = Object.values(results).every(
    (r) => typeof r === 'object' && r && (r as { ok?: boolean }).ok !== false
  );

  return NextResponse.json({
    success: allOk,
    note: 'AI puzzle generation is manual (admin button). This cron only runs maintenance.',
    results,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
