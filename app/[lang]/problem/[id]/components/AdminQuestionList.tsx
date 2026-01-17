'use client';

import React from 'react';
import type { ProblemQuestion } from '@/lib/types';
import ProblemAdminButtons from '../ProblemAdminButtons';

interface AdminQuestionListProps {
  questions: ProblemQuestion[];
  selectedQuestionId: string | null;
  onSelectQuestion: (questionId: string | null) => void;
  onAnswerQuestion: (questionId: string, answer: 'yes' | 'no' | 'irrelevant' | 'decisive') => void;
  getAnswerBadge: (answer: string | null) => { text: string; color: string } | null;
  t: any;
}

export default function AdminQuestionList({
  questions,
  selectedQuestionId,
  onSelectQuestion,
  onAnswerQuestion,
  getAnswerBadge,
  t,
}: AdminQuestionListProps) {
  if (questions.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">{t.problem.dbQuestionList}</h3>
        <div className="space-y-3">
          {questions.map((q) => {
            const badge = getAnswerBadge(q.answer);
            return (
              <div
                key={q.id}
                className={`bg-slate-900 rounded-lg p-4 border transition-all ${
                  selectedQuestionId === q.id
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-slate-700'
                } ${!q.answer ? 'cursor-pointer hover:border-purple-500/50' : ''}`}
                onClick={() => {
                  if (!q.answer) {
                    onSelectQuestion(q.id === selectedQuestionId ? null : q.id);
                  }
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-semibold text-cyan-400">{q.nickname}</span>
                  {badge && (
                    <span className={`px-2 py-1 rounded text-xs font-semibold border ${badge.color}`}>
                      {badge.text}
                    </span>
                  )}
                </div>
                <p className="text-sm text-white">{q.text}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 관리자 답변 버튼 */}
      {selectedQuestionId && (
        <div className="mt-4">
          <ProblemAdminButtons
            onAnswer={(answer) => onAnswerQuestion(selectedQuestionId, answer)}
          />
        </div>
      )}
    </>
  );
}

