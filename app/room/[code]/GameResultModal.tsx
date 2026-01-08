'use client';

import Link from 'next/link';

type Question = {
  id: string;
  nickname: string;
  text: string;
  answer: 'yes' | 'no' | 'irrelevant' | null;
  timestamp: number;
};

type GameResultModalProps = {
  story: string; // 표면 이야기
  truth: string;
  questions: Question[];
  onRestart: () => void;
  roomCode: string;
  isUserWon?: boolean; // 정답 맞춘 유저만 개인적으로 보는 경우
  onClose?: () => void; // 모달 닫기 (정답 맞춘 유저가 게임 계속할 수 있도록)
};

export default function GameResultModal({ story, truth, questions, onRestart, roomCode, isUserWon = false, onClose }: GameResultModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl sm:rounded-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden border border-slate-700 shadow-2xl">
        <div className="bg-gradient-to-r from-teal-500 to-cyan-500 p-4 sm:p-6 text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center bg-white/20 rounded-full mx-auto mb-2 sm:mb-3">
            <i className="ri-trophy-line text-white text-2xl sm:text-3xl"></i>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
            {isUserWon ? '정답을 맞추셨습니다!' : '게임 종료!'}
          </h2>
          <p className="text-white/80 text-xs sm:text-sm">
            {isUserWon ? '축하합니다! 정답을 맞추셨습니다.' : '정답이 맞춰졌습니다'}
          </p>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(95vh-180px)] sm:max-h-[calc(90vh-200px)]">
          <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl p-4 sm:p-6 border border-indigo-500/30 mb-4 sm:mb-6">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center bg-indigo-500/20 rounded-lg flex-shrink-0">
                <i className="ri-book-open-line text-indigo-400 text-sm sm:text-base"></i>
              </div>
              <h3 className="font-bold text-indigo-400 text-sm sm:text-base">표면 이야기</h3>
            </div>
            <div className="max-h-48 sm:max-h-64 overflow-y-auto">
              <p className="text-xs sm:text-sm text-white leading-relaxed break-words pr-2">{story}</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-xl p-4 sm:p-6 border border-yellow-500/30 mb-4 sm:mb-6">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center bg-yellow-500/20 rounded-lg flex-shrink-0">
                <i className="ri-key-line text-yellow-400 text-sm sm:text-base"></i>
              </div>
              <h3 className="font-bold text-yellow-400 text-sm sm:text-base">진실</h3>
            </div>
            <div className="max-h-48 sm:max-h-64 overflow-y-auto">
              <p className="text-xs sm:text-sm text-white leading-relaxed break-words pr-2">{truth}</p>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 sm:p-6 border border-slate-700 mb-4 sm:mb-6">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center bg-blue-500/20 rounded-lg flex-shrink-0">
                <i className="ri-question-line text-blue-400 text-sm sm:text-base"></i>
              </div>
              <h3 className="font-bold text-blue-400 text-sm sm:text-base">질문 목록</h3>
              <span className="ml-auto text-xs sm:text-sm text-slate-500">{questions.length}개</span>
            </div>
            <div className="space-y-2 max-h-64 sm:max-h-80 overflow-y-auto pr-2">
              {questions.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs sm:text-sm">
                  <i className="ri-chat-off-line text-2xl sm:text-3xl mb-2"></i>
                  <p>질문이 없습니다</p>
                </div>
              ) : (
                questions.map((q, index) => (
                  <div key={q.id} className="bg-slate-900 rounded-lg p-3 sm:p-4 border border-slate-700 hover:border-blue-500/50 transition-colors">
                    <div className="flex items-start gap-2 mb-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-500 bg-slate-800 px-2 py-1 rounded">#{index + 1}</span>
                      <span className="text-xs sm:text-sm font-semibold text-cyan-400">{q.nickname}</span>
                      {q.answer && (
                        <span
                          className={`ml-auto px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                            q.answer === 'yes'
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : q.answer === 'no'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          }`}
                        >
                          {q.answer === 'yes' ? '예' : q.answer === 'no' ? '아니오' : '상관없음'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm sm:text-base text-white break-words leading-relaxed">{q.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6 border-t border-slate-700 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Link href="/" className="flex-1">
              <button className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 sm:py-3 rounded-xl transition-all duration-200 whitespace-nowrap text-sm sm:text-base">
                <i className="ri-home-line mr-2"></i>
                홈으로 돌아가기
              </button>
            </Link>
            {isUserWon && onClose && (
              <button
                onClick={onClose}
                className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 sm:py-3 rounded-xl transition-all duration-200 whitespace-nowrap text-sm sm:text-base"
              >
                <i className="ri-close-line mr-2"></i>
                계속하기
              </button>
            )}
            <Link href="/create-room" className="flex-1">
              <button className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-2 sm:py-3 rounded-xl transition-all duration-200 whitespace-nowrap text-sm sm:text-base">
                <i className="ri-add-circle-line mr-2"></i>
                새 방 만들기
              </button>
            </Link>
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t border-slate-700 flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Link href="/" className="flex-1">
            <button className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 sm:py-3 rounded-xl transition-all duration-200 whitespace-nowrap text-sm sm:text-base">
              <i className="ri-home-line mr-2"></i>
              홈으로 돌아가기
            </button>
          </Link>
          {isUserWon && onClose && (
            <button
              onClick={onClose}
              className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 sm:py-3 rounded-xl transition-all duration-200 whitespace-nowrap text-sm sm:text-base"
            >
              <i className="ri-close-line mr-2"></i>
              계속하기
            </button>
          )}
          <Link href="/create-room" className="flex-1">
            <button className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-2 sm:py-3 rounded-xl transition-all duration-200 whitespace-nowrap text-sm sm:text-base">
              <i className="ri-add-circle-line mr-2"></i>
              새 방 만들기
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
