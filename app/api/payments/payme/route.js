import { mockPayments } from "../../../../lib/modes.js";
import { env } from "cloudflare:workers";
import { paymeCallback } from "../../../../lib/payments.js";
export async function POST(req) {
  try {
    if (mockPayments(env))
      return Response.json(
        { error: "Live callbacks disabled" },
        { status: 410 },
      );
    if (Number(req.headers.get("content-length")) > 16384)
      return new Response(null, { status: 413 });
    return Response.json(
      await paymeCallback(
        env.DB,
        env,
        req.headers.get("authorization"),
        await req.json(),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({
      error: { code: -32700, message: "Parse error" },
      id: null,
    });
  }
}
