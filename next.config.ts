import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 리다이렉트: 블로그→공지사항, how-to-play→guide
  async redirects() {
    return [
      { source: '/ko/blog', destination: '/ko/community?category=notice', permanent: true },
      { source: '/ko/blog/:path*', destination: '/ko/community?category=notice', permanent: true },
      { source: '/en/blog', destination: '/en/community?category=notice', permanent: true },
      { source: '/en/blog/:path*', destination: '/en/community?category=notice', permanent: true },
      { source: '/ko/how-to-play', destination: '/ko/guide', permanent: true },
      { source: '/en/how-to-play', destination: '/en/guide', permanent: true },
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
