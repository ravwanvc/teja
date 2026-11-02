import { mockPayments } from "../../../../lib/modes.js";
import { env } from "cloudflare:workers";
import { clickCallback } from "../../../../lib/payments.js";
export async function POST(req) {
  try {
    if (mockPayments(env))
      return Response.json(
        { error: "Live callbacks disabled" },
        { status: 410 },
      );
    if (Number(req.headers.get("content-length")) > 16384)
      return new Response(null, { status: 413 });
    const p = Object.fromEntries(new URLSearchParams(await req.text()));
    return Response.json(await clickCallback(env.DB, env, p), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: -8, error_note: "Invalid request" });
  }
}
