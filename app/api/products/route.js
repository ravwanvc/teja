import { env } from "cloudflare:workers";
import { catalog } from "../../../lib/catalog.js";
export async function GET(req) {
  return Response.json(await catalog(env.DB, new URL(req.url).searchParams), {
    headers: { "Cache-Control": "no-store" },
  });
}
