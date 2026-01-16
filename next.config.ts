import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
