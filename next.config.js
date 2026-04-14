/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: 'dist',
  output: 'export',
  assetPrefix: "./",
  images: {
    unoptimized: true, // 禁用图片优化
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  compiler:{
    removeConsole: process.env.NODE_ENV === 'production'?{ exclude: ["error",'info'] } : false,
  },
  /**
   * Windows 下项目路径含中文等字符时，原生文件监听常失效，表现为保存后终端无 Compiled、浏览器不更新。
   * 在启动前设置环境变量后重开 dev：PowerShell: $env:NEXT_WEBPACK_USE_POLLING='1'; npm run dev
   * CMD: set NEXT_WEBPACK_USE_POLLING=1&& npm run dev
   */
  webpack: (config, { dev }) => {
    if (dev && process.env.NEXT_WEBPACK_USE_POLLING === '1') {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};

export default nextConfig;








