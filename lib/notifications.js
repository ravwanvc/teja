export async function pickupReminders(db, now = Date.now()) {
  await db
    .prepare(
      "INSERT OR IGNORE INTO notifications(id,owner,kind,entity,created) SELECT lower(hex(randomblob(16))),buyer,'pickup_soon',id,? FROM orders WHERE status='reserved' AND pickup_at>? AND pickup_at<=?",
    )
    .bind(now, now, now + 1800000)
    .run();
}
// Transport boundary: a future FCM/APNs adapter must not change durable inbox writes.
export const mockPush = (notification) => ({ channel: "mock", notification });
