"use client";
import Link from "next/link";
import { useState } from "react";
export default function MockPayment() {
  const [busy, B] = useState(false),
    [error, E] = useState("");
  async function run(outcome) {
    B(true);
    E("");
    try {
      const id = new URLSearchParams(location.search).get("id");
      const r = await fetch("/api/payments/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, outcome }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      location.assign("/?view=orders");
    } catch (e) {
      E(e.message);
    } finally {
      B(false);
    }
  }
  return (
    <main className="auth-card">
      <h1>SINOV — pul olinmagan</h1>
      <h2>ТЕСТ — деньги не списаны</h2>
      <p>10% oldindan to‘lov simulyatori / Симулятор предоплаты 10%</p>
      {["pay", "reject", "expire"].map((v, i) => (
        <button key={v} disabled={busy} onClick={() => run(v)}>
          {
            [
              "To‘lash / Оплатить",
              "Rad etish / Отказ",
              "Muddati tugadi / Истёк срок",
            ][i]
          }
        </button>
      ))}
      {error && <p role="alert">{error}</p>}
      <Link href="/?view=orders">Buyurtmalar / Заказы</Link>
    </main>
  );
}
