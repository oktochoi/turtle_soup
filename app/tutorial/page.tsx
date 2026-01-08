'use client';

import Link from 'next/link';

export default function TutorialPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-5xl">
        {/* 히어로 섹션 */}
        <div className="text-center mb-12">
          <div className="inline-block mb-6">
            <div className="text-6xl sm:text-8xl mb-4 animate-bounce">🐢</div>
            <div className="text-4xl sm:text-6xl font-black bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
              바다거북스프
            </div>
          </div>
          <p className="text-xl sm:text-2xl text-slate-300 font-light">
            예/아니오로 풀어가는 추리 게임의 정석
          </p>
        </div>

        {/* 소개 섹션 */}
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-2xl p-8 sm:p-10 mb-8 border border-slate-700/50 shadow-2xl">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
              <i className="ri-question-answer-line text-3xl text-white"></i>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                바다거북스프란?
              </h2>
              <p className="text-lg sm:text-xl text-slate-300 leading-relaxed">
                호스트가 제시한 <span className="text-teal-400 font-semibold">미스터리한 상황</span>을 
                <span className="text-cyan-400 font-semibold"> "예/아니오" 질문</span>만으로 추리하여 
                <span className="text-blue-400 font-semibold"> 진실을 밝혀내는</span> 두뇌 게임입니다.
              </p>
            </div>
          </div>
        </div>

        {/* 클래식 예시 */}
        <div className="bg-gradient-to-br from-teal-900/40 via-cyan-900/40 to-blue-900/40 rounded-2xl p-8 sm:p-10 mb-8 border border-teal-500/30 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center">
                <i className="ri-lightbulb-flash-line text-2xl text-teal-400"></i>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-teal-400">
                클래식 예시
              </h2>
            </div>
            <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl p-6 sm:p-8 border border-slate-700/50 shadow-inner">
              <div className="flex items-start gap-4">
                <div className="text-4xl flex-shrink-0">💭</div>
                <div className="flex-1">
                  <p className="text-lg sm:text-xl text-white leading-relaxed font-medium mb-3">
                    한 남자가 바다거북 수프를 한 수저 먹고 집에 가서 자살했다.
                  </p>
                  <p className="text-base sm:text-lg text-slate-400 italic">
                    왜일까요?
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 p-4 bg-teal-500/10 rounded-lg border border-teal-500/30">
              <p className="text-sm text-teal-300">
                💡 <span className="font-semibold">힌트:</span> 수프의 맛이나 독이 문제가 아닙니다. 
                남자의 과거와 관련이 있을까요?
              </p>
            </div>
          </div>
        </div>

        {/* 게임 진행 방식 */}
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-2xl p-8 sm:p-10 mb-8 border border-slate-700/50 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
              <i className="ri-gamepad-line text-2xl text-white"></i>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              게임 진행 방식
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-teal-900/30 to-cyan-900/30 rounded-xl p-6 border border-teal-500/30 hover:border-teal-500/60 transition-all hover:shadow-lg hover:shadow-teal-500/20">
              <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <span className="text-2xl font-black text-white">1</span>
              </div>
              <h3 className="font-bold text-lg mb-2 text-teal-400">문제 제시</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                호스트가 미스터리한 상황을 제시합니다. 표면적으로는 설명되지 않는 이상한 사건이 벌어집니다.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-xl p-6 border border-purple-500/30 hover:border-purple-500/60 transition-all hover:shadow-lg hover:shadow-purple-500/20">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <span className="text-2xl font-black text-white">2</span>
              </div>
              <h3 className="font-bold text-lg mb-2 text-purple-400">질문과 답변</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                플레이어들은 "예/아니오"로만 답변 가능한 질문을 통해 단서를 수집하고 추리를 진행합니다.
              </p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 rounded-xl p-6 border border-blue-500/30 hover:border-blue-500/60 transition-all hover:shadow-lg hover:shadow-blue-500/20">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                <span className="text-2xl font-black text-white">3</span>
              </div>
              <h3 className="font-bold text-lg mb-2 text-blue-400">정답 확인</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                충분한 단서를 모았다고 생각하면 정답을 추측하고, 호스트가 진실을 공개합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 효과적인 질문법 */}
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-2xl p-8 sm:p-10 mb-8 border border-slate-700/50 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
              <i className="ri-question-line text-2xl text-white"></i>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              효과적인 질문법
            </h2>
          </div>
          
          <p className="text-slate-300 mb-8 text-lg">
            좋은 질문은 추리의 속도를 결정합니다! 전략적으로 질문하세요.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-cyan-900/30 to-teal-900/30 rounded-xl p-6 border border-cyan-500/30 hover:scale-105 transition-transform">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg flex items-center justify-center mb-4">
                <i className="ri-focus-3-line text-2xl text-white"></i>
              </div>
              <h3 className="font-bold text-lg mb-3 text-cyan-400">구체적 질문</h3>
              <p className="text-sm text-slate-300 mb-3">애매한 질문보다 명확한 질문이 효과적입니다.</p>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                <p className="text-xs text-slate-400 italic">"남자는 혼자였나요?"</p>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-xl p-6 border border-purple-500/30 hover:scale-105 transition-transform">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mb-4">
                <i className="ri-map-pin-line text-2xl text-white"></i>
              </div>
              <h3 className="font-bold text-lg mb-3 text-purple-400">상황 파악</h3>
              <p className="text-sm text-slate-300 mb-3">시간, 장소, 인물 등 기본 정보부터 확인하세요.</p>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                <p className="text-xs text-slate-400 italic">"사건이 실내에서 일어났나요?"</p>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 rounded-xl p-6 border border-orange-500/30 hover:scale-105 transition-transform">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center mb-4">
                <i className="ri-lightbulb-flash-line text-2xl text-white"></i>
              </div>
              <h3 className="font-bold text-lg mb-3 text-orange-400">가설 검증</h3>
              <p className="text-sm text-slate-300 mb-3">생각한 가설을 질문으로 검증해보세요.</p>
              <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                <p className="text-xs text-slate-400 italic">"과거 경험과 관련이 있나요?"</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-teal-500/10 to-cyan-500/10 rounded-xl p-6 border border-teal-500/30">
            <h3 className="font-bold text-lg mb-4 text-teal-400 flex items-center gap-2">
              <i className="ri-star-line"></i>
              좋은 질문 예시
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                '수프의 맛이 문제였나요?',
                '과거에 비슷한 경험이 있었나요?',
                '다른 사람이 연관되어 있나요?',
                '시간적 순서가 중요한가요?',
                '물리적 법칙과 관련이 있나요?',
                '심리적 요인이 작용했나요?'
              ].map((question, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <i className="ri-checkbox-circle-fill text-teal-500 mt-0.5 flex-shrink-0"></i>
                  <span className="text-sm text-slate-300">{question}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 좋은 문제 만들기 */}
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-2xl p-8 sm:p-10 mb-8 border border-slate-700/50 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl flex items-center justify-center shadow-lg">
              <i className="ri-edit-box-line text-2xl text-white"></i>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
              좋은 문제 만들기
            </h2>
          </div>
          
          <p className="text-slate-300 mb-8 text-lg">
            매력적인 미스터리 문제를 만드는 핵심 포인트를 알아보세요!
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: 'ri-sparkling-2-line',
                title: '흥미로운 상황',
                desc: '호기심을 자극하는 독특하고 신비로운 설정을 만드세요. 평범한 일상에 작은 이상함을 더하면 완벽합니다.',
                color: 'from-pink-500 to-rose-500'
              },
              {
                icon: 'ri-scales-3-line',
                title: '적절한 정보량',
                desc: '너무 많은 정보는 쉬워지고, 너무 적은 정보는 불가능해집니다. 추리로 풀 수 있는 선에서 정보를 조절하세요.',
                color: 'from-purple-500 to-indigo-500'
              },
              {
                icon: 'ri-brain-line',
                title: '논리적 해답',
                desc: '정답은 반드시 논리적으로 설명 가능해야 합니다. 우연이나 마법보다는 인과관계가 명확한 답이 좋습니다.',
                color: 'from-blue-500 to-cyan-500'
              },
              {
                icon: 'ri-check-double-line',
                title: '명확한 결말',
                desc: '정답을 확인했을 때 "아하!" 하는 깨달음이 있어야 합니다. 모든 단서가 하나의 답으로 수렴해야 합니다.',
                color: 'from-teal-500 to-emerald-500'
              }
            ].map((tip, idx) => (
              <div key={idx} className="bg-gradient-to-br from-slate-900/50 to-slate-800/50 rounded-xl p-6 border border-slate-700/50 hover:border-slate-600 transition-all">
                <div className={`w-12 h-12 bg-gradient-to-br ${tip.color} rounded-lg flex items-center justify-center mb-4 shadow-lg`}>
                  <i className={`${tip.icon} text-2xl text-white`}></i>
                </div>
                <h3 className="font-bold text-lg mb-3 text-white">{tip.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{tip.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 팁 섹션 */}
        <div className="bg-gradient-to-br from-amber-900/20 via-orange-900/20 to-red-900/20 rounded-2xl p-8 sm:p-10 mb-8 border border-amber-500/30 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="text-4xl">💡</div>
            <h2 className="text-2xl sm:text-3xl font-bold text-amber-400">
              프로 팁
            </h2>
          </div>
          <div className="space-y-4">
            {[
              '질문은 한 번에 하나씩! 여러 정보를 묻는 복합 질문은 피하세요.',
              '호스트의 답변을 잘 듣고, 그 안에 숨겨진 힌트를 찾아보세요.',
              '명백히 틀린 가설도 질문으로 검증하면 유용한 정보가 됩니다.',
              '다른 플레이어의 질문과 답변도 주의 깊게 관찰하세요.',
              '막힐 때는 관점을 바꿔보세요. 시간, 공간, 인물, 동기 등 다양한 각도에서 접근하세요.'
            ].map((tip, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-6 h-6 bg-amber-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-amber-400 text-xs font-bold">{idx + 1}</span>
                </div>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 시작하기 버튼 */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/create-room" className="flex-1 group">
            <button className="w-full bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 hover:from-teal-600 hover:via-cyan-600 hover:to-blue-600 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-teal-500/50 transform hover:scale-105">
              <i className="ri-gamepad-line mr-2"></i>
              멀티플레이 게임 시작
            </button>
          </Link>
          <Link href="/problems" className="flex-1 group">
            <button className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 hover:from-purple-600 hover:via-pink-600 hover:to-rose-600 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-purple-500/50 transform hover:scale-105">
              <i className="ri-play-line mr-2"></i>
              오프라인 게임 시작
            </button>
          </Link>
          <Link href="/create-problem" className="flex-1 group">
            <button className="w-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 hover:from-orange-600 hover:via-red-600 hover:to-pink-600 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-orange-500/50 transform hover:scale-105">
              <i className="ri-edit-box-line mr-2"></i>
              문제 만들기
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
