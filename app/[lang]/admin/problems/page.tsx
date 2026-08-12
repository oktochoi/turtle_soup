'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { handleError } from '@/lib/error-handler';

type PendingProblem = {
  id: string;
  title: string;
  content: string;
  author?: string;
  difficulty?: string;
  status: string;
  created_at: string;
  user_id?: string;
};

type ProblemReport = {
  id: string;
  problem_id: string;
  report_type: string;
  reason: string;
  status: string;
  created_at: string;
  problem?: { title: string };
};

export default function AdminProblemsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState<'pending' | 'reports'>('pending');
  const [pending, setPending] = useState<PendingProblem[]>([]);
  const [reports, setReports] = useState<ProblemReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) checkAdmin();
  }, [user, authLoading]);

  useEffect(() => {
    if (user) loadData();
  }, [user, tab]);

  const checkAdmin = async () => {
    if (!user) {
      router.push(`/${lang}/auth/login`);
      return;
    }
    const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).maybeSingle();
    if (!data?.is_admin) {
      router.push(`/${lang}`);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'pending') {
        const { data, error } = await supabase
          .from('problems')
          .select('id, title, content, author, difficulty, status, created_at, user_id')
          .eq('status', 'pending')
          .order('created_at', { ascending: true });
        if (error) throw error;
        setPending((data || []) as PendingProblem[]);
      } else {
        const { data, error } = await supabase
          .from('problem_reports')
          .select('id, problem_id, report_type, reason, status, created_at, problem:problems(title)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setReports((data || []) as unknown as ProblemReport[]);
      }
    } catch (e) {
      handleError(e, '관리자 데이터 로드', true);
    } finally {
      setLoading(false);
    }
  };

  const setProblemStatus = async (id: string, status: 'published' | 'archived') => {
    setBusyId(id);
    try {
      const { error } = await supabase.from('problems').update({ status }).eq('id', id);
      if (error) throw error;
      setPending((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      handleError(e, '사건 상태 변경', true);
    } finally {
      setBusyId(null);
    }
  };

  const resolveReport = async (id: string, status: 'resolved' | 'dismissed') => {
    setBusyId(id);
    try {
      const { error } = await supabase
        .from('problem_reports')
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      handleError(e, '신고 처리', true);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen text-slate-100">
      <div className="page-shell py-8 max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">사건 검수</h1>
            <p className="mt-1 text-sm text-slate-400">UGC 사건 승인 및 신고 처리</p>
          </div>
          <Link href={`/${lang}/admin/dashboard`} className="btn-ghost !text-xs">
            대시보드
          </Link>
        </div>

        <div className="mb-6 flex gap-2">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm ${tab === 'pending' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-300'}`}
            onClick={() => setTab('pending')}
          >
            승인 대기 ({pending.length})
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm ${tab === 'reports' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-300'}`}
            onClick={() => setTab('reports')}
          >
            신고 ({reports.length})
          </button>
        </div>

        {loading ? (
          <p className="text-slate-400 text-sm">로딩 중…</p>
        ) : tab === 'pending' ? (
          pending.length === 0 ? (
            <p className="text-slate-400 text-sm">승인 대기 사건이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {pending.map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-white">{p.title}</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {p.author || '익명'} · {p.difficulty || 'medium'} ·{' '}
                        {new Date(p.created_at).toLocaleString('ko-KR')}
                      </p>
                      <p className="mt-2 text-sm text-slate-400 line-clamp-3 whitespace-pre-wrap">{p.content}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/${lang}/problem/${p.id}`} className="btn-ghost !text-xs">
                      미리보기
                    </Link>
                    <button
                      type="button"
                      className="btn-primary !text-xs !py-1.5"
                      disabled={busyId === p.id}
                      onClick={() => setProblemStatus(p.id, 'published')}
                    >
                      승인 (공개)
                    </button>
                    <button
                      type="button"
                      className="btn-ghost !text-xs !text-red-300"
                      disabled={busyId === p.id}
                      onClick={() => setProblemStatus(p.id, 'archived')}
                    >
                      거절 (보관)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : reports.length === 0 ? (
          <p className="text-slate-400 text-sm">대기 중인 신고가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
                <p className="text-sm font-medium text-white">
                  {(r.problem as { title?: string })?.title || r.problem_id}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {r.report_type} · {new Date(r.created_at).toLocaleString('ko-KR')}
                </p>
                <p className="mt-2 text-sm text-slate-300">{r.reason}</p>
                <div className="mt-3 flex gap-2">
                  <Link href={`/${lang}/problem/${r.problem_id}`} className="btn-ghost !text-xs">
                    사건 보기
                  </Link>
                  <button
                    type="button"
                    className="btn-primary !text-xs !py-1.5"
                    disabled={busyId === r.id}
                    onClick={() => resolveReport(r.id, 'resolved')}
                  >
                    처리 완료
                  </button>
                  <button
                    type="button"
                    className="btn-ghost !text-xs"
                    disabled={busyId === r.id}
                    onClick={() => resolveReport(r.id, 'dismissed')}
                  >
                    기각
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
