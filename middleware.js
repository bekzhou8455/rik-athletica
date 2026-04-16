/**
 * Vercel Edge Middleware.
 * Runs before any request is routed to a static file or API function.
 *
 * Purpose: block known AI-training and scraping bots by User-Agent.
 *
 * Real search engines (Googlebot, Bingbot, DuckDuckBot, Applebot, Twitterbot,
 * facebookexternalhit, Slackbot) stay allowed for SEO and link previews.
 *
 * "Extended"-variant crawlers that signal AI-training intent (Google-Extended,
 * Applebot-Extended, GPTBot, ClaudeBot, anthropic-ai, CCBot, PerplexityBot,
 * Bytespider, Amazonbot, Diffbot, Scrapy, etc.) get a 403.
 *
 * Return `undefined` to let the request continue. Return a Response to short-circuit.
 */

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|_vercel).*)'],
};

const BLOCKED_UA_TOKENS = [
  // OpenAI
  'gptbot', 'chatgpt-user', 'oai-searchbot',
  // Anthropic
  'claudebot', 'claude-web', 'anthropic-ai',
  // Cohere / Common Crawl / Perplexity
  'cohere-ai', 'ccbot', 'perplexitybot', 'perplexity-user',
  // Google / Apple training opt-out variants (the non-extended versions remain allowed)
  'google-extended', 'applebot-extended',
  // ByteDance / Amazon / Omgili
  'bytespider', 'amazonbot', 'omgilibot', 'omgili',
  // Meta AI-specific fetchers (facebookexternalhit stays allowed)
  'facebookbot', 'meta-externalagent', 'meta-externalfetcher',
  // Misc AI + scrapers + SEO-data harvesters
  'imagesiftbot', 'diffbot', 'scrapy', 'ai2bot', 'timpibot', 'youbot',
  'velenpublicwebcrawler', 'duckassistbot', 'pangubot', 'petalbot',
  'semrushbot', 'ahrefsbot', 'mj12bot', 'dotbot',
];

function isBlocked(ua) {
  if (!ua) return false;
  const lc = ua.toLowerCase();
  for (const t of BLOCKED_UA_TOKENS) {
    if (lc.includes(t)) return true;
  }
  return false;
}

export default function middleware(request) {
  const ua = request.headers.get('user-agent') || '';
  if (isBlocked(ua)) {
    return new Response(
      'Access denied.\n\n' +
      'This site disallows automated access by AI training crawlers and scrapers.\n' +
      'See /robots.txt and /ai.txt for our machine-readable policy.\n' +
      'For licensing inquiries: bek.zhou@rikathletica.com\n',
      {
        status: 403,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Robots-Tag': 'noai, noimageai, noindex',
          'Cache-Control': 'no-store',
        },
      }
    );
  }
  // undefined = let request continue to its destination
  return undefined;
}
