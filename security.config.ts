/**
 * Security policy for the production build. The app only ever talks to its own
 * origin and to the three AI providers, directly from the browser.
 */
export const aiProviderOrigins = [
  'https://api.anthropic.com',
  'https://api.openai.com',
  'https://generativelanguage.googleapis.com',
]

const directives: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  // pdf.js reads PDFs in a worker served from our own origin.
  'worker-src': ["'self'", 'blob:'],
  'style-src': ["'self'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'", ...aiProviderOrigins],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
}

/** For a <meta> tag (frame-ancestors is not allowed there; hosts set it as a header). */
export const contentSecurityPolicy = Object.entries(directives)
  .map(([name, values]) => `${name} ${values.join(' ')}`)
  .join('; ')

/** Full header set for static hosts that support custom headers. */
export const securityHeaders: Record<string, string> = {
  'Content-Security-Policy': `${contentSecurityPolicy}; frame-ancestors 'none'`,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
}
