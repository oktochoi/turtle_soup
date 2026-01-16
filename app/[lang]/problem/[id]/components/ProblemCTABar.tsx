'use client';

interface ProblemCTABarProps {
  lang: string;
  isCreatingRoom: boolean;
  onCreateRoomClick: () => void;
  onPreviousClick: () => void;
  onNextClick: () => void;
  onInviteClick: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
}

export default function ProblemCTABar({
  lang,
  isCreatingRoom,
  onCreateRoomClick,
  onPreviousClick,
  onNextClick,
  onInviteClick,
  hasPrevious,
  hasNext,
}: ProblemCTABarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-800 to-slate-800/95 backdrop-blur-xl border-t border-slate-700/50 z-50 shadow-2xl">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 max-w-4xl">
        {/* Primary 버튼: 이 문제로 방 만들기 */}
        <button
          onClick={onCreateRoomClick}
          disabled={isCreatingRoom}
          className="w-full mb-2 sm:mb-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 active:from-green-700 active:to-emerald-700 text-white font-bold py-3 sm:py-3.5 rounded-xl transition-all duration-200 shadow-lg hover:shadow-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation active:scale-95 text-sm sm:text-base"
        >
          {isCreatingRoom ? (
            <>
              <i className="ri-loader-4-line animate-spin mr-2"></i>
              {lang === 'ko' ? '방 생성 중...' : 'Creating room...'}
            </>
          ) : (
            <>
              <i className="ri-group-line mr-2"></i>
              {lang === 'ko' ? '이 문제로 방 만들기' : 'Create Room with This Problem'}
            </>
          )}
        </button>

        {/* Secondary 버튼 3개: 이전 문제, 초대 링크, 다음 문제 */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <button
            onClick={onPreviousClick}
            disabled={!hasPrevious}
            className="flex flex-col items-center justify-center gap-1 px-2 sm:px-3 py-2 sm:py-2.5 bg-slate-700/80 hover:bg-slate-600 active:bg-slate-500 text-white rounded-lg transition-all duration-200 touch-manipulation active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-700/80"
          >
            <i className="ri-arrow-left-line text-base sm:text-lg"></i>
            <span className="text-xs sm:text-sm font-medium">{lang === 'ko' ? '이전 문제' : 'Previous'}</span>
          </button>
          <button
            onClick={onInviteClick}
            className="flex flex-col items-center justify-center gap-1 px-2 sm:px-3 py-2 sm:py-2.5 bg-slate-700/80 hover:bg-slate-600 active:bg-slate-500 text-white rounded-lg transition-all duration-200 touch-manipulation active:scale-95"
          >
            <i className="ri-share-line text-base sm:text-lg"></i>
            <span className="text-xs sm:text-sm font-medium">{lang === 'ko' ? '초대 링크' : 'Invite'}</span>
          </button>
          <button
            onClick={onNextClick}
            disabled={!hasNext}
            className="flex flex-col items-center justify-center gap-1 px-2 sm:px-3 py-2 sm:py-2.5 bg-slate-700/80 hover:bg-slate-600 active:bg-slate-500 text-white rounded-lg transition-all duration-200 touch-manipulation active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-700/80"
          >
            <i className="ri-arrow-right-line text-base sm:text-lg"></i>
            <span className="text-xs sm:text-sm font-medium">{lang === 'ko' ? '다음 문제' : 'Next'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

