import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sellingPaused: integer("selling_paused").notNull().default(0),
  avatar: text("avatar").notNull().default(""),
  role: text("role").notNull(),
  verified: integer("verified").notNull().default(0),
  verification: text("verification").notNull().default("none"),
  businessName: text("business_name"),
  businessContact: text("business_contact"),
  created: integer("created").notNull(),
});
export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  title: text("title").notNull(),
  shop: text("shop").notNull(),
  category: text("category").notNull(),
  image: text("image").notNull(),
  images: text("images").notNull().default("[]"),
  city: text("city").notNull().default("Toshkent"),
  price: integer("price").notNull(),
  original: integer("original").notNull(),
  stock: integer("stock").notNull(),
  address: text("address").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  allergens: text("allergens").notNull(),
  storage: text("storage").notNull(),
  preparedAt: integer("prepared_at"),
  bestBefore: integer("best_before"),
  until: integer("until").notNull(),
  active: integer("active").notNull().default(1),
  imageStatus: text("image_status").notNull().default("legacy"),
  imageNote: text("image_note").notNull().default(""),
  created: integer("created").notNull(),
});
export const receiptCounters = sqliteTable("receipt_counters", {
  kind: text("kind").primaryKey(),
  value: integer("value").notNull().default(0),
});
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  buyer: text("buyer").notNull(),
  product: text("product")
    .notNull()
    .references(() => products.id),
  qty: integer("qty").notNull(),
  price: integer("price").notNull(),
  code: text("code").notNull(),
  partnerId:text("partner_id"),
  commissionRate:integer("commission_rate").notNull().default(0),
  commissionDue:integer("commission_due").notNull().default(0),
  cartItems: text("cart_items").notNull().default("[]"),
  status: text("status").notNull(),
  paymentState: text("payment_state").notNull().default("legacy"),
  provider: text("provider"),
  isMock: integer("is_mock").notNull().default(0),
  mockMethod: text("mock_method"),
  deposit: integer("deposit").notNull().default(0),
  receiptNo: text("receipt_no"),
  paidAt: integer("paid_at"),
  pickupAt: integer("pickup_at"),
  pickupSelected: integer("pickup_selected").notNull().default(0),
  holdUntil: integer("hold_until"),
  snapshot: text("snapshot"),
  termsAt: integer("terms_at"),
  transactionId: text("transaction_id"),
  created: integer("created").notNull(),
});
export const geo = sqliteTable("geo", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  created: integer("created").notNull(),
});

export const favorites = sqliteTable("favorites", {
  id: text("id").primaryKey(),
  user: text("user").notNull(),
  product: text("product")
    .notNull()
    .references(() => products.id),
  created: integer("created").notNull(),
});
export const reviews = sqliteTable("reviews", {
  orderId: text("order_id")
    .primaryKey()
    .references(() => orders.id),
  product: text("product")
    .notNull()
    .references(() => products.id),
  buyer: text("buyer").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  hidden: integer("hidden").notNull().default(0),
  created: integer("created").notNull(),
});
export const stockEvents = sqliteTable("stock_events", {
  id: text("id").primaryKey(),
  product: text("product")
    .notNull()
    .references(() => products.id),
  actor: text("actor").notNull(),
  qty: integer("qty").notNull(),
  created: integer("created").notNull(),
});

export const imageChecks = sqliteTable("image_checks", {
  key: text("key").primaryKey(),
  owner: text("owner").notNull(),
  status: text("status").notNull(),
  note: text("note").notNull(),
  created: integer("created").notNull(),
});
export const demoWallet = sqliteTable("demo_wallet", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  brand: text("brand").notNull(),
  last4: text("last4").notNull(),
  expiry: text("expiry").notNull(),
  created: integer("created").notNull(),
});
export const appAccounts = sqliteTable("app_accounts", {
  phone: text("phone").primaryKey(),
  owner: text("owner").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phoneVerified: integer("phone_verified").notNull().default(0),
});
export const appSessions = sqliteTable("app_sessions", {
  token: text("token").primaryKey(),
  owner: text("owner").notNull(),
  expires: integer("expires").notNull(),
  adminVersion: text("admin_version"),
});
export const appAdmin = sqliteTable("app_admin", {
  id: text("id").primaryKey(),
});
export const authLimits = sqliteTable("auth_limits", {
  key: text("key").primaryKey(),
  n: integer("n").notNull(),
  expires: integer("expires").notNull(),
});
export const phoneOtps = sqliteTable("phone_otps", {
  owner: text("owner").primaryKey(),
  hash: text("hash").notNull(),
  expires: integer("expires").notNull(),
  attempts: integer("attempts").notNull().default(0),
  sentAt: integer("sent_at").notNull().default(0),
});
export const savedCards = sqliteTable("saved_cards", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  token: text("token").notNull().unique(),
  number: text("number").notNull(),
  expiry: text("expiry").notNull(),
  created: integer("created").notNull(),
});
export const paymentTransactions = sqliteTable("payment_transactions", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  providerId: text("provider_id").notNull(),
  orderId: text("order_id").notNull().unique(),
  amount: integer("amount").notNull(),
  providerTime: integer("provider_time").notNull(),
  created: integer("created").notNull(),
  performed: integer("performed").notNull().default(0),
  cancelled: integer("cancelled").notNull().default(0),
  state: integer("state").notNull().default(1),
  reason: integer("reason"),
});
export const listingDrafts = sqliteTable("listing_drafts", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  body: text("body").notNull(),
  version: integer("version").notNull().default(1),
  updated: integer("updated").notNull(),
});

