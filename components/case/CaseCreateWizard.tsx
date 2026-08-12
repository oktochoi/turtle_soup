'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase';
import { triggerEvent } from '@/lib/progress-client';
import { buildCaseKnowledge, judgeQuestionV11 } from '@/lib/ai/v11';
import { findBlockedContentReason } from '@/lib/problems/public';
import { CATEGORY_LABELS, type CaseCategory } from '@/lib/investigation/types';

const CATEGORIES: CaseCategory[] = ['mystery', 'crime', 'horror', 'twist', 'emotional', 'extreme'];

interface Props {
  lang: string;
  userId: string;
  authorName: string;
}

/**
 * 3-step case creation: situation → truth → publish (+ AI answer test).
 * Does not ask creators for keyClues / synonyms / solutionElements.
 */
export default function CaseCreateWizard({ lang, userId, authorName }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [answer, setAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [category, setCategory] = useState<CaseCategory>('mystery');
  const [submitting, setSubmitting] = useState(false);
  const [preparing, setPreparing] = useState(false);

  // AI test
  const [testQ, setTestQ] = useState('');
  const [testBusy, setTestBusy] = useState(false);
  const [testAnswer, setTestAnswer] = useState<string | null>(null);
  const [testDebug, setTestDebug] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [agreedGuidelines, setAgreedGuidelines] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const canStep1 = title.trim().length > 0 && content.trim().length >= 10;
  const canStep2 = answer.trim().length >= 10;

  const runAiTest = async () => {
    const q = testQ.trim();
    if (!q || !canStep1 || !canStep2 || testBusy) return;
    setTestBusy(true);
    setTestAnswer(null);
    setTestDebug(null);
    try {
      // Warm knowledge (same as production path)
      buildCaseKnowledge({ caseId: 'preview', content: content.trim(), answer: answer.trim() });
      const result = await judgeQuestionV11({
        question: q,
        caseId: 'preview',
        content: content.trim(),
        answer: answer.trim(),
      });
      const label =
        result.label === 'yes' ? '예' : result.label === 'no' ? '아니요' : '상관없음';
      setTestAnswer(label);
      setTestDebug(
        JSON.stringify(
          {
            reason: result.reason,
            intent: result.debug.parsedIntent,
            relation: result.debug.relation,
            storyRelevance: result.debug.storyRelevance,
            topScore: result.debug.embeddingTopScore,
          },
          null,
          2
        )
      );
    } catch (e) {
      console.error(e);
      setTestAnswer('테스트에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setTestBusy(false);
    }
  };

  const publish = async () => {
    if (!canStep1 || !canStep2 || submitting || !agreedGuidelines) return;

    const blocked =
      findBlockedContentReason(`${title}\n${content}\n${answer}`) ||
      findBlockedContentReason(content) ||
      findBlockedContentReason(answer);
    if (blocked) {
      alert(blocked);
      return;
    }

    if (!isSupabaseConfigured()) {
      alert('Supabase가 설정되지 않았습니다.');
      return;
    }
    setSubmitting(true);
    setPreparing(true);
    try {
      buildCaseKnowledge({
        caseId: 'draft',
        content: content.trim(),
        answer: answer.trim(),
      });

      const supabase = createClient();
      const tags = ['바다거북 스프'];
      if (category !== 'mystery') tags.push(CATEGORY_LABELS[category]);

      const baseData: Record<string, unknown> = {
        title: title.trim(),
        type: 'soup',
        user_id: userId,
        author: authorName,
        difficulty,
        tags,
        lang: 'ko',
        content: content.trim(),
        answer: answer.trim(),
      };
      if (explanation.trim()) {
        baseData.explanation = explanation.trim();
      }

      const pendingInsert = await supabase
        .from('problems')
        .insert({ ...baseData, status: 'pending' })
        .select('id')
        .single();

      if (pendingInsert.error) {
        const code = pendingInsert.error.code || '';
        const msg = pendingInsert.error.message || '';
        if (code === '23514' || msg.includes('status') || msg.includes('check constraint')) {
          throw new Error(
            '사건 검수 시스템이 아직 준비되지 않았습니다. 관리자에게 072_problem_moderation.sql 마이그레이션 적용을 요청해 주세요.'
          );
        }
        throw pendingInsert.error;
      }

      const problem = pendingInsert.data;

      try {
        await triggerEvent(null, null, userId, 'create_problem', {});
      } catch {
        /* ignore xp */
      }

      setSubmittedId(problem.id);
      setPreparing(false);
      setSubmitting(false);
    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : '사건 등록에 실패했습니다.';
      alert(`사건 등록에 실패했습니다.\n${msg}`);
      setSubmitting(false);
      setPreparing(false);
    }
  };

  if (submittedId) {
    return (
      <div className="rounded-2xl border border-teal-500/30 bg-slate-900/80 p-8 sm:p-10 text-center">
        <p className="text-xs tracking-[0.25em] text-teal-300">SUBMITTED</p>
        <h2 className="mt-4 text-xl font-semibold text-white">사건이 접수되었습니다</h2>
        <p className="mt-3 text-sm text-slate-400 leading-relaxed">
          운영팀 검토 후 공개됩니다. 보통 24시간 이내 처리됩니다.
          <br />
          승인되면 사건 목록에 노출됩니다.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href={`/${lang}/problem/${submittedId}`} className="btn-ghost">
            미리보기
          </Link>
          <Link href={`/${lang}/problems`} className="btn-primary">
            사건 목록으로
          </Link>
        </div>
      </div>
    );
  }

  if (preparing) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-10 text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />
        <p className="text-white font-medium">사건을 준비하고 있습니다.</p>
        <p className="mt-2 text-sm text-slate-400">잠시만 기다려 주세요…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className={step === 1 ? 'text-teal-300' : ''}>1. 상황</span>
        <span>→</span>
        <span className={step === 2 ? 'text-teal-300' : ''}>2. 진실</span>
        <span>→</span>
        <span className={step === 3 ? 'text-teal-300' : ''}>3. 공개</span>
      </div>

      {step === 1 && (
        <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">상황 작성</h2>
          <p className="text-sm text-slate-400">플레이어에게 보여줄 미스터리를 작성하세요.</p>
          <div>
            <label className="mb-2 block text-sm text-slate-300">사건 제목</label>
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="예: 마지막 배달"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">사건 상황</label>
            <textarea
              className="field min-h-[160px]"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={2000}
              placeholder={`한 남자는 식당에서 수프를 한 입 먹고\n곧바로 식당을 나와 자살했다.\n\n왜 그랬을까?`}
            />
            <p className="mt-1 text-right text-xs text-slate-500">{content.length} / 2000</p>
          </div>
          <button type="button" className="btn-primary w-full sm:w-auto" disabled={!canStep1} onClick={() => setStep(2)}>
            다음: 진실 작성
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">진실 작성</h2>
          <p className="text-sm text-slate-400">
            실제 사건의 진실은 무엇인가요? 이 내용은 플레이어에게 공개되지 않습니다.
          </p>
          <textarea
            className="field min-h-[200px]"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={4000}
            placeholder="사건의 진실을 자세히 적어 주세요. AI가 이 내용을 바탕으로 질문을 판정합니다."
          />
          <p className="text-right text-xs text-slate-500">{answer.length} / 4000</p>
          <div className="mt-4">
            <label className="mb-2 block text-sm text-slate-300">
              공개 해설 <span className="text-slate-500">(선택 · 스포일러 포함 가능)</span>
            </label>
            <textarea
              className="field min-h-[100px]"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              maxLength={2000}
              placeholder="수사 후 공개되는 해설입니다. 반전 포인트·배울 점을 적어 주세요. AdSense·검색 품질에 도움이 됩니다."
            />
            <p className="mt-1 text-right text-xs text-slate-500">{explanation.length} / 2000</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
              이전
            </button>
            <button type="button" className="btn-primary" disabled={!canStep2} onClick={() => setStep(3)}>
              다음: 공개 설정
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-5 rounded-2xl border border-slate-700 bg-slate-900/80 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">공개 설정</h2>

          <div>
            <p className="mb-2 text-sm text-slate-300">난이도</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['easy', '쉬움'],
                  ['medium', '보통'],
                  ['hard', '어려움'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  className={`btn-ghost !py-1.5 !px-3 text-sm ${difficulty === v ? '!border-teal-400/50 !text-teal-200' : ''}`}
                  onClick={() => setDifficulty(v)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm text-slate-300">카테고리</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`btn-ghost !py-1.5 !px-3 text-sm ${category === c ? '!border-teal-400/50 !text-teal-200' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
            <p className="text-xs text-slate-500 mb-1">미리보기</p>
            <p className="font-semibold text-white">{title || '제목 없음'}</p>
            <p className="mt-2 text-sm text-slate-400 line-clamp-4 whitespace-pre-wrap">{content}</p>
            <p className="mt-2 text-xs text-slate-500">
              {CATEGORY_LABELS[category]} · {difficulty}
            </p>
          </div>

          {/* AI test */}
          <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">AI 답변 테스트</h3>
            <p className="text-xs text-slate-400">
              공개 전에 테스트 질문을 입력해 AI 답변을 확인해 보세요.
            </p>
            <input
              className="field"
              value={testQ}
              onChange={(e) => setTestQ(e.target.value)}
              placeholder="예: 엄마가 관련돼 있어?"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runAiTest();
                }
              }}
            />
            <button type="button" className="btn-ghost" disabled={testBusy || !testQ.trim()} onClick={runAiTest}>
              {testBusy ? '판정 중…' : 'AI 답변 테스트'}
            </button>
            {testAnswer && (
              <div className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200">
                AI 답변: <span className="text-teal-300 font-medium">{testAnswer}</span>
              </div>
            )}
            {testDebug && (
              <div>
                <button
                  type="button"
                  className="text-xs text-slate-500 underline"
                  onClick={() => setShowDebug((v) => !v)}
                >
                  {showDebug ? '상세 분석 숨기기' : '상세 분석 보기'}
                </button>
                {showDebug && (
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-[11px] text-slate-400">
                    {testDebug}
                  </pre>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white">콘텐츠 안내</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              실제 폭력·성인·혐오·개인정보 노출 콘텐츠는 등록할 수 없습니다. 공포·반전 추리는 가능하지만,
              과도한 잔혹 묘사는 피해주세요. 위반 시 삭제될 수 있습니다.
            </p>
            <label className="flex items-start gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={agreedGuidelines}
                onChange={(e) => setAgreedGuidelines(e.target.checked)}
              />
              <span>
                <Link href={`/${lang}/community-guidelines`} className="text-teal-300 underline underline-offset-2">
                  커뮤니티 가이드라인
                </Link>
                을 확인했고 준수합니다.
              </span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => setStep(2)}>
              이전
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={submitting || !agreedGuidelines}
              onClick={publish}
            >
              검토 요청하기
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
