/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The image matcher behind /api/align: native onnxruntime plus its model, Linux x64 only.
  serverExternalPackages: ['onnxruntime-node'],
  outputFileTracingIncludes: {
    '/api/align': [
      './public/models/loftr-coarse-352x480-fp16-be208d87.onnx',
      './node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/napi-v6/linux/x64/*',
    ],
    // The upcoming places a sent photo may be for.
    '/api/submit': ['./public/posts/*/*.json'],
    '/me': ['./public/posts/*/*.json'],
  },
  outputFileTracingExcludes: {
    '/api/align': [
      '**/onnxruntime-node/bin/napi-v6/darwin/**',
      '**/onnxruntime-node/bin/napi-v6/win32/**',
      '**/onnxruntime-node/bin/napi-v6/linux/arm64/**',
    ],
  },
  // The matcher's model file is named by its content hash, so phones can keep it.
  async headers() {
    return [
      {
        source: '/models/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

export default nextConfig
