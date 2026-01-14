'use client';

type ProblemAdminButtonsProps = {
  onAnswer: (answer: 'yes' | 'no' | 'irrelevant' | 'decisive') => void;
};

export default function ProblemAdminButtons({ onAnswer }: ProblemAdminButtonsProps) {
  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl p-3 sm:p-4 border border-purple-500/30">
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center flex-shrink-0">
          <i className="ri-vip-crown-line text-purple-400 text-sm sm:text-base"></i>
        </div>
        <h3 className="font-semibold text-xs sm:text-sm text-purple-400">선택된 질문에 답변하기</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <button
          onClick={() => onAnswer('yes')}
          className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 sm:py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-green-500/50 whitespace-nowrap text-xs sm:text-sm"
        >
          <i className="ri-check-line mr-1"></i>
          예
        </button>
        <button
          onClick={() => onAnswer('no')}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 sm:py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-red-500/50 whitespace-nowrap text-xs sm:text-sm"
        >
          <i className="ri-close-line mr-1"></i>
          아니오
        </button>
        <button
          onClick={() => onAnswer('irrelevant')}
          className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 sm:py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-yellow-500/50 whitespace-nowrap text-xs sm:text-sm"
        >
          <i className="ri-question-mark mr-1"></i>
          상관없음
        </button>
        <button
          onClick={() => onAnswer('decisive')}
          className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 sm:py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-purple-500/50 whitespace-nowrap text-xs sm:text-sm"
        >
          <i className="ri-lightbulb-line mr-1"></i>
          결정적인
        </button>
      </div>
    </div>
  );
}

