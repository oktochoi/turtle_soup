import type { Metadata } from 'next';
import { getMessages, type Locale, isValidLocale, defaultLocale } from '@/lib/i18n';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getBlogPost, getAllBlogPosts } from '@/lib/blog-posts';

export async function generateStaticParams() {
  const posts = getAllBlogPosts();
  return posts.flatMap((post) => [
    { lang: 'ko', slug: post.slug },
    { lang: 'en', slug: post.slug },
  ]);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const locale = isValidLocale(lang) ? lang : defaultLocale;
  const post = getBlogPost(slug);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';
  const baseUrl = `${siteUrl}/${locale}/blog/${slug}`;

  if (!post) {
    return {
      title: locale === 'ko' ? '게시글을 찾을 수 없습니다' : 'Post Not Found',
    };
  }

  const isKo = locale === 'ko';

  return {
    title: isKo ? post.title.ko : post.title.en,
    description: isKo ? post.excerpt.ko : post.excerpt.en,
    alternates: {
      canonical: baseUrl,
      languages: {
        ko: `${siteUrl}/ko/blog/${slug}`,
        en: `${siteUrl}/en/blog/${slug}`,
      },
    },
    openGraph: {
      title: isKo ? post.title.ko : post.title.en,
      description: isKo ? post.excerpt.ko : post.excerpt.en,
      url: baseUrl,
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isValidLocale(lang)) {
    notFound();
  }
  const locale = lang as Locale;
  const isKo = locale === 'ko';
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  // Markdown을 간단한 HTML로 변환 (실제로는 markdown 라이브러리 사용 권장)
  const content = isKo ? post.content.ko : post.content.en;
  const htmlContent = content
    .split('\n')
    .map((line, index) => {
      if (line.startsWith('# ')) {
        return `<h1 class="text-3xl font-bold text-teal-400 mb-4 mt-8">${line.substring(2)}</h1>`;
      } else if (line.startsWith('## ')) {
        return `<h2 class="text-2xl font-bold text-teal-400 mb-4 mt-6">${line.substring(3)}</h2>`;
      } else if (line.startsWith('### ')) {
        return `<h3 class="text-xl font-semibold text-teal-300 mb-3 mt-4">${line.substring(4)}</h3>`;
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        return `<li class="ml-6 mb-2">${line.substring(2)}</li>`;
      } else if (line.trim() === '') {
        return '<br />';
      } else if (line.match(/^\d+\. /)) {
        return `<li class="ml-6 mb-2 list-decimal">${line.replace(/^\d+\. /, '')}</li>`;
      } else {
        return `<p class="mb-4 leading-relaxed">${line}</p>`;
      }
    })
    .join('');

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-4xl">
        <Link
          href={`/${locale}/blog`}
          className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 transition-colors mb-6"
        >
          <i className="ri-arrow-left-line"></i>
          <span>{isKo ? '블로그 목록으로' : 'Back to Blog'}</span>
        </Link>

        <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 lg:p-10 border border-slate-700 shadow-xl">
          <div className="mb-6">
            <span className="inline-block px-3 py-1 text-xs font-semibold bg-teal-500/20 text-teal-400 rounded-full mb-4">
              {isKo ? post.category.ko : post.category.en}
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
              {isKo ? post.title.ko : post.title.en}
            </h1>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span>{post.author}</span>
              <span>•</span>
              <span>{post.publishedAt}</span>
            </div>
          </div>

          <div
            className="prose prose-invert max-w-none text-slate-300"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />

          <div className="mt-8 pt-6 border-t border-slate-700">
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 text-xs bg-slate-700/50 text-slate-300 rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

