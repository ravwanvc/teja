"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import DemoWallet from "./demo-wallet";
import { CreditCard, LockKeyhole, ShieldCheck } from "lucide-react";
import { formatCard, cardBrand } from "../lib/format";
import {
  phoneDigits,
  pastedPhone,
  formatExpiry,
  validExpiry,
} from "../lib/card-form";
export function CardMark({ brand }) {
  return !["uzcard", "humo", "visa"].includes(brand) ? (
    <CreditCard size={24} />
  ) : (
    <img
      className="network-logo"
      src={"/payments/" + brand + ".png"}
      alt={brand.toUpperCase()}
    />
  );
}
export default function Wallet(props) {
  const [mode, M] = useState(null);
  useEffect(() => {
    fetch("/api/cards")
      .then((r) => r.json())
      .then((d) => M(d.demo ? "demo" : "live"))
      .catch(() => M("live"));
  }, []);
  return mode === "demo" ? (
    <DemoWallet {...props} />
  ) : mode === "live" ? (
    <LiveWallet {...props} />
  ) : (
    <p>Kartalar yuklanmoqda…</p>
  );
}
function LiveWallet({ onAdded, compact = false }) {
  const [data, D] = useState({ cards: [], configured: false }),
    [number, N] = useState(""),
    [expiry, E] = useState(""),
    [contact, P] = useState(""),
    [token, T] = useState(""),
    [bankPhone, BP] = useState(""),
    [code, C] = useState(""),
    [busy, B] = useState(false),
    [msg, M] = useState(""),
    [loaded, L] = useState(false);
  const active = useRef(false),
    lock = useRef(false);
  const brand = cardBrand(number);
  async function reload() {
    const r = await fetch("/api/cards");
    const d = await r.json();
    if (!r.ok) throw Error(d.error || "Kartalar yuklanmadi");
    if (active.current) {
      D(d);
      L(true);
    }
  }
  useEffect(() => {
    active.current = true;
    reload().catch((e) => M(e.message));
    return () => {
      active.current = false;
    };
  }, []);
  async function rpc(method, params) {
    const r = await fetch("https://checkout.paycom.uz/api", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth": data.merchantId,
      },
      body: JSON.stringify({ id: Date.now(), method, params }),
      signal: AbortSignal.timeout(20000),
    });
    const d = await r.json();
    if (!r.ok || d.error || !d.result)
      throw Error(
        "Bank so‘rovni tasdiqlamadi. Ma’lumotlarni tekshirib qayta urinib ko‘ring.",
      );
    return d.result;
  }
  async function save(e) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true;
    B(true);
    M("");
    try {
      if (!data.configured)
        throw Error("Karta ulash xizmati hali faollashtirilmagan");
      if (!token) {
        if (!["uzcard", "humo"].includes(brand))
          throw Error(
            "Hozir UZCARD yoki HUMO kartasi qo‘llanadi. Visa ulanishi mavjud emas.",
          );
        if (
          number.replace(/\D/g, "").length !== 16 ||
          !validExpiry(expiry) ||
          contact.length !== 9
        )
          throw Error(
            "16 raqam, amaldagi OO/YY va 9 xonali telefonni kiriting.",
          );
        const { card } = await rpc("cards.create", {
          card: {
            number: number.replace(/\D/g, ""),
            expire: expiry.replace(/\D/g, ""),
          },
          customer: "+998" + contact,
          save: true,
        });
        if (!card?.token) throw Error("Karta tokeni olinmadi");
        const sent = await rpc("cards.get_verify_code", { token: card.token });
        if (!sent.sent) throw Error("Bank SMS yuborilishini tasdiqlamadi");
        if (!active.current) return;
        T(card.token);
        BP(sent.phone);
        N("");
        E("");
        P("");
        M("Bank kartaga bog‘langan raqamga SMS yubordi.");
      } else {
        const { card } = await rpc("cards.verify", { token, code });
        if (!card?.verify || !card.token) throw Error("SMS tasdiqlanmadi");
        const r = await fetch("/api/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", token: card.token }),
        });
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (!active.current) return;
        T("");
        C("");
        BP("");
        await reload();
        M("Karta tasdiqlandi va saqlandi.");
        await onAdded?.();
      }
    } catch (e) {
      if (active.current)
        M(
          e.name === "TimeoutError"
            ? "Bank javobi kechikdi. Karta qo‘shilmadi, qayta urinib ko‘ring."
            : e.message,
        );
    } finally {
      lock.current = false;
      if (active.current) B(false);
    }
  }
  async function remove(id) {
    if (lock.current) return;
    lock.current = true;
    B(true);
    M("");
    try {
      const r = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", id }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      await reload();
      M("Karta olib tashlandi");
    } catch (e) {
      M(e.message);
    } finally {
      lock.current = false;
      B(false);
    }
  }
  return (
    <div className={compact ? "wallet-grid compact-wallet" : "wallet-grid"}>
      {!compact && (
        <section>
          <h2>Saqlangan kartalar</h2>
          {loaded && !data.cards.length && (
            <p className="muted">Hali karta qo‘shilmagan.</p>
          )}
          {data.cards.map((c) => (
            <article className="bank-card" key={c.id}>
              <div className="saved-card-heading">
                <CardMark brand={cardBrand(c.number)} />
                <span>
                  <ShieldCheck size={15} /> SMS bilan tasdiqlangan
                </span>
              </div>
              <strong>{c.number}</strong>
              <span>{c.expiry}</span>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => remove(c.id)}
              >
                Olib tashlash
              </button>
            </article>
          ))}
          <p className="muted">Buyurtma to‘lovi alohida tasdiqlanadi.</p>
        </section>
      )}
      <section className="card-form custom-card-form">
        <div className="wallet-intro">
          <div>
            <div className="eyebrow">SHAXSIY HAMYON</div>
            <h2>Kartangizni qo‘shing</h2>
            <p>
              Karta ma’lumotlarini kiriting va bank SMS kodi bilan tasdiqlang.
            </p>
          </div>
          <img
            src="/payments/card-networks.png"
            alt="HUMO, Visa va UZCARD kartalari"
          />
        </div>
        <form onSubmit={save} autoComplete="off">
          {!token ? (
            <>
              <label>
                Karta raqami
                <div className="card-number-field">
                  <input
                    aria-label="Karta raqami"
                    autoComplete="off"
                    inputMode="numeric"
                    required
                    minLength={19}
                    maxLength={19}
                    placeholder="0000 0000 0000 0000"
                    value={number}
                    disabled={busy}
                    onChange={(e) => N(formatCard(e.target.value))}
                  />
                  <CardMark brand={brand} />
                </div>
                <small>
                  {brand === "unknown"
                    ? "Karta turi raqam orqali aniqlanadi."
                    : brand.toUpperCase() + " · raqam prefiksi bo‘yicha"}
                </small>
              </label>
              <div className="card-detail-fields">
                <label>
                  Amal qilish muddati
                  <input
                    aria-label="Amal qilish muddati"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    pattern="(0[1-9]|1[0-2])/[0-9]{2}"
                    placeholder="OO/YY"
                    maxLength={5}
                    value={expiry}
                    disabled={busy}
                    onChange={(e) => E(formatExpiry(e.target.value))}
                  />
                </label>
                {brand === "visa" && (
                  <label>
                    CVV
                    <input
                      aria-label="Visa CVV — provayder ulanmagan"
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="•••"
                      maxLength={3}
                      disabled
                      aria-describedby="visa-unavailable"
                    />
                  </label>
                )}
              </div>
              <label>
                Telefon raqamingiz
                <div className="phone-field">
                  <span aria-hidden="true">+998</span>
                  <input
                    aria-label="Telefon, +998 dan keyingi 9 raqam"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="90 123 45 67"
                    required
                    minLength={9}
                    maxLength={9}
                    pattern="[0-9]{9}"
                    value={contact}
                    disabled={busy}
                    onChange={(e) => P(phoneDigits(e.target.value))}
                    onPaste={(e) => {
                      e.preventDefault();
                      P(pastedPhone(e.clipboardData.getData("text")));
                    }}
                  />
                </div>
                <small>
                  Aynan 9 ta raqam. Bu raqam SMS manzilini o‘zgartirmaydi.
                </small>
              </label>
              {brand === "visa" && (
                <p id="visa-unavailable" className="wallet-notice">
                  Visa provayderi hali ulanmagan. CVV kiritish va Visa saqlash
                  hozir yopiq. UZCARD yoki HUMO kartasidan foydalaning.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="wallet-notice">
                <ShieldCheck size={22} />
                <p>
                  Bank SMS yuborgan raqam: <b>{bankPhone}</b>
                </p>
                <small>
                  Bu raqamni bank qaytardi. Kodni hech kimga bermang.
                </small>
              </div>
              <label>
                SMS kodi
                <input
                  aria-label="Bank SMS kodi"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={10}
                  value={code}
                  disabled={busy}
                  onChange={(e) => C(e.target.value.replace(/\D/g, ""))}
                />
              </label>
            </>
          )}
          {!data.configured && (
            <p className="wallet-notice">
              {loaded
                ? "Karta ulash xizmati hali faollashtirilmagan. Hozir SMS yuborilmaydi va karta saqlanmaydi."
                : "Karta xizmati tekshirilmoqda…"}
            </p>
          )}
          <label className="check">
            <input type="checkbox" required disabled={busy} />
            <span>
              <Link
                href="https://cdn.payme.uz/terms/main.html"
                target="_blank"
                rel="noreferrer"
              >
                To‘lov xizmati shartlariga
              </Link>{" "}
              roziman.
            </span>
          </label>
          <button
            className="full"
            disabled={busy || !data.configured || (!token && brand === "visa")}
          >
            {busy
              ? "Tekshirilmoqda…"
              : token
                ? "Tasdiqlash va saqlash"
                : "SMS kodini olish"}
          </button>
          {token && (
            <button
              className="secondary full"
              type="button"
              disabled={busy}
              onClick={() => {
                T("");
                C("");
                BP("");
                M("");
              }}
            >
              Boshqa karta kiritish
            </button>
          )}
        </form>
        <p className="wallet-security">
          <LockKeyhole size={16} />
          <span>
            Karta raqami va SMS kodi bevosita to‘lov provayderiga yuboriladi.
            TEJA faqat token, niqoblangan raqam va muddatni saqlaydi. SMS
            kartaga bankda bog‘langan raqamga boradi; kiritgan telefoningiz
            bilan bank raqamining to‘liq mosligi tekshirilmaydi.
          </span>
        </p>
        <div className="wallet-real-logos">
          <span>
            <img src="/payments/click-upload.png" alt="Click" />
          </span>
          <span>
            <img src="/payments/payme-upload.png" alt="Payme" />
          </span>
        </div>
        <small className="muted">Karta ulash: Powered by Payme</small>
        <p role="status">{msg}</p>
      </section>
    </div>
  );
}
