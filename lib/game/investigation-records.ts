/**
 * Investigation play history — localStorage first, optional Supabase sync for ranking.
 */

import { createClient } from '@/lib/supabase/client';
import { INVESTIGATION_CONFIG } from '@/lib/investigation/config';

export interface InvestigationRecord {
  id: string;
  caseId: string;
  caseTitle: string;
  caseNumber: string;
  status: 'closed';
  accuracy: number;
  questionCount: number;
  hintCount: number;
  confirmedFactsCount: number;
  durationSec: number;
  startedAt: number;
  closedAt: number;
}

const MAX_RECORDS = 50;

function storageKey(authUserId?: string | null): string {
  if (typeof window === 'undefined') return 'investigation_records_anonymous';
  if (authUserId) return `investigation_records_${authUserId}`;
  let guest = localStorage.getItem('guest_id');
  if (!guest) {
    guest = `guest_${Date.now()}`;
    localStorage.setItem('guest_id', guest);
  }
  return `investigation_records_${guest}`;
}

export function loadInvestigationRecords(authUserId?: string | null): InvestigationRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(authUserId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InvestigationRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveClosedInvestigationRecord(
  record: Omit<InvestigationRecord, 'id' | 'status'>,
  authUserId?: string | null
): InvestigationRecord {
  const full: InvestigationRecord = {
    ...record,
    id: `rec_${record.closedAt}_${record.caseId.slice(0, 8)}`,
    status: 'closed',
  };

  if (typeof window === 'undefined') return full;

  const existing = loadInvestigationRecords(authUserId);
  const next = [full, ...existing.filter((r) => r.id !== full.id)].slice(0, MAX_RECORDS);
  localStorage.setItem(storageKey(authUserId), JSON.stringify(next));
  return full;
}

/** Sync to user_problem_solves when logged in (ranking / solve count). */
export async function syncInvestigationToSupabase(args: {
  authUserId: string;
  problemId: string;
  accuracy: number;
}): Promise<void> {
  if (args.accuracy < INVESTIGATION_CONFIG.SOLVE_MIN) return;

  try {
    const supabase = createClient();
    const { data: existing } = await supabase
      .from('user_problem_solves')
      .select('similarity_score')
      .eq('user_id', args.authUserId)
      .eq('problem_id', args.problemId)
      .maybeSingle();

    if (existing) {
      return;
    }

    await supabase.from('user_problem_solves').insert({
      user_id: args.authUserId,
      problem_id: args.problemId,
      similarity_score: Math.round(args.accuracy),
    });
  } catch (e) {
    console.warn('[InvestigationRecord] Supabase sync skipped', e);
  }
}

export function formatRecordDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
