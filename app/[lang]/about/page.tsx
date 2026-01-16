import type { Metadata } from 'next';
import { getMessages, type Locale, isValidLocale, defaultLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = isValidLocale(lang) ? lang : defaultLocale;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';
  const baseUrl = `${siteUrl}/${locale}/about`;

  return {
    title: locale === 'ko' ? '사이트 소개' : 'About Us',
    description: locale === 'ko'
      ? '바다거북스프 게임에 대해 알아보세요. 추리와 질문으로 진실을 밝혀내는 온라인 멀티플레이어 게임입니다.'
      : 'Learn about Pelican Soup Riddle. An online multiplayer game where you uncover the truth through deduction and questions.',
    alternates: {
      canonical: baseUrl,
      languages: {
        ko: `${siteUrl}/ko/about`,
        en: `${siteUrl}/en/about`,
      },
    },
    openGraph: {
      title: locale === 'ko' ? '사이트 소개' : 'About Us',
      description: locale === 'ko'
        ? '바다거북스프 게임 소개'
        : 'About Pelican Soup Riddle',
      url: baseUrl,
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
    },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isValidLocale(lang)) {
    notFound();
  }
  const locale = lang as Locale;
  const isKo = locale === 'ko';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-4xl">
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 lg:p-10 border border-slate-700 shadow-xl">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            {isKo ? '바다거북스프 소개' : 'About Pelican Soup Riddle'}
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            {isKo ? '추리와 질문으로 진실을 밝혀내는 온라인 게임' : 'An online game where you uncover the truth through deduction and questions'}
          </p>

          <div className="prose prose-invert max-w-none space-y-8 text-slate-300">
            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '게임 소개' : 'Game Introduction'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '바다거북스프는 추리와 질문을 통해 진실을 밝혀내는 온라인 멀티플레이어 추리 게임입니다. 한 명의 호스트가 이야기와 진실을 설정하고, 다른 플레이어들은 예/아니오/상관없음으로 답변 가능한 질문을 통해 진실을 추리합니다.'
                  : 'Pelican Soup Riddle is an online multiplayer deduction game where you uncover the truth through deduction and questions. One host sets up a story and truth, and other players deduce the truth through questions that can be answered with yes/no/irrelevant.'}
              </p>
              <p>
                {isKo
                  ? '게임은 실시간으로 진행되며, 플레이어들은 서로 질문하고 답변하며 협력하여 진실을 찾아냅니다. 문제를 해결하거나 새로운 문제를 만들어 공유할 수 있으며, 랭킹 시스템을 통해 자신의 실력을 확인할 수 있습니다.'
                  : 'The game proceeds in real-time, and players ask and answer questions to each other and cooperate to find the truth. You can solve problems or create and share new problems, and check your skills through the ranking system.'}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '주요 기능' : 'Key Features'}
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <h3 className="text-xl font-semibold text-teal-300 mb-2">
                    <i className="ri-group-line mr-2"></i>
                    {isKo ? '멀티플레이어' : 'Multiplayer'}
                  </h3>
                  <p className="text-sm">
                    {isKo
                      ? '친구들과 함께 실시간으로 게임을 즐길 수 있습니다. 방을 만들거나 참여하여 함께 추리하세요.'
                      : 'Play games in real-time with friends. Create or join rooms to solve mysteries together.'}
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <h3 className="text-xl font-semibold text-teal-300 mb-2">
                    <i className="ri-question-answer-line mr-2"></i>
                    {isKo ? '문제 생성' : 'Problem Creation'}
                  </h3>
                  <p className="text-sm">
                    {isKo
                      ? '자신만의 추리 문제를 만들어 다른 플레이어들과 공유할 수 있습니다.'
                      : 'Create your own deduction problems and share them with other players.'}
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <h3 className="text-xl font-semibold text-teal-300 mb-2">
                    <i className="ri-trophy-line mr-2"></i>
                    {isKo ? '랭킹 시스템' : 'Ranking System'}
                  </h3>
                  <p className="text-sm">
                    {isKo
                      ? '문제 해결 수와 좋아요 수를 기반으로 랭킹을 확인할 수 있습니다.'
                      : 'Check rankings based on the number of problems solved and likes received.'}
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <h3 className="text-xl font-semibold text-teal-300 mb-2">
                    <i className="ri-community-line mr-2"></i>
                    {isKo ? '커뮤니티' : 'Community'}
                  </h3>
                  <p className="text-sm">
                    {isKo
                      ? '다른 플레이어들과 댓글을 주고받으며 소통할 수 있습니다.'
                      : 'Communicate with other players through comments and discussions.'}
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '게임 방법' : 'How to Play'}
              </h2>
              <ol className="list-decimal pl-6 space-y-3">
                <li>
                  {isKo
                    ? '멀티플레이어 모드: 호스트가 방을 만들고 이야기와 진실을 설정합니다. 다른 플레이어들은 방 코드로 참여하여 질문을 통해 진실을 추리합니다.'
                    : 'Multiplayer mode: The host creates a room and sets up a story and truth. Other players join with a room code and deduce the truth through questions.'}
                </li>
                <li>
                  {isKo
                    ? '오프라인 모드: 문제 목록에서 원하는 문제를 선택하여 혼자서 추리할 수 있습니다.'
                    : 'Offline mode: Choose a problem from the problem list to solve on your own.'}
                </li>
                <li>
                  {isKo
                    ? '문제 생성: 자신만의 추리 문제를 만들어 다른 플레이어들과 공유할 수 있습니다.'
                    : 'Problem creation: Create your own deduction problems and share them with other players.'}
                </li>
              </ol>
              <div className="mt-4">
                <Link
                  href={`/${locale}/guide`}
                  className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 transition-colors"
                >
                  <i className="ri-book-open-line"></i>
                  <span>{isKo ? '자세한 게임 가이드 보기' : 'View detailed game guide'}</span>
                  <i className="ri-arrow-right-line"></i>
                </Link>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '서비스 정보' : 'Service Information'}
              </h2>
              <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
                <div>
                  <strong className="text-teal-300">{isKo ? '서비스명' : 'Service Name'}:</strong>{' '}
                  <span>{isKo ? '바다거북스프' : 'Pelican Soup Riddle'}</span>
                </div>
                <div>
                  <strong className="text-teal-300">{isKo ? '서비스 유형' : 'Service Type'}:</strong>{' '}
                  <span>{isKo ? '온라인 멀티플레이어 추리 게임' : 'Online multiplayer deduction game'}</span>
                </div>
                <div>
                  <strong className="text-teal-300">{isKo ? '플랫폼' : 'Platform'}:</strong>{' '}
                  <span>{isKo ? '웹 브라우저 (모바일/데스크톱)' : 'Web browser (mobile/desktop)'}</span>
                </div>
                <div>
                  <strong className="text-teal-300">{isKo ? '지원 언어' : 'Supported Languages'}:</strong>{' '}
                  <span>한국어, English</span>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '문의 및 지원' : 'Contact and Support'}
              </h2>
              <p className="mb-4">
                {isKo
                  ? '게임 이용 중 문제가 발생하거나 문의사항이 있으시면 언제든지 문의해 주세요.'
                  : 'If you encounter any problems while using the game or have any inquiries, please feel free to contact us.'}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/${locale}/contact`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500/20 text-teal-400 border border-teal-500/50 rounded-lg hover:bg-teal-500/30 transition-colors"
                >
                  <i className="ri-mail-line"></i>
                  <span>{isKo ? '문의하기' : 'Contact Us'}</span>
                </Link>
                <Link
                  href={`/${locale}/guide`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 text-purple-400 border border-purple-500/50 rounded-lg hover:bg-purple-500/30 transition-colors"
                >
                  <i className="ri-book-open-line"></i>
                  <span>{isKo ? '게임 가이드' : 'Game Guide'}</span>
                </Link>
                <Link
                  href={`/${locale}/community-guidelines`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/50 rounded-lg hover:bg-blue-500/30 transition-colors"
                >
                  <i className="ri-shield-check-line"></i>
                  <span>{isKo ? '커뮤니티 가이드라인' : 'Community Guidelines'}</span>
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

