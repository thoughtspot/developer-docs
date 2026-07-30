import { rewrite, next } from '@vercel/functions'

// Content-negotiation for AEO: agents (Claude Code, Cursor, OpenCode, etc.) send
// `Accept: text/markdown` and expect the markdown sibling generated at build time.
// Vercel's vercel.json `rewrites` can't do this because filesystem match takes
// precedence over rewrites for a path that already resolves to an existing static
// file, so this has to run in Middleware instead, which executes before that
// filesystem check.
export const config = {
  matcher: '/:path*',
}

export default function middleware (request) {
  const accept = request.headers.get('accept') || ''
  if (!accept.includes('text/markdown')) return next()

  const url = new URL(request.url)
  const { pathname } = url
  if (pathname.endsWith('.md')) return next()

  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1)
  if (lastSegment.includes('.')) return next() // static asset (css/js/svg/png/...), not a doc page

  url.pathname = pathname.endsWith('/') ? `${pathname}index.md` : `${pathname}.md`
  return rewrite(url)
}
