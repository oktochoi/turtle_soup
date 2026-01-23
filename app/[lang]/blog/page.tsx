import type { Metadata } from 'next';
import { getMessages, type Locale, isValidLocale, defaultLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllBlogPosts } from '@/lib/blog-posts';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = isValidLocale(lang) ? lang : defaultLocale;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';
  const baseUrl = `${siteUrl}/${locale}/blog`;

  return {
    title: locale === 'ko' ? '블로그' : 'Blog',
    description: locale === 'ko'
      ? '바다거북스프 게임에 대한 최신 소식, 가이드, 팁을 확인하세요.'
      : 'Check out the latest news, guides, and tips about Turtle Soup game.',
    alternates: {
      canonical: baseUrl,
      languages: {
        ko: `${siteUrl}/ko/blog`,
        en: `${siteUrl}/en/blog`,
      },
    },
    openGraph: {
      title: locale === 'ko' ? '블로그' : 'Blog',
      description: locale === 'ko'
        ? '바다거북스프 블로그'
        : 'Turtle Soup Blog',
      url: baseUrl,
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
    },
  };
}

export default async function BlogPage({
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
  const posts = getAllBlogPosts();

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
            {isKo ? '블로그' : 'Blog'}
          </h1>
          <p className="text-slate-400 text-sm">
            {isKo ? '게임 가이드, 팁, 최신 소식을 확인하세요' : 'Check out game guides, tips, and latest news'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/${locale}/blog/${post.slug}`}
              className="group bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-teal-500/50 transition-all hover:shadow-xl hover:shadow-teal-500/20 hover:-translate-y-1"
            >
              <div className="mb-3">
                <span className="inline-block px-3 py-1 text-xs font-semibold bg-teal-500/20 text-teal-400 rounded-full">
                  {isKo ? post.category.ko : post.category.en}
                </span>
              </div>
              <h2 className="text-xl font-bold mb-3 text-white group-hover:text-teal-300 transition-colors line-clamp-2">
                {isKo ? post.title.ko : post.title.en}
              </h2>
              <p className="text-slate-400 text-sm mb-4 line-clamp-3">
                {isKo ? post.excerpt.ko : post.excerpt.en}
              </p>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{post.author}</span>
                <span>{post.publishedAt}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

