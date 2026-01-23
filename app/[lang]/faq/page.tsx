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
  const baseUrl = `${siteUrl}/${locale}/faq`;

  return {
    title: locale === 'ko' ? '자주 묻는 질문' : 'FAQ',
    description: locale === 'ko'
      ? '바다거북스프 게임에 대한 자주 묻는 질문과 답변을 확인하세요.'
      : 'Check frequently asked questions and answers about Pelican Soup Riddle.',
    alternates: {
      canonical: baseUrl,
      languages: {
        ko: `${siteUrl}/ko/faq`,
        en: `${siteUrl}/en/faq`,
      },
    },
    openGraph: {
      title: locale === 'ko' ? '자주 묻는 질문' : 'FAQ',
      description: locale === 'ko'
        ? '바다거북스프 FAQ'
        : 'Pelican Soup Riddle FAQ',
      url: baseUrl,
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
    },
  };
}

export default async function FAQPage({
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

  const faqs = [
    {
      question: isKo ? '게임을 시작하려면 로그인이 필요한가요?' : 'Do I need to log in to start playing?',
      answer: isKo
        ? '멀티플레이어 모드나 문제 생성, 댓글 작성 등 일부 기능은 로그인이 필요합니다. 하지만 문제 목록 보기, 문제 읽기 등은 로그인 없이도 가능합니다.'
        : 'Some features like multiplayer mode, problem creation, and comment writing require login. However, viewing problem lists and reading problems are available without login.',
    },
    {
      question: isKo ? '방 코드는 어떻게 공유하나요?' : 'How do I share a room code?',
      answer: isKo
        ? '방을 만들면 고유한 방 코드가 생성됩니다. 이 코드를 다른 플레이어들에게 공유하면 같은 방에 참여할 수 있습니다.'
        : 'When you create a room, a unique room code is generated. Share this code with other players to join the same room.',
    },
    {
      question: isKo ? '문제를 만들고 싶어요. 어떻게 하나요?' : 'I want to create a problem. How do I do it?',
      answer: isKo
        ? '로그인 후 "문제 만들기" 메뉴에서 자신만의 추리 문제를 만들 수 있습니다. 문제 제목, 내용, 정답을 입력하고 공유할 수 있습니다.'
        : 'After logging in, you can create your own deduction problem from the "Create Problem" menu. Enter the problem title, content, and answer, and share it.',
    },
    {
      question: isKo ? '랭킹은 어떻게 결정되나요?' : 'How is the ranking determined?',
      answer: isKo
        ? '랭킹은 문제 해결 수와 받은 좋아요 수를 기반으로 결정됩니다. 더 많은 문제를 해결하고 좋아요를 받을수록 높은 순위를 기록할 수 있습니다.'
        : 'Rankings are determined based on the number of problems solved and likes received. The more problems you solve and likes you receive, the higher your rank.',
    },
    {
      question: isKo ? '게임이 작동하지 않아요. 어떻게 해야 하나요?' : 'The game is not working. What should I do?',
      answer: isKo
        ? '브라우저를 새로고침하거나 캐시를 삭제한 후 다시 시도해 보세요. 문제가 지속되면 문의하기 페이지를 통해 문의해 주세요.'
        : 'Try refreshing your browser or clearing the cache. If the problem persists, please contact us through the contact page.',
    },
    {
      question: isKo ? '계정을 삭제하고 싶어요.' : 'I want to delete my account.',
      answer: isKo
        ? '계정 삭제를 원하시면 문의하기 페이지를 통해 이메일로 문의해 주세요. 개인정보처리방침에 따라 처리해 드리겠습니다.'
        : 'If you wish to delete your account, please contact us by email through the contact page. We will process it according to our Privacy Policy.',
    },
    {
      question: isKo ? '버그를 발견했어요. 어떻게 신고하나요?' : 'I found a bug. How do I report it?',
      answer: isKo
        ? '버그를 발견하셨다면 문의하기 페이지를 통해 가능한 한 자세한 설명과 스크린샷을 포함하여 신고해 주세요. 빠르게 확인하고 수정하겠습니다.'
        : 'If you find a bug, please report it through the contact page with as detailed a description as possible and screenshots. We will check and fix it quickly.',
    },
    {
      question: isKo ? '모바일에서도 플레이할 수 있나요?' : 'Can I play on mobile?',
      answer: isKo
        ? '네, 모바일 브라우저에서도 플레이할 수 있습니다. 반응형 디자인으로 모바일과 데스크톱 모두에서 최적화된 경험을 제공합니다.'
        : 'Yes, you can play on mobile browsers. Responsive design provides an optimized experience on both mobile and desktop.',
    },
    {
      question: isKo ? '게임 데이터는 어디에 저장되나요?' : 'Where is game data stored?',
      answer: isKo
        ? '게임 데이터는 Supabase 클라우드 데이터베이스에 안전하게 저장됩니다. 개인정보처리방침에서 자세한 내용을 확인할 수 있습니다.'
        : 'Game data is securely stored in Supabase cloud database. You can find more details in our Privacy Policy.',
    },
    {
      question: isKo ? '무료로 사용할 수 있나요?' : 'Is it free to use?',
      answer: isKo
        ? '네, 바다거북스프는 완전 무료로 사용할 수 있습니다. 추가 비용 없이 모든 기능을 이용하실 수 있습니다.'
        : 'Yes, Pelican Soup Riddle is completely free to use. You can use all features without any additional costs.',
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-4xl">
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 lg:p-10 border border-slate-700 shadow-xl">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            {isKo ? '자주 묻는 질문' : 'Frequently Asked Questions'}
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            {isKo ? '게임 이용 중 궁금한 점을 확인하세요' : 'Find answers to your questions about using the game'}
          </p>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-slate-900/50 rounded-lg p-5 border border-slate-700/50 hover:border-teal-500/50 transition-colors"
              >
                <h2 className="text-xl font-semibold text-teal-300 mb-3 flex items-start">
                  <span className="mr-2 text-teal-400">Q{index + 1}.</span>
                  {faq.question}
                </h2>
                <p className="text-slate-300 leading-relaxed pl-8">{faq.answer}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 bg-teal-500/10 border border-teal-500/30 rounded-lg">
            <p className="text-slate-300 mb-3">
              {isKo
                ? '더 궁금한 점이 있으신가요? 문의하기 페이지를 통해 질문해 주세요.'
                : 'Have more questions? Please ask through the contact page.'}
            </p>
            <Link
              href={`/${locale}/contact`}
              className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 transition-colors font-semibold"
            >
              <i className="ri-mail-line"></i>
              <span>{isKo ? '문의하기' : 'Contact Us'}</span>
              <i className="ri-arrow-right-line"></i>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