export const cardCharges = sqliteTable("card_charges", {
  orderId: text("order_id")
    .primaryKey()
    .references(() => orders.id),
  cardId: text("card_id").notNull(),
  receiptId: text("receipt_id").unique(),
  status: text("status").notNull().default("creating"),
  paidAt: integer("paid_at"),
  updated: integer("updated").notNull(),
  created: integer("created").notNull(),
});

export const cities = sqliteTable("cities", {
  name: text("name").primaryKey(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
});
export const mobileSessions = sqliteTable("mobile_sessions", {
  accessHash: text("access_hash").primaryKey(),
  refreshHash: text("refresh_hash").notNull().unique(),
  owner: text("owner").notNull(),
  accessExpires: integer("access_expires").notNull(),
  refreshExpires: integer("refresh_expires").notNull(),
  family: text("family").notNull(),
});
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  kind: text("kind").notNull(),
  entity: text("entity"),
  created: integer("created").notNull(),
  readAt: integer("read_at"),
});
export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  reporter: text("reporter").notNull(),
  kind: text("kind").notNull(),
  target: text("target").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  created: integer("created").notNull(),
});
export const changeVersion = sqliteTable("change_version", {
  id: integer("id").primaryKey(),
  version: integer("version").notNull().default(0),
});
export const deletionJobs = sqliteTable("deletion_jobs", {
  key: text("key").primaryKey(),
  created: integer("created").notNull(),
});

export const passwordResets = sqliteTable("password_resets", {token:text("token").primaryKey(),phone:text("phone").notNull(),expires:integer("expires").notNull()});
export const qualityClaims = sqliteTable("quality_claims", {id:text("id").primaryKey(),orderId:text("order_id").notNull().unique(),owner:text("owner").notNull(),reason:text("reason").notNull(),status:text("status").notNull().default("pending"),reply:text("reply").notNull().default(""),created:integer("created").notNull(),updated:integer("updated").notNull()});

export const partnerBusinesses=sqliteTable("partner_businesses",{id:text("id").primaryKey(),owner:text("owner").unique(),name:text("name").notNull(),contact:text("contact").notNull(),address:text("address").notNull(),rateBps:integer("rate_bps").notNull(),enabled:integer("enabled").notNull().default(1),created:integer("created").notNull(),updated:integer("updated").notNull()});
export const partnerLedger=sqliteTable("partner_ledger",{id:text("id").primaryKey(),partnerId:text("partner_id").notNull().references(()=>partnerBusinesses.id),kind:text("kind").notNull(),amount:integer("amount").notNull(),orderId:text("order_id"),actor:text("actor"),reference:text("reference").notNull().default(""),created:integer("created").notNull()});
export const adminEvents=sqliteTable("admin_events",{id:text("id").primaryKey(),actor:text("actor").notNull(),target:text("target").notNull(),action:text("action").notNull(),note:text("note").notNull(),created:integer("created").notNull()});
export const refundRecords=sqliteTable("refund_records",{orderId:text("order_id").primaryKey().references(()=>orders.id),amount:integer("amount").notNull(),actor:text("actor").notNull(),reference:text("reference").notNull(),created:integer("created").notNull()});

export const reminderPreferences=sqliteTable("reminder_preferences",{owner:text("owner").primaryKey(),sms:integer("sms").notNull().default(0),updated:integer("updated").notNull()});
export const reminderDeliveries=sqliteTable("reminder_deliveries",{orderId:text("order_id").primaryKey(),state:text("state").notNull(),providerId:text("provider_id"),error:text("error"),created:integer("created").notNull(),updated:integer("updated").notNull()});
