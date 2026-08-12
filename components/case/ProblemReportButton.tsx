'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import { handleError } from '@/lib/error-handler';

type ReportType = 'spam' | 'violence' | 'inappropriate_content' | 'copyright' | 'other';

interface Props {
  problemId: string;
  lang?: string;
}

export default function ProblemReportButton({ problemId, lang = 'ko' }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ReportType>('inappropriate_content');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!reason.trim() || busy) return;
    setBusy(true);
    try {
      let reporterIdentifier: string | null = null;
      if (!user && typeof window !== 'undefined') {
        reporterIdentifier = localStorage.getItem('guest_id') || `guest_${Date.now()}`;
        localStorage.setItem('guest_id', reporterIdentifier);
      }

      const { error } = await supabase.from('problem_reports').insert({
        problem_id: problemId,
        reporter_user_id: user?.id ?? null,
        reporter_identifier: reporterIdentifier,
        report_type: type,
        reason: reason.trim(),
        description: description.trim() || null,
        status: 'pending',
      });

      if (error) throw error;
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setReason('');
        setDescription('');
      }, 1800);
    } catch (e) {
      handleError(e, '사건 신고', true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2"
        onClick={() => setOpen(true)}
      >
        사건 신고
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
          onClick={() => !busy && setOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="사건 신고"
          >
            <h3 className="text-lg font-semibold text-white">사건 신고</h3>
            <p className="mt-1 text-xs text-slate-400">
              폭력·혐오·스팸 등 정책 위반 사건을 알려주세요. 검토 후 조치합니다.
            </p>

            {done ? (
              <p className="mt-6 text-sm text-teal-300">신고가 접수되었습니다. 검토해 주셔서 감사합니다.</p>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['violence', '폭력/잔혹'],
                      ['inappropriate_content', '부적절'],
                      ['spam', '스팸'],
                      ['copyright', '저작권'],
                      ['other', '기타'],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      className={`rounded-lg px-2.5 py-1 text-xs ${
                        type === v ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                      onClick={() => setType(v)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  className="field w-full"
                  placeholder="신고 사유 (필수)"
                  value={reason}
                  maxLength={200}
                  onChange={(e) => setReason(e.target.value)}
                />
                <textarea
                  className="field w-full min-h-[80px]"
                  placeholder="상세 설명 (선택)"
                  value={description}
                  maxLength={500}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <div className="flex gap-2 pt-1">
                  <button type="button" className="btn-ghost flex-1" disabled={busy} onClick={() => setOpen(false)}>
                    취소
                  </button>
                  <button
                    type="button"
                    className="btn-primary flex-1"
                    disabled={busy || !reason.trim()}
                    onClick={submit}
                  >
                    {busy ? '제출 중…' : '신고하기'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
