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
        ? '로그인 없이도 문제 목록 보기, 문제 읽기, 오프라인 모드로 AI와 추리하기 등 핵심 기능을 이용할 수 있습니다. 다만 멀티플레이어 모드(방 만들기, 방 참여), 문제 생성, 댓글 작성, 맞추기 게임 세트 만들기 등은 로그인이 필요합니다. 먼저 오프라인으로 게임을 체험해 보시고, 친구들과 함께 플레이하거나 자신만의 문제를 만들고 싶다면 가입 후 이용하시면 됩니다.'
        : 'You can use core features like viewing problem lists, reading problems, and playing offline with AI without logging in. However, multiplayer mode (creating/joining rooms), problem creation, comment writing, and creating guess game sets require login. Try the game offline first, then sign up if you want to play with friends or create your own problems.',
    },
    {
      question: isKo ? '방 코드는 어떻게 공유하나요?' : 'How do I share a room code?',
      answer: isKo
        ? '방을 만들면 6자리 영문·숫자로 된 고유한 방 코드가 생성됩니다. 이 코드를 카카오톡, 디스코드, 문자 등으로 다른 플레이어들에게 공유하면 같은 방에 참여할 수 있습니다. 방 코드는 방 생성 시 화면에 표시되며, 참여하기 메뉴에서 "방 코드로 참여"를 선택한 뒤 코드를 입력하면 됩니다. 비공개 방의 경우 비밀번호도 함께 공유해야 합니다.'
        : 'When you create a room, a unique 6-character alphanumeric room code is generated. Share this code via KakaoTalk, Discord, text message, etc. so other players can join the same room. The room code is displayed when the room is created. To join, select "Join with room code" in the Join menu and enter the code. For private rooms, share the password as well.',
    },
    {
      question: isKo ? '문제를 만들고 싶어요. 어떻게 하나요?' : 'I want to create a problem. How do I do it?',
      answer: isKo
        ? '로그인 후 상단 메뉴의 "문제 만들기" 또는 문제 목록 페이지의 "문제 만들기" 버튼을 클릭하세요. 문제 제목(짧은 상황 설명), 내용(스토리 본문), 정답을 입력하고, 선택적으로 힌트 3개까지 추가할 수 있습니다. 좋은 바다거북스프 문제는 "착각"을 중심으로 설계됩니다. 공간·대상·시간에 대한 착각을 유도하고, 모든 정보가 예/아니오 질문으로 밝혀질 수 있는 구조인지 확인하세요. 저장 후 다른 플레이어들이 플레이할 수 있습니다.'
        : 'After logging in, click "Create Problem" in the top menu or on the problem list page. Enter the problem title (short situation), content (story), and answer. You can optionally add up to 3 hints. Good Turtle Soup problems are designed around "misconceptions"—induce misconceptions about space, subject, or time, and ensure all information can be revealed through yes/no questions. After saving, other players can play it.',
    },
    {
      question: isKo ? '랭킹은 어떻게 결정되나요?' : 'How is the ranking determined?',
      answer: isKo
        ? '랭킹은 크게 두 가지로 나뉩니다. 문제 해결 랭킹은 정답을 맞춘 문제 수를 기준으로, 좋아요 랭킹은 자신이 만든 문제에 받은 좋아요 수를 기준으로 결정됩니다. 더 많은 문제를 해결하고 좋아요를 받을수록 높은 순위를 기록합니다. 출석체크, 문제 해결, 댓글 작성 등 다양한 활동으로 경험치를 쌓으면 레벨이 올라가며, 랭킹 페이지에서 자신의 순위와 다른 플레이어들과의 비교를 확인할 수 있습니다.'
        : 'Rankings are divided into two main types. Problem-solving ranking is based on the number of problems solved correctly, and like ranking is based on the number of likes received on problems you created. The more problems you solve and likes you receive, the higher your rank. Earn experience through check-ins, solving problems, writing comments, etc. to level up. Check your rank and compare with other players on the ranking page.',
    },
    {
      question: isKo ? '게임이 작동하지 않아요. 어떻게 해야 하나요?' : 'The game is not working. What should I do?',
      answer: isKo
        ? '먼저 브라우저를 새로고침하거나 캐시를 삭제한 후 다시 시도해 보세요. Chrome, Safari, Firefox 등 최신 브라우저 사용을 권장합니다. 네트워크 연결이 불안정하면 실시간 멀티플레이어 모드에서 끊김이 발생할 수 있습니다. AI 답변이 느리다면 첫 질문 시 모델 로딩 시간이 소요될 수 있으니 잠시 기다려 보세요. 문제가 지속되면 문의하기 페이지를 통해 발생 상황, 사용 환경, 스크린샷을 포함하여 문의해 주시면 빠르게 확인하겠습니다.'
        : 'First, try refreshing your browser or clearing the cache. We recommend using the latest Chrome, Safari, or Firefox. Unstable network connections may cause disconnections in real-time multiplayer mode. If AI answers are slow, the model may be loading on the first question—please wait a moment. If the problem persists, contact us through the contact page with the situation, your environment, and screenshots for quick resolution.',
    },
    {
      question: isKo ? '계정을 삭제하고 싶어요.' : 'I want to delete my account.',
      answer: isKo
        ? '계정 삭제를 원하시면 문의하기 페이지를 통해 이메일로 문의해 주세요. 개인정보처리방침에 따라 요청을 확인한 후 14일 이내에 처리해 드립니다. 삭제 시 작성한 문제, 댓글, 게시글 등 관련 데이터가 함께 삭제되며, 복구가 불가능합니다. 프로필 페이지의 설정 메뉴에서 일부 데이터를 직접 삭제할 수도 있습니다.'
        : 'If you wish to delete your account, please contact us by email through the contact page. We will process your request within 14 days in accordance with our Privacy Policy. Upon deletion, related data such as problems, comments, and posts will be deleted and cannot be recovered. You can also delete some data directly in the profile settings.',
    },
    {
      question: isKo ? '버그를 발견했어요. 어떻게 신고하나요?' : 'I found a bug. How do I report it?',
      answer: isKo
        ? '버그를 발견하셨다면 문의하기 페이지를 통해 신고해 주세요. 가능한 한 자세한 설명(어떤 동작을 했을 때, 어떤 결과가 나왔는지), 스크린샷 또는 화면 녹화, 사용 중인 브라우저와 기기 정보를 포함하면 빠르게 확인하고 수정할 수 있습니다. AI 답변 오류의 경우 문제 상세 페이지의 "오류 리포트" 버튼으로 질문·답변·기대한 답변을 직접 제출할 수 있으며, 이는 AI 학습에 활용됩니다.'
        : 'If you find a bug, please report it through the contact page. Include as much detail as possible (what action you took, what result occurred), screenshots or screen recordings, and your browser and device info for quick identification and fixes. For AI answer errors, you can submit the question, answer, and expected answer directly via the "Error Report" button on the problem detail page—this is used for AI learning.',
    },
    {
      question: isKo ? '모바일에서도 플레이할 수 있나요?' : 'Can I play on mobile?',
      answer: isKo
        ? '네, 모바일 브라우저(Chrome, Safari, Safari iOS 등)에서 플레이할 수 있습니다. 반응형 디자인으로 모바일과 데스크톱 모두에서 최적화된 경험을 제공합니다. 터치 인터페이스로 질문 입력, 정답 제출, 카드 넘기기 등이 편리하게 동작합니다. 오프라인 모드, 맞추기 게임, 멀티플레이어 방 참여 모두 모바일에서 이용 가능합니다. 가로·세로 모드 모두 지원합니다.'
        : 'Yes, you can play on mobile browsers (Chrome, Safari, Safari iOS, etc.). Responsive design provides an optimized experience on both mobile and desktop. Touch interface makes question input, answer submission, and card flipping convenient. Offline mode, guess games, and multiplayer room joining are all available on mobile. Both portrait and landscape modes are supported.',
    },
    {
      question: isKo ? '게임 데이터는 어디에 저장되나요?' : 'Where is game data stored?',
      answer: isKo
        ? '게임 데이터는 Supabase 클라우드 데이터베이스에 암호화되어 안전하게 저장됩니다. 문제, 댓글, 사용자 정보, 플레이 기록 등이 포함됩니다. 데이터는 AWS 인프라를 기반으로 한 Supabase의 데이터베이스에 저장되며, 정기적인 백업이 수행됩니다. 개인정보 수집 항목, 보관 기간, 이용 목적 등 자세한 내용은 개인정보처리방침에서 확인할 수 있습니다.'
        : 'Game data is securely stored encrypted in Supabase cloud database. This includes problems, comments, user information, and play records. Data is stored in Supabase database on AWS infrastructure with regular backups. For details on data collection, retention, and use, see our Privacy Policy.',
    },
    {
      question: isKo ? '무료로 사용할 수 있나요?' : 'Is it free to use?',
      answer: isKo
        ? '네, 바다거북스프는 완전 무료로 사용할 수 있습니다. 문제 풀기, 방 만들기, 문제 생성, 맞추기 게임, 커뮤니티 등 모든 기능을 추가 비용 없이 이용하실 수 있습니다. 향후 유료 기능이 추가될 경우 기존 무료 기능은 그대로 유지됩니다.'
        : 'Yes, Pelican Soup Riddle is completely free to use. All features—solving problems, creating rooms, creating problems, guess games, community—are available at no additional cost. If paid features are added in the future, existing free features will remain unchanged.',
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

