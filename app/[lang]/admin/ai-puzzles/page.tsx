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
  const [batchSize, setBatchSize] = useState(5);
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
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || '처리 실패');
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
        setMessage(
          opts?.publishThreads === false
            ? '사이트에만 공개됨 (Threads 생략)'
            : `승인 · 사이트 공개 + Threads 게시${json.permalink ? `: ${json.permalink}` : ''}`
        );
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

  const generateMore = async () => {
    setGenBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/ai-puzzles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || '생성 실패');
      }
      const n = json.count || json.saved?.length || 0;
      setMessage(
        n > 0
          ? `${n}개 후보가 검수 대기열에 추가됨. 골라서 수락하면 공개됩니다.`
          : '저장에 성공한 후보가 없습니다. 다시 눌러 주세요.'
      );
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
            Hobby·Groq 무료 한도(~8k TPM) 때문에 프롬프트를 작게 보냅니다. 한 번에 5개 권장. 수락한 것만 공개됩니다.
          </p>
        </div>
        <Link href={`/${lang}/admin/dashboard`} className="btn-ghost !text-xs self-start">
          대시보드
        </Link>
      </div>

      <div className="mb-6 rounded-xl border border-brass/30 bg-ink-700/40 p-4">
        <p className="text-sm font-medium text-white mb-3">한번에 후보 만들기</p>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {[5, 8, 10, 12].map((n) => (
            <button
              key={n}
              type="button"
              disabled={genBusy}
              onClick={() => setBatchSize(n)}
              className={`rounded-lg px-3 py-1.5 text-xs border ${
                batchSize === n
                  ? 'border-brass bg-brass/20 text-brass'
                  : 'border-slate-600 text-slate-300 hover:border-slate-400'
              }`}
            >
              {n}개
            </button>
          ))}
          <label className="text-xs text-slate-400 flex items-center gap-2 ml-1">
            직접
            <input
              type="number"
              min={1}
              max={15}
              value={batchSize}
              onChange={(e) => setBatchSize(Math.min(15, Math.max(1, Number(e.target.value) || 8)))}
              className="w-14 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          className="btn-primary !py-2.5 !px-5 text-sm font-semibold"
          disabled={genBusy}
          onClick={generateMore}
        >
          {genBusy
            ? `${batchSize}개 생성 중… (1~3분 걸릴 수 있음)`
            : `${batchSize}개 한번에 만들기`}
        </button>
        {genBusy && (
          <p className="mt-2 text-xs text-slate-400">
            Groq로 후보 생성·품질검사 중입니다. 페이지를 닫지 마세요.
          </p>
        )}
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
                대기 중인 AI 문제가 없습니다. 위에서 「한번에 만들기」를 눌러 주세요.
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
