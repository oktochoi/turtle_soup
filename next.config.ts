import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "export" 제거 - Supabase를 사용하는 동적 앱이므로 필요 없음
  images: {
    unoptimized: true,
  },
  typescript: {
    // ignoreBuildErrors: true,
  },
};

export default nextConfig;
