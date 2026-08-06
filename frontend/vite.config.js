import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build the Coder proxy base path from workspace env vars so the dev
// server works when accessed via code-server's reverse proxy at:
//   /@{owner}/{workspace}/apps/code-server/proxy/5173/
// Without this, all JS/CSS assets use "/" paths which break behind the proxy.
const owner = process.env.CODER_WORKSPACE_OWNER_NAME
const ws = process.env.CODER_WORKSPACE_NAME
const base = owner && ws ? `/@${owner}/${ws}/apps/code-server/proxy/5173/` : '/'

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    port: 5173,
    host: true,
    // Allow any host header — required for Coder's workspace proxy.
    // Vite 6.x blocks proxied requests with Host: coder.evolveml.io without this.
    allowedHosts: true,
    proxy: {
      // Forward API calls to the local FastAPI backend during development.
      // Matches both a plain "/api/..." request AND one prefixed with the
      // Coder proxy base path ("/@{owner}/{ws}/apps/code-server/proxy/5173/
      // api/...") — the browser's `fetch('${BASE_URL}api/...')` calls (see
      // lib/api/colleges.js) resolve to the latter whenever `base` above is
      // proxy-prefixed, since `base` is baked into BASE_URL and fetch() is
      // otherwise an absolute, base-unaware browser path. `^` marks this key
      // as a regex per Vite/http-proxy-middleware's proxy option syntax.
      '^/(?:@[^/]+/[^/]+/apps/code-server/(?:absproxy|proxy)/5173/)?api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/@[^/]+\/[^/]+\/apps\/code-server\/(?:absproxy|proxy)\/5173\//, '/'),
      },
    },
  },
})
