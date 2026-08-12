'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ProblemKnowledge } from '@/lib/ai-analyzer';
import type { Problem } from '@/lib/types';
import {
  askQuestionV2,
  createGameSession,
  problemToCaseView,
  solveCaseV2,
  submitHypothesisV2,
  applyHintV2,
  type GameSessionV2,
} from '@/lib/game/session';
import {
  saveClosedInvestigationRecord,
  syncInvestigationToSupabase,
} from '@/lib/game/investigation-records';
import { useAuth } from '@/lib/hooks/useAuth';
import AdSlot from '@/components/ads/AdSlot';
import ProblemReportButton from '@/components/case/ProblemReportButton';
import { buildCaseDossier } from '@/lib/content/case-dossier';

const MAX_HINTS = 3;

interface Props {
  problem: Problem;
  knowledge: ProblemKnowledge | null;
  ensureKnowledge: () => Promise<ProblemKnowledge | null>;
}

export default function InvestigationGame({ problem, knowledge, ensureKnowledge }: Props) {
  const caseView = useMemo(() => problemToCaseView(problem), [problem]);
  const { user } = useAuth();
  const params = useParams();
  const lang = (params?.lang as string) || 'ko';
  const [session, setSession] = useState<GameSessionV2>(() => createGameSession(problem.id));
  const [questionText, setQuestionText] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCaseSheet, setShowCaseSheet] = useState(false);
  const [showFactsSheet, setShowFactsSheet] = useState(false);
  const [showHypothesis, setShowHypothesis] = useState(false);
  const [hypothesisText, setHypothesisText] = useState('');
  const [showSolve, setShowSolve] = useState(false);
  const [solutionText, setSolutionText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hintsLeft = Math.max(0, MAX_HINTS - session.hintCount);

  useEffect(() => {
    if (session.status !== 'briefing') return;
    const t = setTimeout(() => {
      setSession((s) => ({ ...s, status: 'investigating' }));
    }, 1400);
    return () => clearTimeout(t);
  }, [session.status]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.messages.length, busy]);

  const onAsk = async () => {
    const q = questionText.trim();
    if (!q || busy || session.status !== 'investigating') return;
    setBusy(true);
    try {
      const kn = knowledge || (await ensureKnowledge());
      const { session: next } = await askQuestionV2({
        question: q,
        session,
        caseView,
        problemKnowledge: kn,
      });
      setSession(next);
      setQuestionText('');
      inputRef.current?.focus();
    } catch (e) {
      console.error(e);
      setSession((s) => ({
        ...s,
        messages: [
          ...s.messages,
          {
            id: `err_${Date.now()}`,
            role: 'system',
            text: '질문 처리 중 문제가 생겼습니다. 다시 시도해 주세요.',
            createdAt: Date.now(),
          },
        ],
      }));
    } finally {
      setBusy(false);
    }
  };

  const onHypothesis = async () => {
    const text = hypothesisText.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const next = await submitHypothesisV2({ hypothesis: text, session, caseView });
      setSession(next);
      setShowHypothesis(false);
      setHypothesisText('');
    } catch {
      setSession((s) => ({
        ...s,
        messages: [
          ...s.messages,
          {
            id: `err_h_${Date.now()}`,
            role: 'system',
            text: '가설 확인에 실패했습니다. 다시 시도해 주세요.',
            createdAt: Date.now(),
          },
        ],
      }));
    } finally {
      setBusy(false);
    }
  };

  const onHint = async () => {
    if (busy || hintsLeft <= 0) return;
    setBusy(true);
    try {
      setSession(await applyHintV2({ session, caseView }));
    } finally {
      setBusy(false);
    }
  };

  const onSolve = async () => {
    const text = solutionText.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const { session: next } = await solveCaseV2({ solution: text, session, caseView });
      setSession(next);

      if (next.result && next.closedAt) {
        const durationSec = Math.max(1, Math.round((next.closedAt - next.startedAt) / 1000));
        saveClosedInvestigationRecord(
          {
            caseId: caseView.id,
            caseTitle: caseView.title,
            caseNumber: caseView.caseNumber,
            accuracy: next.result.accuracy,
            questionCount: next.questionCount,
            hintCount: next.hintCount,
            confirmedFactsCount: next.confirmedFacts.length,
            durationSec,
            startedAt: next.startedAt,
            closedAt: next.closedAt,
          },
          user?.id ?? null
        );

        if (user?.id) {
          await syncInvestigationToSupabase({
            authUserId: user.id,
            problemId: caseView.id,
            accuracy: next.result.accuracy,
          });
        }
      }

      setShowSolve(false);
    } catch {
      setSession((s) => ({
        ...s,
        messages: [
          ...s.messages,
          {
            id: `err_s_${Date.now()}`,
            role: 'system',
            text: '사건 해결 제출에 실패했습니다. 다시 시도해 주세요.',
            createdAt: Date.now(),
          },
        ],
      }));
    } finally {
      setBusy(false);
    }
  };

  if (session.status === 'ready') {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 sm:p-8">
        <p className="text-[11px] tracking-[0.22em] text-teal-300">CASE #{caseView.caseNumber}</p>
        <h2 className="mt-3 font-display text-2xl sm:text-3xl text-white">{caseView.title}</h2>
        <p className="mt-2 text-xs text-slate-400">
          {caseView.categoryLabel} · {caseView.stars} · 약{' '}
          {caseView.difficulty === 'hard' ? 15 : caseView.difficulty === 'easy' ? 8 : 12}분
        </p>
        <div className="mt-6 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
          {caseView.content}
        </div>
        <ul className="mt-5 space-y-1.5 text-xs text-slate-500">
          <li>· 예 / 아니요 / 상관없음으로 답합니다</li>
          <li>· 가설로 방향을 확인하고, 확신이 생기면 사건 해결</li>
          <li>· 힌트는 사건당 {MAX_HINTS}회까지</li>
        </ul>
        <p className="mt-4 text-xs text-slate-500">{(problem.view_count || 0).toLocaleString()}회 수사</p>
        {(problem as Problem & { status?: string }).status === 'pending' && (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            검토 중인 사건입니다. 승인 후 다른 사용자에게 공개됩니다.
          </p>
        )}
        <div className="mt-3">
          <ProblemReportButton problemId={caseView.id} lang={lang} />
        </div>
        <button
          type="button"
          className="btn-primary mt-8 w-full sm:w-auto"
          onClick={() => setSession((s) => ({ ...s, status: 'briefing', startedAt: Date.now() }))}
        >
          수사 시작
        </button>
      </div>
    );
  }

  if (session.status === 'briefing') {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-8 sm:p-12 text-center">
        <p className="text-xs tracking-[0.25em] text-teal-300/80">CASE #{caseView.caseNumber}</p>
        <h2 className="mt-4 font-display text-3xl sm:text-4xl text-white">{caseView.title}</h2>
        <p className="mt-8 text-sm tracking-[0.35em] text-slate-300 animate-pulse">CASE OPEN</p>
        <button
          type="button"
          className="btn-ghost mt-10 !text-xs"
          onClick={() => setSession((s) => ({ ...s, status: 'investigating' }))}
        >
          바로 시작
        </button>
      </div>
    );
  }

  if (session.status === 'closed' && session.result) {
    const r = session.result;
    const dossier = buildCaseDossier(problem);
    const verdict =
      r.accuracy >= 85 ? '거의 완벽히 밝혀냈습니다.' : r.accuracy >= 70 ? '사건을 해결했습니다.' : '아직 핵심이 남아 있습니다.';

    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-6 sm:p-10">
        <p className="text-xs tracking-[0.3em] text-teal-300">CASE CLOSED</p>
        <p className="mt-4 text-sm text-slate-400">추리 정확도</p>
        <p className="mt-1 font-display text-5xl text-white">{r.accuracy}%</p>
        <p className="mt-3 text-sm text-slate-300">{verdict}</p>
        <p className="mt-4 text-sm text-slate-300">
          맞춘 핵심 사실 {r.matchedCount} / {r.totalCount}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          질문 {session.questionCount}회 · 힌트 {session.hintCount}회
        </p>

        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-950/50 p-4">
          <p className="text-xs text-slate-500 mb-2">사건 진실</p>
          <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{r.answer}</p>
        </div>

        {dossier.explanation && (
          <div className="mt-4 rounded-xl border border-teal-500/20 bg-teal-500/5 p-4">
            <p className="text-xs text-teal-300/80 mb-2">해설</p>
            <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{dossier.explanation}</p>
          </div>
        )}

        <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
          <p className="text-xs font-semibold text-slate-400 mb-2">이 사건에서 배운 수사법</p>
          <ul className="space-y-1.5 text-sm text-slate-300 list-disc pl-5">
            {dossier.learningPoints.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setSession(createGameSession(problem.id));
              setSolutionText('');
              setHypothesisText('');
            }}
          >
            다시 수사하기
          </button>
          <Link href={`/${lang}/problems`} className="btn-ghost text-center">
            다른 사건 찾기
          </Link>
        </div>

        <AdSlot variant="closed" className="mt-8" />
      </div>
    );
  }

  return (
    <div className="game-v2 flex flex-col min-h-[70dvh] lg:min-h-[640px]">
      <div className="lg:hidden flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-[11px] tracking-[0.18em] text-teal-300 truncate">
            CASE #{caseView.caseNumber} · {caseView.title}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => setShowCaseSheet(true)}>
            사건
          </button>
          <button type="button" className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => setShowFactsSheet(true)}>
            사실 {session.confirmedFacts.length}
          </button>
        </div>
      </div>

      <div className="flex-1 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)] min-h-0">
        <aside className="hidden lg:flex flex-col rounded-2xl border border-slate-700 bg-slate-900/80 p-5 min-h-0">
          <p className="text-[11px] tracking-[0.22em] text-teal-300">CASE #{caseView.caseNumber}</p>
          <h2 className="mt-2 font-display text-xl text-white">{caseView.title}</h2>
          <p className="mt-1 text-xs text-slate-400">
            {caseView.categoryLabel} · {caseView.stars}
          </p>
          <div className="mt-4 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap overflow-y-auto flex-1">
            {caseView.content}
          </div>
          <div className="mt-6 pt-4 border-t border-slate-700">
            <p className="text-xs font-semibold text-slate-400 mb-2">확인된 사실</p>
            {session.confirmedFacts.length === 0 ? (
              <p className="text-sm text-slate-500">아직 없습니다. 질문으로 사실을 확인해 보세요.</p>
            ) : (
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {session.confirmedFacts.map((f) => (
                  <li key={f.id} className="text-sm text-teal-100/90">
                    · {f.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/80 flex flex-col min-h-[52dvh] lg:min-h-0">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">AI 조사</h3>
            <p className="text-[11px] text-slate-500">
              질문 {session.questionCount} · 힌트 {session.hintCount}/{MAX_HINTS}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {session.messages.length === 0 && !busy && (
              <div className="rounded-xl border border-dashed border-slate-700 px-3 py-4 text-sm text-slate-400 space-y-2">
                <p>자유롭게 질문하며 사건의 진실을 좁혀가세요.</p>
                <p className="text-xs text-slate-500">
                  예: “가족이 관련됐나요?”, “문이 잠겨 있었나요?”
                </p>
              </div>
            )}
            {session.messages.map((m) => (
              <div key={m.id} className="space-y-2">
                {m.role === 'user' && (
                  <div className="rounded-xl bg-slate-800/90 px-3 py-2 text-sm text-slate-100 ml-4 sm:ml-10">
                    {m.text}
                  </div>
                )}
                {m.role === 'ai' && (
                  <div className="space-y-2 mr-4 sm:mr-10">
                    <div className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200">
                      {m.text}
                    </div>
                    {m.confirmedFact && (
                      <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-sm text-teal-100">
                        <p className="font-semibold mb-1 text-teal-200/90">확인된 사실</p>
                        <p>{m.confirmedFact}</p>
                      </div>
                    )}
                  </div>
                )}
                {m.role === 'system' && (
                  <div className="rounded-xl border border-slate-600/50 bg-slate-950/40 px-3 py-2 text-sm text-slate-300">
                    {m.text}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="mr-4 sm:mr-10 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-400 animate-pulse">
                AI가 답변을 준비하고 있습니다…
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="sticky bottom-0 border-t border-slate-700 bg-slate-900/95 p-3 space-y-2 safe-pb">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-ghost !text-xs !px-3 !py-1.5"
                disabled={busy || hintsLeft <= 0}
                onClick={onHint}
                title={hintsLeft <= 0 ? '힌트를 모두 사용했습니다' : `남은 힌트 ${hintsLeft}회`}
              >
                힌트 {hintsLeft > 0 ? `(${hintsLeft})` : '(없음)'}
              </button>
              <button
                type="button"
                className="btn-ghost !text-xs !px-3 !py-1.5"
                disabled={busy}
                onClick={() => setShowHypothesis(true)}
              >
                가설 확인
              </button>
              <button
                type="button"
                className="btn-primary !text-xs !px-3 !py-1.5"
                disabled={busy}
                onClick={() => setShowSolve(true)}
              >
                사건 해결
              </button>
            </div>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                className="field flex-1"
                placeholder="예/아니요로 답할 수 있는 질문을 입력…"
                value={questionText}
                disabled={busy}
                onChange={(e) => setQuestionText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onAsk();
                  }
                }}
              />
              <button
                type="button"
                className="btn-primary !px-4 min-w-[4.5rem]"
                disabled={busy || !questionText.trim()}
                onClick={onAsk}
              >
                {busy ? '…' : '질문'}
              </button>
            </div>
          </div>
        </section>
      </div>

      {showCaseSheet && (
        <Sheet title="사건 정보" onClose={() => setShowCaseSheet(false)}>
          <p className="text-[11px] tracking-[0.2em] text-teal-300">CASE #{caseView.caseNumber}</p>
          <h3 className="mt-2 text-lg text-white font-semibold">{caseView.title}</h3>
          <p className="mt-1 text-xs text-slate-400">
            {caseView.categoryLabel} · {caseView.stars}
          </p>
          <p className="mt-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{caseView.content}</p>
        </Sheet>
      )}
      {showFactsSheet && (
        <Sheet title="확인된 사실" onClose={() => setShowFactsSheet(false)}>
          {session.confirmedFacts.length === 0 ? (
            <p className="text-sm text-slate-500">아직 확인된 사실이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {session.confirmedFacts.map((f) => (
                <li key={f.id} className="text-sm text-teal-100">
                  · {f.text}
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}

      {showHypothesis && (
        <Sheet title="가설 확인" onClose={() => setShowHypothesis(false)}>
          <p className="text-sm text-slate-400 mb-2">
            아직 확실하지 않아도 됩니다. 지금 생각하는 방향을 적으면 AI가 맞는지 대략 알려줍니다.
            <span className="block mt-1 text-slate-500">사건을 끝내려면 ‘사건 해결’을 사용하세요.</span>
          </p>
          <textarea
            className="field min-h-[120px]"
            value={hypothesisText}
            onChange={(e) => setHypothesisText(e.target.value)}
            placeholder="예: 전화한 사람은 진짜 아들이 아니었던 것 같다."
          />
          <button
            type="button"
            className="btn-primary mt-3 w-full"
            disabled={busy || !hypothesisText.trim()}
            onClick={onHypothesis}
          >
            방향 확인
          </button>
        </Sheet>
      )}

      {showSolve && (
        <Sheet title="사건 해결" onClose={() => setShowSolve(false)}>
          <p className="text-sm text-slate-400 mb-2">
            최종 추리를 제출하면 사건이 종료되고 정확도가 채점됩니다.
          </p>
          <textarea
            className="field min-h-[140px]"
            value={solutionText}
            onChange={(e) => setSolutionText(e.target.value)}
            placeholder="당신이 밝힌 사건 전체를 설명해 주세요."
          />
          <button
            type="button"
            className="btn-primary mt-3 w-full"
            disabled={busy || !solutionText.trim()}
            onClick={onSolve}
          >
            제출하고 종료
          </button>
        </Sheet>
      )}
    </div>
  );
}

function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full sm:max-w-lg max-h-[85dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-soft"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button type="button" className="text-slate-400 hover:text-white" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
