import { env } from "cloudflare:workers";
export function GET() {
  return new Response(
    "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /mock-payment\nSitemap: " +
      (env.PUBLIC_SITE_URL || "http://localhost:5173") +
      "/sitemap.xml\n",
    { headers: { "Content-Type": "text/plain" } },
  );
}
