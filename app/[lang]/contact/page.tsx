import type { Metadata } from 'next';
import { getMessages, type Locale, isValidLocale, defaultLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';
import ContactForm from './ContactForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = isValidLocale(lang) ? lang : defaultLocale;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';
  const baseUrl = `${siteUrl}/${locale}/contact`;

  return {
    title: locale === 'ko' ? '문의하기' : 'Contact Us',
    description: locale === 'ko'
      ? '바다거북스프 게임에 대한 문의사항을 보내주세요. 빠르게 답변드리겠습니다.'
      : 'Send us your inquiries about Pelican Soup Riddle. We will respond quickly.',
    alternates: {
      canonical: baseUrl,
      languages: {
        ko: `${siteUrl}/ko/contact`,
        en: `${siteUrl}/en/contact`,
      },
    },
    openGraph: {
      title: locale === 'ko' ? '문의하기' : 'Contact Us',
      description: locale === 'ko'
        ? '바다거북스프 문의하기'
        : 'Contact Pelican Soup Riddle',
      url: baseUrl,
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
    },
  };
}

export default async function ContactPage({
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
  const contactEmail = 'okto0914@gmail.com';

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-4xl">
        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 lg:p-10 border border-slate-700 shadow-xl">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            {isKo ? '문의하기' : 'Contact Us'}
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            {isKo
              ? '게임 이용 중 문제가 발생하거나 문의사항이 있으시면 언제든지 연락해 주세요.'
              : 'If you encounter any problems while using the game or have any inquiries, please feel free to contact us.'}
          </p>

          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                <i className="ri-mail-line mr-2"></i>
                {isKo ? '이메일 문의' : 'Email Inquiry'}
              </h2>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="mb-3 text-slate-300">
                  {isKo
                    ? '이메일로 직접 문의하실 수 있습니다.'
                    : 'You can contact us directly by email.'}
                </p>
                <a
                  href={`mailto:${contactEmail}`}
                  className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 transition-colors text-lg font-semibold"
                >
                  <i className="ri-mail-send-line"></i>
                  {contactEmail}
                </a>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                <i className="ri-questionnaire-line mr-2"></i>
                {isKo ? '문의 양식' : 'Inquiry Form'}
              </h2>
              <ContactForm locale={locale} contactEmail={contactEmail} />
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '자주 묻는 질문' : 'Frequently Asked Questions'}
              </h2>
              <div className="space-y-4">
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <h3 className="font-semibold text-teal-300 mb-2">
                    {isKo ? 'Q: 게임이 작동하지 않아요.' : 'Q: The game is not working.'}
                  </h3>
                  <p className="text-slate-300 text-sm">
                    {isKo
                      ? 'A: 브라우저를 새로고침하거나 캐시를 삭제한 후 다시 시도해 보세요. 문제가 지속되면 문의해 주세요.'
                      : 'A: Please try refreshing your browser or clearing the cache. If the problem persists, please contact us.'}
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <h3 className="font-semibold text-teal-300 mb-2">
                    {isKo ? 'Q: 계정을 삭제하고 싶어요.' : 'Q: I want to delete my account.'}
                  </h3>
                  <p className="text-slate-300 text-sm">
                    {isKo
                      ? 'A: 계정 삭제를 원하시면 이메일로 문의해 주세요. 개인정보처리방침에 따라 처리해 드리겠습니다.'
                      : 'A: If you wish to delete your account, please contact us by email. We will process it according to our Privacy Policy.'}
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <h3 className="font-semibold text-teal-300 mb-2">
                    {isKo ? 'Q: 버그를 발견했어요.' : 'Q: I found a bug.'}
                  </h3>
                  <p className="text-slate-300 text-sm">
                    {isKo
                      ? 'A: 버그 리포트를 보내주시면 빠르게 확인하고 수정하겠습니다. 가능한 한 자세한 설명과 스크린샷을 포함해 주세요.'
                      : 'A: If you send us a bug report, we will check and fix it quickly. Please include as detailed a description as possible and screenshots.'}
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-teal-400 mb-4">
                {isKo ? '응답 시간' : 'Response Time'}
              </h2>
              <p className="text-slate-300">
                {isKo
                  ? '일반적인 문의는 1-2일 이내에 답변드리며, 긴급한 문제의 경우 가능한 한 빠르게 처리하겠습니다.'
                  : 'We respond to general inquiries within 1-2 days, and we will handle urgent issues as quickly as possible.'}
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

