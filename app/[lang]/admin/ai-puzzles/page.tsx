'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { handleError } from '@/lib/error-handler';

type AiPending = {
  id: string;
  title: string;
  content: string;
  answer: string;
  explanation?: string | null;
  difficulty?: string;
  status: string;
  author?: string;
  tags?: string[];
  created_at: string;
};

type Draft = {
  title: string;
  content: string;
  answer: string;
  explanation: string;
  difficulty: string;
};

function toDraft(p: AiPending): Draft {
  return {
    title: p.title || '',
    content: p.content || '',
    answer: p.answer || '',
    explanation: p.explanation || '',
    difficulty: p.difficulty || 'medium',
  };
}

function threadsPreview(title: string, content: string) {
  const body = content.replace(/\s*왜\s*그랬을까\s*\?\s*$/u, '').trimEnd();
  return `${title.trim()}\n\n${body}\n\n왜 그랬을까?`;
}

async function readApiJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    if (res.status === 504 || res.status === 503) {
      throw new Error(
        '서버 시간 초과(504). Vercel Hobby는 약 10초 제한입니다. 잠시 후 다시 눌러 주세요.'
      );
    }
    throw new Error(text.slice(0, 180) || `요청 실패 (${res.status})`);
  }
}


export default function AdminAiPuzzlesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = use(params);
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<AiPending[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = items.find((i) => i.id === selectedId) || null;

  const checkAdmin = useCallback(async () => {
    if (!user) {
      router.push(`/${lang}/auth/login`);
      return false;
    }
    const { data } = await supabase.from('users').select('is_admin').eq('id', user.id).maybeSingle();
    if (!data?.is_admin) {
      router.push(`/${lang}`);
      return false;
    }
    return true;
  }, [user, lang, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('problems')
        .select('id, title, content, answer, explanation, difficulty, status, author, tags, created_at')
        .eq('status', 'pending')
        .eq('author', '바다거북스프 AI')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const list = (data || []) as AiPending[];
      setItems(list);
      setSelectedId((prev) => {
        const still = prev ? list.find((x) => x.id === prev) : undefined;
        const next = still || list[0] || null;
        if (next) setDraft(toDraft(next));
        else setDraft(null);
        return next?.id ?? null;
      });
    } catch (e) {
      handleError(e, 'AI 검수 목록 로드', true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      const ok = await checkAdmin();
      if (ok) await loadData();
    })();
  }, [user, authLoading]);

  const selectItem = (p: AiPending) => {
    setSelectedId(p.id);
    setDraft(toDraft(p));
    setMessage(null);
  };

  const moderate = async (
    action: 'approve' | 'reject' | 'save',
    opts?: { publishThreads?: boolean }
  ) => {
    if (!selectedId || !draft) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/ai-puzzles/moderate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          problemId: selectedId,
          publishThreads: opts?.publishThreads,
          edits: {
            title: draft.title,
            content: draft.content,
            answer: draft.answer,
            explanation: draft.explanation || null,
            difficulty: draft.difficulty,
          },
        }),
      });
      const json = await readApiJson(res);
      if (!res.ok || !json.success) {
        throw new Error(String(json.error || '처리 실패'));
      }

      if (action === 'save') {
        setMessage('임시 저장됨 (아직 비공개)');
        await loadData();
      } else if (action === 'reject') {
        setMessage('거절 · 보관 처리됨');
        setSelectedId(null);
        setDraft(null);
        await loadData();
      } else {
        const threadsError = json.threadsError ? String(json.threadsError) : '';
        if (opts?.publishThreads === false) {
          setMessage('사이트에만 공개됨 (Threads 생략)');
        } else if (threadsError) {
          setMessage(
            `사이트는 공개됨. Threads 게시 실패: ${threadsError} (THREADS_USER_ID는 숫자 id여야 함 — 핸들 funzip.1.7 불가)`
          );
        } else {
          setMessage(
            `승인 · 사이트 공개 + Threads 게시${json.permalink ? `: ${json.permalink}` : ''}`
          );
        }
        setSelectedId(null);
        setDraft(null);
        await loadData();
      }
    } catch (e) {
      handleError(e, '검수 처리', true);
    } finally {
      setBusy(false);
    }
  };

  const generateOne = async () => {
    setGenBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/ai-puzzles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await readApiJson(res);
      if (!res.ok || !json.success) {
        throw new Error(String(json.error || '생성 실패'));
      }
      const saved = json.saved as Array<{ title?: string }> | undefined;
      const title = saved?.[0]?.title;
      setMessage(title ? `「${title}」 검수 대기열에 추가됨` : '후보 1개가 추가됨');
      await loadData();
    } catch (e) {
      handleError(e, 'AI 후보 생성', true);
    } finally {
      setGenBusy(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">AI 문제 검수</h1>
          <p className="mt-1 text-sm text-slate-400">
            「만들기」를 누르면 후보 1개가 대기열에 쌓입니다. 수락한 것만 공개됩니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary !py-2 !px-4 text-sm font-semibold"
            disabled={genBusy}
            onClick={generateOne}
          >
            {genBusy ? '생성 중…' : '문제 1개 만들기'}
          </button>
          <Link href={`/${lang}/admin/dashboard`} className="btn-ghost !text-xs">
            대시보드
          </Link>
        </div>
      </div>

      {message && (
        <p className="mb-4 rounded-lg border border-teal-700/50 bg-teal-950/40 px-3 py-2 text-sm text-teal-200">
          {message}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">로딩 중…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
          <aside className="space-y-2 max-h-[70vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-sm text-slate-400">
                대기 중인 AI 문제가 없습니다. 「문제 1개 만들기」를 눌러 주세요.
              </p>
            ) : (
              items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectItem(p)}
                  className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
                    selectedId === p.id
                      ? 'border-brass/60 bg-brass/10'
                      : 'border-slate-700 bg-slate-900/60 hover:border-slate-500'
                  }`}
                >
                  <p className="font-medium text-white text-sm line-clamp-2">{p.title}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {p.difficulty || 'medium'} · {new Date(p.created_at).toLocaleString('ko-KR')}
                  </p>
                </button>
              ))
            )}
          </aside>

          <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 sm:p-5">
            {!draft || !selected ? (
              <p className="text-sm text-slate-400">왼쪽에서 후보를 선택하세요.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400">제목</label>
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">본문</label>
                  <textarea
                    value={draft.content}
                    onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                    rows={8}
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm whitespace-pre-wrap"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">정답</label>
                  <textarea
                    value={draft.answer}
                    onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
                    rows={5}
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">해설 (공개 explanation)</label>
                  <textarea
                    value={draft.explanation}
                    onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">난이도</label>
                  <select
                    value={draft.difficulty}
                    onChange={(e) => setDraft({ ...draft, difficulty: e.target.value })}
                    className="mt-1 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm"
                  >
                    <option value="easy">easy</option>
                    <option value="medium">medium</option>
                    <option value="hard">hard</option>
                  </select>
                </div>

                <div className="rounded-lg border border-slate-600 bg-ink-800/50 p-3">
                  <p className="text-xs text-slate-400 mb-2">Threads 미리보기</p>
                  <pre className="whitespace-pre-wrap text-sm text-slate-200 font-sans">
                    {threadsPreview(draft.title, draft.content)}
                  </pre>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    className="btn-ghost !text-xs"
                    disabled={busy}
                    onClick={() => moderate('save')}
                  >
                    임시 저장
                  </button>
                  <button
                    type="button"
                    className="btn-primary !text-xs !py-1.5"
                    disabled={busy}
                    onClick={() => moderate('approve', { publishThreads: true })}
                  >
                    수락 (사이트+Threads)
                  </button>
                  <button
                    type="button"
                    className="btn-ghost !text-xs !border-teal-700"
                    disabled={busy}
                    onClick={() => moderate('approve', { publishThreads: false })}
                  >
                    수락 (사이트만)
                  </button>
                  <button
                    type="button"
                    className="btn-ghost !text-xs !text-red-300"
                    disabled={busy}
                    onClick={() => {
                      if (confirm('이 후보를 거절(보관)할까요?')) moderate('reject');
                    }}
                  >
                    거절
                  </button>
                  <Link href={`/${lang}/problem/${selected.id}`} className="btn-ghost !text-xs">
                    미리보기
                  </Link>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
