/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The image matcher behind /api/align: native onnxruntime plus its model, Linux x64 only.
  serverExternalPackages: ['onnxruntime-node'],
  outputFileTracingIncludes: {
    '/api/align': [
      './models/loftr-coarse-352x480-fp16.onnx',
      './node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/napi-v6/linux/x64/*',
    ],
  },
  outputFileTracingExcludes: {
    '/api/align': [
      '**/onnxruntime-node/bin/napi-v6/darwin/**',
      '**/onnxruntime-node/bin/napi-v6/win32/**',
      '**/onnxruntime-node/bin/napi-v6/linux/arm64/**',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'place-hold.it',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placekitten.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
}

export default nextConfig
