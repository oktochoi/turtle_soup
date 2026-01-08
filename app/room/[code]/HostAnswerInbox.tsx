'use client';

type Guess = {
  id: string;
  nickname: string;
  text: string;
  judged: boolean;
  correct: boolean;
  timestamp: number;
};

type HostAnswerInboxProps = {
  guesses: Guess[];
  onJudge: (guessId: string, correct: boolean) => void;
  gameEnded: boolean;
};

export default function HostAnswerInbox({ guesses, onJudge, gameEnded }: HostAnswerInboxProps) {
  const unjudgedGuesses = guesses.filter(g => !g.judged);

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      <div className="p-3 sm:p-4 border-b border-slate-700 flex items-center gap-2">
        <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center bg-purple-500/20 rounded-lg flex-shrink-0">
          <i className="ri-inbox-line text-purple-400 text-sm sm:text-base"></i>
        </div>
        <h3 className="font-bold text-purple-400 text-sm sm:text-base">정답 제출함</h3>
        {unjudgedGuesses.length > 0 && (
          <span className="ml-auto bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            {unjudgedGuesses.length}
          </span>
        )}
        <span className="ml-auto text-xs sm:text-sm text-slate-500">{guesses.length}개</span>
      </div>
      <div className="max-h-64 sm:max-h-96 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3">
        {guesses.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs sm:text-sm">
            <i className="ri-inbox-line text-2xl sm:text-3xl mb-2"></i>
            <p>제출된 정답이 없습니다</p>
          </div>
        ) : (
          guesses.map((guess) => (
            <div
              key={guess.id}
              className={`p-3 sm:p-4 rounded-lg border transition-colors ${
                guess.judged
                  ? guess.correct
                    ? 'bg-green-500/10 border-green-500/50 hover:border-green-500/70'
                    : 'bg-red-500/10 border-red-500/50 hover:border-red-500/70'
                  : 'bg-slate-900 border-slate-700 hover:border-purple-500/50'
              }`}
            >
              <div className="flex items-start gap-2 mb-2 flex-wrap">
                <span className="text-xs sm:text-sm font-semibold text-purple-400">{guess.nickname}</span>
                {guess.judged && (
                  <span
                    className={`ml-auto px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                      guess.correct
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {guess.correct ? '정답' : '오답'}
                  </span>
                )}
              </div>
              <p className="text-sm sm:text-base text-white leading-relaxed mb-2 sm:mb-3 break-words">{guess.text}</p>
              {!guess.judged && !gameEnded && (
                <div className="flex gap-2">
                  <button
                    onClick={() => onJudge(guess.id, true)}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 rounded-lg transition-all duration-200 text-xs sm:text-sm whitespace-nowrap"
                  >
                    <i className="ri-check-line mr-1"></i>
                    정답
                  </button>
                  <button
                    onClick={() => onJudge(guess.id, false)}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 rounded-lg transition-all duration-200 text-xs sm:text-sm whitespace-nowrap"
                  >
                    <i className="ri-close-line mr-1"></i>
                    오답
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
