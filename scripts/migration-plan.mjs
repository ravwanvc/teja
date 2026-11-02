// Pure planner: decides how to bring a local D1 database up to date WITHOUT
// replaying SQL that already ran. No I/O here, so it is unit-tested directly.
//
// Fingerprints list what each Drizzle migration leaves behind in the schema.
// Keyed by the numeric prefix of the migration file name.
export const FINGERPRINTS = {
  '0000': { tables: ['geo', 'orders', 'products', 'users'] },
  '0001': { tables: ['receipt_counters'], columns: { orders: ['payment_state', 'transaction_id', 'hold_until'] } },
  '0002': { tables: ['favorites', 'reviews', 'stock_events'], columns: { users: ['verified', 'business_contact'] } },
  '0003': { tables: ['demo_wallet', 'image_checks'], columns: { products: ['image_status', 'image_note'] } },
  '0004': { tables: ['app_accounts', 'app_admin', 'app_sessions', 'auth_limits', 'phone_otps'] },
  '0005': { tables: ['payment_transactions', 'saved_cards'] },
  '0006': { tables: ['listing_drafts'] },
  '0008': { tables: ['cities','mobile_sessions','notifications','reports','change_version','deletion_jobs'], columns: {orders:['is_mock','mock_method'],phone_otps:['sent_at'],products:['city','images']} },
  '0009': { tables: ['password_resets','shop_follows','waitlist','quality_claims'], columns: {users:['avatar'],orders:['cart_items']} },
  '0010': { tables: ['partner_businesses','partner_ledger','admin_events','refund_records','reminder_preferences','reminder_deliveries'], columns: {users:['selling_paused'],products:['prepared_at','best_before'],orders:['partner_id','commission_rate','commission_due']} },
  '0007': { tables: ['card_charges'] },
};

const hasColumn = (sqlText, col) => new RegExp('[`"\\[\\s(,]' + col + '[`"\\]\\s,)]').test(sqlText || '');

// tables: Map<name, createSql>; applied: Set<string> | null (null = no d1_migrations table)
export function fingerprintState(file, tables) {
  const fp = FINGERPRINTS[file.slice(0, 4)];
  if (!fp) return 'unknown';
  const checks = [
    ...fp.tables.map((t) => tables.has(t)),
    ...Object.entries(fp.columns || {}).flatMap(([t, cols]) => cols.map((c) => tables.has(t) && hasColumn(tables.get(t), c))),
  ];
  if (checks.every(Boolean)) return 'present';
  if (checks.every((v) => !v)) return 'absent';
  return 'partial';
}

export function planMigrations(files, tables, applied) {
  const recorded = applied ?? new Set();
  const baseline = [];
  const pending = [];
  const problems = [];
  let gap = null;
  for (const file of files) {
    const state = fingerprintState(file, tables);
    if (recorded.has(file)) {
      if (state === 'absent' || state === 'partial') problems.push(`${file} is recorded as applied but its schema objects are ${state}.`);
      continue;
    }
    if (state === 'present' && gap === null) { baseline.push(file); continue; }
    if (state === 'present') problems.push(`${file} already exists in the database but earlier migration ${gap} does not.`);
    else if (state === 'partial') problems.push(`${file} is only partly present in the database (interrupted or hand-edited).`);
    else if (state === 'unknown') { pending.push(file); gap ??= file; }
    else { pending.push(file); gap ??= file; }
  }
  const extra = [...recorded].filter((n) => !files.includes(n));
  if (extra.length) problems.push(`Database records migrations that are not in drizzle/: ${extra.join(', ')}.`);
  if (problems.length) return { action: 'refuse', baseline: [], pending: [], problems };
  if (!baseline.length && !pending.length) return { action: 'noop', baseline, pending, problems };
  return { action: baseline.length ? 'baseline-then-apply' : 'apply', baseline, pending, problems };
}
