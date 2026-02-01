import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PostClient from './PostClient';

type Props = { params: Promise<{ lang: string; id: string }> };

export async function generateMetadata({ params }: Props) {
  const { lang, id } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from('posts')
    .select('title, content')
    .eq('id', id)
    .single();

  if (!post) return { title: '게시글을 찾을 수 없습니다' };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://turtle-soup-rust.vercel.app';
  const description = post.content?.slice(0, 155) + (post.content?.length > 155 ? '...' : '') || '';

  return {
    title: post.title,
    description,
    alternates: {
      canonical: `${siteUrl}/${lang}/community/${id}`,
      languages: {
        ko: `${siteUrl}/ko/community/${id}`,
        en: `${siteUrl}/en/community/${id}`,
        'x-default': `${siteUrl}/ko/community/${id}`,
      },
    },
    openGraph: {
      title: post.title,
      description,
      url: `${siteUrl}/${lang}/community/${id}`,
      locale: lang === 'ko' ? 'ko_KR' : 'en_US',
    },
  };
}

export const dynamic = 'force-dynamic';

export default async function PostPage({ params }: Props) {
  const { lang, id } = await params;
  const supabase = await createClient();
  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !post) notFound();

  return <PostClient initialPost={post} lang={lang} postId={id} />;
}
