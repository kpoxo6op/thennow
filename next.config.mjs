/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    appDir: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'place-hold.it',
        port: '',
        pathname: '/*',
      },
    ],
  },
}

export default nextConfig
