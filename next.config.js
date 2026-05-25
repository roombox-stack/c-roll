/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // R2 default public domain (dev)
      { protocol: 'https', hostname: '*.r2.dev' },
      // R2 custom domain (prod, when configured)
      { protocol: 'https', hostname: 'media.showside.com' },
      // Mux thumbnail CDN
      { protocol: 'https', hostname: 'image.mux.com' },
    ],
  },
};

module.exports = nextConfig;
