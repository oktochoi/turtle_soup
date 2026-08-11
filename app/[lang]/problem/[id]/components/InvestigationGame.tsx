'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ProblemKnowledge } from '@/lib/ai-analyzer';
import type { Problem } from '@/lib/types';
import {
  INVESTIGATION_CONFIG,
  canCloseCase,
  createSession,
  difficultyStars,
  evaluateFinalSolution,
  formatDuration,
  problemToCase,
  processFinalSolution,
  processHint,
  processHypothesis,
  processQuestion,
  type CaseResult,
  type InvestigationSession,
} from '@/lib/investigation';

interface Props {
  problem: Problem;
  knowledge: ProblemKnowledge | null;
  ensureKnowledge: () => Promise<ProblemKnowledge | null>;
}

type Banner =
  | { type: 'clue'; text: string }
  | { type: 'critical'; text: string }
  | { type: 'hint'; text: string }
  | { type: 'energy'; text: string }
  | null;

export default function InvestigationGame({ problem, knowledge, ensureKnowledge }: Props) {
  const caseData = useMemo(() => problemToCase(problem), [problem]);
  const [session, setSession] = useState<InvestigationSession>(() => createSession(problem.id));
  const [questionText, setQuestionText] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [showHypothesis, setShowHypothesis] = useState(false);
  const [hypothesisText, setHypothesisText] = useState('');
  const [showSolve, setShowSolve] = useState(false);
  const [solutionText, setSolutionText] = useState('');
  const [pendingResult, setPendingResult] = useState<CaseResult | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [result, setResult] = useState<CaseResult | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (session.status !== 'briefing') return;
    const t = setTimeout(() => {
      setSession((s) => ({ ...s, status: 'investigating' }));
    }, INVESTIGATION_CONFIG.CASE_BRIEFING_MS);
    return () => clearTimeout(t);
  }, [session.status]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.questions.length, banner]);

  const energyDepleted = session.investigationEnergy <= 0;
  const canAsk = session.status === 'investigating' && !energyDepleted && !busy;

  const onAsk = async () => {
    const q = questionText.trim();
    if (!q || !canAsk) return;
    setBusy(true);
    setBanner(null);
    try {
      const kn = knowledge || (await ensureKnowledge());
      if (!kn) throw new Error('knowledge unavailable');
      const out = await processQuestion({
        question: q,
        session,
        caseData,
        knowledge: kn,
      });
      setSession(out.session);
      setQuestionText('');
      if (out.unlockedClue) {
        setBanner({
          type: out.importance === 'critical' ? 'critical' : 'clue',
          text: out.unlockedClue.text,
        });
      }
      if (out.energyDepleted) {
        setBanner({
          type: 'energy',
          text: '수사력이 모두 소진되었습니다. 현재까지 확보한 정보로 최종 추리에 도전하세요.',
        });
        setShowSolve(true);
      }
    } catch (e) {
      console.error(e);
      setBanner({ type: 'energy', text: '질문 처리 중 오류가 발생했습니다. 다시 시도해 주세요.' });
    } finally {
      setBusy(false);
    }
  };

  const onHypothesis = async () => {
    const text = hypothesisText.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const next = await processHypothesis({ hypothesis: text, session, caseData });
      setSession(next);
      setShowHypothesis(false);
    } finally {
      setBusy(false);
    }
  };

  const onHint = async () => {
    if (busy || energyDepleted) return;
    setBusy(true);
    try {
      const { session: next, hint } = await processHint({ session, caseData });
      setSession(next);
      if (hint) setBanner({ type: 'hint', text: hint });
    } finally {
      setBusy(false);
    }
  };

  const onSolvePreview = async () => {
    const text = solutionText.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const { score, matches } = await evaluateFinalSolution(text, caseData);
      const previewSession = {
        ...session,
        truthScore: Math.max(session.truthScore, score),
      };
      // Build a temporary result for confirm UI without closing
      const { calculateCaseScore } = await import('@/lib/investigation/scoring');
      const r = calculateCaseScore({
        session: { ...previewSession, closedAt: Date.now(), finalSolutionScore: score },
        finalSolutionScore: score,
        cluesTotal: caseData.keyClues.length,
        elementMatches: matches,
      });
      setSession(previewSession);
      setPendingResult(r);
      setConfirmClose(true);
    } finally {
      setBusy(false);
    }
  };

  const confirmSolve = async (close: boolean) => {
    if (!pendingResult) return;
    if (!close) {
      setConfirmClose(false);
      setPendingResult(null);
      if (!energyDepleted) setShowSolve(false);
      return;
    }
    if (!canCloseCase(pendingResult.finalSolutionScore) && !energyDepleted) {
      setConfirmClose(false);
      return;
    }
    setBusy(true);
    try {
      const { session: next, result: r } = await processFinalSolution({
        solution: solutionText.trim(),
        session: { ...session, status: 'solving' },
        caseData,
      });
      setSession(next);
      setResult(r);
      setConfirmClose(false);
      setShowSolve(false);
    } finally {
      setBusy(false);
    }
  };

  const answerLabel = (a: string) =>
    a === 'yes' ? '예' : a === 'no' ? '아니요' : '상관없음';

  const answerColor = (a: string) =>
    a === 'yes'
      ? 'text-emerald-300'
      : a === 'no'
        ? 'text-rose-300'
        : 'text-slate-400';

  if (session.status === 'briefing') {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-8 sm:p-12 text-center animate-fade-in">
        <p className="text-xs tracking-[0.25em] text-teal-300/80">CASE #{caseData.caseNumber}</p>
        <h2 className="mt-4 font-display text-3xl sm:text-4xl text-white">{caseData.title}</h2>
        <p className="mt-8 text-sm tracking-[0.35em] text-slate-300">CASE OPEN</p>
      </div>
    );
  }

  if (result && session.status === 'closed') {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900/90 p-6 sm:p-10 animate-fade-in">
        <p className="text-xs tracking-[0.3em] text-teal-300">CASE CLOSED</p>
        <p className="mt-4 font-display text-5xl text-white">{result.grade}</p>
        <p className="mt-2 text-2xl text-teal-300">{result.score.toLocaleString()} POINTS</p>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <Stat label="추리 정확도" value={`${result.finalSolutionScore}%`} />
          <Stat label="핵심 단서" value={`${result.cluesFound} / ${result.cluesTotal}`} />
          <Stat label="질문" value={String(result.questionCount)} />
          <Stat label="불필요 질문" value={String(result.irrelevantQuestionCount)} />
          <Stat label="힌트" value={String(result.hintCount)} />
          <Stat label="해결 시간" value={formatDuration(result.durationSec)} />
        </div>

        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-950/50 p-5">
          <p className="text-xs text-slate-400">당신의 추리 스타일</p>
          <p className="mt-2 text-lg font-semibold text-white">{result.detectiveStyle}</p>
          <p className="mt-2 text-sm text-slate-300">{result.styleDescription}</p>
          {result.highlightQuestion && (
            <p className="mt-3 text-sm text-teal-200/90">
              핵심 질문: “{result.highlightQuestion}”
            </p>
          )}
        </div>

        <button
          type="button"
          className="btn-primary mt-8"
          onClick={() => {
            setResult(null);
            setSession(createSession(problem.id));
            setSolutionText('');
            setPendingResult(null);
          }}
        >
          다시 수사하기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top stats */}
      <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
        <Pill label="수사력" value={String(session.investigationEnergy)} accent />
        <Pill
          label="단서"
          value={`${session.discoveredClueIds.length}/${caseData.keyClues.length}`}
        />
        <Pill label="TRUTH" value={`${session.truthScore}%`} />
        <Pill label="XP" value={String(session.xp)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_minmax(0,0.9fr)]">
        {/* Case board */}
        <aside className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 sm:p-5 order-1">
          <p className="text-[11px] tracking-[0.22em] text-teal-300">CASE #{caseData.caseNumber}</p>
          <h2 className="mt-2 font-display text-xl text-white">{caseData.title}</h2>
          <p className="mt-1 text-xs text-slate-400">
            {caseData.categoryLabel} · {difficultyStars(caseData.difficulty)} · 약 {caseData.estimatedMinutes}분
          </p>
          <div className="mt-4 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {caseData.content}
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold text-slate-400 mb-2">발견한 단서</p>
            <ul className="space-y-2">
              {caseData.keyClues.map((clue) => {
                const unlocked = session.discoveredClueIds.includes(clue.id);
                return (
                  <li
                    key={clue.id}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      unlocked
                        ? 'border-teal-500/30 bg-teal-500/10 text-teal-100'
                        : 'border-slate-700 bg-slate-950/40 text-slate-500'
                    }`}
                  >
                    {unlocked ? `✓ ${clue.text}` : '🔒 ???'}
                  </li>
                );
              })}
              {caseData.keyClues.length === 0 && (
                <li className="text-sm text-slate-500">이 사건은 별도 단서 목록이 없습니다.</li>
              )}
            </ul>
          </div>
        </aside>

        {/* Chat */}
        <section className="rounded-2xl border border-slate-700 bg-slate-900/80 flex flex-col min-h-[420px] order-2">
          <div className="px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-semibold text-white">AI 수사 대화</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh] lg:max-h-[560px]">
            {session.questions.length === 0 && (
              <p className="text-sm text-slate-400">자유롭게 질문하며 사건의 진실을 좁혀가세요.</p>
            )}
            {session.questions.map((q, i) => (
              <div key={`${q.createdAt}-${i}`} className="space-y-2">
                <div className="rounded-xl bg-slate-800/80 px-3 py-2 text-sm text-slate-100">
                  Q. {q.question}
                </div>
                <div className={`rounded-xl border border-slate-700 px-3 py-2 text-sm ${answerColor(q.answer)}`}>
                  A. {answerLabel(q.answer)}
                  <span className="ml-2 text-[11px] text-slate-500">
                    {q.importance} · +{q.xp}XP · -{q.energyCost}
                  </span>
                </div>
              </div>
            ))}
            {banner && (
              <div
                className={`rounded-xl border px-3 py-3 text-sm ${
                  banner.type === 'critical'
                    ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                    : banner.type === 'clue'
                      ? 'border-teal-400/40 bg-teal-500/10 text-teal-100'
                      : banner.type === 'hint'
                        ? 'border-sky-400/40 bg-sky-500/10 text-sky-100'
                        : 'border-rose-400/40 bg-rose-500/10 text-rose-100'
                }`}
              >
                {banner.type === 'critical' && <p className="font-semibold mb-1">CRITICAL QUESTION</p>}
                {banner.type === 'clue' && <p className="font-semibold mb-1">새로운 단서 발견</p>}
                {banner.type === 'hint' && <p className="font-semibold mb-1">수사 힌트</p>}
                <p>{banner.text}</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="sticky bottom-0 border-t border-slate-700 bg-slate-900/95 p-3 space-y-2">
            {energyDepleted && (
              <p className="text-xs text-rose-300">수사력 소진 — 최종 추리만 가능합니다.</p>
            )}
            <div className="flex gap-2">
              <input
                className="field flex-1"
                placeholder="질문을 입력하세요…"
                value={questionText}
                disabled={!canAsk}
                onChange={(e) => setQuestionText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onAsk();
                  }
                }}
              />
              <button type="button" className="btn-primary !px-4" disabled={!canAsk || !questionText.trim()} onClick={onAsk}>
                {busy ? '…' : '질문'}
              </button>
            </div>
          </div>
        </section>

        {/* Status / actions */}
        <aside className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 sm:p-5 space-y-4 order-3">
          <div>
            <p className="text-xs text-slate-400">수사 상태</p>
            <p className="mt-1 text-sm text-white">
              {session.status === 'solving' ? '최종 추리 단계' : '조사 중'}
            </p>
          </div>

          {session.hypothesisFeedback && (
            <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-sm">
              <p className="text-xs text-slate-400 mb-1">가설 분석</p>
              <p className="text-slate-200">{session.hypothesisFeedback.summary}</p>
              <p className="mt-2 text-teal-300">진실 접근도 {session.truthScore}%</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button type="button" className="btn-ghost w-full" onClick={() => setShowHypothesis(true)} disabled={busy}>
              가설 세우기
            </button>
            <button type="button" className="btn-ghost w-full" onClick={onHint} disabled={busy || energyDepleted}>
              수사 힌트 (-{INVESTIGATION_CONFIG.COST_HINT})
            </button>
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => setShowSolve(true)}
              disabled={busy}
            >
              사건 해결
            </button>
          </div>
        </aside>
      </div>

      {/* Hypothesis modal */}
      {showHypothesis && (
        <Modal title="현재 생각하는 사건의 진실을 적어주세요." onClose={() => setShowHypothesis(false)}>
          <textarea
            className="field min-h-[120px]"
            value={hypothesisText}
            onChange={(e) => setHypothesisText(e.target.value)}
            placeholder="예: 누군가 피해자의 상태를 확인하기 위해 배달을 보냈다고 생각한다."
          />
          <button type="button" className="btn-primary mt-3" disabled={busy || !hypothesisText.trim()} onClick={onHypothesis}>
            가설 분석
          </button>
        </Modal>
      )}

      {/* Solve modal */}
      {showSolve && (
        <Modal title="최종 추리를 작성하세요." onClose={() => !energyDepleted && setShowSolve(false)}>
          <textarea
            className="field min-h-[140px]"
            value={solutionText}
            onChange={(e) => setSolutionText(e.target.value)}
            placeholder="당신이 밝힌 사건 전체를 설명해 주세요."
          />
          <button
            type="button"
            className="btn-primary mt-3"
            disabled={busy || !solutionText.trim()}
            onClick={onSolvePreview}
          >
            추리 평가
          </button>
        </Modal>
      )}

      {confirmClose && pendingResult && (
        <Modal title="추리 평가 결과" onClose={() => confirmSolve(false)}>
          <p className="text-sm text-slate-300">
            추리 정확도 <span className="text-teal-300 font-semibold">{pendingResult.finalSolutionScore}%</span>
          </p>
          <p className="mt-2 text-sm text-slate-400">현재 상태로 사건을 종결하시겠습니까?</p>
          {!canCloseCase(pendingResult.finalSolutionScore) && !energyDepleted && (
            <p className="mt-2 text-xs text-amber-300">
              {INVESTIGATION_CONFIG.SOLVE_MIN}% 이상일 때 종결할 수 있습니다. 조사를 이어가 보세요.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={!canCloseCase(pendingResult.finalSolutionScore) && !energyDepleted}
              onClick={() => confirmSolve(true)}
            >
              {pendingResult.finalSolutionScore}%로 종결
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={energyDepleted}
              onClick={() => confirmSolve(false)}
            >
              조사 계속하기
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Pill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 ${
        accent ? 'border-teal-500/30 bg-teal-500/10 text-teal-200' : 'border-slate-700 bg-slate-900 text-slate-300'
      }`}
    >
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-soft">
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
