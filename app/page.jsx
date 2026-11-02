import { env } from "cloudflare:workers";
import { catalog } from "../lib/catalog.js";
import MarketClient from "./market-client";
export const dynamic = "force-dynamic";
export default async function Home() {
  let initialProducts = [];
  try {
    initialProducts = (await catalog(env.DB, new URLSearchParams("limit=24")))
      .products;
  } catch {
    /* Client presents migration/network failure with retry. */
  }
  return <MarketClient initialProducts={initialProducts} />;
}
