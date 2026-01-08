'use client';

import { useEffect, useRef } from 'react';

type Question = {
  id: string;
  nickname: string;
  text: string;
  answer: 'yes' | 'no' | 'irrelevant' | null;
  timestamp: number;
};

type QuestionListProps = {
  questions: Question[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  isHost?: boolean; // 호스트 여부
};

export default function QuestionList({ questions, selectedId, onSelect, isHost = false }: QuestionListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      // 사용자 화면에서는 최신 질문이 보이도록 스크롤을 맨 아래로
      // 어드민 화면에서는 정렬된 순서대로 표시
      if (!isHost) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }
  }, [questions, isHost]);

  // 정렬 로직: 모든 화면에서 최신 질문이 위로 오도록 정렬 (내림차순)
  const sortedQuestions = [...questions].sort((a, b) => {
    // 최신 질문이 위로 오도록 (내림차순)
    return b.timestamp - a.timestamp;
  });

  const getAnswerBadge = (answer: 'yes' | 'no' | 'irrelevant' | null) => {
    if (!answer) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-400 whitespace-nowrap">
          대기중
        </span>
      );
    }

    const styles = {
      yes: 'bg-green-500/20 text-green-400 border border-green-500/50',
      no: 'bg-red-500/20 text-red-400 border border-red-500/50',
      irrelevant: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50',
    };

    const labels = {
      yes: '예',
      no: '아니오',
      irrelevant: '상관없음',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[answer]} whitespace-nowrap`}>
        {labels[answer]}
      </span>
    );
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-slate-700 flex items-center gap-2">
        <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center flex-shrink-0">
          <i className="ri-chat-3-line text-teal-400 text-sm sm:text-base"></i>
        </div>
        <h3 className="font-semibold text-xs sm:text-sm">질문 목록</h3>
        {isHost && (
          <span className="text-xs text-slate-400 ml-2" title="질문을 클릭하면 예/아니오/상관없음을 선택할 수 있습니다">
            <i className="ri-information-line mr-1"></i>
            질문 클릭하여 답변하기
          </span>
        )}
        <span className="ml-auto text-xs text-slate-500">{questions.length}개</span>
      </div>
      <div ref={listRef} className="max-h-64 sm:max-h-96 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3">
        {sortedQuestions.length === 0 ? (
          <div className="text-center py-6 sm:py-8 text-slate-500 text-xs sm:text-sm">
            <i className="ri-chat-off-line text-2xl sm:text-3xl mb-2"></i>
            <p>아직 질문이 없습니다</p>
          </div>
        ) : (
          sortedQuestions.map((q) => (
            <div
              key={q.id}
              onClick={() => onSelect && onSelect(q.id)}
              className={`p-3 sm:p-4 rounded-lg transition-all duration-200 ${
                selectedId === q.id
                  ? 'bg-teal-500/20 border-2 border-teal-500'
                  : 'bg-slate-900 border border-slate-700 hover:border-slate-600'
              } ${onSelect ? 'cursor-pointer' : ''}`}
            >
              <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2 flex-wrap">
                <span className="text-xs font-semibold text-cyan-400">{q.nickname}</span>
                {getAnswerBadge(q.answer)}
              </div>
              <p className="text-xs sm:text-sm text-white leading-relaxed break-words">{q.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
