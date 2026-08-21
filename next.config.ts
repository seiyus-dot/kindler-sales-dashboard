import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['googleapis'],
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    // OAuthのディスカバリは /.well-known/ 配下に置く決まり（RFC 8414 / RFC 9728）。
    // app/.well-known/ はドット始まりでApp Routerが拾わないため、rewriteでAPIルートへ流す。
    // クライアントによってはリソースのパスを末尾に足してくる（.../oauth-authorization-server/api/mcp）ので
    // その形も同じところへ向ける。
    return [
      { source: '/.well-known/oauth-authorization-server', destination: '/api/oauth/authorization-server' },
      { source: '/.well-known/oauth-authorization-server/:path*', destination: '/api/oauth/authorization-server' },
      { source: '/.well-known/oauth-protected-resource', destination: '/api/oauth/protected-resource' },
      { source: '/.well-known/oauth-protected-resource/:path*', destination: '/api/oauth/protected-resource' },
    ]
  },
}

export default nextConfig
