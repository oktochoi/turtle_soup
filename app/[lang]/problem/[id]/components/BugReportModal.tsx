'use client';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  problemId: string;
  lang: string;
  bugReportType: 'wrong_answer' | 'wrong_yes_no' | 'wrong_irrelevant' | 'wrong_similarity' | 'other';
  bugReportExpected: string;
  bugReportQuestion: string | null;
  bugReportAnswer: string | null;
  questionText: string;
  suggestedAnswer: string | null;
  userGuess: string;
  similarityScore: number | null;
  onBugReportTypeChange: (type: 'wrong_answer' | 'wrong_yes_no' | 'wrong_irrelevant' | 'wrong_similarity' | 'other') => void;
  onBugReportExpectedChange: (value: string) => void;
  t: any;
}

export default function BugReportModal({
  isOpen,
  onClose,
  onSubmit,
  problemId,
  lang,
  bugReportType,
  bugReportExpected,
  bugReportQuestion,
  bugReportAnswer,
  questionText,
  suggestedAnswer,
  userGuess,
  similarityScore,
  onBugReportTypeChange,
  onBugReportExpectedChange,
  t,
}: BugReportModalProps) {
  if (!isOpen) return null;

  const shouldShow = (bugReportType === 'wrong_similarity') || 
    ((bugReportQuestion || questionText) && (bugReportAnswer || suggestedAnswer));
  
  if (!shouldShow) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl p-4 sm:p-6 max-w-md w-full border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg sm:text-xl font-bold text-red-400 flex items-center gap-2">
            <i className="ri-bug-line"></i>
            {lang === 'ko' ? '오류 리포트 보내기' : 'Send Error Report'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors touch-manipulation"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
              {lang === 'ko' ? '버그 유형' : 'Bug Type'}
            </label>
            <select
              value={bugReportType}
              onChange={(e) => onBugReportTypeChange(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="wrong_yes_no">{lang === 'ko' ? '예/아니요 오류 (예여야 하는데 아니요로 판단)' : 'Yes/No Error (Should be Yes but got No)'}</option>
              <option value="wrong_answer">{lang === 'ko' ? '정답 오류 (정답인데 오답으로 판단)' : 'Answer Error (Correct but marked wrong)'}</option>
              <option value="wrong_irrelevant">{lang === 'ko' ? '무관 오류 (관련 있는데 무관으로 판단)' : 'Irrelevant Error (Relevant but marked irrelevant)'}</option>
              <option value="wrong_similarity">{lang === 'ko' ? '유사도 계산 오류' : 'Similarity Calculation Error'}</option>
              <option value="other">{lang === 'ko' ? '기타' : 'Other'}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
              {lang === 'ko' ? '문제 ID' : 'Problem ID'}
            </label>
            <div className="bg-slate-900 rounded-lg px-3 sm:px-4 py-2 text-sm text-slate-300 border border-slate-700">
              {problemId}
            </div>
          </div>

          {bugReportType !== 'wrong_similarity' && (bugReportQuestion || questionText) && (
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                {lang === 'ko' ? '질문' : 'Question'}
              </label>
              <div className="bg-slate-900 rounded-lg px-3 sm:px-4 py-2 text-sm text-slate-300 border border-slate-700">
                {bugReportQuestion || questionText}
              </div>
            </div>
          )}

          {bugReportType !== 'wrong_similarity' && (bugReportAnswer || suggestedAnswer) && (
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                {lang === 'ko' ? 'AI 제안 답변' : 'AI Suggested Answer'}
              </label>
              <div className="bg-slate-900 rounded-lg px-3 sm:px-4 py-2 text-sm text-slate-300 border border-slate-700">
                {(() => {
                  const answer = bugReportAnswer || suggestedAnswer;
                  return answer === 'yes' ? (lang === 'ko' ? '예' : 'Yes') :
                         answer === 'no' ? (lang === 'ko' ? '아니요' : 'No') :
                         answer === 'irrelevant' ? (lang === 'ko' ? '무관' : 'Irrelevant') :
                         answer === 'decisive' ? (lang === 'ko' ? '결정적인' : 'Decisive') : answer;
                })()}
              </div>
            </div>
          )}

          {bugReportType === 'wrong_similarity' && userGuess && (
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                {lang === 'ko' ? '제출한 정답' : 'Submitted Answer'}
              </label>
              <div className="bg-slate-900 rounded-lg px-3 sm:px-4 py-2 text-sm text-slate-300 border border-slate-700">
                {userGuess}
              </div>
            </div>
          )}

          {bugReportType === 'wrong_similarity' && similarityScore !== null && (
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
                {lang === 'ko' ? '계산된 유사도' : 'Calculated Similarity'}
              </label>
              <div className="bg-slate-900 rounded-lg px-3 sm:px-4 py-2 text-sm text-slate-300 border border-slate-700">
                {similarityScore}%
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2 text-slate-300">
              {lang === 'ko' ? '기대한 답변' : 'Expected Answer'}
              <span className="text-red-400 ml-1">*</span>
            </label>
            <input
              type="text"
              value={bugReportExpected}
              onChange={(e) => onBugReportExpectedChange(e.target.value)}
              placeholder={lang === 'ko' ? '예: 예, 아니요, 무관 등' : 'e.g., Yes, No, Irrelevant'}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 sm:px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm sm:text-base"
            />
            <p className="text-xs text-slate-400 mt-1">
              {lang === 'ko' 
                ? 'AI가 어떤 답변을 해야 했는지 입력해주세요.' 
                : 'Please enter what answer the AI should have given.'}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-500 text-white rounded-lg transition-all font-semibold text-sm sm:text-base touch-manipulation"
            >
              {lang === 'ko' ? '취소' : 'Cancel'}
            </button>
            <button
              onClick={onSubmit}
              className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-lg transition-all font-semibold text-sm sm:text-base touch-manipulation"
            >
              {lang === 'ko' ? '신고하기' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

