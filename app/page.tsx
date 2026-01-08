'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Home() {
  const [roomCode, setRoomCode] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-md">
        <div className="text-center mb-8 sm:mb-12 pt-6 sm:pt-8">
          <div className="mb-4 sm:mb-6">
            <i className="ri-question-line text-5xl sm:text-6xl text-teal-400"></i>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 sm:mb-3 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            바다거북스프
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">
            추리와 질문으로 진실을 밝혀내는 게임
          </p>
        </div>

        <div className="space-y-4">
          <Link href="/create-room">
            <button className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-teal-500/50 whitespace-nowrap">
              <i className="ri-add-circle-line mr-2"></i>
              새 방 만들기
            </button>
          </Link>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-slate-900 text-slate-500">또는</span>
            </div>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="방 코드 입력"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-center text-lg tracking-wider"
              maxLength={6}
            />
            <Link href={roomCode ? `/room/${roomCode}` : '#'}>
              <button 
                disabled={!roomCode}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <i className="ri-login-box-line mr-2"></i>
                방 참여하기
              </button>
            </Link>
          </div>
        </div>

        <div className="mt-12 sm:mt-16 bg-slate-800/50 rounded-xl p-4 sm:p-6 border border-slate-700">
          <h3 className="font-semibold mb-3 text-teal-400 flex items-center text-sm sm:text-base">
            <i className="ri-information-line mr-2"></i>
            게임 방법
          </h3>
          <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
            <li className="flex items-start">
              <i className="ri-checkbox-circle-fill text-teal-500 mr-2 mt-0.5 flex-shrink-0"></i>
              <span>관리자는 이야기의 진실을 알고 있습니다</span>
            </li>
            <li className="flex items-start">
              <i className="ri-checkbox-circle-fill text-teal-500 mr-2 mt-0.5 flex-shrink-0"></i>
              <span>참여자는 질문을 통해 진실을 추리합니다</span>
            </li>
            <li className="flex items-start">
              <i className="ri-checkbox-circle-fill text-teal-500 mr-2 mt-0.5 flex-shrink-0"></i>
              <span>관리자는 예/아니오/상관없음으로만 답합니다</span>
            </li>
            <li className="flex items-start">
              <i className="ri-checkbox-circle-fill text-teal-500 mr-2 mt-0.5 flex-shrink-0"></i>
              <span>정답을 맞추면 진실이 공개됩니다</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
