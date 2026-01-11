'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 max-w-md lg:max-w-lg">
        <header className="text-center mb-8 sm:mb-12 pt-4 sm:pt-6 lg:pt-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 sm:mb-3 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            바다거북스프
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm lg:text-base">
            추리와 질문으로 진실을 밝혀내는 게임
          </p>
        </header>

        <div className="space-y-4 sm:space-y-6">
          {/* 멀티플레이어 섹션 */}
          <div className="bg-slate-800/50 rounded-xl p-4 sm:p-5 lg:p-6 border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <i className="ri-group-line text-teal-400 text-lg sm:text-xl"></i>
              <h2 className="text-base sm:text-lg font-semibold text-teal-400">멀티플레이어</h2>
        </div>
            <p className="text-xs sm:text-sm text-slate-400 mb-4">친구들과 함께 실시간으로 게임을 즐기세요</p>
            
            <Link href="/rooms">
              <button className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 sm:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-teal-500/50 text-sm sm:text-base">
                <i className="ri-group-line mr-2"></i>
                멀티 플레이
            </button>
          </Link>
            </div>

          {/* 오프라인 섹션 */}
          <div className="bg-slate-800/50 rounded-xl p-4 sm:p-5 lg:p-6 border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <i className="ri-user-line text-purple-400 text-lg sm:text-xl"></i>
              <h2 className="text-base sm:text-lg font-semibold text-purple-400">오프라인</h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mb-4">혼자서 문제를 풀어보세요</p>
            <Link href="/problems">
              <button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 sm:py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-purple-500/50 text-sm sm:text-base">
                <i className="ri-question-answer-line mr-2"></i>
                게임 시작하기
              </button>
            </Link>
          </div>
        </div>

        <section className="mt-8 sm:mt-12 lg:mt-16 bg-slate-800/50 rounded-xl p-4 sm:p-5 lg:p-6 border border-slate-700">
          <h2 className="font-semibold mb-3 text-teal-400 flex items-center text-sm sm:text-base lg:text-lg">
            <i className="ri-information-line mr-2" aria-hidden="true"></i>
            게임 방법
          </h2>
          <ul className="space-y-2 text-xs sm:text-sm lg:text-base text-slate-300">
            <li className="flex items-start">
              <i className="ri-checkbox-circle-fill text-teal-500 mr-2 mt-0.5 flex-shrink-0" aria-hidden="true"></i>
              <span>관리자는 이야기의 진실을 알고 있습니다</span>
            </li>
            <li className="flex items-start">
              <i className="ri-checkbox-circle-fill text-teal-500 mr-2 mt-0.5 flex-shrink-0" aria-hidden="true"></i>
              <span>참여자는 질문을 통해 진실을 추리합니다</span>
            </li>
            <li className="flex items-start">
              <i className="ri-checkbox-circle-fill text-teal-500 mr-2 mt-0.5 flex-shrink-0" aria-hidden="true"></i>
              <span>관리자는 예/아니오/상관없음으로만 답합니다</span>
            </li>
            <li className="flex items-start">
              <i className="ri-checkbox-circle-fill text-teal-500 mr-2 mt-0.5 flex-shrink-0" aria-hidden="true"></i>
              <span>정답을 맞추면 진실이 공개됩니다</span>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
