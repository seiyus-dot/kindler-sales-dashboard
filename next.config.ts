import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['googleapis'],
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
