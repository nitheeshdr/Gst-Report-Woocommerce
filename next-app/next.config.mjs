/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/wc-api/:path*',
        destination: 'https://naturesjoystore.com/:path*',
      },
    ];
  },
};

export default nextConfig;
