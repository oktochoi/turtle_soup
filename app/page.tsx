'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
      {/* 배경 장식 요소 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 max-w-md lg:max-w-5xl relative z-10">
        <header className="text-center mb-8 sm:mb-12 pt-4 sm:pt-6 lg:pt-8 animate-fade-in">
          <div className="inline-block mb-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-3 bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto]">
              바다거북스프
            </h1>
            <div className="h-1 w-24 mx-auto bg-gradient-to-r from-transparent via-teal-400 to-transparent rounded-full"></div>
          </div>
          <p className="text-slate-300 text-sm sm:text-base lg:text-lg font-light tracking-wide">
            추리와 질문으로 진실을 밝혀내는 게임
          </p>
        </header>

        <div className="flex flex-col lg:flex-row gap-5 sm:gap-6 animate-fade-in-up">
          {/* 멀티플레이어 섹션 */}
          <div className="group relative bg-slate-800/40 backdrop-blur-xl rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50 hover:border-teal-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-teal-500/20 hover:-translate-y-1 flex-1">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-lg group-hover:scale-110 transition-transform duration-300">
                  <i className="ri-group-line text-teal-400 text-xl sm:text-2xl"></i>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-teal-400">멀티플레이어</h2>
              </div>
              <p className="text-sm sm:text-base text-slate-300 mb-5 leading-relaxed">친구들과 함께 실시간으로 게임을 즐기세요</p>
              
              <Link href="/rooms">
                <button className="w-full group/btn relative overflow-hidden bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-4 sm:py-5 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-teal-500/50 text-base sm:text-lg transform hover:scale-[1.02]">
                  <span className="relative z-10 flex items-center justify-center">
                    <i className="ri-group-line mr-2 text-lg"></i>
                    멀티 플레이
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-teal-500 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                </button>
              </Link>
            </div>
          </div>

          {/* 오프라인 섹션 */}
          <div className="group relative bg-slate-800/40 backdrop-blur-xl rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50 hover:border-purple-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20 hover:-translate-y-1 flex-1">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg group-hover:scale-110 transition-transform duration-300">
                  <i className="ri-user-line text-purple-400 text-xl sm:text-2xl"></i>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-purple-400">오프라인</h2>
              </div>
              <p className="text-sm sm:text-base text-slate-300 mb-5 leading-relaxed">혼자서 문제를 풀어보세요</p>
              <Link href="/problems">
                <button className="w-full group/btn relative overflow-hidden bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-4 sm:py-5 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-purple-500/50 text-base sm:text-lg transform hover:scale-[1.02]">
                  <span className="relative z-10 flex items-center justify-center">
                    <i className="ri-question-answer-line mr-2 text-lg"></i>
                    게임 시작하기
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-500 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                </button>
              </Link>
            </div>
          </div>
        </div>

        <section className="mt-8 sm:mt-12 lg:mt-16 bg-slate-800/40 backdrop-blur-xl rounded-2xl p-5 sm:p-6 lg:p-7 border border-slate-700/50 animate-fade-in-up delay-200">
          <h2 className="font-bold mb-5 text-teal-400 flex items-center text-base sm:text-lg lg:text-xl">
            <div className="p-1.5 bg-teal-500/20 rounded-lg mr-3">
              <i className="ri-information-line text-lg" aria-hidden="true"></i>
            </div>
            게임 방법
          </h2>
          <ul className="space-y-3 text-sm sm:text-base lg:text-base text-slate-300">
            <li className="flex items-start group/item">
              <div className="p-1 bg-teal-500/20 rounded-full mr-3 mt-0.5 flex-shrink-0 group-hover/item:bg-teal-500/30 transition-colors">
                <i className="ri-checkbox-circle-fill text-teal-400 text-sm" aria-hidden="true"></i>
              </div>
              <span className="leading-relaxed">관리자는 이야기의 진실을 알고 있습니다</span>
            </li>
            <li className="flex items-start group/item">
              <div className="p-1 bg-teal-500/20 rounded-full mr-3 mt-0.5 flex-shrink-0 group-hover/item:bg-teal-500/30 transition-colors">
                <i className="ri-checkbox-circle-fill text-teal-400 text-sm" aria-hidden="true"></i>
              </div>
              <span className="leading-relaxed">참여자는 질문을 통해 진실을 추리합니다</span>
            </li>
            <li className="flex items-start group/item">
              <div className="p-1 bg-teal-500/20 rounded-full mr-3 mt-0.5 flex-shrink-0 group-hover/item:bg-teal-500/30 transition-colors">
                <i className="ri-checkbox-circle-fill text-teal-400 text-sm" aria-hidden="true"></i>
              </div>
              <span className="leading-relaxed">관리자는 예/아니오/상관없음으로만 답합니다</span>
            </li>
            <li className="flex items-start group/item">
              <div className="p-1 bg-teal-500/20 rounded-full mr-3 mt-0.5 flex-shrink-0 group-hover/item:bg-teal-500/30 transition-colors">
                <i className="ri-checkbox-circle-fill text-teal-400 text-sm" aria-hidden="true"></i>
              </div>
              <span className="leading-relaxed">정답을 맞추면 진실이 공개됩니다</span>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
