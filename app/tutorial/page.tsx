'use client';

import Link from 'next/link';

export default function TutorialPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-4xl">
        {/* 헤더 */}
        <div className="mb-8">
          <Link href="/">
            <button className="text-slate-400 hover:text-white transition-colors text-sm mb-4">
              <i className="ri-arrow-left-line mr-2"></i>
              돌아가기
            </button>
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            바다거북스프란?
          </h1>
        </div>

        {/* 소개 섹션 */}
        <div className="bg-slate-800 rounded-xl p-6 sm:p-8 mb-6 border border-slate-700">
          <p className="text-lg sm:text-xl text-slate-300 leading-relaxed">
            "예/아니오" 질문으로 미스터리를 풀어가는 추리 게임입니다.
          </p>
        </div>

        {/* 클래식 예시 */}
        <div className="bg-gradient-to-br from-teal-900/30 to-cyan-900/30 rounded-xl p-6 sm:p-8 mb-6 border border-teal-500/50">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-teal-400 flex items-center gap-2">
            <i className="ri-lightbulb-line"></i>
            클래식 예시:
          </h2>
          <div className="bg-slate-900/50 rounded-lg p-4 sm:p-6 border border-slate-700">
            <p className="text-base sm:text-lg text-white leading-relaxed">
              한 남자가 바다거북 수프를 한 수저 먹고 집에 가서 자살했다. 왜일까?
            </p>
          </div>
        </div>

        {/* 게임 진행 방식 */}
        <div className="bg-slate-800 rounded-xl p-6 sm:p-8 mb-6 border border-slate-700">
          <h2 className="text-xl sm:text-2xl font-bold mb-6 text-teal-400 flex items-center gap-2">
            <i className="ri-gamepad-line"></i>
            게임 진행 방식
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-teal-400 font-bold">1</span>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-white">문제 제시</h3>
                <p className="text-slate-300 text-sm sm:text-base">미스터리한 상황 제시</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-teal-400 font-bold">2</span>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-white">질문과 답변</h3>
                <p className="text-slate-300 text-sm sm:text-base">"예/아니오" 질문으로 추리</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-teal-400 font-bold">3</span>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-white">정답 확인</h3>
                <p className="text-slate-300 text-sm sm:text-base">사건의 진실을 밝혀내기</p>
              </div>
            </div>
          </div>
        </div>

        {/* 효과적인 질문법 */}
        <div className="bg-slate-800 rounded-xl p-6 sm:p-8 mb-6 border border-slate-700">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-teal-400 flex items-center gap-2">
            <i className="ri-question-line"></i>
            효과적인 질문법
          </h2>
          <p className="text-slate-300 mb-6">좋은 질문으로 빠르게 진실에 다가가세요!</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold mb-2 text-cyan-400">구체적 질문</h3>
              <p className="text-sm text-slate-400">"남자는 혼자였나요?"</p>
            </div>
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold mb-2 text-cyan-400">상황 파악</h3>
              <p className="text-sm text-slate-400">"사건이 실내에서 일어났나요?"</p>
            </div>
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold mb-2 text-cyan-400">가설 검증</h3>
              <p className="text-sm text-slate-400">"과거 경험과 관련이 있나요?"</p>
            </div>
          </div>

          <div className="bg-teal-500/10 rounded-lg p-4 border border-teal-500/30">
            <h3 className="font-semibold mb-3 text-teal-400">좋은 질문 예시:</h3>
            <ul className="space-y-2 text-sm sm:text-base text-slate-300">
              <li className="flex items-start">
                <i className="ri-checkbox-circle-fill text-teal-500 mr-2 mt-0.5 flex-shrink-0"></i>
                <span>수프의 맛이 문제였나요?</span>
              </li>
              <li className="flex items-start">
                <i className="ri-checkbox-circle-fill text-teal-500 mr-2 mt-0.5 flex-shrink-0"></i>
                <span>과거에 비슷한 경험이 있었나요?</span>
              </li>
              <li className="flex items-start">
                <i className="ri-checkbox-circle-fill text-teal-500 mr-2 mt-0.5 flex-shrink-0"></i>
                <span>다른 사람이 연관되어 있나요?</span>
              </li>
            </ul>
          </div>
        </div>

        {/* 좋은 문제 만들기 */}
        <div className="bg-slate-800 rounded-xl p-6 sm:p-8 mb-6 border border-slate-700">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-purple-400 flex items-center gap-2">
            <i className="ri-edit-box-line"></i>
            좋은 문제 만들기
          </h2>
          <p className="text-slate-300 mb-6">매력적인 미스터리 문제를 만드는 팁!</p>
          
          <div className="space-y-4">
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold mb-2 text-purple-400 flex items-center gap-2">
                <i className="ri-sparkling-line"></i>
                흥미로운 상황
              </h3>
              <p className="text-sm text-slate-300">호기심을 자극하는 설정</p>
            </div>
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold mb-2 text-purple-400 flex items-center gap-2">
                <i className="ri-scales-3-line"></i>
                적절한 정보량
              </h3>
              <p className="text-sm text-slate-300">너무 쉽지도 어렵지도 않게</p>
            </div>
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold mb-2 text-purple-400 flex items-center gap-2">
                <i className="ri-brain-line"></i>
                논리적 해답
              </h3>
              <p className="text-sm text-slate-300">추리로 풀 수 있는 답</p>
            </div>
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <h3 className="font-semibold mb-2 text-purple-400 flex items-center gap-2">
                <i className="ri-check-double-line"></i>
                명확한 결말
              </h3>
              <p className="text-sm text-slate-300">확실한 정답 제시</p>
            </div>
          </div>
        </div>

        {/* 시작하기 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/create-room" className="flex-1">
            <button className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-teal-500/50">
              <i className="ri-add-circle-line mr-2"></i>
              게임 시작하기
            </button>
          </Link>
          <Link href="/create-problem" className="flex-1">
            <button className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-purple-500/50">
              <i className="ri-edit-box-line mr-2"></i>
              문제 만들기
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

