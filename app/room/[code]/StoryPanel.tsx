'use client';

type StoryPanelProps = {
  story: string;
};

export default function StoryPanel({ story }: StoryPanelProps) {
  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-slate-700 shadow-xl">
      <div className="flex items-start gap-2 sm:gap-3">
        <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-teal-500/20 rounded-lg flex-shrink-0">
          <i className="ri-book-open-line text-teal-400 text-lg sm:text-xl"></i>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xs sm:text-sm font-semibold text-teal-400 mb-2">이야기</h2>
          <p className="text-sm sm:text-base text-white leading-relaxed break-words">{story}</p>
        </div>
      </div>
    </div>
  );
}
