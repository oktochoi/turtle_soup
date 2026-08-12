import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep ONNX / Transformers out of Vercel serverless function traces (250MB limit).
  // These run in the browser via dynamic import, not on the Node function.
  serverExternalPackages: [
    '@xenova/transformers',
    '@huggingface/transformers',
    'onnxruntime-node',
    'onnxruntime-web',
  ],
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@xenova/**',
      'node_modules/@huggingface/**',
      'node_modules/onnxruntime-node/**',
      'node_modules/onnxruntime-web/**',
      'node_modules/@huggingface/transformers/**',
      '**/node_modules/**/onnx*/**',
      '**/.cache/**',
    ],
  },
  // 리다이렉트: 블로그→공지사항, how-to-play→guide
  async redirects() {
    return [
      // 레거시 경로 → 한국어 대응 페이지
      { source: '/ko/blog', destination: '/ko', permanent: true },
      { source: '/ko/blog/:path*', destination: '/ko', permanent: true },
      { source: '/ko/community', destination: '/ko', permanent: true },
      { source: '/ko/community/:path*', destination: '/ko', permanent: true },
      { source: '/ko/how-to-play', destination: '/ko/guide', permanent: true },
      { source: '/ko/tutorial', destination: '/ko/guide', permanent: true },
      { source: '/ko/about', destination: '/ko/guide', permanent: true },
      { source: '/ko/guess', destination: '/ko/problems', permanent: true },
      { source: '/ko/guess/:path*', destination: '/ko/problems', permanent: true },
      { source: '/ko/balance', destination: '/ko/problems', permanent: true },
      { source: '/ko/balance/:path*', destination: '/ko/problems', permanent: true },
      { source: '/ko/chat/:path*', destination: '/ko/rooms', permanent: true },
      { source: '/ko/liar_room/:path*', destination: '/ko/rooms', permanent: true },
      { source: '/ko/mafia_room/:path*', destination: '/ko/rooms', permanent: true },
      { source: '/ko/wallet', destination: '/ko', permanent: true },
      { source: '/ko/shop', destination: '/ko', permanent: true },
      { source: '/ko/earn', destination: '/ko', permanent: true },
    ];
  },
  // output: "export" 제거 - Supabase를 사용하는 동적 앱이므로 필요 없음
  images: {
    // Pro 플랜에서 이미지 최적화 활성화
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    // 외부 이미지 도메인 추가 (필요시)
    remotePatterns: [],
  },
  typescript: {
    // ignoreBuildErrors: true,
  },
};

export default nextConfig;
