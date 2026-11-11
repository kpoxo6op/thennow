// The memory store is for the test suite alone (lib/store.ts). A deployment asked to use it stops here.
const DEPLOYED = [
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_DEPLOYMENT_ID',
  'AWS_LAMBDA_FUNCTION_NAME',
  'AWS_EXECUTION_ENV',
  'LAMBDA_TASK_ROOT',
]
if (process.env.TN_FAKE_STORE && DEPLOYED.some((name) => process.env[name])) {
  throw new Error('TN_FAKE_STORE is set on a deployment. Remove it: the memory store is for tests only.')
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_CAMERA_BUILD: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_CAMERA_BUILD || 'unknown' },
  // The image matcher behind /api/align: native onnxruntime plus its model, Linux x64 only.
  serverExternalPackages: ['onnxruntime-node'],
  outputFileTracingIncludes: {
    '/api/align': [
      './public/models/loftr-coarse-352x480-fp16-be208d87.onnx',
      './node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/napi-v6/linux/x64/*',
    ],
    // The upcoming places a sent photo may be for.
    '/api/submit': ['./public/posts/*/*.json'],
    '/api/comments': ['./public/posts/*/*.json'],
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
