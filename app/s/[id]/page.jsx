import Link from "next/link";
import { env } from "cloudflare:workers";
import { notFound } from "next/navigation";
import { catalog } from "../../../lib/catalog.js";
import { money } from "../../../lib/format.js";
import { ReportButton } from "../../account-tools";
export const dynamic = "force-dynamic";
export default async function Store({ params, searchParams }) {
  const { id } = await params,
    q = await searchParams,
    u = await env.DB.prepare(
      "SELECT id,name,verified,business_name FROM users WHERE id=? AND role='seller'",
    )
      .bind(id)
      .first();
  if (!u) notFound();
  const data = await catalog(
    env.DB,
    new URLSearchParams({ owner: id, page: q?.page || "1" }),
  );
  const rating = await env.DB.prepare(
    "SELECT ROUND(AVG(r.rating),1) rating FROM reviews r JOIN products p ON p.id=r.product WHERE p.owner=? AND r.hidden=0",
  )
    .bind(id)
    .first();
  return (
    <main className="dashboard">
      <Link href="/">← TEJA</Link>
      <h1>
        {u.business_name || u.name} {u.verified ? "✓" : ""}
      </h1>
      <p>★ {rating.rating || "—"}</p>
      <ReportButton kind="seller" target={id} />
      <div className="grid">
        {data.products.map((p) => (
          <article key={p.id} className="product">
            <img
              src={p.image}
              alt={p.title}
              style={{ width: "100%", height: 180, objectFit: "cover" }}
            />
            <h2>
              <Link href={"/p/" + p.id}>{p.title}</Link>
            </h2>
            <p>{money(p.price)}</p>
          </article>
        ))}
      </div>
      {data.page > 1 && <Link href={"?page=" + (data.page - 1)}>←</Link>}{" "}
      {data.page}/{data.pages || 1}{" "}
      {data.page < data.pages && (
        <Link href={"?page=" + (data.page + 1)}>→</Link>
      )}
    </main>
  );
}
