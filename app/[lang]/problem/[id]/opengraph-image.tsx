import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export async function generateImageMetadata() {
  return [
    {
      id: 'og',
      alt: '바다거북스프 문제',
      size,
      contentType,
    },
  ];
}

export default async function Image({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const resolvedParams = await params;
  const problemId = resolvedParams.id;

  const supabase = await createClient();
  const { data: problem } = await supabase
    .from('problems')
    .select('title, content, view_count, like_count, comment_count')
    .eq('id', problemId)
    .single();

  if (!problem) {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f172a',
            backgroundImage: 'linear-gradient(to bottom right, #0f172a, #1e293b, #0f172a)',
          }}
        >
          <div style={{ display: 'flex', fontSize: 60, fontWeight: 'bold', color: '#14b8a6', marginBottom: 20 }}>
            바다거북스프
          </div>
          <div style={{ display: 'flex', fontSize: 30, color: '#94a3b8' }}>
            문제를 찾을 수 없습니다
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const title = problem.title || '바다거북스프 문제';
  const contentPreview = problem.content
    ? problem.content.substring(0, 100) + (problem.content.length > 100 ? '...' : '')
    : '추리와 질문으로 진실을 밝혀내세요';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0f172a',
          backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute', top: -100, left: -100, width: 400, height: 400, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(20, 184, 166, 0.1) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute', bottom: -150, right: -150, width: 500, height: 500, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)',
          }}
        />

        <div
          style={{
            display: 'flex', flexDirection: 'column', padding: '60px 80px', height: '100%',
            justifyContent: 'space-between', position: 'relative', zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
            <div
              style={{
                width: 60, height: 60, borderRadius: 12,
                background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, fontWeight: 'bold', color: 'white',
              }}
            >
              🐢
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#14b8a6', lineHeight: 1.2 }}>
                바다거북스프
              </div>
              <div style={{ fontSize: 18, color: '#64748b' }}>
                추리 게임
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
            <div
              style={{
                fontSize: 56, fontWeight: 'bold', color: '#ffffff', lineHeight: 1.2,
                display: 'flex', maxWidth: '90%', wordBreak: 'break-word',
              }}
            >
              {title}
            </div>
            <div style={{ fontSize: 24, color: '#cbd5e1', lineHeight: 1.5, display: 'flex', maxWidth: '85%' }}>
              {contentPreview}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginTop: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 20 }}>
              <span>👁️</span><span>{problem.view_count || 0}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 20 }}>
              <span>❤️</span><span>{problem.like_count || 0}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 20 }}>
              <span>💬</span><span>{problem.comment_count || 0}</span>
            </div>
            <div
              style={{
                marginLeft: 'auto', padding: '12px 32px', borderRadius: 12,
                background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
                color: 'white', fontSize: 22, fontWeight: 'bold',
              }}
            >
              문제 풀기 →
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
