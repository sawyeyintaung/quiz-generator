import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { contentSecurityPolicy, securityHeaders } from './security.config.ts'

/**
 * Production only: adds the Content Security Policy as a <meta> tag (works on any
 * static host) and writes header files for hosts that support them (Netlify,
 * Cloudflare Pages, Vercel). The dev server needs inline scripts, so it is skipped there.
 */
function securityPlugin(): Plugin {
  return {
    name: 'quiz-generator-security',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy },
          injectTo: 'head-prepend',
        },
        { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head' },
      ]
    },
    generateBundle() {
      const lines = Object.entries(securityHeaders).map(([k, v]) => `  ${k}: ${v}`)
      this.emitFile({ type: 'asset', fileName: '_headers', source: `/*\n${lines.join('\n')}\n` })
      this.emitFile({
        type: 'asset',
        fileName: 'vercel.json',
        source: JSON.stringify(
          {
            headers: [
              {
                source: '/(.*)',
                headers: Object.entries(securityHeaders).map(([key, value]) => ({ key, value })),
              },
            ],
          },
          null,
          2,
        ),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Relative base + hash routing lets the build run on any static host or sub-path.
  base: './',
  plugins: [react(), tailwindcss(), securityPlugin()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
